import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import mysql from 'mysql2/promise'
import { config } from 'dotenv'

config({ path: ['.env.local', '.env.production', '.env'], quiet: true })

test('concurrent reservations cannot overdraw a locked balance', async (context) => {
  const database = process.env.FINANCIAL_TEST_DATABASE
  if (!database) {
    context.skip('FINANCIAL_TEST_DATABASE is not configured')
    return
  }
  if (database === process.env.MYSQL_DATABASE) {
    throw new Error('FINANCIAL_TEST_DATABASE must not be the application database')
  }
  const ssl =
    process.env.MYSQL_SSL === 'skip-verify'
      ? { rejectUnauthorized: false }
      : process.env.MYSQL_SSL === 'true'
        ? process.env.MYSQL_CA_PATH
          ? { ca: readFileSync(process.env.MYSQL_CA_PATH, 'utf8') }
          : { rejectUnauthorized: true }
        : undefined
  const options = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database,
    ssl,
  }
  const setup = await mysql.createConnection(options)
  const table = `financial_concurrency_${Date.now()}`
  try {
    await setup.query(
      `CREATE TABLE \`${table}\` (
         id INT PRIMARY KEY,
         balance BIGINT NOT NULL,
         CONSTRAINT chk_balance_nonnegative CHECK (balance >= 0)
       ) ENGINE=InnoDB`
    )
    await setup.execute(`INSERT INTO \`${table}\` (id, balance) VALUES (1, 10000)`)
    const reserve = async () => {
      const conn = await mysql.createConnection(options)
      try {
        await conn.beginTransaction()
        const [rows] = await conn.execute<mysql.RowDataPacket[]>(
          `SELECT balance FROM \`${table}\` WHERE id = 1 FOR UPDATE`
        )
        const balance = Number(rows[0]?.balance || 0)
        if (balance < 8_000) {
          await conn.rollback()
          return false
        }
        await conn.execute(`UPDATE \`${table}\` SET balance = balance - 8000 WHERE id = 1`)
        await conn.commit()
        return true
      } finally {
        await conn.end()
      }
    }
    const results = await Promise.all([reserve(), reserve()])
    assert.equal(results.filter(Boolean).length, 1)
    const [final] = await setup.execute<mysql.RowDataPacket[]>(
      `SELECT balance FROM \`${table}\` WHERE id = 1`
    )
    assert.equal(Number(final[0]?.balance), 2_000)
  } finally {
    await setup.query(`DROP TABLE IF EXISTS \`${table}\``)
    await setup.end()
  }
})
