// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'client' | 'artisan' | 'professional' | 'recruiter' | 'admin'

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
  lga?: string
  address?: string
  bio?: string
  businessName?: string
  businessContact?: string
  yearsOfExperience?: number
  feePerHour?: number
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
  lga?: string
  address?: string
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
  state: string
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const BUSINESS_CATEGORY_GROUPS = [
  {
    label: 'Home, Property & Facility Services',
    categories: [
      'Carpentry & Furniture',
      'Plumbing Services',
      'Electrical Installation & Repairs',
      'Painting & Wall Finishing',
      'Masonry, Tiling & Flooring',
      'Roofing & Waterproofing',
      'Welding & Metal Fabrication',
      'Aluminium & Glass Works',
      'POP, Ceiling & Partitioning',
      'Interior Decoration & Space Styling',
      'HVAC / AC Installation & Repairs',
      'Generator, Inverter & Solar Services',
      'Pest Control & Fumigation',
      'Cleaning & Facility Management',
      'Security Systems & CCTV',
    ],
  },
  {
    label: 'Automotive & Mechanical Services',
    categories: [
      'Auto Mechanics',
      'Auto Electrical Services',
      'Panel Beating & Spray Painting',
      'Tyre, Wheel Alignment & Balancing',
      'Car Wash & Auto Detailing',
    ],
  },
  {
    label: 'Logistics, Trade & Mobility',
    categories: [
      'Logistics / Transportation Services',
      'Courier & Dispatch Services',
      'Freight Forwarding / Clearing Agents',
      'Moving & Relocation Services',
      'Haulage & Trucking Services',
    ],
  },
  {
    label: 'Construction, Engineering & Real Estate',
    categories: [
      'Technical Engineering Services',
      'Quantity Surveying',
      'Architecture & Building Design',
      'Estate Surveying & Property Management',
      'Land Surveying',
      'Building Contractors',
      'Civil Works & Road Maintenance',
    ],
  },
  {
    label: 'Business, Legal & Financial Advisory',
    categories: [
      'Legal Consultancy',
      'Tax / Accounting Consultancy',
      'Business Registration & Corporate Services',
      'HR / Recruitment Services',
      'Insurance Brokerage',
      'Real Estate Agency',
    ],
  },
  {
    label: 'Education, Coaching & Training',
    categories: [
      'Home Tutors',
      'Exam Preparation & Academic Coaching',
      'Vocational Training',
      'Language Lessons',
      'Music & Creative Lessons',
    ],
  },
  {
    label: 'Creative, Lifestyle & Events',
    categories: [
      'Digital Printing Services',
      'Graphic Design & Branding',
      'Photography & Videography',
      'Event Planning & Rentals',
      'Catering & Food Services',
      'Tailoring & Fashion Design',
      'Beauty, Spa & Wellness',
      'Makeup & Hair Styling',
    ],
  },
  {
    label: 'Technology & Digital Services',
    categories: [
      'Software Development',
      'Website & App Development',
      'IT Support & Networking',
      'Digital Marketing',
      'Data & Business Analytics',
      'Cybersecurity Services',
    ],
  },
  {
    label: 'Health, Care & Essential Services',
    categories: [
      'Healthcare Services',
      'Physiotherapy & Wellness',
      'Caregiving & Home Care',
      'Restaurant & Lounge Services',
      'Tradesmen & Retailers',
      'General Services',
    ],
  },
] as const

export type JobCategory = typeof BUSINESS_CATEGORY_GROUPS[number]['categories'][number]

export const JOB_CATEGORIES = BUSINESS_CATEGORY_GROUPS.flatMap((group) => group.categories) as JobCategory[]

export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'

export type JobTimeline = 'urgent' | 'this_week' | 'this_month' | 'flexible'
export type JobType = 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship'
export type WorkArrangement = 'on-site' | 'remote' | 'hybrid'

export interface Job {
  id: string
  title: string
  shortDescription: string
  description: string
  category: string
  budget: number
  city: string
  status: JobStatus
  timeline: JobTimeline
  posterId: string
  posterName: string
  businessName: string
  businessAddress: string
  jobType: JobType
  workArrangement: WorkArrangement
  closingDate: string
  applicationCount: number
  createdAt: string
}

export interface JobPostPayload {
  title: string
  shortDescription: string
  description: string
  category: string
  budget: number
  city: string
  timeline: JobTimeline
  businessName: string
  businessAddress: string
  jobType: JobType
  workArrangement: WorkArrangement
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

export type ApplicationStatus = 'pending' | 'reviewing' | 'shortlisted' | 'rejected' | 'hired'

export interface WorkExperience {
  jobTitle: string
  employer: string
  startDate: string
  endDate?: string
  current: boolean
  description?: string
}

export interface Application {
  id: string
  jobId: string
  jobTitle: string
  applicantId: string
  applicantName: string
  firstName: string
  lastName: string
  coverLetter: string
  education: string
  workExperience: WorkExperience[]
  cvOriginalName: string
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
