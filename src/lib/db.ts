import fs from 'fs'
import mysql from 'mysql2/promise'

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

export async function query<T extends mysql.RowDataPacket[]>(
  sql: string,
  params?: SqlValue[]
): Promise<T> {
  const [rows] = await pool.execute<T>(sql, params as mysql.ExecuteValues)
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
  const [result] = await pool.execute<mysql.ResultSetHeader>(sql, params as mysql.ExecuteValues)
  return result
}

export async function getConnection(): Promise<mysql.PoolConnection> {
  return pool.getConnection()
}

export default pool