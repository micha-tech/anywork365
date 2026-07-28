import { createHash, randomUUID } from 'crypto'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getConnection } from '@/lib/db'
import type { AccountSpec } from './account-types'
import { FinancialError } from './errors'
import { minorFromDatabase, type MinorAmount } from './money-value'
import { assertBalancedJournal } from './ledger-invariants'

export type FinancialAccountRow = RowDataPacket & {
  id: number
  balance_kobo: string | number
  currency: string
  allow_negative: number
}

type TransactionRow = RowDataPacket & {
  id: number
  reference: string
  idempotency_key: string
  metadata: string | Record<string, unknown> | null
}

export type LedgerEntryInput = {
  account: AccountSpec
  deltaMinor: MinorAmount
  metadata?: Record<string, unknown>
}

export type LedgerActor = {
  type: 'system' | 'user' | 'admin' | 'provider' | 'worker'
  id: string
}

export type PostLedgerTransactionInput = {
  reference?: string
  idempotencyKey: string
  transactionType: string
  amountMinor: MinorAmount
  bookingId?: number
  userUid?: string
  externalReference?: string
  description: string
  entries: LedgerEntryInput[]
  metadata?: Record<string, unknown>
  actor: LedgerActor
  outbox?: {
    eventType: string
    aggregateType: string
    aggregateId: string
    payload: Record<string, unknown>
  }
}

export type PostedLedgerTransaction = {
  id: number
  reference: string
  idempotentReplay: boolean
}

export class LedgerService {
  async post(input: PostLedgerTransactionInput): Promise<PostedLedgerTransaction> {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()
      const result = await this.postInTransaction(conn, input)
      await conn.commit()
      return result
    } catch (error) {
      await conn.rollback().catch(() => undefined)
      throw error
    } finally {
      conn.release()
    }
  }

  async postInTransaction(
    conn: PoolConnection,
    input: PostLedgerTransactionInput
  ): Promise<PostedLedgerTransaction> {
    validatePostingInput(input)

    const [existing] = await conn.execute<TransactionRow[]>(
      `SELECT id, reference, idempotency_key, metadata
       FROM money_transactions WHERE idempotency_key = ? FOR UPDATE`,
      [input.idempotencyKey]
    )
    if (existing[0]) {
      const expectedHash = postingRequestHash(input)
      const metadata = parseMetadata(existing[0].metadata)
      if (metadata.requestHash !== expectedHash) {
        throw new FinancialError(
          'IDEMPOTENCY_CONFLICT',
          'The idempotency key was already used for a different financial request',
          409
        )
      }
      return { id: existing[0].id, reference: existing[0].reference, idempotentReplay: true }
    }

    const consolidated = consolidateEntries(input.entries)
    const resolved = await Promise.all(
      consolidated.map(async (entry) => ({
        ...entry,
        row: await this.ensureAccountInTransaction(conn, entry.account),
      }))
    )

    const sortedIds = [...new Set(resolved.map(({ row }) => Number(row.id)))].sort((a, b) => a - b)
    if (sortedIds.length < 2) {
      throw new FinancialError('LEDGER_UNBALANCED', 'A ledger transaction requires at least two accounts')
    }

    const placeholders = sortedIds.map(() => '?').join(',')
    const [lockedRows] = await conn.execute<FinancialAccountRow[]>(
      `SELECT ma.id, ma.balance_kobo, ma.currency, map.allow_negative
       FROM money_accounts ma
       JOIN money_account_policies map ON map.account_id = ma.id
       WHERE ma.id IN (${placeholders})
       ORDER BY ma.id
       FOR UPDATE`,
      sortedIds
    )
    const locked = new Map(lockedRows.map((row) => [Number(row.id), row]))

    for (const entry of resolved) {
      const row = locked.get(Number(entry.row.id))
      if (!row) throw new FinancialError('ACCOUNT_NOT_FOUND', 'Ledger account lock failed')
      if (row.currency !== entry.account.currency) {
        throw new FinancialError('CURRENCY_MISMATCH', 'Ledger account currency mismatch')
      }
      const next = minorFromSignedDatabase(row.balance_kobo) + entry.deltaMinor
      if (!Boolean(row.allow_negative) && next < BigInt(0)) {
        throw new FinancialError('INSUFFICIENT_FUNDS', 'Available balance is insufficient')
      }
    }

    const reference = input.reference ?? makeFinancialReference(input.transactionType)
    const [transactionResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO money_transactions (
         reference, idempotency_key, transaction_type, status, amount_kobo, currency,
         user_uid, booking_id, external_reference, metadata, created_at, updated_at
       ) VALUES (?, ?, ?, 'success', ?, 'NGN', ?, ?, ?, ?, NOW(), NOW())`,
      [
        reference,
        input.idempotencyKey,
        input.transactionType,
        input.amountMinor.toString(),
        input.userUid ?? null,
        input.bookingId ?? null,
        input.externalReference ?? null,
        JSON.stringify({
          description: input.description,
          actor: input.actor,
          requestHash: postingRequestHash(input),
          ...input.metadata,
        }),
      ]
    )
    const transactionId = transactionResult.insertId

    for (const entry of resolved) {
      await conn.execute(
        `INSERT INTO money_entries (transaction_id, account_id, delta_kobo, created_at)
         VALUES (?, ?, ?, NOW())`,
        [transactionId, entry.row.id, entry.deltaMinor.toString()]
      )
      await conn.execute(
        `UPDATE money_accounts
         SET balance_kobo = balance_kobo + ?, updated_at = NOW()
         WHERE id = ?`,
        [entry.deltaMinor.toString(), entry.row.id]
      )
    }

    await conn.execute(
      `INSERT INTO financial_audit_logs (
         actor_type, actor_id, action, resource_type, resource_id,
         internal_reference, details, created_at
       ) VALUES (?, ?, 'ledger.posted', 'ledger_transaction', ?, ?, ?, NOW())`,
      [
        input.actor.type,
        input.actor.id,
        String(transactionId),
        reference,
        JSON.stringify({
          transactionType: input.transactionType,
          amountMinor: input.amountMinor.toString(),
          bookingId: input.bookingId,
          entryCount: resolved.length,
        }),
      ]
    )

    if (input.outbox) {
      await conn.execute(
        `INSERT INTO financial_outbox_events (
           event_key, event_type, aggregate_type, aggregate_id, payload, status, available_at
         ) VALUES (?, ?, ?, ?, ?, 'pending', NOW())
         ON DUPLICATE KEY UPDATE event_key = event_key`,
        [
          `${input.idempotencyKey}:${input.outbox.eventType}`.slice(0, 190),
          input.outbox.eventType,
          input.outbox.aggregateType,
          input.outbox.aggregateId,
          JSON.stringify(input.outbox.payload),
        ]
      )
    }

    return { id: transactionId, reference, idempotentReplay: false }
  }

  async balance(account: AccountSpec): Promise<MinorAmount> {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()
      const row = await this.ensureAccountInTransaction(conn, account)
      await conn.commit()
      return minorFromDatabase(row.balance_kobo)
    } catch (error) {
      await conn.rollback().catch(() => undefined)
      throw error
    } finally {
      conn.release()
    }
  }

  async ensureAccountInTransaction(
    conn: PoolConnection,
    account: AccountSpec
  ): Promise<FinancialAccountRow> {
    await conn.execute<ResultSetHeader>(
      `INSERT INTO money_accounts (owner_type, owner_id, purpose, currency, balance_kobo, status)
       VALUES (?, ?, ?, ?, 0, 'active')
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [account.ownerType, account.ownerId, account.accountType, account.currency]
    )
    const [rows] = await conn.execute<FinancialAccountRow[]>(
      `SELECT ma.id, ma.balance_kobo, ma.currency, COALESCE(map.allow_negative, ?) AS allow_negative
       FROM money_accounts ma
       LEFT JOIN money_account_policies map ON map.account_id = ma.id
       WHERE ma.owner_type = ? AND ma.owner_id = ? AND ma.purpose = ? AND ma.currency = ?
       LIMIT 1`,
      [
        account.allowNegative ? 1 : 0,
        account.ownerType,
        account.ownerId,
        account.accountType,
        account.currency,
      ]
    )
    const row = rows[0]
    if (!row) throw new FinancialError('ACCOUNT_NOT_FOUND', 'Approved ledger account could not be created')
    await conn.execute(
      `INSERT INTO money_account_policies (account_id, classification, allow_negative)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         classification = VALUES(classification),
         allow_negative = VALUES(allow_negative)`,
      [row.id, account.classification, account.allowNegative ? 1 : 0]
    )
    return { ...row, allow_negative: account.allowNegative ? 1 : 0 }
  }
}

function validatePostingInput(input: PostLedgerTransactionInput): void {
  if (!input.idempotencyKey || input.idempotencyKey.length > 160) {
    throw new FinancialError('INVALID_IDEMPOTENCY_KEY', 'A valid idempotency key is required')
  }
  if (input.amountMinor <= BigInt(0)) {
    throw new FinancialError('INVALID_AMOUNT', 'Ledger amount must be positive')
  }
  try {
    assertBalancedJournal(
      input.entries.map((entry) => ({
        accountKey: [
          entry.account.ownerType,
          entry.account.ownerId,
          entry.account.accountType,
          entry.account.currency,
        ].join(':'),
        currency: entry.account.currency,
        deltaMinor: entry.deltaMinor,
      }))
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ledger invariant failed'
    const code = message.includes('currenc') ? 'CURRENCY_MISMATCH' : 'LEDGER_UNBALANCED'
    throw new FinancialError(code, message)
  }
}

function consolidateEntries(entries: LedgerEntryInput[]): LedgerEntryInput[] {
  const grouped = new Map<string, LedgerEntryInput>()
  for (const entry of entries) {
    const key = [
      entry.account.ownerType,
      entry.account.ownerId,
      entry.account.accountType,
      entry.account.currency,
    ].join(':')
    const current = grouped.get(key)
    grouped.set(key, {
      account: entry.account,
      deltaMinor: (current?.deltaMinor ?? BigInt(0)) + entry.deltaMinor,
      metadata: entry.metadata,
    })
  }
  return [...grouped.values()].filter((entry) => entry.deltaMinor !== BigInt(0))
}

function minorFromSignedDatabase(value: string | number | bigint): bigint {
  return typeof value === 'bigint' ? value : BigInt(String(value))
}

function makeFinancialReference(prefix: string): string {
  const normalized = prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${normalized}-${randomUUID()}`.slice(0, 50)
}

export function hashFinancialRequest(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex')
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
  return `{${entries.join(',')}}`
}

function postingRequestHash(input: PostLedgerTransactionInput): string {
  return hashFinancialRequest({
    transactionType: input.transactionType,
    amountMinor: input.amountMinor.toString(),
    bookingId: input.bookingId ?? null,
    userUid: input.userUid ?? null,
    externalReference: input.externalReference ?? null,
    entries: input.entries
      .map((entry) => ({
        ownerType: entry.account.ownerType,
        ownerId: entry.account.ownerId,
        accountType: entry.account.accountType,
        currency: entry.account.currency,
        deltaMinor: entry.deltaMinor.toString(),
      }))
      .sort((left, right) =>
        `${left.ownerType}:${left.ownerId}:${left.accountType}`.localeCompare(
          `${right.ownerType}:${right.ownerId}:${right.accountType}`
        )
      ),
  })
}

function parseMetadata(value: string | Record<string, unknown> | null): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return {}
  }
}
