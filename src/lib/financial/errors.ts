export type FinancialErrorCode =
  | 'INVALID_AMOUNT'
  | 'INVALID_CURRENCY'
  | 'INVALID_STATE'
  | 'INSUFFICIENT_FUNDS'
  | 'IDEMPOTENCY_CONFLICT'
  | 'NOT_AUTHORIZED'
  | 'NOT_FOUND'
  | 'PROVIDER_UNAVAILABLE'
  | 'RISK_REVIEW_REQUIRED'
  | 'CONFIGURATION_ERROR'
  | 'LEDGER_UNBALANCED'
  | 'ACCOUNT_NOT_FOUND'
  | 'CURRENCY_MISMATCH'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'LIMIT_EXCEEDED'
  | 'RISK_HOLD_ACTIVE'

export class FinancialError extends Error {
  constructor(
    public readonly code: FinancialErrorCode,
    message: string,
    public readonly httpStatus = 400
  ) {
    super(message)
    this.name = 'FinancialError'
  }
}
