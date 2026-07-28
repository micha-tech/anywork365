import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { FinancialError } from './errors'
import { hashFinancialRequest } from './ledger-service'

type IdempotencyRow = RowDataPacket & {
  id: number
  request_hash: string
  status: 'processing' | 'completed' | 'failed'
  response_payload: string | Record<string, unknown> | null
  resource_type: string | null
  resource_id: string | null
}

export async function claimFinancialIdempotency(
  conn: PoolConnection,
  input: {
    key: string
    operation: string
    actorId: string
    request: unknown
  }
): Promise<{ replay: boolean; row: IdempotencyRow }> {
  if (!input.key || input.key.length > 190) {
    throw new FinancialError('INVALID_IDEMPOTENCY_KEY', 'A valid idempotency key is required')
  }
  const requestHash = hashFinancialRequest(input.request)
  await conn.execute(
    `INSERT IGNORE INTO financial_idempotency_records (
       idempotency_key, operation, actor_id, request_hash, status, expires_at
     ) VALUES (?, ?, ?, ?, 'processing', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [input.key, input.operation, input.actorId, requestHash]
  )
  const [rows] = await conn.execute<IdempotencyRow[]>(
    `SELECT id, request_hash, status, response_payload, resource_type, resource_id
     FROM financial_idempotency_records WHERE idempotency_key = ? FOR UPDATE`,
    [input.key]
  )
  const row = rows[0]
  if (!row) throw new FinancialError('NOT_FOUND', 'Idempotency record could not be created')
  if (row.request_hash !== requestHash) {
    throw new FinancialError(
      'IDEMPOTENCY_CONFLICT',
      'The idempotency key was already used for a different request',
      409
    )
  }
  return { replay: row.status === 'completed', row }
}

export async function completeFinancialIdempotency(
  conn: PoolConnection,
  input: {
    id: number
    resourceType: string
    resourceId: string
    response: Record<string, unknown>
  }
): Promise<void> {
  await conn.execute(
    `UPDATE financial_idempotency_records
     SET status = 'completed', resource_type = ?, resource_id = ?,
         response_payload = ?, updated_at = NOW()
     WHERE id = ?`,
    [input.resourceType, input.resourceId, JSON.stringify(input.response), input.id]
  )
}
