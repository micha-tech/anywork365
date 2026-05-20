// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'client' | 'vendor' | 'admin'

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  countryCode?: string
  nin?: string
  role: UserRole
  city: string
  bio?: string
  skills?: string[]
  avatarUrl?: string
  rating?: number
  reviewCount?: number
  isVerified?: boolean
  verificationTier?: 'basic' | 'verified' | 'premium'
  isFeatured?: boolean
  portfolio?: PortfolioItem[]
  createdAt: string
}

export interface PortfolioItem {
  id: string
  title: string
  description?: string
  imageUrl: string
  createdAt: string
}

export interface AuthUser {
  // Optional profile fields stored in JWT payload
  phone?: string
  city?: string
  bio?: string
  avatarUrl?: string
  emailVerified?: boolean
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
}

export interface LoginPayload {
  email: string
  password: string
}

export interface SignupPayload {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  role: UserRole
  city: string
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export type JobCategory =
  | 'Repair services'
  | 'Environmental services'
  | 'Cleaning services'
  | 'Events and rentals'
  | 'Fashion services'
  | 'Spa and beauty parlour'
  | 'General services'
  | 'Computer operation'
  | 'Restaurant and lounges'
  | 'Lifestyle and entertainment'
  | 'Tradesmen and retailers'
  | 'Professional services'
  | 'Healthcare services'
  | 'Software development'

export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'

export type JobTimeline = 'urgent' | 'this_week' | 'this_month' | 'flexible'
export type JobType = 'full-time' | 'contract'

export interface Job {
  id: string
  title: string
  description: string
  category: JobCategory
  budget: number
  city: string
  status: JobStatus
  timeline: JobTimeline
  posterId: string
  posterName: string
  businessName: string
  businessAddress: string
  jobType: JobType
  closingDate: string
  applicationCount: number
  createdAt: string
}

export interface JobPostPayload {
  title: string
  description: string
  category: JobCategory
  budget: number
  city: string
  timeline: JobTimeline
  businessName: string
  businessAddress: string
  jobType: JobType
  closingDate: string
}

// ─── Reviews ───────────────────────────────────────────────────────────────

export interface Review {
  id: string
  vendorId: string
  clientId: string
  clientName: string
  overallRating: number
  ratings: {
    quality: number
    punctuality: number
    communication: number
    value: number
  }
  comment: string
  imageUrl?: string
  isUrgent: boolean
  createdAt: string
}

// ─── Booking ────────────────────────────────────────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface Booking {
  id: string
  vendorId: string
  clientId: string
  serviceTitle: string
  description: string
  scheduledDate: string
  location: string
  status: BookingStatus
  price: number
  isUrgent: boolean
  createdAt: string
}

// ─── Applications ─────────────────────────────────────────────────────────────

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected'

export interface Application {
  id: string
  jobId: string
  jobTitle: string
  applicantId: string
  applicantName: string
  coverLetter: string
  proposedRate: number
  availability: string
  status: ApplicationStatus
  createdAt: string
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ─── Filter / Search ──────────────────────────────────────────────────────────

export interface ProfessionalsFilter {
  search?: string
  city?: string
  category?: string
  minRating?: number
}

export interface JobsFilter {
  search?: string
  category?: string
  city?: string
  minBudget?: number
  maxBudget?: number
}

// ─── Nigerian States ──────────────────────────────────────────────────────────

export const NIGERIAN_STATE_NAMES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
] as const

export type NigerianState = typeof NIGERIAN_STATE_NAMES[number]

export const JOB_CATEGORIES: JobCategory[] = [
  'Repair services',
  'Environmental services',
  'Cleaning services',
  'Events and rentals',
  'Fashion services',
  'Spa and beauty parlour',
  'General services',
  'Computer operation',
  'Restaurant and lounges',
  'Lifestyle and entertainment',
  'Tradesmen and retailers',
  'Professional services',
  'Healthcare services',
  'Software development',
]

// ─── Wallet ───────────────────────────────────────────────────────────────────

export type TransactionType =
  | 'credit'       // wallet funding
  | 'earning'      // job earnings (different from credit)
  | 'debit'        // money going out (withdrawal)
  | 'escrow_lock'  // client funds locked in escrow
  | 'escrow_release' // escrow released to pro after job completion
  | 'refund'       // escrow returned to client

export type TransactionStatus = 'pending' | 'success' | 'failed'

export type WithdrawalStatus = 'pending' | 'processing' | 'paid' | 'failed'

export interface WalletTransaction {
  id: string
  userId: string
  type: TransactionType
  amount: number            // in kobo (Paystack uses kobo — 1 NGN = 100 kobo)
  amountNGN: number         // human-readable NGN
  description: string
  reference: string         // unique Paystack/internal reference
  status: TransactionStatus
  metadata?: Record<string, string>
  createdAt: string
}

export interface Wallet {
  userId: string
  availableBalance: number  // NGN — can be withdrawn
  escrowBalance: number     // NGN — locked, awaiting job completion
  totalEarned: number       // NGN — lifetime earnings
  paystackRecipientCode?: string  // for transfers to bank
  bankAccountNumber?: string
  bankCode?: string
  bankName?: string
  isVerified: boolean       // KYC / bank account verified
  createdAt: string
  updatedAt: string
}

export interface WithdrawalRequest {
  id: string
  userId: string
  amount: number            // NGN
  amountKobo: number        // kobo
  bankAccountNumber: string
  bankCode: string
  bankName: string
  accountName: string
  paystackTransferCode?: string
  status: WithdrawalStatus
  reason?: string
  createdAt: string
  updatedAt: string
}

export interface PaystackInitResponse {
  status: boolean
  message: string
  data: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

export interface PaystackVerifyResponse {
  status: boolean
  message: string
  data: {
    status: 'success' | 'failed' | 'abandoned'
    reference: string
    amount: number           // in kobo
    currency: string
    customer: { email: string }
    metadata: Record<string, string>
  }
}

export interface NigerianBank {
  id: number
  name: string
  code: string
  slug: string
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatConversation {
  id: string
  participants: string[]  // user IDs
  lastMessage?: string
  lastMessageAt?: string
  unreadCount: Record<string, number>  // userId -> count
  createdAt: string
  updatedAt: string
}

export interface ChatParticipantInfo {
  id: string
  firstName: string
  lastName: string
  role: string
  avatarUrl?: string
  isVerified?: boolean
  city?: string
}

export interface EnrichedChatConversation extends ChatConversation {
  participantsInfo: Record<string, ChatParticipantInfo>
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  content: string        // encrypted content
  contentDecrypted?: string  // decrypted for display
  senderInfo?: ChatParticipantInfo  // populated on GET
  type: 'text' | 'image' | 'file'
  status: 'sent' | 'delivered' | 'read'
  createdAt: string
}

export interface ChatNotification {
  id: string
  userId: string
  type: 'message' | 'job_application' | 'job_update' | 'payment'
  title: string
  body: string
  conversationId?: string
  isRead: boolean
  createdAt: string
}

// ─── Push Notification ─────────────────────────────────────────────────────────

export interface PushSubscription {
  id: string
  userId: string
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  createdAt: string
}
