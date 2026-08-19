import 'dotenv/config'
import mysql from 'mysql2/promise'

const c = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: +process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  ssl: { rejectUnauthorized: false },
})

const paystackRefs = [
  'wallet-fund-1e079e3d-6f93-4650-b22e-3fec7beab92b',
  'wallet-fund-e3e081fe-894c-4b82-8fe0-9c3f6663d210',
  'wallet-fund-47f09ca0-5aff-42f4-a147-de5a74447900',
  'wallet-fund-6fbf2eff-6dbd-422b-9b50-51a1eb3391fe',
  'wallet-fund-67ca5138-2ea1-4b70-8087-e0a2ec87bb46',
  'wallet-fund-2b733964-7bfd-41e5-b141-3c10127d2cad',
  'wallet-fund-1e687cd2-415a-4d9a-beae-0eb8e5decb28',
  'wallet-fund-63d904dd-4bcc-4a99-ab1c-a043c442d17e',
  'wallet-fund-a3a7dc8e-036e-43c6-be43-42e6825c7f34',
  'wallet-fund-15790006-2883-47a1-9870-74ade50c9d35',
  'wallet-fund-62eae6c5-46cc-4217-b032-e26558b387e5',
  'wallet-fund-2e10570c-9e46-4d34-aed7-66ada044c94e',
  'wallet-fund-37617e7b-df03-4385-8102-96c09f5e1d03',
  'wallet-fund-6021ff94-d4fc-41ff-9192-086d24a4f408',
  'wallet-fund-9b9cce4f-b329-4d46-93d0-1e649153d77e',
  'wallet-fund-87a3ae0c-8f0c-4581-adcc-db6a0607fb79',
  'FUND_1782127328380_T1J6G2',
  'FUND_1782127309577_KQUC17',
  'FUND_1778951314223_0BPFMI',
  'FUND_1778777423686_WNB7JT',
  'FUND_1778670215747_PAGO92',
  'FUND_1778667819450_SSB6CK',
  'FUND_1778665177859_8CBO4S',
  'FUND_1778665155134_7AZO8B',
  'FUND_1778664856430_ZEW5PP',
  'FUND_1778664539930_HO1W3E',
]

// gather all references from DB tables into a set
const tables = [
  ['transactions', 'trans_reference'],
  ['wallet_transactions', 'reference'],
  ['funding_intents', 'reference'],
  ['wallet_deposits', 'reference'],
  ['wallet_balances', 'reference'],
  ['money_transactions', 'reference'],
  ['money_transactions', 'external_reference'],
  ['wallet_funding_intents', 'internal_reference'],
  ['wallet_funding_intents', 'provider_reference'],
  ['provider_events', 'provider_reference'],
  ['payment_webhook_events', 'reference'],
]
const dbRefs = new Set()
for (const [t, col] of tables) {
  try {
    const [rows] = await c.query(`SELECT \`${col}\` AS ref FROM \`${t}\` WHERE \`${col}\` IS NOT NULL`)
    for (const r of rows) dbRefs.add(r.ref)
  } catch (e) { console.log('skip', t, col, e.message) }
}

console.log('=== PAYSTACK REFS NOT FOUND ANYWHERE IN DB ===')
for (const ref of paystackRefs) {
  if (!dbRefs.has(ref)) console.log('MISSING FROM DB:', ref)
}

console.log('\n=== check substring variants (FUND_ prefix) ===')
const fundRefs = paystackRefs.filter(r => r.startsWith('FUND_'))
for (const ref of fundRefs) {
  const key = ref.split('_').slice(0, 3).join('_')
  const hits = [...dbRefs].filter(d => d.includes(key))
  console.log(ref, '->', hits.length ? hits : 'NOT FOUND')
}

await c.end()