import fs from 'fs'
import mysql from 'mysql2/promise'
import { ensureIndexes } from './indexes'

export type SqlValue = string | number | boolean | Date | null | Buffer

const sslMode = process.env.MYSQL_SSL || ''
let sslConfig: mysql.ConnectionOptions = {}
if (sslMode === 'skip-verify') {
  sslConfig = { ssl: { rejectUnauthorized: false } }
} else if (sslMode === 'true') {
  const caPath = process.env.MYSQL_CA_PATH
  if (caPath && fs.existsSync(caPath)) {
    sslConfig = { ssl: { ca: fs.readFileSync(caPath).toString() } }
  } else {
    sslConfig = { ssl: { rejectUnauthorized: true } }
  }
}

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ...sslConfig,
})

let indexTask: Promise<void> | null = null

async function ensureDbInit(): Promise<void> {
  if (!indexTask) {
    indexTask = ensureIndexes().catch((err) => {
      console.error('[DB INIT] Index creation failed:', err)
    })
  }
  await indexTask
}

function slowQueryLog(sql: string, durationMs: number): void {
  if (durationMs > 200) {
    console.warn(`[SLOW QUERY] ${durationMs}ms: ${sql.substring(0, 120)}`)
  }
}

export async function query<T extends mysql.RowDataPacket[]>(
  sql: string,
  params?: SqlValue[]
): Promise<T> {
  await ensureDbInit()
  const start = Date.now()
  const [rows] = await pool.execute<T>(sql, params as mysql.ExecuteValues)
  slowQueryLog(sql, Date.now() - start)
  return rows
}

export async function queryOne<T extends mysql.RowDataPacket[]>(
  sql: string,
  params?: SqlValue[]
): Promise<T[number] | null> {
  const rows = await query<T>(sql, params)
  return rows.length > 0 ? rows[0] : null
}

export async function execute(
  sql: string,
  params?: SqlValue[]
): Promise<mysql.ResultSetHeader> {
  await ensureDbInit()
  const start = Date.now()
  const [result] = await pool.execute<mysql.ResultSetHeader>(sql, params as mysql.ExecuteValues)
  slowQueryLog(sql, Date.now() - start)
  return result
}

export async function getConnection(): Promise<mysql.PoolConnection> {
  await ensureDbInit()
  return pool.getConnection()
}

export default pool

// ─── Graceful shutdown ────────────────────────────────────
let shuttingDown = false
function shutdown(): void {
  if (shuttingDown) return
  shuttingDown = true
  console.log('[DB] Shutting down connection pool...')
  pool.end().catch((err: Error) => {
    if ((err as Error & { code?: string }).code === 'ECONNRESET') return
    console.warn('[DB] Pool shutdown warn:', err.message)
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
