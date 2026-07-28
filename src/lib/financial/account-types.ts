import type { SupportedCurrency } from './money-value'

export type AccountClassification =
  | 'ASSET'
  | 'LIABILITY'
  | 'REVENUE'
  | 'EXPENSE'
  | 'EQUITY'
  | 'CLEARING'
  | 'SUSPENSE'

export type FinancialAccountType =
  | 'client_available'
  | 'client_locked_job_funds'
  | 'client_refund_pending'
  | 'client_refundable'
  | 'artisan_pending_earnings'
  | 'artisan_available_earnings'
  | 'artisan_withdrawal_pending'
  | 'artisan_withdrawn_earnings'
  | 'artisan_reversed_earnings'
  | 'artisan_reserve_hold'
  | 'platform_commission_revenue'
  | 'platform_transaction_fee_revenue'
  | 'platform_promotional_credit_expense'
  | 'platform_refund_liability'
  | 'platform_chargeback_liability'
  | 'platform_operational_reserve'
  | 'platform_paystack_clearing'
  | 'platform_bank_settlement_clearing'
  | 'external_payment_clearing'
  | 'external_transfer_clearing'
  | 'suspense'
  | 'migration_opening_balance'
  | 'adjustment'

export type AccountOwnerType = 'client' | 'artisan' | 'booking' | 'platform' | 'system'

export type AccountSpec = {
  ownerType: AccountOwnerType
  ownerId: string
  accountType: FinancialAccountType
  classification: AccountClassification
  allowNegative: boolean
  currency: SupportedCurrency
}

const PLATFORM_ID = 'anywork365'
const SYSTEM_ID = 'anywork365-financial-system'

export const accounts = {
  clientAvailable: (uid: string): AccountSpec => liability('client', uid, 'client_available'),
  clientLockedJobFunds: (bookingId: number): AccountSpec =>
    liability('booking', String(bookingId), 'client_locked_job_funds'),
  clientRefundPending: (uid: string): AccountSpec =>
    liability('client', uid, 'client_refund_pending'),
  clientRefundable: (uid: string): AccountSpec =>
    liability('client', uid, 'client_refundable'),
  artisanPendingEarnings: (uid: string): AccountSpec =>
    liability('artisan', uid, 'artisan_pending_earnings'),
  artisanAvailableEarnings: (uid: string): AccountSpec =>
    liability('artisan', uid, 'artisan_available_earnings'),
  artisanWithdrawalPending: (uid: string): AccountSpec =>
    liability('artisan', uid, 'artisan_withdrawal_pending'),
  artisanWithdrawnEarnings: (uid: string): AccountSpec =>
    liability('artisan', uid, 'artisan_withdrawn_earnings'),
  artisanReversedEarnings: (uid: string): AccountSpec =>
    liability('artisan', uid, 'artisan_reversed_earnings'),
  artisanReserveHold: (uid: string): AccountSpec =>
    liability('artisan', uid, 'artisan_reserve_hold'),
  platformCommissionRevenue: (): AccountSpec =>
    classified('platform', PLATFORM_ID, 'platform_commission_revenue', 'REVENUE', false),
  platformTransactionFeeRevenue: (): AccountSpec =>
    classified('platform', PLATFORM_ID, 'platform_transaction_fee_revenue', 'REVENUE', false),
  platformPromotionalCreditExpense: (): AccountSpec =>
    classified('platform', PLATFORM_ID, 'platform_promotional_credit_expense', 'EXPENSE', true),
  platformRefundLiability: (): AccountSpec =>
    classified('platform', PLATFORM_ID, 'platform_refund_liability', 'LIABILITY', false),
  platformChargebackLiability: (): AccountSpec =>
    classified('platform', PLATFORM_ID, 'platform_chargeback_liability', 'LIABILITY', false),
  platformOperationalReserve: (): AccountSpec =>
    classified('platform', PLATFORM_ID, 'platform_operational_reserve', 'ASSET', true),
  platformPaystackClearing: (): AccountSpec =>
    classified('platform', PLATFORM_ID, 'platform_paystack_clearing', 'CLEARING', true),
  platformBankSettlementClearing: (): AccountSpec =>
    classified('platform', PLATFORM_ID, 'platform_bank_settlement_clearing', 'CLEARING', true),
  externalPaymentClearing: (): AccountSpec =>
    classified('system', SYSTEM_ID, 'external_payment_clearing', 'CLEARING', true),
  externalTransferClearing: (): AccountSpec =>
    classified('system', SYSTEM_ID, 'external_transfer_clearing', 'CLEARING', true),
  suspense: (): AccountSpec =>
    classified('system', SYSTEM_ID, 'suspense', 'SUSPENSE', true),
  migrationOpeningBalance: (): AccountSpec =>
    classified('system', SYSTEM_ID, 'migration_opening_balance', 'EQUITY', true),
  adjustment: (): AccountSpec =>
    classified('system', SYSTEM_ID, 'adjustment', 'EQUITY', true),
}

function liability(
  ownerType: AccountOwnerType,
  ownerId: string,
  accountType: FinancialAccountType
): AccountSpec {
  return classified(ownerType, ownerId, accountType, 'LIABILITY', false)
}

function classified(
  ownerType: AccountOwnerType,
  ownerId: string,
  accountType: FinancialAccountType,
  classification: AccountClassification,
  allowNegative: boolean
): AccountSpec {
  return { ownerType, ownerId, accountType, classification, allowNegative, currency: 'NGN' }
}
