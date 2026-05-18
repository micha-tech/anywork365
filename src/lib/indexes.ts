let initialized = false

const INDEX_STATEMENTS = [
  'CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid)',
  'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
  'CREATE INDEX IF NOT EXISTS idx_businesses_uid ON businesses(uid)',
  'CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category)',
  'CREATE INDEX IF NOT EXISTS idx_bookings_clientUID ON bookings(clientUID)',
  'CREATE INDEX IF NOT EXISTS idx_bookings_businessId ON bookings(businessId)',
  'CREATE INDEX IF NOT EXISTS idx_bookings_bookingStatus ON bookings(bookingStatus)',
  'CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_wallet_ledger_wallet_id ON wallet_ledger(wallet_id)',
  'CREATE INDEX IF NOT EXISTS idx_wallet_escrow_booking_id ON wallet_escrow(booking_id)',
  'CREATE INDEX IF NOT EXISTS idx_wallet_escrow_status ON wallet_escrow(status)',
  'CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference)',
  'CREATE INDEX IF NOT EXISTS idx_reviews_businessId ON reviews(businessId)',
  'CREATE INDEX IF NOT EXISTS idx_reviews_bookingId ON reviews(bookingId)',
  'CREATE INDEX IF NOT EXISTS idx_business_ratings_businessId ON business_ratings(businessId)',
  'CREATE INDEX IF NOT EXISTS idx_favorites_uid ON favorites(uid)',
  'CREATE INDEX IF NOT EXISTS idx_users_notifications_recieverUid ON users_notifications(recieverUid)',
  'CREATE INDEX IF NOT EXISTS idx_withdrawal_accounts_user_id ON withdrawal_accounts(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_withdrawals_wallet_id ON withdrawals(wallet_id)',
  'CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_uid ON user_fcm_tokens(uid)',
  'CREATE INDEX IF NOT EXISTS idx_business_verifications_businessId ON business_verifications(businessId)',
  'CREATE INDEX IF NOT EXISTS idx_vacancies_company_id ON vacancies(company_id)',
  'CREATE INDEX IF NOT EXISTS idx_vacancy_applications_vacancy_id ON vacancy_applications(vacancy_id)',
  'CREATE INDEX IF NOT EXISTS idx_disputes_bookingId ON disputes(bookingId)',
  'CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status)',
  'CREATE INDEX IF NOT EXISTS idx_admin_audit_log_adminUid ON admin_audit_log(adminUid)',
  'CREATE INDEX IF NOT EXISTS idx_admin_audit_log_createdAt ON admin_audit_log(createdAt)',
  'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
  'CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status)',
  'CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_userId ON withdrawal_requests(userId)',
]

export async function ensureIndexes(): Promise<void> {
  if (initialized) return
  initialized = true
  const { execute } = await import('@/lib/db')
  for (const sql of INDEX_STATEMENTS) {
    try {
      await execute(sql)
    } catch {
      // Table may not exist yet (created by migration or externally);
      // index will be created when the table exists on next cold start
    }
  }
}
