import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import type { PaymentRail } from '../src/lib/financial/payment-rail'

config({ path: ['.env.local', '.env.production', '.env'], quiet: true })

const testDatabase = process.env.FINANCIAL_TEST_DATABASE
if (!testDatabase || !/^anywork365_(staging|test)_[a-z0-9_]+$/i.test(testDatabase)) {
  throw new Error('FINANCIAL_TEST_DATABASE must be an isolated anywork365_staging_ or anywork365_test_ database')
}
if (testDatabase === 'defaultdb') throw new Error('Refusing to run wallet verification against production')

process.env.MYSQL_DATABASE = testDatabase
process.env.PAYSTACK_ENVIRONMENT = 'test'
process.env.PAYSTACK_SECRET_KEY = 'sk_test_wallet_verification_only'
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_wallet_verification_only'
process.env.FINANCIAL_WORKER_SECRET = 'wallet-verification-worker-secret-0000000000000000'
process.env.WITHDRAWAL_MODE = 'AUTOMATIC'
process.env.BANK_CHANGE_HOLD_HOURS = '0'
process.env.DEFAULT_WITHDRAWAL_HOLD_HOURS = '0'
process.env.MARKETPLACE_FINANCE_V3_ENABLED = 'true'

async function main() {
const [
  { default: pool, getConnection },
  funding,
  marketplace,
  withdrawals,
  outbox,
  reconciliation,
] =
  await Promise.all([
    import('../src/lib/db'),
    import('../src/lib/financial/wallet-funding-service'),
    import('../src/lib/financial/marketplace-service'),
    import('../src/lib/financial/withdrawal-service'),
    import('../src/lib/financial/outbox-service'),
    import('../src/lib/financial/reconciliation-service'),
  ])
const { majorToMinor } = await import('../src/lib/financial/money-value')

const runId = randomUUID().replaceAll('-', '').slice(0, 20)
const clientUid = `wallet-test-client-${runId}`
const artisanUid = `wallet-test-artisan-${runId}`
const customerEmail = `wallet-test-${runId}@example.invalid`
const fundingAmount = majorToMinor('100000')
const cancelledJobAmount = majorToMinor('25000')
const releasedJobAmount = majorToMinor('40000')
const withdrawalAmount = majorToMinor('10000')
const providerCollectionFee = 160_000
const providerTransferFee = 5_000

class MockPaystackRail implements PaymentRail {
  readonly provider = 'paystack'
  private payment:
    | {
        reference: string
        email: string
        amountMinor: number
        metadata: Record<string, string>
      }
    | undefined
  private transfer:
    | { reference: string; amountMinor: number; transferCode: string }
    | undefined

  async initializePayment(input: Parameters<PaymentRail['initializePayment']>[0]) {
    this.payment = {
      reference: input.reference,
      email: input.email,
      amountMinor: input.amountMinor,
      metadata: input.metadata,
    }
    return {
      authorizationUrl: `https://checkout.test.invalid/${input.reference}`,
      accessCode: `access-${runId}`,
      providerReference: input.reference,
    }
  }

  async verifyPayment(reference: string) {
    assert(this.payment)
    assert.equal(reference, this.payment.reference)
    return {
      provider: this.provider,
      reference,
      providerTransactionId: `paystack-test-transaction-${runId}`,
      amountMinor: this.payment.amountMinor,
      requestedAmountMinor: this.payment.amountMinor,
      providerFeeMinor: providerCollectionFee,
      currency: 'NGN',
      environment: 'test' as const,
      status: 'succeeded' as const,
      customerEmail: this.payment.email,
      paymentMethod: 'card',
      gatewayResponse: 'Approved',
      paidAt: new Date().toISOString(),
      metadata: this.payment.metadata,
    }
  }

  async createTransferRecipient() {
    return { recipientCode: `RCP_${runId}` }
  }

  async resolveBankAccount(input: Parameters<PaymentRail['resolveBankAccount']>[0]) {
    return { accountName: 'Wallet Verification Artisan', accountNumber: input.accountNumber }
  }

  async initiateTransfer(input: Parameters<PaymentRail['initiateTransfer']>[0]) {
    this.transfer = {
      reference: input.reference,
      amountMinor: input.amountMinor,
      transferCode: `TRF_${runId}`,
    }
    return { transferCode: this.transfer.transferCode, status: 'processing' as const }
  }

  async verifyTransfer(reference: string) {
    assert(this.transfer)
    assert.equal(reference, this.transfer.reference)
    return {
      provider: this.provider,
      reference,
      transferCode: this.transfer.transferCode,
      amountMinor: this.transfer.amountMinor,
      providerFeeMinor: providerTransferFee,
      currency: 'NGN',
      environment: 'test' as const,
      status: 'succeeded' as const,
    }
  }

  async initiateRefund(
    _input: Parameters<PaymentRail['initiateRefund']>[0]
  ): Promise<{ providerRefundReference: string; status: string }> {
    throw new Error('Wallet-funded booking cancellation must not call Paystack refund')
  }

  verifyWebhook() {
    return true
  }
}

const [platformBaselineRows] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
  `SELECT purpose, balance_kobo
   FROM money_accounts
   WHERE owner_type = 'platform' AND owner_id = 'anywork365'`
)
const platformBaseline = (purpose: string) =>
  BigInt(String(platformBaselineRows.find((row) => row.purpose === purpose)?.balance_kobo ?? 0))

const rail = new MockPaystackRail()
try {
  const initialized = await funding.initializeWalletFunding(
    {
      clientUid,
      customerEmail,
      amountMinor: fundingAmount,
      callbackUrl: 'https://staging.example.invalid/api/wallet/verify',
    },
    rail
  )
  const confirmation = await funding.confirmWalletFunding(
    initialized.reference,
    { type: 'provider', id: 'paystack-test' },
    rail
  )
  assert.equal(confirmation.credited, true)
  assert.equal(confirmation.creditedAmountMinor, Number(fundingAmount))
  assert.equal(confirmation.providerFeeMinor, providerCollectionFee)

  const replay = await funding.confirmWalletFunding(
    initialized.reference,
    { type: 'provider', id: 'paystack-test-replay' },
    rail
  )
  assert.equal(replay.credited, false)
  assert.equal(replay.receiptNumber, confirmation.receiptNumber)

  const cancelledBookingId = await createBookingAndLock(cancelledJobAmount)
  const cancelConnection = await getConnection()
  try {
    await cancelConnection.beginTransaction()
    const cancelled = await marketplace.cancelOrRefundJobInTransaction(cancelConnection, {
      bookingId: cancelledBookingId,
      requestedByUid: clientUid,
      reason: 'Staging cancellation verification',
      actor: { type: 'user', id: clientUid },
    })
    assert.equal(cancelled.refundReference, null)
    await cancelConnection.commit()
  } catch (error) {
    await cancelConnection.rollback()
    throw error
  } finally {
    cancelConnection.release()
  }

  const releasedBookingId = await createBookingAndLock(releasedJobAmount)
  const releaseConnection = await getConnection()
  try {
    await releaseConnection.beginTransaction()
    await marketplace.releaseJobFundsToArtisanInTransaction(releaseConnection, {
      bookingId: releasedBookingId,
      actor: { type: 'user', id: clientUid },
    })
    await releaseConnection.commit()
  } catch (error) {
    await releaseConnection.rollback()
    throw error
  } finally {
    releaseConnection.release()
  }
  assert.equal(await marketplace.releaseMaturedEarnings(10), 1)

  await withdrawals.saveVerifiedTransferRecipient({
    userUid: artisanUid,
    providerRecipientCode: `RCP_${runId}`,
    bankCode: '058',
    bankName: 'Test Bank',
    accountNumberLastFour: '0001',
    accountName: 'Wallet Verification Artisan',
    ownershipStatus: 'matched',
    actor: { type: 'system', id: 'wallet-staging-verification' },
  })
  const requested = await withdrawals.requestMarketplaceWithdrawal({
    artisanUid,
    amountMinor: withdrawalAmount,
    idempotencyKey: `wallet-stage-${runId}`,
    actor: { type: 'user', id: artisanUid },
  })
  assert.equal(requested.status, 'approved')
  const submitted = await withdrawals.submitMarketplaceWithdrawal(
    requested.reference,
    { type: 'system', id: 'wallet-staging-verification' },
    rail
  )
  assert.equal(submitted.status, 'processing')
  const reconciled = await withdrawals.reconcileMarketplaceWithdrawal(
    requested.reference,
    { type: 'provider', id: 'paystack-test' },
    rail
  )
  assert.equal(reconciled.status, 'success')

  const [accountRows] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
    `SELECT owner_type, owner_id, purpose, balance_kobo
     FROM money_accounts
     WHERE owner_id IN (?, ?) OR owner_id = 'anywork365'`,
    [clientUid, artisanUid]
  )
  const balance = (ownerId: string, purpose: string) =>
    BigInt(String(accountRows.find(
      (row) => row.owner_id === ownerId && row.purpose === purpose
    )?.balance_kobo ?? 0))

  assert.equal(balance(clientUid, 'client_available'), majorToMinor('60000'))
  assert.equal(balance(artisanUid, 'artisan_available_earnings'), majorToMinor('28000'))
  assert.equal(balance(artisanUid, 'artisan_withdrawn_earnings'), withdrawalAmount)
  assert.equal(
    balance('anywork365', 'platform_commission_revenue') -
      platformBaseline('platform_commission_revenue'),
    majorToMinor('2000')
  )
  assert.equal(
    balance('anywork365', 'platform_payment_processing_expense') -
      platformBaseline('platform_payment_processing_expense'),
    BigInt(providerCollectionFee + providerTransferFee)
  )

  const [[journalCheck]] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
    `SELECT COUNT(*) AS invalid
     FROM (
       SELECT mt.id
       FROM money_transactions mt
       JOIN money_entries me ON me.transaction_id = mt.id
       WHERE mt.user_uid IN (?, ?)
       GROUP BY mt.id
       HAVING COUNT(me.id) < 2 OR SUM(me.delta_kobo) <> 0
     ) invalid_journals`,
    [clientUid, artisanUid]
  )
  assert.equal(Number(journalCheck.invalid), 0)

  const [[fundingCount]] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
    `SELECT COUNT(*) AS count
     FROM wallet_funding_intents
     WHERE client_uid = ? AND status = 'succeeded'
       AND provider_transaction_id IS NOT NULL
       AND receipt_number IS NOT NULL
       AND credited_amount_kobo = requested_amount_kobo`,
    [clientUid]
  )
  assert.equal(Number(fundingCount.count), 1)
  const outboxResult = await outbox.processFinancialOutbox(100)
  assert.equal(outboxResult.failed, 0)
  const reconciliationResult = await reconciliation.runFinancialReconciliation(true)
  assert.equal(reconciliationResult.status, 'passed')

  console.log(JSON.stringify({
    status: 'passed',
    database: testDatabase,
    runId,
    assertions: {
      verifiedFundingAndReceipt: true,
      callbackReplayIdempotent: true,
      bookingLockAndWalletCancellation: true,
      verifiedArtisanReleaseAndHold: true,
      terminalPaystackWithdrawalAndFee: true,
      balancedJournals: true,
      scheduledReconciliationService: true,
    },
  }, null, 2))
} finally {
  await pool.end()
}

async function createBookingAndLock(amountMinor: bigint): Promise<number> {
  const connection = await getConnection()
  try {
    await connection.beginTransaction()
    const [businessRows] = await connection.query<import('mysql2/promise').RowDataPacket[]>(
      'SELECT businessId FROM businesses ORDER BY businessId LIMIT 1'
    )
    assert(businessRows[0], 'Staging clone must contain a business')
    const [result] = await connection.execute<import('mysql2/promise').ResultSetHeader>(
      `INSERT INTO bookings (
         businessId, clientUID, bookedDate, bookedTime, appointmentAddress,
         meetingPoint, additionalInfo, bookingStatus, vendorComment,
         amountAgreed, priceConfirmed, reasonForCancellation, dateBooked
       ) VALUES (?, ?, CURRENT_DATE, CURRENT_TIME, '', '', ?, 'Pending', '', ?, 1, '', NOW())`,
      [
        businessRows[0].businessId,
        clientUid,
        `Wallet v4 staging verification ${runId}`,
        Number(amountMinor) / 100,
      ]
    )
    await marketplace.createWalletFundedJobInTransaction(connection, {
      bookingId: result.insertId,
      clientUid,
      artisanUid,
      amountMinor,
      actor: { type: 'user', id: clientUid },
    })
    await connection.commit()
    return result.insertId
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exit(1)
})
