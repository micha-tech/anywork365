import { query, queryOne, execute, type SqlValue } from './db'
import type { RowDataPacket } from 'mysql2/promise'
import type {
  User, AuthUser,
  Booking, BookingStatus,
} from '@/types'

// ─── Row Types (mirror MySQL columns) ──────────────────────────────────────

interface UserRow extends RowDataPacket {
  userId: number
  uid: string
  email: string
  fullName: string
  phoneNumber: string
  state: string
  lga: string | null
  gender: string
  profileImage: string
  nin: string | null
  address: string
  hasBusinessAccount: number
  verified: number
  suspended: number
  dateJoined: string
  deleted: number
}

interface BusinessRow extends RowDataPacket {
  businessId: number
  uid: string
  category: string
  businessName: string
  businessContact: string
  description: string
  location: string
  state: string
  lga: string | null
  yearsOfExperience: number | null
  feePerHour: number
  businessLogo: string
  reviews: number
  rating: number
  verified: number
  suspended: number
  dateStarted: string
  subscriptionCategory: number
  activeSubscription: number
  deleted: number
}

interface VacancyRow extends RowDataPacket {
  vacancy_id: number
  company_id: number
  vacancy_title: string
  vacancy_location: string
  job_type: string
  work_type: string
  years_of_experience: number | null
  required_skills: string
  job_description: string
  closing_date: string | null
  date_created: string
  closed: number
}

interface BookingRow extends RowDataPacket {
  bookingId: number
  bookingCode: string | null
  businessId: number
  clientUID: string
  bookedDate: string
  bookedTime: string
  appointmentAddress: string
  meetingPoint: string
  additionalInfo: string
  bookingStatus: string
  clientDecision: string
  vendorDecision: string
  vendorComment: string
  amountAgreed: number
  priceConfirmed: number
  jobStatus: string
  dateBooked: string
  reasonForCancellation: string
}

interface WalletRow extends RowDataPacket {
  id: number
  user_id: number
  email: string | null
  currency: string
  wallet_type: string
  status: string
  created_at: string
}

interface WalletLedgerRow extends RowDataPacket {
  id: number
  wallet_id: number
  amount: number
  direction: 'debit' | 'credit'
  balance_after: number | null
  description: string | null
  created_at: string
}

interface WalletEscrowRow extends RowDataPacket {
  id: number
  booking_id: number
  amount: number
  status: 'held' | 'released' | 'refunded'
  created_at: string
  released_at: string | null
}

interface VacancyApplicationRow extends RowDataPacket {
  application_id: number
  vacancy_id: number
  uid: string
  cv: string | null
  cover_letter: string | null
  applied_date: string
}

interface CountRow extends RowDataPacket {
  c: number
}

interface BookingActivityRow extends RowDataPacket {
  bookingId: number
  businessId: number
  clientUID: string
  bookingStatus: string
  additionalInfo: string | null
  bookedDate: string | null
  dateBooked: string
  fullName?: string
  businessName?: string
}

interface CompanyRow extends RowDataPacket {
  company_id: number
  uid: string
  company_name: string
  company_logo: string | null
  company_address: string | null
  company_email: string | null
  company_phone: string | null
}

interface ReviewRow extends RowDataPacket {
  reviewId: number
  businessId: number
  userUid: string
  review: string
  dateAdded: string | null
}

interface FavoriteRow extends RowDataPacket {
  id: number
  uid: string
  business_id: number
  created_at: string
}

interface NotificationRow extends RowDataPacket {
  id: number
  senderUid: string
  senderEmail: string
  recieverUid: string
  recieverEmail: string
  body: string
  dateCreated: string
  seenByReciever: number
}

interface WithdrawalAccountRow extends RowDataPacket {
  id: number
  user_id: number
  bank_name: string
  bank_code: string
  account_number: string
  account_name: string
}

interface WithdrawalRow extends RowDataPacket {
  id: number
  wallet_id: number | null
  user_id: number
  amount: number
  account_id: number | null
  status: string
  created_at: string
}

// ─── Transform helpers ────────────────────────────────────────────────────

function userRowToAuthUser(row: UserRow): AuthUser {
  const parts = row.fullName.trim().split(/\s+/)
  return {
    id: row.uid,
    email: row.email,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
    role: row.hasBusinessAccount ? 'vendor' : 'client',
    phone: row.phoneNumber || undefined,
    city: row.state || undefined,
    bio: undefined,
    avatarUrl: row.profileImage ? `/uploads/${row.profileImage}` : undefined,
  }
}

function userRowToUser(row: UserRow): User {
  const parts = row.fullName.trim().split(/\s+/)
  return {
    id: row.uid,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
    email: row.email,
    phone: row.phoneNumber || undefined,
    role: row.hasBusinessAccount ? 'vendor' : 'client',
    city: row.state || '',
    avatarUrl: row.profileImage ? `/uploads/${row.profileImage}` : undefined,
    nin: row.nin || undefined,
    isVerified: row.verified === 1,
    createdAt: row.dateJoined,
  }
}

function mapBookingStatus(s: string): BookingStatus {
  if (s === 'Closed') return 'completed'
  if (s === 'Confirmed') return 'confirmed'
  return 'pending'
}

// ─── Users ────────────────────────────────────────────────────────────────

export async function getUserByUid(uid: string): Promise<AuthUser | null> {
  const row = await queryOne<UserRow[]>('SELECT * FROM users WHERE uid = ? AND deleted = 0', [uid])
  return row ? userRowToAuthUser(row) : null
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const row = await queryOne<UserRow[]>('SELECT * FROM users WHERE email = ? AND deleted = 0', [email])
  return row ? userRowToAuthUser(row) : null
}

export async function getUserRowByUid(uid: string): Promise<UserRow | null> {
  return queryOne<UserRow[]>('SELECT * FROM users WHERE uid = ? AND deleted = 0', [uid])
}

export async function getUserFullByUid(uid: string): Promise<User | null> {
  const row = await queryOne<UserRow[]>('SELECT * FROM users WHERE uid = ? AND deleted = 0', [uid])
  return row ? userRowToUser(row) : null
}

export async function createUser(data: {
  uid: string
  email: string
  fullName: string
  phoneNumber: string
  state?: string
  nin?: string
}): Promise<void> {
  await execute(
    `INSERT INTO users (uid, email, fullName, phoneNumber, state, nin, loginProvider, dateJoined)
     VALUES (?, ?, ?, ?, ?, ?, 'EmailAndPassword', NOW())`,
    [data.uid, data.email, data.fullName, data.phoneNumber, data.state || '', data.nin || null]
  )
}

export async function updateUserProfile(uid: string, updates: {
  fullName?: string
  phoneNumber?: string
  state?: string
  profileImage?: string
}): Promise<void> {
  const sets: string[] = []
  const params: SqlValue[] = []
  if (updates.fullName !== undefined) { sets.push('fullName = ?'); params.push(updates.fullName) }
  if (updates.phoneNumber !== undefined) { sets.push('phoneNumber = ?'); params.push(updates.phoneNumber) }
  if (updates.state !== undefined) { sets.push('state = ?'); params.push(updates.state) }
  if (updates.profileImage !== undefined) { sets.push('profileImage = ?'); params.push(updates.profileImage) }
  if (sets.length === 0) return
  params.push(uid)
  await execute(`UPDATE users SET ${sets.join(', ')} WHERE uid = ?`, params)
}

// ─── Businesses (Vendors) ─────────────────────────────────────────────────

export async function getBusinessById(id: number): Promise<BusinessRow | null> {
  return queryOne<BusinessRow[]>('SELECT * FROM businesses WHERE businessId = ? AND deleted = 0', [id])
}

export async function getBusinessByUid(uid: string): Promise<BusinessRow | null> {
  return queryOne<BusinessRow[]>('SELECT * FROM businesses WHERE uid = ? AND deleted = 0', [uid])
}

export async function listBusinesses(filters?: {
  category?: string
  state?: string
  search?: string
  limit?: number
}): Promise<BusinessRow[]> {
  let sql = 'SELECT * FROM businesses WHERE deleted = 0'
  const params: SqlValue[] = []
  if (filters?.category) { sql += ' AND category LIKE ?'; params.push(`%${filters.category}%`) }
  if (filters?.state) { sql += ' AND state = ?'; params.push(filters.state) }
  if (filters?.search) { sql += ' AND (businessName LIKE ? OR description LIKE ?)'; params.push(`%${filters.search}%`, `%${filters.search}%`) }
  sql += ' ORDER BY rating DESC, reviews DESC'
  if (filters?.limit && filters.limit > 0) { sql += ' LIMIT ?'; params.push(filters.limit) }
  return query<BusinessRow[]>(sql, params)
}

interface VendorJoinRow extends RowDataPacket {
  businessId: number
  uid: string
  category: string
  businessName: string
  businessContact: string
  description: string
  location: string
  state: string
  lga: string | null
  yearsOfExperience: number | null
  feePerHour: number
  businessLogo: string
  reviews: number
  rating: number
  verified: number
  suspended: number
  dateStarted: string
  subscriptionCategory: number
  activeSubscription: number
  deleted: number
  user_email: string | null
  user_phoneNumber: string | null
  user_fullName: string | null
}

export async function listVendors(filters?: {
  category?: string
  state?: string
  search?: string
  limit?: number
}): Promise<User[]> {
  let sql = `
    SELECT b.*, u.email AS user_email, u.phoneNumber AS user_phoneNumber, u.fullName AS user_fullName
    FROM businesses b
    LEFT JOIN users u ON b.uid = u.uid AND u.deleted = 0
    WHERE b.deleted = 0
  `
  const params: SqlValue[] = []
  if (filters?.category) { sql += ' AND b.category LIKE ?'; params.push(`%${filters.category}%`) }
  if (filters?.state) { sql += ' AND b.state = ?'; params.push(filters.state) }
  if (filters?.search) { sql += ' AND (b.businessName LIKE ? OR b.description LIKE ?)'; params.push(`%${filters.search}%`, `%${filters.search}%`) }
  sql += ' ORDER BY b.rating DESC, b.reviews DESC'
  if (filters?.limit && filters.limit > 0) { sql += ' LIMIT ?'; params.push(filters.limit) }

  const rows = await query<VendorJoinRow[]>(sql, params)
  return rows.map((r) => {
    const name = r.user_fullName || r.businessName
    const parts = name.split(' ')
    return {
      id: r.uid,
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email: r.user_email ?? '',
      phone: r.user_phoneNumber || undefined,
      role: 'vendor',
      city: r.state,
      bio: r.description,
      avatarUrl: r.businessLogo ? `/uploads/${r.businessLogo}` : undefined,
      skills: r.category ? [r.category] : [],
      rating: r.rating,
      reviewCount: r.reviews,
      isVerified: r.verified === 1,
      createdAt: r.dateStarted,
    }
  })
}

export async function getVendorByUid(uid: string): Promise<User | null> {
  const business = await getBusinessByUid(uid)
  if (!business) return null
  const row = await getUserRowByUid(uid)
  return businessRowToUser(business, row ?? undefined)
}

function businessRowToUser(b: BusinessRow, user?: UserRow): User {
  const name = user ? user.fullName : b.businessName
  const parts = name.split(' ')
  return {
    id: b.uid,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
    email: user?.email ?? '',
    phone: user?.phoneNumber || undefined,
    role: 'vendor',
    city: b.state,
    bio: b.description,
    avatarUrl: b.businessLogo ? `/uploads/${b.businessLogo}` : undefined,
    skills: b.category ? [b.category] : [],
    rating: b.rating,
    reviewCount: b.reviews,
    isVerified: b.verified === 1,
    createdAt: b.dateStarted,
  }
}

// ─── Vacancies (Jobs) ─────────────────────────────────────────────────────

export async function getVacancyById(id: number): Promise<VacancyRow | null> {
  return queryOne<VacancyRow[]>('SELECT * FROM vacancies WHERE vacancy_id = ?', [id])
}

export async function listVacancies(filters?: {
  search?: string
  location?: string
  job_type?: string
  limit?: number
}): Promise<VacancyRow[]> {
  let sql = 'SELECT * FROM vacancies WHERE closed = 0'
  const params: SqlValue[] = []
  if (filters?.search) { sql += ' AND (vacancy_title LIKE ? OR job_description LIKE ?)'; params.push(`%${filters.search}%`, `%${filters.search}%`) }
  if (filters?.location) { sql += ' AND vacancy_location = ?'; params.push(filters.location) }
  if (filters?.job_type) { sql += ' AND job_type = ?'; params.push(filters.job_type) }
  sql += ' ORDER BY date_created DESC'
  if (filters?.limit && filters.limit > 0) { sql += ' LIMIT ?'; params.push(filters.limit) }
  return query<VacancyRow[]>(sql, params)
}

export async function createVacancy(data: {
  company_id: number
  vacancy_title: string
  vacancy_location: string
  job_type: string
  work_type: string
  years_of_experience?: number
  required_skills: string
  job_description: string
  closing_date?: string
}): Promise<number> {
  const result = await execute(
    `INSERT INTO vacancies (company_id, vacancy_title, vacancy_location, job_type, work_type, years_of_experience, required_skills, job_description, closing_date, date_created)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [data.company_id, data.vacancy_title, data.vacancy_location, data.job_type, data.work_type, data.years_of_experience || null, data.required_skills, data.job_description, data.closing_date || null]
  )
  return result.insertId
}

// ─── Bookings ─────────────────────────────────────────────────────────────

export async function getBookingById(id: number): Promise<BookingRow | null> {
  return queryOne<BookingRow[]>('SELECT * FROM bookings WHERE bookingId = ?', [id])
}

export async function getBookingsByClient(uid: string): Promise<BookingRow[]> {
  return query<BookingRow[]>('SELECT * FROM bookings WHERE clientUID = ? ORDER BY dateBooked DESC', [uid])
}

export async function getBookingsByBusiness(businessId: number): Promise<BookingRow[]> {
  return query<BookingRow[]>('SELECT * FROM bookings WHERE businessId = ? ORDER BY dateBooked DESC', [businessId])
}

// ─── Applications (Vacancy Applications) ──────────────────────────────────

export async function getApplicationById(id: number): Promise<VacancyApplicationRow | null> {
  return queryOne<VacancyApplicationRow[]>('SELECT * FROM vacancy_applications WHERE application_id = ?', [id])
}

export async function getApplicationsByVacancy(vacancyId: number): Promise<VacancyApplicationRow[]> {
  return query<VacancyApplicationRow[]>('SELECT * FROM vacancy_applications WHERE vacancy_id = ? ORDER BY applied_date DESC', [vacancyId])
}

export async function getApplicationsByUser(uid: string): Promise<VacancyApplicationRow[]> {
  return query<VacancyApplicationRow[]>('SELECT * FROM vacancy_applications WHERE uid = ? ORDER BY applied_date DESC', [uid])
}

export async function createApplication(data: {
  vacancy_id: number
  uid: string
  cv?: string
  cover_letter?: string
}): Promise<number> {
  const result = await execute(
    `INSERT INTO vacancy_applications (vacancy_id, uid, cv, cover_letter, applied_date)
     VALUES (?, ?, ?, ?, NOW())`,
    [data.vacancy_id, data.uid, data.cv || null, data.cover_letter || null]
  )
  return result.insertId
}

// ─── Wallet ───────────────────────────────────────────────────────────────

export async function getWalletByUserId(userId: number): Promise<WalletRow | null> {
  return queryOne<WalletRow[]>('SELECT * FROM wallets WHERE user_id = ? AND wallet_type = ?', [userId, 'user'])
}

export async function getOrCreateWallet(userId: number, email: string): Promise<WalletRow> {
  const existing = await getWalletByUserId(userId)
  if (existing) return existing
  await execute(
    'INSERT INTO wallets (user_id, email, currency, wallet_type, status) VALUES (?, ?, ?, ?, ?)',
    [userId, email, 'NGN', 'user', 'active']
  )
  return (await getWalletByUserId(userId))!
}

export async function getWalletBalance(walletId: number): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    'SELECT COALESCE(SUM(CASE WHEN direction = ? THEN amount ELSE -amount END), 0) AS balance FROM wallet_ledger WHERE wallet_id = ?',
    ['credit', walletId]
  )
  const row = rows[0] as { balance: number } | undefined
  return row?.balance ?? 0
}

export async function getWalletLedger(walletId: number): Promise<WalletLedgerRow[]> {
  return query<WalletLedgerRow[]>(
    'SELECT * FROM wallet_ledger WHERE wallet_id = ? ORDER BY created_at DESC',
    [walletId]
  )
}

export async function addLedgerEntry(data: {
  wallet_id: number
  amount: number
  direction: 'debit' | 'credit'
  balance_after: number
  description: string
}): Promise<number> {
  const result = await execute(
    `INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [data.wallet_id, data.amount, data.direction, data.balance_after, data.description]
  )
  return result.insertId
}

export async function createWalletTransaction(data: {
  reference: string
  type: string
  status: string
  metadata?: string
}): Promise<number> {
  const result = await execute(
    `INSERT INTO wallet_transactions (reference, type, status, metadata, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [data.reference, data.type, data.status, data.metadata || null]
  )
  return result.insertId
}

export async function getEscrowByBooking(bookingId: number): Promise<WalletEscrowRow | null> {
  return queryOne<WalletEscrowRow[]>('SELECT * FROM wallet_escrow WHERE booking_id = ?', [bookingId])
}

export async function createEscrow(data: {
  booking_id: number
  client_wallet_id: number
  vendor_wallet_id: number
  amount: number
}): Promise<number> {
  const result = await execute(
    `INSERT INTO wallet_escrow (booking_id, client_wallet_id, vendor_wallet_id, escrow_wallet_id, amount, status, created_at)
     VALUES (?, ?, ?, (SELECT id FROM wallets WHERE wallet_type = ? LIMIT 1), ?, ?, NOW())`,
    [data.booking_id, data.client_wallet_id, data.vendor_wallet_id, 'escrow', data.amount, 'held']
  )
  return result.insertId
}

// ─── Companies ────────────────────────────────────────────────────────────

export async function getCompanyById(id: number): Promise<CompanyRow | null> {
  return queryOne<CompanyRow[]>('SELECT * FROM companies WHERE company_id = ?', [id])
}

export async function getCompaniesByUid(uid: string): Promise<CompanyRow[]> {
  return query<CompanyRow[]>('SELECT * FROM companies WHERE uid = ?', [uid])
}

export const getCompanyByUid = getCompaniesByUid

// ─── Reviews & Ratings ────────────────────────────────────────────────────

export async function getReviewsByBusiness(businessId: number): Promise<ReviewRow[]> {
  return query<ReviewRow[]>('SELECT * FROM reviews WHERE businessId = ? ORDER BY dateAdded DESC', [businessId])
}

export async function getAverageRating(businessId: number): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    'SELECT AVG(rating) AS avg FROM business_ratings WHERE businessId = ?',
    [businessId]
  )
  const row = rows[0] as { avg: number | null } | undefined
  return row?.avg ?? 0
}

// ─── Favorites ────────────────────────────────────────────────────────────

export async function getFavoritesByUser(uid: string): Promise<FavoriteRow[]> {
  return query<FavoriteRow[]>('SELECT * FROM favorites WHERE uid = ? ORDER BY created_at DESC', [uid])
}

export async function addFavorite(uid: string, businessId: number): Promise<void> {
  await execute('INSERT IGNORE INTO favorites (uid, business_id) VALUES (?, ?)', [uid, businessId])
}

export async function removeFavorite(uid: string, businessId: number): Promise<void> {
  await execute('DELETE FROM favorites WHERE uid = ? AND business_id = ?', [uid, businessId])
}

// ─── Notifications ────────────────────────────────────────────────────────

export async function getUserNotifications(uid: string): Promise<NotificationRow[]> {
  return query<NotificationRow[]>(
    'SELECT * FROM users_notifications WHERE recieverUid = ? ORDER BY dateCreated DESC LIMIT 50',
    [uid]
  )
}

export async function getUnreadNotificationCount(uid: string): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM users_notifications WHERE recieverUid = ? AND seenByReciever = 0',
    [uid]
  )
  const row = rows[0] as { count: number } | undefined
  return row?.count ?? 0
}

export async function markNotificationAsRead(id: number, uid: string): Promise<void> {
  await execute('UPDATE users_notifications SET seenByReciever = 1 WHERE id = ? AND recieverUid = ?', [id, uid])
}

export async function markAllNotificationsAsRead(uid: string): Promise<void> {
  await execute('UPDATE users_notifications SET seenByReciever = 1 WHERE recieverUid = ?', [uid])
}

export async function createDbNotification(uid: string, body: string): Promise<void> {
  await execute(
    `INSERT INTO users_notifications (senderUid, senderEmail, recieverUid, recieverEmail, body, dateCreated, seenByReciever)
     VALUES (?, ?, ?, ?, ?, NOW(), 0)`,
    ['system', '', uid, '', body]
  )
}

// ─── Withdrawal Accounts ──────────────────────────────────────────────────

export async function getWithdrawalAccounts(userId: number): Promise<WithdrawalAccountRow[]> {
  return query<WithdrawalAccountRow[]>('SELECT * FROM withdrawal_accounts WHERE user_id = ?', [userId])
}

export async function saveWithdrawalAccount(data: {
  user_id: number
  bank_name: string
  bank_code: string
  account_number: string
  account_name: string
}): Promise<number> {
  const result = await execute(
    `INSERT INTO withdrawal_accounts (user_id, bank_name, bank_code, account_number, account_name)
     VALUES (?, ?, ?, ?, ?)`,
    [data.user_id, data.bank_name, data.bank_code, data.account_number, data.account_name]
  )
  return result.insertId
}

// ─── Withdrawals ──────────────────────────────────────────────────────────

export async function createWithdrawal(data: {
  user_id: number
  amount: number
  account_id: number
}): Promise<number> {
  const result = await execute(
    'INSERT INTO withdrawals (user_id, amount, account_id, status) VALUES (?, ?, ?, ?)',
    [data.user_id, data.amount, data.account_id, 'pending']
  )
  return result.insertId
}

export async function getUserWithdrawals(userId: number): Promise<WithdrawalRow[]> {
  return query<WithdrawalRow[]>('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC', [userId])
}

// ─── Vendor creation(for signup) ──────────────────────────────────────────

export async function createBusiness(data: {
  uid: string
  businessName: string
  category?: string
  businessContact?: string
  state?: string
}): Promise<number> {
  const result = await execute(
    `INSERT INTO businesses (uid, businessName, category, businessContact, state, dateStarted, deleted)
     VALUES (?, ?, ?, ?, ?, NOW(), 0)`,
    [data.uid, data.businessName, data.category || '', data.businessContact || '', data.state || '']
  )
  await execute('UPDATE users SET hasBusinessAccount = 1 WHERE uid = ?', [data.uid])
  return result.insertId
}

// ─── FCM Tokens ──────────────────────────────────────────────────────────

export async function saveFcmToken(uid: string, token: string) {
  try {
    await execute(
      `INSERT INTO user_fcm_tokens (uid, token, is_active, updated_at)
       VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE is_active = 1, updated_at = NOW()`,
      [uid, token]
    )
    return { error: null }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { error: e?.message || 'Failed to save token' }
  }
}

export async function deleteFcmToken(token: string) {
  try {
    await execute('DELETE FROM user_fcm_tokens WHERE token = ?', [token])
    return { error: null }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { error: e?.message || 'Failed to delete token' }
  }
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────

export interface DashboardStats {
  activeJobs: number
  applications: number
  hiredPros: number
  jobsCompleted: number
}

export interface ActivityItem {
  initials: string
  color: string
  text: string
  sub: string
  time: string
}

const ACTIVITY_COLORS = ['bg-brand-500', 'bg-blue-600', 'bg-amber-500', 'bg-rose-500', 'bg-teal-600', 'bg-purple-600']

export async function getDashboardStats(uid: string, role: string): Promise<DashboardStats> {
  const business = role === 'vendor' ? await getBusinessByUid(uid) : null

  if (business) {
    const [activeJobs] = await query<CountRow[]>('SELECT COUNT(*) AS c FROM vacancies WHERE company_id = ? AND closed = 0', [business.businessId])
    const [apps] = await query<CountRow[]>('SELECT COUNT(*) AS c FROM bookings WHERE businessId = ?', [business.businessId])
    const [hired] = await query<CountRow[]>('SELECT COUNT(*) AS c FROM bookings WHERE businessId = ? AND bookingStatus = ?', [business.businessId, 'Confirmed'])
    const [done] = await query<CountRow[]>('SELECT COUNT(*) AS c FROM bookings WHERE businessId = ? AND bookingStatus = ?', [business.businessId, 'Closed'])
    return {
      activeJobs: Number(activeJobs.c),
      applications: Number(apps.c),
      hiredPros: Number(hired.c),
      jobsCompleted: Number(done.c),
    }
  }

  const [bookings] = await query<CountRow[]>('SELECT COUNT(*) AS c FROM bookings WHERE clientUID = ?', [uid])
  const [hired] = await query<CountRow[]>("SELECT COUNT(*) AS c FROM bookings WHERE clientUID = ? AND bookingStatus = ?", [uid, 'Confirmed'])
  const [done] = await query<CountRow[]>("SELECT COUNT(*) AS c FROM bookings WHERE clientUID = ? AND (bookingStatus = ? OR jobStatus = ?)", [uid, 'Closed', 'completed'])
  return {
    activeJobs: Number(bookings.c),
    applications: Number(bookings.c),
    hiredPros: Number(hired.c),
    jobsCompleted: Number(done.c),
  }
}

export async function getRecentActivity(uid: string, role: string): Promise<ActivityItem[]> {
  const business = role === 'vendor' ? await getBusinessByUid(uid) : null
  const items: ActivityItem[] = []

  if (business) {
    const rows = await query<BookingActivityRow[]>(
      `SELECT b.*, u.fullName FROM bookings b
       LEFT JOIN users u ON b.clientUID = u.uid
       WHERE b.businessId = ? ORDER BY b.dateBooked DESC LIMIT 5`,
      [business.businessId]
    )
    for (const row of rows) {
      const name = row.fullName || 'A user'
      const parts = name.split(' ')
      const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase()
      const statusMap: Record<string, string> = { Pending: 'applied to', Confirmed: 'was hired for', Closed: 'completed', Cancelled: 'cancelled' }
      const action = statusMap[row.bookingStatus] || 'interacted with'
      items.push({
        initials: initials || '??',
        color: ACTIVITY_COLORS[Math.floor(Math.random() * ACTIVITY_COLORS.length)],
        text: `${name} ${action} ${row.additionalInfo || 'a job'}`,
        sub: row.bookingStatus === 'Pending' ? 'Awaiting response' : `${row.bookingStatus} · ${row.bookedDate || ''}`,
        time: row.dateBooked ? timeAgo(row.dateBooked) : '',
      })
    }
  } else {
    const rows = await query<BookingActivityRow[]>(
      `SELECT b.*, bs.businessName FROM bookings b
       LEFT JOIN businesses bs ON b.businessId = bs.businessId
       WHERE b.clientUID = ? ORDER BY b.dateBooked DESC LIMIT 5`,
      [uid]
    )
    for (const row of rows) {
      const name = row.businessName || 'A vendor'
      const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '??'
      const statusMap: Record<string, string> = { Pending: 'requested service from', Confirmed: 'confirmed booking with', Closed: 'completed work with', Cancelled: 'cancelled with' }
      const action = statusMap[row.bookingStatus] || 'interacted with'
      items.push({
        initials,
        color: ACTIVITY_COLORS[Math.floor(Math.random() * ACTIVITY_COLORS.length)],
        text: `You ${action} ${name}`,
        sub: row.bookingStatus === 'Pending' ? 'Waiting for response' : `${row.bookingStatus} · ${row.bookedDate || ''}`,
        time: row.dateBooked ? timeAgo(row.dateBooked) : '',
      })
    }
  }

  return items.slice(0, 5)
}

// ─── Business Verification ───────────────────────────────────────────

interface BusinessVerificationRow extends RowDataPacket {
  id: number
  businessId: number
  nin: string
  photo_url: string | null
  nin_card_url: string | null
  utility_bill_url: string | null
  business_registration_url: string | null
  trade_certificate_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  submitted_at: string
  reviewed_at: string | null
}

export async function ensureVerificationTable(): Promise<void> {
  await execute(
    `CREATE TABLE IF NOT EXISTS business_verifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      businessId INT NOT NULL,
      nin VARCHAR(11) NOT NULL,
      photo_url VARCHAR(500),
      nin_card_url VARCHAR(500),
      utility_bill_url VARCHAR(500),
      business_registration_url VARCHAR(500),
      trade_certificate_url VARCHAR(500),
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      admin_notes TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      FOREIGN KEY (businessId) REFERENCES businesses(businessId)
    )`
  )
}

export async function submitVerification(data: {
  businessId: number
  nin: string
  photo_url: string | null
  nin_card_url: string | null
  utility_bill_url: string | null
  business_registration_url: string | null
  trade_certificate_url: string | null
}): Promise<number> {
  await ensureVerificationTable()
  const result = await execute(
    `INSERT INTO business_verifications
     (businessId, nin, photo_url, nin_card_url, utility_bill_url, business_registration_url, trade_certificate_url, status, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
    [data.businessId, data.nin, data.photo_url, data.nin_card_url, data.utility_bill_url, data.business_registration_url, data.trade_certificate_url]
  )
  return result.insertId
}

export async function getLatestVerification(businessId: number): Promise<BusinessVerificationRow | null> {
  await ensureVerificationTable()
  return queryOne<BusinessVerificationRow[]>(
    'SELECT * FROM business_verifications WHERE businessId = ? ORDER BY submitted_at DESC LIMIT 1',
    [businessId]
  )
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}