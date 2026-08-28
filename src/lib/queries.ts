import { query, queryOne, execute, type SqlValue } from './db'
import type { RowDataPacket } from 'mysql2/promise'
import type {
  User, AuthUser, UserRole, PortfolioItem,
} from '@/types'
import { getAvatarUrl } from '@/lib/avatar'

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
  bio: string | null
  hasBusinessAccount: number
  role: UserRole | 'vendor' | null
  can_switch_client_recruiter: number
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

export interface VacancyRow extends RowDataPacket {
  vacancy_id: number
  company_id: number
  posted_by_uid: string | null
  company_name: string
  company_address: string
  vacancy_title: string
  category: string
  budget: number
  timeline: string
  vacancy_location: string
  job_type: string
  work_type: string
  years_of_experience: number | null
  required_skills: string
  short_description: string
  job_description: string
  closing_date: string | null
  date_created: string
  closed: number
  poster_name: string
  application_count: number
}

export interface BookingRow extends RowDataPacket {
  bookingId: number
  bookingCode: string | null
  businessId: number
  clientUID: string
  bookedDate: string
  bookedTime: string
  appointmentAddress: string
  meetingPoint: string
  inspectionMethod: 'none' | 'physical' | 'virtual'
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
  cancelledByUid: string | null
  cancelledAt: string | null
  refundStatus: 'not_required' | 'pending' | 'processing' | 'completed' | 'failed'
}

export interface BookingQuoteRow extends RowDataPacket {
  id: number
  booking_id: number
  artisan_uid: string
  amount: number
  scope: string
  estimated_duration: string | null
  proposed_start_date: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'superseded' | 'withdrawn'
  rejection_reason: 'price' | 'scope' | 'timeline' | 'materials' | 'inspection' | 'other' | null
  rejection_note: string | null
  responded_at: string | null
  created_at: string
  updated_at: string
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

export interface VacancyApplicationRow extends RowDataPacket {
  application_id: number
  vacancy_id: number
  uid: string
  first_name: string
  last_name: string
  cv: string | null
  cv_original_name: string | null
  cv_mime_type: string | null
  cover_letter: string | null
  education: string | null
  work_experience: string | null
  status: 'pending' | 'reviewing' | 'shortlisted' | 'rejected' | 'hired'
  applied_date: string
  vacancy_title?: string
  posted_by_uid?: string | null
  applicant_email?: string
  applicant_phone?: string
}

export interface ProfessionalDirectoryRow extends RowDataPacket {
  uid: string
  full_name: string
  profile_image: string
  state: string
  lga: string | null
  bio: string | null
  industry_category: string
  professional_service_category: string
  job_title: string
  qualification: string
  school_name?: string | null
  certifications?: string | unknown[] | null
  work_experience?: string | unknown[] | null
  years_experience: number
  linkedin_or_portfolio_url: string | null
  cover_image_url: string | null
}

export interface RecruiterProfileRow extends RowDataPacket {
  uid: string
  company_name: string
  company_size: string
  industry_category: string
  recruitment_function: string
  position: string
  company_website: string | null
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

interface PortfolioRow extends RowDataPacket {
  id: number
  uid: string
  title: string
  description: string | null
  imageUrl: string | null
  projectUrl: string | null
  createdAt: string
}

interface WithdrawalAccountRow extends RowDataPacket {
  id: number
  user_id: number
  bank_name: string
  bank_code: string
  account_number: string
  account_name: string
  recipient_code: string
  created_at: string
  updated_at: string
}

interface WithdrawalRow extends RowDataPacket {
  id: number
  wallet_id: number | null
  user_id: number
  amount: number
  account_id: number | null
  status: string
  created_at: string
  bank_name: string | null
  account_number: string | null
}

// ─── Transform helpers ────────────────────────────────────────────────────

function resolveRole(row: UserRow): UserRole {
  if (row.role === 'admin') return 'admin'
  if (row.role === 'support') return 'support'
  if (row.role === 'artisan' || row.role === 'vendor') return 'artisan'
  if (row.role === 'professional') return 'professional'
  if (row.role === 'recruiter') return 'recruiter'
  if (row.role === 'client') return 'client'
  return row.hasBusinessAccount ? 'artisan' : 'client'
}

function userRowToAuthUser(row: UserRow): AuthUser {
  const parts = row.fullName.trim().split(/\s+/)
  return {
    id: row.uid,
    email: row.email,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
    role: resolveRole(row),
    canSwitchClientRecruiter: row.can_switch_client_recruiter === 1,
    phone: row.phoneNumber || undefined,
    city: row.state || undefined,
    lga: row.lga || undefined,
    address: row.address || undefined,
    bio: row.bio || undefined,
    avatarUrl: getAvatarUrl(row.profileImage),
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
    role: resolveRole(row),
    city: row.state || '',
    lga: row.lga || undefined,
    address: row.address || undefined,
    bio: row.bio || undefined,
    avatarUrl: getAvatarUrl(row.profileImage),
    nin: row.nin || undefined,
    isVerified: row.verified === 1,
    createdAt: row.dateJoined,
  }
}

// ─── Users ────────────────────────────────────────────────────────────────

export async function getUserByUid(uid: string): Promise<AuthUser | null> {
  const row = await queryOne<UserRow[]>('SELECT * FROM users WHERE uid = ? AND deleted = 0', [uid])
  return row ? userRowToAuthUser(row) : null
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const row = await queryOne<UserRow[]>('SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND deleted = 0', [email.trim()])
  return row ? userRowToAuthUser(row) : null
}

export async function getUserRowByUid(uid: string): Promise<UserRow | null> {
  return queryOne<UserRow[]>('SELECT * FROM users WHERE uid = ? AND deleted = 0', [uid])
}

export async function getUserFullByUid(uid: string): Promise<User | null> {
  const row = await queryOne<UserRow[]>('SELECT * FROM users WHERE uid = ? AND deleted = 0', [uid])
  return row ? userRowToUser(row) : null
}

export async function getUsersFullByUids(uids: string[]): Promise<User[]> {
  const uniqueUids = Array.from(new Set(uids.filter(Boolean)))
  if (uniqueUids.length === 0) return []
  const placeholders = uniqueUids.map(() => '?').join(',')
  const rows = await query<UserRow[]>(
    `SELECT * FROM users WHERE uid IN (${placeholders}) AND deleted = 0`,
    uniqueUids
  )
  return rows.map(userRowToUser)
}

export async function createUser(data: {
  uid: string
  email: string
  fullName: string
  phoneNumber: string
  role?: UserRole
  state?: string
  nin?: string
  loginProvider?: 'EmailAndPassword' | 'Google'
}): Promise<void> {
  await execute(
    `INSERT INTO users (uid, email, fullName, phoneNumber, role, state, nin, loginProvider, dateJoined)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      data.uid,
      data.email.trim().toLowerCase(),
      data.fullName,
      data.phoneNumber,
      data.role || 'client',
      data.state || '',
      data.nin || null,
      data.loginProvider || 'EmailAndPassword',
    ]
  )
}

export async function updateUserProfile(uid: string, updates: {
  fullName?: string
  phoneNumber?: string
  state?: string
  lga?: string
  address?: string
  bio?: string
  profileImage?: string
}): Promise<void> {
  const sets: string[] = []
  const params: SqlValue[] = []
  if (updates.fullName !== undefined) { sets.push('fullName = ?'); params.push(updates.fullName) }
  if (updates.phoneNumber !== undefined) { sets.push('phoneNumber = ?'); params.push(updates.phoneNumber) }
  if (updates.state !== undefined) { sets.push('state = ?'); params.push(updates.state) }
  if (updates.lga !== undefined) { sets.push('lga = ?'); params.push(updates.lga) }
  if (updates.address !== undefined) { sets.push('address = ?'); params.push(updates.address) }
  if (updates.bio !== undefined) { sets.push('bio = ?'); params.push(updates.bio) }
  if (updates.profileImage !== undefined) { sets.push('profileImage = ?'); params.push(updates.profileImage) }
  if (sets.length === 0) return
  params.push(uid)
  await execute(`UPDATE users SET ${sets.join(', ')} WHERE uid = ?`, params)
}

export async function getPortfolioByUid(uid: string): Promise<PortfolioItem[]> {
  const rows = await query<PortfolioRow[]>(
    'SELECT * FROM user_portfolio WHERE uid = ? ORDER BY createdAt DESC',
    [uid]
  )
  return rows.map((row) => ({
    id: String(row.id),
    title: row.title,
    description: row.description || undefined,
    imageUrl: row.imageUrl || undefined,
    projectUrl: row.projectUrl || undefined,
    createdAt: row.createdAt,
  }))
}

export async function createPortfolioItem(data: {
  uid: string
  title: string
  description?: string
  imageUrl?: string
  projectUrl?: string
}): Promise<PortfolioItem> {
  const result = await execute(
    `INSERT INTO user_portfolio (uid, title, description, imageUrl, projectUrl, createdAt)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [data.uid, data.title, data.description || null, data.imageUrl || null, data.projectUrl || null]
  )
  return {
    id: String(result.insertId),
    title: data.title,
    description: data.description,
    imageUrl: data.imageUrl,
    projectUrl: data.projectUrl,
    createdAt: new Date().toISOString(),
  }
}

export async function deletePortfolioItem(id: number, uid: string): Promise<{ imageUrl: string | null } | null> {
  const row = await queryOne<PortfolioRow[]>(
    'SELECT * FROM user_portfolio WHERE id = ? AND uid = ?',
    [id, uid]
  )
  if (!row) return null
  await execute('DELETE FROM user_portfolio WHERE id = ? AND uid = ?', [id, uid])
  return { imageUrl: row.imageUrl }
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
  if (filters?.limit && filters.limit > 0) { sql += ` LIMIT ${filters.limit}` }
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
  user_profileImage: string | null
}

const SEARCH_SYNONYMS: Record<string, string[]> = {
  auto: ['car', 'vehicle', 'motor', 'automobile'],
  car: ['auto', 'vehicle', 'motor', 'automobile'],
  mechanic: ['auto mechanic', 'auto mechanics', 'auto repair', 'car repair', 'vehicle repair'],
  mechanics: ['auto mechanic', 'auto mechanics', 'auto repair', 'car repair', 'vehicle repair'],
  motor: ['auto', 'car', 'vehicle', 'auto mechanic', 'auto mechanics'],
  electricals: ['electrical', 'electrician', 'electrical installation', 'electrical repairs'],
  electrical: ['electricals', 'electrician', 'electrical installation', 'electrical repairs'],
  electrician: ['electrical', 'electricals', 'electrical installation', 'electrical repairs'],
  plumber: ['plumbing', 'plumbing services'],
  plumbing: ['plumber', 'plumbing services'],
  carpenter: ['carpentry', 'furniture', 'carpentry furniture'],
  carpentry: ['carpenter', 'furniture', 'carpentry furniture'],
  septic: ['septic tank', 'septic tank evacuation', 'waste removal'],
  waste: ['waste removal', 'septic tank evacuation', 'cleaning'],
}

function getSearchTerms(search?: string): string[] {
  if (!search) return []
  const normalized = search.toLowerCase()
  const baseTerms = normalized
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
  const expanded = new Set<string>(baseTerms)

  if (normalized.includes('motor mechanic')) {
    expanded.add('auto mechanics')
    expanded.add('auto mechanic')
    expanded.add('car repair')
  }

  for (const term of baseTerms) {
    for (const synonym of SEARCH_SYNONYMS[term] ?? []) {
      expanded.add(synonym)
    }
  }

  return Array.from(expanded).slice(0, 12)
}

function splitBusinessCategories(category: string | null | undefined): string[] {
  if (!category) return []
  return category
    .split(/[;,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function listVendors(filters?: {
  category?: string
  state?: string
  lga?: string
  search?: string
  limit?: number
}): Promise<User[]> {
  const search = filters?.search?.trim()
  const searchLower = search?.toLowerCase()
  const searchTerms = getSearchTerms(search)
  const searchFields = [
    'b.businessName',
    'b.category',
    'b.description',
    'b.state',
    'b.lga',
    'b.location',
    'u.fullName',
  ]
  let sql = `
    SELECT b.*, u.email AS user_email, u.phoneNumber AS user_phoneNumber,
           u.fullName AS user_fullName, u.profileImage AS user_profileImage
    FROM businesses b
    LEFT JOIN users u ON b.uid = u.uid AND u.deleted = 0
    WHERE b.deleted = 0
  `
  const params: SqlValue[] = []
  if (filters?.category) { sql += ' AND b.category LIKE ?'; params.push(`%${filters.category}%`) }
  if (filters?.state) { sql += ' AND b.state = ?'; params.push(filters.state) }
  if (filters?.lga) { sql += ' AND b.lga = ?'; params.push(filters.lga) }
  if (searchLower) {
    const searchPredicates: string[] = []
    const addFieldMatches = (value: string) => {
      const pattern = `%${value}%`
      searchPredicates.push(`(${searchFields.map((field) => `LOWER(COALESCE(${field}, '')) LIKE ?`).join(' OR ')})`)
      params.push(...searchFields.map(() => pattern))
    }

    addFieldMatches(searchLower)
    searchTerms.forEach(addFieldMatches)
    sql += ` AND (${searchPredicates.join(' OR ')})`
  }

  if (searchLower) {
    const rankParts: string[] = [
      'CASE WHEN LOWER(COALESCE(b.businessName, \'\')) = ? THEN 130 ELSE 0 END',
      'CASE WHEN LOWER(COALESCE(b.category, \'\')) = ? THEN 120 ELSE 0 END',
      'CASE WHEN LOWER(COALESCE(b.businessName, \'\')) LIKE ? THEN 90 ELSE 0 END',
      'CASE WHEN LOWER(COALESCE(b.category, \'\')) LIKE ? THEN 85 ELSE 0 END',
      'CASE WHEN LOWER(COALESCE(u.fullName, \'\')) LIKE ? THEN 55 ELSE 0 END',
      'CASE WHEN LOWER(COALESCE(b.description, \'\')) LIKE ? THEN 30 ELSE 0 END',
      'CASE WHEN LOWER(COALESCE(b.state, \'\')) LIKE ? OR LOWER(COALESCE(b.lga, \'\')) LIKE ? OR LOWER(COALESCE(b.location, \'\')) LIKE ? THEN 20 ELSE 0 END',
    ]
    const rankParams: SqlValue[] = [
      searchLower,
      searchLower,
      `%${searchLower}%`,
      `%${searchLower}%`,
      `%${searchLower}%`,
      `%${searchLower}%`,
      `%${searchLower}%`,
      `%${searchLower}%`,
      `%${searchLower}%`,
    ]

    for (const term of searchTerms) {
      rankParts.push(
        'CASE WHEN LOWER(COALESCE(b.category, \'\')) LIKE ? THEN 18 ELSE 0 END',
        'CASE WHEN LOWER(COALESCE(b.businessName, \'\')) LIKE ? THEN 15 ELSE 0 END',
        'CASE WHEN LOWER(COALESCE(u.fullName, \'\')) LIKE ? THEN 10 ELSE 0 END',
        'CASE WHEN LOWER(COALESCE(b.description, \'\')) LIKE ? THEN 6 ELSE 0 END',
        'CASE WHEN LOWER(COALESCE(b.state, \'\')) LIKE ? OR LOWER(COALESCE(b.lga, \'\')) LIKE ? OR LOWER(COALESCE(b.location, \'\')) LIKE ? THEN 5 ELSE 0 END'
      )
      const pattern = `%${term}%`
      rankParams.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern)
    }

    sql += ` ORDER BY (${rankParts.join(' + ')}) DESC, b.verified DESC, b.rating DESC, b.reviews DESC`
    params.push(...rankParams)
  } else {
    sql += ' ORDER BY b.verified DESC, b.rating DESC, b.reviews DESC'
  }
  if (filters?.limit && filters.limit > 0) { sql += ` LIMIT ${filters.limit}` }

  const rows = await query<VendorJoinRow[]>(sql, params)
  const seenUids = new Set<string>()

  return rows.filter((r) => {
    if (seenUids.has(r.uid)) return false
    seenUids.add(r.uid)
    return true
  }).map((r) => {
    const name = r.user_fullName || r.businessName
    const parts = name.split(' ')
    return {
      id: r.uid,
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email: r.user_email ?? '',
      phone: r.businessContact || r.user_phoneNumber || undefined,
      role: 'artisan',
      city: r.state,
      lga: r.lga || undefined,
      address: r.location || undefined,
      bio: r.description,
      businessName: r.businessName,
      businessContact: r.businessContact || undefined,
      yearsOfExperience: r.yearsOfExperience ?? undefined,
      avatarUrl: getAvatarUrl(r.user_profileImage || r.businessLogo),
      skills: splitBusinessCategories(r.category),
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
  const portfolio = await getPortfolioByUid(uid)
  return { ...businessRowToUser(business, row ?? undefined), portfolio }
}

function businessRowToUser(b: BusinessRow, user?: UserRow): User {
  const name = user ? user.fullName : b.businessName
  const parts = name.split(' ')
  return {
    id: b.uid,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
    email: user?.email ?? '',
    phone: b.businessContact || user?.phoneNumber || undefined,
    role: 'artisan',
    city: b.state,
    lga: b.lga || undefined,
    address: b.location || undefined,
    bio: user?.bio || b.description,
    businessName: b.businessName,
    businessContact: b.businessContact || undefined,
    yearsOfExperience: b.yearsOfExperience ?? undefined,
    avatarUrl: getAvatarUrl(user?.profileImage || b.businessLogo),
    skills: splitBusinessCategories(b.category),
    rating: b.rating,
    reviewCount: b.reviews,
    isVerified: b.verified === 1,
    createdAt: b.dateStarted,
  }
}

// ─── Vacancies (Jobs) ─────────────────────────────────────────────────────

const VACANCY_SELECT = `SELECT v.*,
  COALESCE(NULLIF(v.company_name, ''), rp.company_name, c.company_name, '') AS company_name,
  COALESCE(NULLIF(v.company_address, ''), c.company_address, '') AS company_address,
  COALESCE(u.fullName, '') AS poster_name,
  (SELECT COUNT(*) FROM vacancy_applications va WHERE va.vacancy_id = v.vacancy_id) AS application_count
 FROM vacancies v
 LEFT JOIN recruiter_profiles rp ON rp.uid = v.posted_by_uid
 LEFT JOIN companies c ON c.company_id = v.company_id
 LEFT JOIN users u ON u.uid = v.posted_by_uid`

export async function getVacancyById(id: number): Promise<VacancyRow | null> {
  return queryOne<VacancyRow[]>(`${VACANCY_SELECT} WHERE v.vacancy_id = ?`, [id])
}

export async function listVacancies(filters?: {
  search?: string
  location?: string
  job_type?: string
  limit?: number
}): Promise<VacancyRow[]> {
  let sql = `${VACANCY_SELECT} WHERE v.closed = 0 AND (v.closing_date IS NULL OR v.closing_date >= CURDATE())`
  const params: SqlValue[] = []
  if (filters?.search) { sql += ' AND (v.vacancy_title LIKE ? OR v.short_description LIKE ? OR v.job_description LIKE ? OR v.company_name LIKE ?)'; params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`) }
  if (filters?.location) { sql += ' AND v.vacancy_location = ?'; params.push(filters.location) }
  if (filters?.job_type) { sql += ' AND v.category = ?'; params.push(filters.job_type) }
  sql += ' ORDER BY v.date_created DESC'
  const limit = filters?.limit && filters.limit > 0 ? filters.limit : 100
  sql += ` LIMIT ${limit}`
  return query<VacancyRow[]>(sql, params)
}

export async function createVacancy(data: {
  company_id: number
  posted_by_uid: string
  company_name: string
  company_address: string
  vacancy_title: string
  category: string
  budget: number
  timeline: string
  vacancy_location: string
  job_type: string
  work_type: string
  years_of_experience?: number
  required_skills: string
  short_description: string
  job_description: string
  closing_date?: string
}): Promise<number> {
  const result = await execute(
    `INSERT INTO vacancies
      (company_id, posted_by_uid, company_name, company_address, vacancy_title, category, budget, timeline,
       vacancy_location, job_type, work_type, years_of_experience, required_skills, short_description, job_description, closing_date, date_created)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [data.company_id, data.posted_by_uid, data.company_name, data.company_address, data.vacancy_title,
      data.category, data.budget, data.timeline, data.vacancy_location, data.job_type, data.work_type,
      data.years_of_experience || null, data.required_skills, data.short_description, data.job_description, data.closing_date || null]
  )
  return result.insertId
}

export async function getVacanciesByRecruiter(uid: string): Promise<VacancyRow[]> {
  return query<VacancyRow[]>(`${VACANCY_SELECT} WHERE v.posted_by_uid = ? ORDER BY v.date_created DESC LIMIT 200`, [uid])
}

// ─── Bookings ─────────────────────────────────────────────────────────────

export async function getBookingById(id: number): Promise<BookingRow | null> {
  return queryOne<BookingRow[]>('SELECT * FROM bookings WHERE bookingId = ?', [id])
}

export async function getBookingsByClient(uid: string): Promise<(BookingRow & { businessName: string })[]> {
  return query<(BookingRow & { businessName: string })[]>(
    `SELECT b.*, COALESCE(bu.businessName, 'Vendor') AS businessName
     FROM bookings b
     LEFT JOIN businesses bu ON bu.businessId = b.businessId
     WHERE b.clientUID = ?
     ORDER BY b.dateBooked DESC
     LIMIT 50`, [uid])
}

export async function getBookingsByBusiness(businessId: number): Promise<(BookingRow & { fullName: string })[]> {
  return query<(BookingRow & { fullName: string })[]>(
    `SELECT b.*, COALESCE(u.fullName, 'Unknown') AS fullName
     FROM bookings b
     LEFT JOIN users u ON u.uid = b.clientUID
     WHERE b.businessId = ?
     ORDER BY b.dateBooked DESC
     LIMIT 50`, [businessId])
}

export async function getBookingQuotesByBookingIds(bookingIds: number[]): Promise<BookingQuoteRow[]> {
  if (bookingIds.length === 0) return []

  const placeholders = bookingIds.map(() => '?').join(', ')
  return query<BookingQuoteRow[]>(
    `SELECT id, booking_id, artisan_uid, amount, scope, estimated_duration,
            proposed_start_date, status, rejection_reason, rejection_note,
            responded_at, created_at, updated_at
     FROM booking_quotes
     WHERE booking_id IN (${placeholders})
     ORDER BY created_at DESC, id DESC`,
    bookingIds
  )
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
  first_name: string
  last_name: string
  cv: string
  cv_original_name: string
  cv_mime_type: string
  cover_letter: string | null
  education: string
  work_experience: unknown[]
}): Promise<number> {
  const result = await execute(
    `INSERT INTO vacancy_applications
      (vacancy_id, uid, first_name, last_name, cv, cv_original_name, cv_mime_type,
       cover_letter, education, work_experience, status, applied_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
    [data.vacancy_id, data.uid, data.first_name, data.last_name, data.cv, data.cv_original_name,
      data.cv_mime_type, data.cover_letter, JSON.stringify(data.education), JSON.stringify(data.work_experience)]
  )
  return result.insertId
}

export async function hasUserApplied(vacancyId: number, uid: string): Promise<boolean> {
  const row = await queryOne<CountRow[]>(
    'SELECT COUNT(*) AS c FROM vacancy_applications WHERE vacancy_id = ? AND uid = ?',
    [vacancyId, uid]
  )
  return (row?.c ?? 0) > 0
}

export async function getApplicationForFile(id: number): Promise<VacancyApplicationRow | null> {
  return queryOne<VacancyApplicationRow[]>(
    `SELECT va.*, v.posted_by_uid, v.vacancy_title
     FROM vacancy_applications va
     JOIN vacancies v ON v.vacancy_id = va.vacancy_id
     WHERE va.application_id = ?`,
    [id]
  )
}

export async function getApplicationsForRecruiter(uid: string, vacancyId?: number): Promise<VacancyApplicationRow[]> {
  let sql = `SELECT va.*, v.vacancy_title, v.posted_by_uid,
    u.email AS applicant_email, u.phoneNumber AS applicant_phone
    FROM vacancy_applications va
    JOIN vacancies v ON v.vacancy_id = va.vacancy_id
    LEFT JOIN users u ON u.uid = va.uid
    WHERE v.posted_by_uid = ?`
  const params: SqlValue[] = [uid]
  if (vacancyId) {
    sql += ' AND v.vacancy_id = ?'
    params.push(vacancyId)
  }
  sql += ' ORDER BY va.applied_date DESC LIMIT 300'
  return query<VacancyApplicationRow[]>(sql, params)
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

export async function getWalletLedger(walletId: number, limit = 100): Promise<WalletLedgerRow[]> {
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)))
  return query<WalletLedgerRow[]>(
    'SELECT * FROM wallet_ledger WHERE wallet_id = ? ORDER BY created_at DESC LIMIT ?',
    [walletId, safeLimit]
  )
}

export async function getHeldEscrowBalance(walletId: number): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) AS amount
     FROM wallet_escrow
     WHERE vendor_wallet_id = ? AND status = 'held'`,
    [walletId]
  )
  return Number((rows[0] as { amount?: number } | undefined)?.amount ?? 0)
}

export async function getClientHeldEscrowBalance(walletId: number): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) AS amount
     FROM wallet_escrow
     WHERE client_wallet_id = ? AND status = 'held'`,
    [walletId]
  )
  return Number((rows[0] as { amount?: number } | undefined)?.amount ?? 0)
}

export async function getClientTotalBookingPayments(walletId: number): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) AS amount
     FROM wallet_escrow
     WHERE client_wallet_id = ?`,
    [walletId]
  )
  return Number((rows[0] as { amount?: number } | undefined)?.amount ?? 0)
}

export async function getTotalWalletEarnings(walletId: number): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) AS amount
     FROM wallet_ledger
     WHERE wallet_id = ?
       AND direction = 'credit'
       AND description LIKE 'Job earnings%'
    `,
    [walletId]
  )
  return Number((rows[0] as { amount?: number } | undefined)?.amount ?? 0)
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
  return query<WithdrawalAccountRow[]>(
    'SELECT * FROM withdrawal_accounts WHERE user_id = ? ORDER BY id ASC',
    [userId]
  )
}

export async function saveWithdrawalAccount(data: {
  user_id: number
  bank_name: string
  bank_code: string
  account_number: string
  account_name: string
  recipient_code: string
}): Promise<number> {
  const result = await execute(
    `INSERT INTO withdrawal_accounts (user_id, bank_name, bank_code, account_number, account_name, recipient_code)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.user_id, data.bank_name, data.bank_code, data.account_number, data.account_name, data.recipient_code]
  )
  return result.insertId
}

// ─── Withdrawals ──────────────────────────────────────────────────────────

export async function createWithdrawal(data: {
  user_id: number
  wallet_id: number
  amount: number
  account_id: number
}): Promise<number> {
  const result = await execute(
    'INSERT INTO withdrawals (wallet_id, user_id, amount, account_id, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
    [data.wallet_id, data.user_id, data.amount, data.account_id, 'pending']
  )
  return result.insertId
}

export async function getUserWithdrawals(userId: number): Promise<WithdrawalRow[]> {
  return query<WithdrawalRow[]>(
    `SELECT w.*, wa.bank_name, wa.account_number
     FROM withdrawals w
     LEFT JOIN withdrawal_accounts wa ON wa.id = w.account_id
     WHERE w.user_id = ?
     ORDER BY w.created_at DESC`,
    [userId]
  )
}

// ─── Vendor creation(for signup) ──────────────────────────────────────────

export async function updateBusiness(uid: string, data: {
  businessName?: string
  category?: string
  businessContact?: string
  description?: string
  location?: string
  state?: string
  lga?: string
  yearsOfExperience?: number
}): Promise<void> {
  const sets: string[] = []
  const params: SqlValue[] = []
  if (data.businessName !== undefined) { sets.push('businessName = ?'); params.push(data.businessName) }
  if (data.category !== undefined) { sets.push('category = ?'); params.push(data.category) }
  if (data.businessContact !== undefined) { sets.push('businessContact = ?'); params.push(data.businessContact) }
  if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description) }
  if (data.location !== undefined) { sets.push('location = ?'); params.push(data.location) }
  if (data.state !== undefined) { sets.push('state = ?'); params.push(data.state) }
  if (data.lga !== undefined) { sets.push('lga = ?'); params.push(data.lga) }
  if (data.yearsOfExperience !== undefined) { sets.push('yearsOfExperience = ?'); params.push(data.yearsOfExperience) }
  if (sets.length === 0) return
  params.push(uid)
  await execute(`UPDATE businesses SET ${sets.join(', ')} WHERE uid = ? AND deleted = 0`, params)
}

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

export async function createProfessionalProfile(data: {
  uid: string
  industryCategory: string
  professionalServiceCategory: string
  jobTitle: string
  qualification: string
  yearsExperience: number
  linkedinOrPortfolioUrl?: string
}): Promise<number> {
  const result = await execute(
    `INSERT INTO professional_profiles
      (uid, industry_category, professional_service_category, job_title, qualification,
       years_experience, linkedin_or_portfolio_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      data.uid,
      data.industryCategory,
      data.professionalServiceCategory,
      data.jobTitle,
      data.qualification,
      data.yearsExperience,
      data.linkedinOrPortfolioUrl || null,
    ]
  )
  return result.insertId
}

export async function listProfessionalProfiles(filters?: {
  search?: string
  industry?: string
  location?: string
}): Promise<ProfessionalDirectoryRow[]> {
  let sql = `SELECT u.uid, u.fullName AS full_name, u.profileImage AS profile_image,
    u.state, u.lga, u.bio, pp.industry_category, pp.professional_service_category,
    pp.job_title, pp.qualification, pp.years_experience, pp.linkedin_or_portfolio_url, pp.cover_image_url
    FROM professional_profiles pp
    JOIN users u ON u.uid = pp.uid
    WHERE u.role = 'professional' AND u.deleted = 0 AND u.suspended = 0`
  const params: SqlValue[] = []
  if (filters?.search) {
    sql += ` AND (u.fullName LIKE ? OR pp.job_title LIKE ? OR pp.professional_service_category LIKE ? OR pp.industry_category LIKE ?)`
    const term = `%${filters.search}%`
    params.push(term, term, term, term)
  }
  if (filters?.industry) {
    sql += ' AND pp.industry_category = ?'
    params.push(filters.industry)
  }
  if (filters?.location) {
    sql += ' AND u.state = ?'
    params.push(filters.location)
  }
  sql += ' ORDER BY pp.updated_at DESC LIMIT 200'
  return query<ProfessionalDirectoryRow[]>(sql, params)
}

export async function getProfessionalProfileByUid(uid: string): Promise<ProfessionalDirectoryRow | null> {
  return queryOne<ProfessionalDirectoryRow[]>(
    `SELECT u.uid, u.fullName AS full_name, u.profileImage AS profile_image,
      u.state, u.lga, u.bio, pp.industry_category, pp.professional_service_category,
      pp.job_title, pp.qualification, pp.school_name, pp.certifications, pp.work_experience,
      pp.years_experience, pp.linkedin_or_portfolio_url, pp.cover_image_url
     FROM professional_profiles pp
     JOIN users u ON u.uid = pp.uid
     WHERE pp.uid = ? AND u.role = 'professional' AND u.deleted = 0 AND u.suspended = 0`,
    [uid]
  )
}

export async function getProfessionalBackgroundByUid(uid: string): Promise<{
  schoolName: string
  certifications: unknown[]
  workExperience: unknown[]
} | null> {
  const row = await queryOne<Array<RowDataPacket & {
    school_name: string | null
    certifications: string | unknown[] | null
    work_experience: string | unknown[] | null
  }>>(
    `SELECT school_name, certifications, work_experience
     FROM professional_profiles WHERE uid = ?`,
    [uid]
  )
  if (!row) return null

  const parseArray = (value: string | unknown[] | null): unknown[] => {
    if (Array.isArray(value)) return value
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return {
    schoolName: row.school_name || '',
    certifications: parseArray(row.certifications),
    workExperience: parseArray(row.work_experience),
  }
}

export async function updateProfessionalBackground(uid: string, data: {
  schoolName: string
  certifications: unknown[]
  workExperience: unknown[]
}): Promise<void> {
  await execute(
    `UPDATE professional_profiles
     SET school_name = ?, certifications = ?, work_experience = ?, updated_at = NOW()
     WHERE uid = ?`,
    [
      data.schoolName || null,
      JSON.stringify(data.certifications),
      JSON.stringify(data.workExperience),
      uid,
    ]
  )
}

export async function updateProfessionalProfile(uid: string, data: {
  industryCategory: string
  professionalServiceCategory: string
  jobTitle: string
  qualification: string
  yearsExperience: number
  linkedinOrPortfolioUrl?: string
}): Promise<void> {
  await execute(
    `UPDATE professional_profiles
     SET industry_category = ?, professional_service_category = ?, job_title = ?,
         qualification = ?, years_experience = ?, linkedin_or_portfolio_url = ?, updated_at = NOW()
     WHERE uid = ?`,
    [
      data.industryCategory,
      data.professionalServiceCategory,
      data.jobTitle,
      data.qualification,
      data.yearsExperience,
      data.linkedinOrPortfolioUrl || null,
      uid,
    ]
  )
}

export async function updateProfessionalCoverImage(uid: string, coverImageUrl: string | null): Promise<void> {
  await execute(
    'UPDATE professional_profiles SET cover_image_url = ?, updated_at = NOW() WHERE uid = ?',
    [coverImageUrl, uid]
  )
}

export async function createRecruiterProfile(data: {
  uid: string
  companyName: string
  companySize: string
  industryCategory: string
  recruitmentFunction: string
  position: string
  companyWebsite?: string
}): Promise<number> {
  const result = await execute(
    `INSERT INTO recruiter_profiles
      (uid, company_name, company_size, industry_category, recruitment_function,
       position, company_website, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      data.uid,
      data.companyName,
      data.companySize,
      data.industryCategory,
      data.recruitmentFunction,
      data.position,
      data.companyWebsite || null,
    ]
  )
  return result.insertId
}

export async function getRecruiterProfileByUid(uid: string): Promise<RecruiterProfileRow | null> {
  return queryOne<RecruiterProfileRow[]>('SELECT * FROM recruiter_profiles WHERE uid = ?', [uid])
}

export async function upsertRecruiterProfile(data: {
  uid: string
  companyName: string
  companySize: string
  industryCategory: string
  recruitmentFunction: string
  position: string
  companyWebsite?: string
}): Promise<void> {
  await execute(
    `INSERT INTO recruiter_profiles
      (uid, company_name, company_size, industry_category, recruitment_function,
       position, company_website, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       company_name = VALUES(company_name),
       company_size = VALUES(company_size),
       industry_category = VALUES(industry_category),
       recruitment_function = VALUES(recruitment_function),
       position = VALUES(position),
       company_website = VALUES(company_website),
       updated_at = NOW()`,
    [
      data.uid,
      data.companyName,
      data.companySize,
      data.industryCategory,
      data.recruitmentFunction,
      data.position,
      data.companyWebsite || null,
    ]
  )
}

export async function updateUserRole(uid: string, role: 'client' | 'recruiter'): Promise<void> {
  await execute(
    'UPDATE users SET role = ? WHERE uid = ? AND can_switch_client_recruiter = 1 AND deleted = 0',
    [role, uid]
  )
}

// ─── FCM Tokens ──────────────────────────────────────────────────────────

export async function deleteSignupProfileByUid(uid: string): Promise<void> {
  await execute('DELETE FROM professional_profiles WHERE uid = ?', [uid])
  await execute('DELETE FROM recruiter_profiles WHERE uid = ?', [uid])
  await execute('DELETE FROM businesses WHERE uid = ?', [uid])
  await execute('DELETE FROM users WHERE uid = ?', [uid])
}

export async function saveFcmToken(uid: string, token: string) {
  try {
    await execute(
      `INSERT INTO user_fcm_tokens (uid, token, is_active, updated_at)
       VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE is_active = 1, updated_at = NOW()`,
      [uid, token]
    )
    return { error: null }
  } catch {
    return { error: 'Failed to save notification token' }
  }
}

export async function deleteFcmToken(token: string) {
  try {
    await execute('DELETE FROM user_fcm_tokens WHERE token = ?', [token])
    return { error: null }
  } catch {
    return { error: 'Failed to remove notification token' }
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
  const business = role === 'artisan' ? await getBusinessByUid(uid) : null

  if (business) {
    const [activeJobs] = await query<CountRow[]>('SELECT COUNT(*) AS c FROM vacancies WHERE company_id = ? AND closed = 0', [business.businessId])
    const [[appsRow], [hiredRow], [doneRow]] = await Promise.all([
      query<CountRow[]>('SELECT COUNT(*) AS c FROM bookings WHERE businessId = ?', [business.businessId]),
      query<CountRow[]>('SELECT COUNT(*) AS c FROM bookings WHERE businessId = ? AND bookingStatus = ?', [business.businessId, 'Confirmed']),
      query<CountRow[]>('SELECT COUNT(*) AS c FROM bookings WHERE businessId = ? AND bookingStatus = ?', [business.businessId, 'Closed']),
    ])
    return {
      activeJobs: Number(activeJobs.c),
      applications: Number(appsRow.c),
      hiredPros: Number(hiredRow.c),
      jobsCompleted: Number(doneRow.c),
    }
  }

  const [[bookingsRow], [hiredRow], [doneRow]] = await Promise.all([
    query<CountRow[]>('SELECT COUNT(*) AS c FROM bookings WHERE clientUID = ?', [uid]),
    query<CountRow[]>("SELECT COUNT(*) AS c FROM bookings WHERE clientUID = ? AND bookingStatus = ?", [uid, 'Confirmed']),
    query<CountRow[]>("SELECT COUNT(*) AS c FROM bookings WHERE clientUID = ? AND (bookingStatus = ? OR jobStatus = ?)", [uid, 'Closed', 'completed']),
  ])
  return {
    activeJobs: Number(bookingsRow.c),
    applications: Number(bookingsRow.c),
    hiredPros: Number(hiredRow.c),
    jobsCompleted: Number(doneRow.c),
  }
}

export async function getRecentActivity(uid: string, role: string): Promise<ActivityItem[]> {
  const business = role === 'artisan' ? await getBusinessByUid(uid) : null
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
      const name = row.businessName || 'An artisan'
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
  nin: string | null
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

export async function submitVerification(data: {
  businessId: number
  nin: string | null
  photo_url: string | null
  nin_card_url: string | null
  utility_bill_url: string | null
  business_registration_url: string | null
  trade_certificate_url: string | null
}): Promise<number> {
  const result = await execute(
    `INSERT INTO business_verifications
     (businessId, nin, photo_url, nin_card_url, utility_bill_url, business_registration_url, trade_certificate_url, status, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
    [data.businessId, data.nin, data.photo_url, data.nin_card_url, data.utility_bill_url, data.business_registration_url, data.trade_certificate_url]
  )
  return result.insertId
}

export async function getLatestVerification(businessId: number): Promise<BusinessVerificationRow | null> {
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
