let initialized = false

const INDEX_STATEMENTS = [
  'CREATE INDEX idx_users_uid ON users(uid)',
  'CREATE INDEX idx_users_email ON users(email)',
  'CREATE INDEX idx_businesses_uid ON businesses(uid)',
  'CREATE INDEX idx_businesses_category ON businesses(category)',
  'CREATE INDEX idx_bookings_clientUID ON bookings(clientUID)',
  'CREATE INDEX idx_bookings_businessId ON bookings(businessId)',
  'CREATE INDEX idx_bookings_bookingStatus ON bookings(bookingStatus)',
  'CREATE INDEX idx_wallets_user_id ON wallets(user_id)',
  'CREATE INDEX idx_wallet_ledger_wallet_id ON wallet_ledger(wallet_id)',
  'CREATE INDEX idx_wallet_escrow_booking_id ON wallet_escrow(booking_id)',
  'CREATE INDEX idx_wallet_escrow_status ON wallet_escrow(status)',
  'CREATE INDEX idx_wallet_transactions_reference ON wallet_transactions(reference)',
  'CREATE INDEX idx_reviews_businessId ON reviews(businessId)',
  'CREATE INDEX idx_reviews_bookingId ON reviews(bookingId)',
  'CREATE INDEX idx_business_ratings_businessId ON business_ratings(businessId)',
  'CREATE INDEX idx_favorites_uid ON favorites(uid)',
  'CREATE INDEX idx_users_notifications_recieverUid ON users_notifications(recieverUid)',
  'CREATE INDEX idx_withdrawal_accounts_user_id ON withdrawal_accounts(user_id)',
  'CREATE INDEX idx_withdrawals_wallet_id ON withdrawals(wallet_id)',
  'CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id)',
  'CREATE INDEX idx_user_fcm_tokens_uid ON user_fcm_tokens(uid)',
  'CREATE INDEX idx_business_verifications_businessId ON business_verifications(businessId)',
  'CREATE INDEX idx_vacancies_company_id ON vacancies(company_id)',
  'CREATE INDEX idx_vacancy_applications_vacancy_id ON vacancy_applications(vacancy_id)',
  'CREATE INDEX idx_disputes_bookingId ON disputes(bookingId)',
  'CREATE INDEX idx_disputes_status ON disputes(status)',
  'CREATE INDEX idx_admin_audit_log_adminUid ON admin_audit_log(adminUid)',
  'CREATE INDEX idx_admin_audit_log_createdAt ON admin_audit_log(createdAt)',
  'CREATE INDEX idx_users_role ON users(role)',
  'CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status)',
  'CREATE INDEX idx_withdrawal_requests_userId ON withdrawal_requests(userId)',
]

export async function ensureIndexes(): Promise<void> {
  if (initialized) return
  initialized = true
  const dbModule = await import('@/lib/db')
  const pool = dbModule.default
  for (const sql of INDEX_STATEMENTS) {
    try {
      await pool.execute(sql)
    } catch {
      // Table or index may already exist — silently ignored
    }
  }
}
