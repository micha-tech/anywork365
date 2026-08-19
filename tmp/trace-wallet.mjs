import 'dotenv/config'
import fs from 'fs'
import mysql from 'mysql2/promise'

const PAYSTACK_BASE = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co'
const SECRET = process.env.PAYSTACK_SECRET_KEY

async function db() {
  let sslConfig = {}
  const mode = process.env.MYSQL_SSL
  if (mode === 'skip-verify') sslConfig = { ssl: { rejectUnauthorized: false } }
  else if (mode === 'true') {
    const caPem = process.env.MYSQL_CA_BASE64 ? Buffer.from(process.env.MYSQL_CA_BASE64, 'base64').toString('utf8') : undefined
    const caPath = process.env.MYSQL_CA_PATH
    if (caPem) sslConfig = { ssl: { ca: caPem, rejectUnauthorized: true } }
    else if (caPath && fs.existsSync(caPath)) sslConfig = { ssl: { ca: fs.readFileSync(caPath).toString() } }
    else sslConfig = { ssl: { rejectUnauthorized: true } }
  }
  return mysql.createConnection({ host: process.env.MYSQL_HOST, port: +process.env.MYSQL_PORT, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, ...sslConfig })
}

async function ps(path) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, { headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' } })
  const json = await res.json()
  if (!res.ok || !json.status) throw new Error(`Paystack ${path}: ${json.message || res.status}`)
  return json
}

const rows = (r) => r[0]

const c = await db()

console.log('===== FUNDING INTENTS (wallet_funding_intents) =====')
const [funds] = await c.query('SELECT * FROM wallet_funding_intents ORDER BY created_at')
for (const f of funds) {
  let psVer = null, psErr = null
  try {
    const v = await ps(`/transaction/verify/${encodeURIComponent(f.provider_reference)}`)
    psVer = v.data
  } catch (e) { psErr = e.message }
  const match = psVer
    ? {
        ps_status: psVer.status,
        ps_amount_kobo: psVer.amount,
        db_amount_kobo: Number(f.charged_amount_kobo),
        amount_match: psVer.amount === Number(f.charged_amount_kobo),
        ps_fees: psVer.fees ?? null,
      }
    : { ps_error: psErr }
  console.log(JSON.stringify({
    internal_reference: f.internal_reference,
    provider_reference: f.provider_reference,
    client_uid: f.client_uid,
    email: f.customer_email,
    status: f.status,
    requested_kobo: Number(f.requested_amount_kobo),
    charged_kobo: Number(f.charged_amount_kobo),
    credited_kobo: Number(f.credited_amount_kobo),
    fee_kobo: Number(f.provider_fee_kobo),
    receipt: f.receipt_number,
    ledger_tx: f.ledger_transaction_id,
    provider_tx_id: f.provider_transaction_id,
    paid_at: f.paid_at,
    confirmed_at: f.confirmed_at,
    ...match,
  }, null, 2))
}

console.log('\n===== LEDGER TRANSACTIONS (money_transactions + money_entries) =====')
const [txs] = await c.query('SELECT * FROM money_transactions ORDER BY created_at')
for (const t of txs) {
  const [entries] = await c.query('SELECT me.account_id, me.delta_kobo, m.purpose, m.owner_type, m.owner_id FROM money_entries me JOIN money_accounts m ON m.id = me.account_id WHERE me.transaction_id = ?', [t.id])
  console.log(JSON.stringify({
    id: t.id, reference: t.reference, idempotency_key: t.idempotency_key,
    transaction_type: t.transaction_type, status: t.status, amount_kobo: Number(t.amount_kobo),
    user_uid: t.user_uid, booking_id: t.booking_id, external_reference: t.external_reference,
    metadata: t.metadata, created_at: t.created_at,
    entries: entries.map(e => ({ account: e.account_id, purpose: e.purpose, owner_type: e.owner_type, owner_id: e.owner_id, delta_kobo: Number(e.delta_kobo) })),
  }, null, 2))
}

console.log('\n===== ACCOUNT BALANCES (money_accounts) =====')
const [acts] = await c.query('SELECT a.id, a.owner_type, a.owner_id, a.purpose, a.currency, a.balance_kobo, a.status, p.classification FROM money_accounts a LEFT JOIN money_account_policies p ON p.account_id = a.id ORDER BY a.purpose')
for (const a of acts) console.log(JSON.stringify({ id: a.id, owner_type: a.owner_type, owner_id: a.owner_id, purpose: a.purpose, currency: a.currency, balance_kobo: Number(a.balance_kobo), status: a.status, classification: a.classification ?? null }))

console.log('\n===== JOB FUNDS (job_funds) =====')
const [jfs] = await c.query('SELECT * FROM job_funds ORDER BY created_at')
for (const j of jfs) console.log(JSON.stringify({ booking_id: j.booking_id, client_uid: j.client_uid, artisan_uid: j.artisan_uid, status: j.status, expected_kobo: Number(j.expected_amount_kobo), funded: Number(j.funded_amount_kobo), locked: Number(j.locked_amount_kobo), released: Number(j.released_amount_kobo), refunded: Number(j.refunded_amount_kobo), platform_fee_kobo: Number(j.platform_fee_kobo), funded_tx: j.funded_transaction_id, release_tx: j.release_transaction_id, created_at: j.created_at }))

console.log('\n===== WITHDRAWALS (marketplace_withdrawal_requests) =====')
const [wds] = await c.query('SELECT * FROM marketplace_withdrawal_requests ORDER BY created_at')
for (const w of wds) {
  let psVer = null, psErr = null
  if (w.provider_reference) {
    try {
      const v = await ps(`/transfer/verify/${encodeURIComponent(w.provider_reference)}`)
      psVer = v.data
    } catch (e) { psErr = e.message }
  }
  console.log(JSON.stringify({
    internal_reference: w.internal_reference, provider_reference: w.provider_reference, artisan_uid: w.artisan_uid,
    amount_kobo: Number(w.amount_kobo), fee_kobo: Number(w.fee_kobo), net_kobo: Number(w.net_amount_kobo),
    status: w.status, risk_status: w.risk_status, recipient_id: w.recipient_id,
    reserve_tx: w.reserve_transaction_id, terminal_tx: w.terminal_transaction_id,
    failure_reason: w.failure_reason, requested_at: w.requested_at, completed_at: w.completed_at,
    ps: psVer ? { status: psVer.status, amount_kobo: psVer.amount, currency: psVer.currency, recipient: psVer.recipient?.details ?? null, transfer_code: psVer.transfer_code, created_at: psVer.created_at } : { ps_error: psErr },
  }, null, 2))
}

console.log('\n===== PAYMENT INTENTS (marketplace_payment_intents) =====')
const [pis] = await c.query('SELECT * FROM marketplace_payment_intents ORDER BY created_at')
for (const p of pis) console.log(JSON.stringify({ internal_reference: p.internal_reference, provider_reference: p.provider_reference, booking_id: p.booking_id, job_fund_id: p.job_fund_id, client_uid: p.client_uid, purpose: p.purpose, status: p.status, amount_kobo: Number(p.amount_kobo), provider_tx_id: p.provider_transaction_id, failure_reason: p.failure_reason, created_at: p.created_at }))

console.log('\n===== EARNINGS HOLDS / REFUNDS / DISPUTES =====')
const [ehs] = await c.query('SELECT * FROM earnings_holds ORDER BY created_at')
for (const e of ehs) console.log('earnings_hold', JSON.stringify({ job_fund_id: e.job_fund_id, artisan_uid: e.artisan_uid, amount_kobo: Number(e.amount_kobo), status: e.status, reason: e.reason, release_after: e.release_after, release_tx: e.release_transaction_id }))
const [refunds] = await c.query('SELECT * FROM refund_requests ORDER BY created_at')
for (const r of refunds) {
  let psVer = null, psErr = null
  if (r.provider_reference) { try { const v = await ps(`/refund/${r.provider_reference}`); psVer = v.data } catch (e) { psErr = e.message } }
  console.log('refund', JSON.stringify({ internal_ref: r.internal_reference, provider_ref: r.provider_reference, status: r.status, amount_kobo: Number(r.amount_kobo), reason: r.reason, ps: psVer ? { status: psVer.status, amount_kobo: psVer.amount, transaction_id: psVer.transaction?.id ?? null } : { ps_error: psErr } }))
}
const [disputes] = await c.query('SELECT * FROM financial_disputes ORDER BY created_at')
for (const d of disputes) console.log('dispute', JSON.stringify({ id: d.id, booking_id: d.booking_id, status: d.status, amount_kobo: Number(d.amount_kobo), reason: d.reason ?? null }))

console.log('\n===== LEGACY TABLES (wallets, wallet_ledger, wallet_transactions, withdrawals) =====')
for (const [name, sql] of Object.entries({
  wallets: 'SELECT * FROM wallets ORDER BY created_at',
  wallet_ledger: 'SELECT * FROM wallet_ledger ORDER BY created_at',
  wallet_transactions: 'SELECT * FROM wallet_transactions ORDER BY created_at',
  withdrawals: 'SELECT * FROM withdrawals ORDER BY created_at',
})) {
  try {
    const [r] = await c.query(sql)
    console.log(name, 'count=', r.length)
    for (const x of r) console.log(JSON.stringify(x))
  } catch (e) { console.log(name, 'ERR', e.message) }
}

await c.end()