import { createHash, randomUUID } from 'crypto'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, getConnection } from '@/lib/db'
import { accounts } from './account-types'
import { getFinancialConfig } from './config'
import { FinancialError } from './errors'
import { LedgerService, type LedgerActor } from './ledger-service'
import { minorFromDatabase, toSafeDatabaseInteger, type MinorAmount } from './money-value'
import { paymentRail } from './paystack-gateway'
import type { PaymentRail, TransferVerificationResult } from './payment-rail'
import {
  claimFinancialIdempotency,
  completeFinancialIdempotency,
} from './idempotency-service'

type RecipientRow = RowDataPacket & {
  id: number
  user_uid: string
  provider_recipient_code: string
  bank_code: string
  bank_name: string
  account_number_last_four: string
  account_name: string
  verification_status: string
  ownership_status: string
  status: string
  created_at: Date
  updated_at: Date
}

type WithdrawalRow = RowDataPacket & {
  id: number
  artisan_uid: string
  recipient_id: number
  internal_reference: string
  provider_reference: string | null
  amount_kobo: string | number
  net_amount_kobo: string | number
  currency: string
  status: string
  risk_status: string
  submission_attempts: number
}

const ledger = new LedgerService()

export async function saveVerifiedTransferRecipient(input: {
  userUid: string
  providerRecipientCode: string
  bankCode: string
  bankName: string
  accountNumberLastFour: string
  accountName: string
  ownershipStatus: 'matched' | 'manual_review'
  actor: LedgerActor
}): Promise<{ id: number }> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [pending] = await conn.execute<(RowDataPacket & { count: number })[]>(
      `SELECT COUNT(*) AS count
       FROM marketplace_withdrawal_requests
       WHERE artisan_uid = ? AND status IN ('requested','under_review','approved','processing')
       FOR UPDATE`,
      [input.userUid]
    )
    if (Number(pending[0]?.count ?? 0) > 0) {
      throw new FinancialError(
        'INVALID_STATE',
        'Bank details cannot change while a withdrawal is pending',
        409
      )
    }
    await conn.execute(
      `UPDATE transfer_recipients
       SET status = 'disabled', is_default = 0, updated_at = NOW()
       WHERE user_uid = ? AND status = 'active'`,
      [input.userUid]
    )
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO transfer_recipients (
         user_uid, provider, provider_recipient_code, bank_code, bank_name,
         account_number_last_four, account_name, verification_status,
         ownership_status, is_default, status, verified_at
       ) VALUES (?, 'paystack', ?, ?, ?, ?, ?, 'verified', ?, 1, 'active', NOW())
       ON DUPLICATE KEY UPDATE
         user_uid = VALUES(user_uid), bank_code = VALUES(bank_code),
         bank_name = VALUES(bank_name), account_number_last_four = VALUES(account_number_last_four),
         account_name = VALUES(account_name), verification_status = 'verified',
         ownership_status = VALUES(ownership_status), is_default = 1,
         status = 'active', verified_at = NOW(), updated_at = NOW(),
         id = LAST_INSERT_ID(id)`,
      [
        input.userUid,
        input.providerRecipientCode,
        input.bankCode,
        input.bankName,
        input.accountNumberLastFour,
        input.accountName,
        input.ownershipStatus,
      ]
    )
    await audit(conn, input.actor, 'transfer_recipient.changed', 'transfer_recipient', String(result.insertId), {
      bankCode: input.bankCode,
      bankName: input.bankName,
      accountLastFour: input.accountNumberLastFour,
      ownershipStatus: input.ownershipStatus,
    })
    await conn.commit()
    return { id: result.insertId }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export async function disableTransferRecipients(userUid: string, actor: LedgerActor): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [pending] = await conn.execute<(RowDataPacket & { count: number })[]>(
      `SELECT COUNT(*) AS count FROM marketplace_withdrawal_requests
       WHERE artisan_uid = ? AND status IN ('requested','under_review','approved','processing')
       FOR UPDATE`,
      [userUid]
    )
    if (Number(pending[0]?.count ?? 0) > 0) {
      throw new FinancialError(
        'INVALID_STATE',
        'Bank details cannot change while a withdrawal is pending',
        409
      )
    }
    await conn.execute(
      `UPDATE transfer_recipients
       SET status = 'disabled', is_default = 0, updated_at = NOW()
       WHERE user_uid = ? AND status = 'active'`,
      [userUid]
    )
    await audit(conn, actor, 'transfer_recipient.disabled', 'user', userUid, {})
    await conn.commit()
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export async function requestMarketplaceWithdrawal(input: {
  artisanUid: string
  amountMinor: MinorAmount
  idempotencyKey: string
  actor: LedgerActor
}): Promise<{
  reference: string
  status: string
  created: boolean
  recipient: { bankName: string; accountLastFour: string }
}> {
  const config = getFinancialConfig()
  enforceConfiguredAmountLimits(input.amountMinor)
  const durableIdempotencyKey = `withdrawal:${createHash('sha256')
    .update(`${input.artisanUid}:${input.idempotencyKey}`)
    .digest('hex')}`
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const idempotency = await claimFinancialIdempotency(conn, {
      key: durableIdempotencyKey,
      operation: 'request_marketplace_withdrawal',
      actorId: input.artisanUid,
      request: {
        artisanUid: input.artisanUid,
        amountMinor: input.amountMinor.toString(),
        currency: 'NGN',
      },
    })
    const [existing] = await conn.execute<WithdrawalRow[]>(
      `SELECT mw.* FROM marketplace_withdrawal_requests mw
       JOIN money_transactions mt ON mt.id = mw.reserve_transaction_id
       WHERE mt.idempotency_key = ? LIMIT 1 FOR UPDATE`,
      [durableIdempotencyKey]
    )
    if (existing[0]) {
      const recipient = await recipientById(conn, existing[0].recipient_id)
      await completeFinancialIdempotency(conn, {
        id: idempotency.row.id,
        resourceType: 'withdrawal',
        resourceId: String(existing[0].id),
        response: {
          reference: existing[0].internal_reference,
          status: existing[0].status,
        },
      })
      await conn.commit()
      return {
        reference: existing[0].internal_reference,
        status: existing[0].status,
        created: false,
        recipient: {
          bankName: recipient.bank_name,
          accountLastFour: recipient.account_number_last_four,
        },
      }
    }

    const recipient = await activeRecipient(conn, input.artisanUid)
    if (
      recipient.verification_status !== 'verified' ||
      recipient.ownership_status !== 'matched'
    ) {
      throw new FinancialError('RISK_REVIEW_REQUIRED', 'Bank recipient requires review', 403)
    }
    const ageMs = Date.now() - new Date(recipient.updated_at).getTime()
    if (ageMs < config.BANK_CHANGE_HOLD_HOURS * 60 * 60 * 1000) {
      throw new FinancialError(
        'RISK_REVIEW_REQUIRED',
        `Withdrawals are held for ${config.BANK_CHANGE_HOLD_HOURS} hours after bank changes`,
        403
      )
    }

    await enforceWithdrawalVelocity(conn, input.artisanUid, input.amountMinor)
    const [holds] = await conn.execute<(RowDataPacket & { count: number })[]>(
      `SELECT COUNT(*) AS count FROM risk_holds
       WHERE user_uid = ? AND status = 'active' FOR UPDATE`,
      [input.artisanUid]
    )
    if (Number(holds[0]?.count ?? 0) > 0) {
      throw new FinancialError('RISK_HOLD_ACTIVE', 'Withdrawals are unavailable during an active risk hold', 403)
    }

    const riskReview =
      config.WITHDRAWAL_MODE === 'MANUAL' ||
      (config.WITHDRAWAL_MODE === 'RISK_BASED' &&
        input.amountMinor > BigInt(config.AUTOMATIC_WITHDRAWAL_LIMIT) * BigInt(100))
    const status = riskReview ? 'under_review' : 'approved'
    const riskStatus = riskReview ? 'review' : 'passed'
    const reference = financialReference('withdrawal')
    const posted = await ledger.postInTransaction(conn, {
      idempotencyKey: durableIdempotencyKey,
      transactionType: 'withdrawal_reserved',
      amountMinor: input.amountMinor,
      userUid: input.artisanUid,
      description: 'Artisan withdrawal reserved for provider submission',
      actor: input.actor,
      entries: [
        { account: accounts.artisanAvailableEarnings(input.artisanUid), deltaMinor: -input.amountMinor },
        { account: accounts.artisanWithdrawalPending(input.artisanUid), deltaMinor: input.amountMinor },
      ],
      metadata: { recipientId: recipient.id },
      outbox: {
        eventType: 'withdrawal.requested',
        aggregateType: 'withdrawal',
        aggregateId: reference,
        payload: { artisanUid: input.artisanUid, amountMinor: input.amountMinor.toString() },
      },
    })
    const [withdrawalResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO marketplace_withdrawal_requests (
         artisan_uid, recipient_id, internal_reference, amount_kobo, fee_kobo,
         net_amount_kobo, currency, status, risk_status, reserve_transaction_id,
         approved_at
       ) VALUES (?, ?, ?, ?, 0, ?, 'NGN', ?, ?, ?, ?)`,
      [
        input.artisanUid,
        recipient.id,
        reference,
        input.amountMinor.toString(),
        input.amountMinor.toString(),
        status,
        riskStatus,
        posted.id,
        status === 'approved' ? new Date() : null,
      ]
    )
    await completeFinancialIdempotency(conn, {
      id: idempotency.row.id,
      resourceType: 'withdrawal',
      resourceId: String(withdrawalResult.insertId),
      response: { reference, status },
    })
    await conn.commit()
    return {
      reference,
      status,
      created: true,
      recipient: {
        bankName: recipient.bank_name,
        accountLastFour: recipient.account_number_last_four,
      },
    }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export async function approveMarketplaceWithdrawal(
  reference: string,
  actor: LedgerActor,
  reason: string
): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<WithdrawalRow[]>(
      'SELECT * FROM marketplace_withdrawal_requests WHERE internal_reference = ? FOR UPDATE',
      [reference]
    )
    const withdrawal = rows[0]
    if (!withdrawal) throw new FinancialError('NOT_FOUND', 'Withdrawal was not found', 404)
    if (withdrawal.status === 'approved') {
      await conn.commit()
      return
    }
    if (!['requested', 'under_review', 'failed'].includes(withdrawal.status)) {
      throw new FinancialError('INVALID_STATE', `Withdrawal cannot be approved from ${withdrawal.status}`, 409)
    }
    await conn.execute(
      `UPDATE marketplace_withdrawal_requests
       SET status = 'approved', risk_status = 'passed', approved_at = NOW(),
           failure_reason = NULL, updated_at = NOW()
       WHERE id = ?`,
      [withdrawal.id]
    )
    await audit(conn, actor, 'withdrawal.approved', 'withdrawal', String(withdrawal.id), {
      reference,
      reason,
    })
    await conn.commit()
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export async function submitMarketplaceWithdrawal(
  reference: string,
  actor: LedgerActor,
  rail: PaymentRail = paymentRail
): Promise<{ status: string; transferCode: string | null }> {
  const claimed = await claimWithdrawalForSubmission(reference, actor)
  if (!claimed.created) {
    return { status: claimed.withdrawal.status, transferCode: claimed.withdrawal.provider_reference }
  }
  try {
    const transfer = await rail.initiateTransfer({
      amountMinor: toSafeDatabaseInteger(minorFromDatabase(claimed.withdrawal.net_amount_kobo)),
      recipientCode: claimed.recipient.provider_recipient_code,
      reference: claimed.withdrawal.internal_reference,
      reason: 'Anywork365 marketplace earnings withdrawal',
      currency: 'NGN',
    })
    await execute(
      `UPDATE marketplace_withdrawal_requests
       SET provider_reference = ?, status = 'processing', processing_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND status = 'processing'`,
      [transfer.transferCode, claimed.withdrawal.id]
    )
    return { status: 'processing', transferCode: transfer.transferCode }
  } catch (error) {
    // An ambiguous provider timeout is never auto-refunded or automatically resubmitted.
    await execute(
      `UPDATE marketplace_withdrawal_requests
       SET status = 'under_review', risk_status = 'review', failure_reason = ?, updated_at = NOW()
       WHERE id = ? AND status = 'processing'`,
      [safeError(error).slice(0, 500), claimed.withdrawal.id]
    )
    return { status: 'under_review', transferCode: null }
  }
}

export async function reconcileMarketplaceWithdrawal(
  reference: string,
  actor: LedgerActor,
  rail: PaymentRail = paymentRail
): Promise<{ status: string; changed: boolean }> {
  const verified = await rail.verifyTransfer(reference)
  validateTransferVerification(verified)
  if (!['succeeded', 'failed', 'reversed'].includes(verified.status)) {
    return { status: verified.status, changed: false }
  }
  return finalizeWithdrawal(reference, verified, actor)
}

async function finalizeWithdrawal(
  reference: string,
  verified: TransferVerificationResult,
  actor: LedgerActor
): Promise<{ status: string; changed: boolean }> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<WithdrawalRow[]>(
      'SELECT * FROM marketplace_withdrawal_requests WHERE internal_reference = ? FOR UPDATE',
      [reference]
    )
    const withdrawal = rows[0]
    if (!withdrawal) throw new FinancialError('NOT_FOUND', 'Withdrawal was not found', 404)
    const terminal = verified.status === 'succeeded' ? 'success' : verified.status
    if (withdrawal.status === terminal) {
      await conn.commit()
      return { status: terminal, changed: false }
    }
    if (!['processing', 'under_review'].includes(withdrawal.status)) {
      throw new FinancialError('INVALID_STATE', `Withdrawal cannot finish from ${withdrawal.status}`, 409)
    }
    const amount = minorFromDatabase(withdrawal.amount_kobo)
    if (amount !== BigInt(verified.amountMinor) || verified.currency !== 'NGN') {
      throw new FinancialError('INVALID_AMOUNT', 'Provider transfer does not match the withdrawal')
    }
    const providerFee = BigInt(verified.providerFeeMinor)
    const succeeded = terminal === 'success'
    const feeEntries =
      providerFee > 0n
        ? [
            { account: accounts.platformPaymentProcessingExpense(), deltaMinor: providerFee },
            { account: accounts.platformPaystackClearing(), deltaMinor: -providerFee },
          ]
        : []
    const posted = await ledger.postInTransaction(conn, {
      idempotencyKey: `withdrawal-terminal:${withdrawal.id}:${terminal}`,
      transactionType: succeeded ? 'withdrawal_succeeded' : 'withdrawal_returned',
      amountMinor: amount,
      userUid: withdrawal.artisan_uid,
      externalReference: verified.transferCode || verified.reference,
      description: succeeded
        ? 'Withdrawal completed by payment provider'
        : 'Failed or reversed withdrawal returned to available earnings',
      actor,
      entries: succeeded
        ? [
            { account: accounts.artisanWithdrawalPending(withdrawal.artisan_uid), deltaMinor: -amount },
            { account: accounts.artisanWithdrawnEarnings(withdrawal.artisan_uid), deltaMinor: amount },
            ...feeEntries,
          ]
        : [
            { account: accounts.artisanWithdrawalPending(withdrawal.artisan_uid), deltaMinor: -amount },
            { account: accounts.artisanAvailableEarnings(withdrawal.artisan_uid), deltaMinor: amount },
            ...feeEntries,
          ],
      metadata: {
        withdrawalId: withdrawal.id,
        providerStatus: verified.status,
        providerFeeMinor: providerFee.toString(),
        feeBearer: 'platform',
      },
      outbox: {
        eventType: succeeded ? 'withdrawal.success' : 'withdrawal.failed',
        aggregateType: 'withdrawal',
        aggregateId: String(withdrawal.id),
        payload: { artisanUid: withdrawal.artisan_uid, amountMinor: amount.toString() },
      },
    })
    await conn.execute(
      `UPDATE marketplace_withdrawal_requests
       SET status = ?, terminal_transaction_id = ?, provider_reference = ?,
           fee_kobo = ?, net_amount_kobo = amount_kobo,
           completed_at = ?, failed_at = ?, reversed_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        terminal,
        posted.id,
        verified.transferCode,
        providerFee.toString(),
        terminal === 'success' ? new Date() : null,
        terminal === 'failed' ? new Date() : null,
        terminal === 'reversed' ? new Date() : null,
        withdrawal.id,
      ]
    )
    await conn.commit()
    return { status: terminal, changed: !posted.idempotentReplay }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

async function claimWithdrawalForSubmission(reference: string, actor: LedgerActor): Promise<{
  withdrawal: WithdrawalRow
  recipient: RecipientRow
  created: boolean
}> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<WithdrawalRow[]>(
      'SELECT * FROM marketplace_withdrawal_requests WHERE internal_reference = ? FOR UPDATE',
      [reference]
    )
    const withdrawal = rows[0]
    if (!withdrawal) throw new FinancialError('NOT_FOUND', 'Withdrawal was not found', 404)
    const recipient = await recipientById(conn, withdrawal.recipient_id)
    if (withdrawal.status !== 'approved') {
      await conn.commit()
      return { withdrawal, recipient, created: false }
    }
    if (withdrawal.submission_attempts > 0) {
      throw new FinancialError(
        'IDEMPOTENCY_CONFLICT',
        'Withdrawal was already submitted or requires reconciliation',
        409
      )
    }
    await conn.execute(
      `UPDATE marketplace_withdrawal_requests
       SET status = 'processing', submission_attempts = submission_attempts + 1,
           submission_token = ?, processing_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [randomUUID(), withdrawal.id]
    )
    await audit(conn, actor, 'withdrawal.submission_started', 'withdrawal', String(withdrawal.id), {
      reference,
    })
    await conn.commit()
    return { withdrawal: { ...withdrawal, status: 'processing' }, recipient, created: true }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

async function activeRecipient(conn: PoolConnection, userUid: string): Promise<RecipientRow> {
  const [rows] = await conn.execute<RecipientRow[]>(
    `SELECT * FROM transfer_recipients
     WHERE user_uid = ? AND status = 'active' AND is_default = 1
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [userUid]
  )
  if (!rows[0]) throw new FinancialError('NOT_FOUND', 'Verified bank recipient was not found', 400)
  return rows[0]
}

async function recipientById(conn: PoolConnection, id: number): Promise<RecipientRow> {
  const [rows] = await conn.execute<RecipientRow[]>(
    'SELECT * FROM transfer_recipients WHERE id = ? FOR UPDATE',
    [id]
  )
  if (!rows[0]) throw new FinancialError('NOT_FOUND', 'Transfer recipient was not found', 404)
  return rows[0]
}

async function enforceWithdrawalVelocity(
  conn: PoolConnection,
  artisanUid: string,
  amount: MinorAmount
): Promise<void> {
  const config = getFinancialConfig()
  const [rows] = await conn.execute<(RowDataPacket & {
    daily: string | number
    monthly: string | number
  })[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN requested_at >= CURRENT_DATE THEN amount_kobo ELSE 0 END), 0) AS daily,
       COALESCE(SUM(CASE WHEN requested_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
                         THEN amount_kobo ELSE 0 END), 0) AS monthly
     FROM marketplace_withdrawal_requests
     WHERE artisan_uid = ? AND status NOT IN ('failed','reversed','cancelled')
     FOR UPDATE`,
    [artisanUid]
  )
  const daily = BigInt(String(rows[0]?.daily ?? 0)) + amount
  const monthly = BigInt(String(rows[0]?.monthly ?? 0)) + amount
  if (daily > BigInt(config.DAILY_WITHDRAWAL_LIMIT) * BigInt(100)) {
    throw new FinancialError('LIMIT_EXCEEDED', 'Daily withdrawal limit exceeded', 400)
  }
  if (monthly > BigInt(config.MONTHLY_WITHDRAWAL_LIMIT) * BigInt(100)) {
    throw new FinancialError('LIMIT_EXCEEDED', 'Monthly withdrawal limit exceeded', 400)
  }
}

function enforceConfiguredAmountLimits(amount: MinorAmount): void {
  const config = getFinancialConfig()
  if (amount < BigInt(config.MINIMUM_WITHDRAWAL_AMOUNT) * BigInt(100)) {
    throw new FinancialError('INVALID_AMOUNT', 'Withdrawal is below the configured minimum')
  }
  if (amount > BigInt(config.MAXIMUM_WITHDRAWAL_AMOUNT) * BigInt(100)) {
    throw new FinancialError('INVALID_AMOUNT', 'Withdrawal exceeds the configured maximum')
  }
}

function validateTransferVerification(verified: TransferVerificationResult): void {
  const config = getFinancialConfig()
  if (verified.environment !== config.PAYSTACK_ENVIRONMENT) {
    throw new FinancialError('PROVIDER_UNAVAILABLE', 'Provider environment mismatch', 502)
  }
  if (verified.currency !== 'NGN') {
    throw new FinancialError('CURRENCY_MISMATCH', 'Provider returned an unexpected currency')
  }
  if (
    !Number.isSafeInteger(verified.providerFeeMinor) ||
    verified.providerFeeMinor < 0
  ) {
    throw new FinancialError('INVALID_AMOUNT', 'Provider returned an invalid transfer fee')
  }
}

async function audit(
  conn: PoolConnection,
  actor: LedgerActor,
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown>
): Promise<void> {
  await conn.execute(
    `INSERT INTO financial_audit_logs (
       actor_type, actor_id, action, resource_type, resource_id, details, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [actor.type, actor.id, action, resourceType, resourceId, JSON.stringify(details)]
  )
}

function financialReference(prefix: string): string {
  return `${prefix}-${randomUUID()}`.slice(0, 50)
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Provider request failed'
}
