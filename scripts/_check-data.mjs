import mysql from 'mysql2/promise'
import { readFileSync } from 'fs'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(import.meta.dirname, '..', '.env') })

async function main() {
  const ssl = process.env.MYSQL_SSL === 'true' && process.env.MYSQL_CA_PATH
    ? { ca: readFileSync(process.env.MYSQL_CA_PATH) }
    : undefined
  const c = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl,
  })

  const [biz] = await c.execute('SELECT COUNT(*) AS count FROM businesses WHERE deleted = 0')
  console.log('Businesses (not deleted):', biz[0].count)

  const [allBiz] = await c.execute('SELECT COUNT(*) AS count FROM businesses')
  console.log('Total businesses:', allBiz[0].count)

  const [vac] = await c.execute('SELECT COUNT(*) AS count FROM vacancies WHERE closed = 0')
  console.log('Vacancies (not closed):', vac[0].count)

  const [allVac] = await c.execute('SELECT COUNT(*) AS count FROM vacancies')
  console.log('Total vacancies:', allVac[0].count)

  const [users] = await c.execute('SELECT COUNT(*) AS count FROM users WHERE deleted = 0')
  console.log('Users (not deleted):', users[0].count)

  const [vendors] = await c.execute("SELECT b.businessId, b.businessName, b.deleted FROM businesses b LIMIT 5")
  console.log('\nSample businesses:')
  vendors.forEach(v => console.log(' ', v.businessId, v.businessName, 'deleted:', v.deleted))

  await c.end()
}
main().catch(console.error)
