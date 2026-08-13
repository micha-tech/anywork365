import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedSession } from '@/lib/auth'
import {
  getBusinessByUid,
  getProfessionalBackgroundByUid,
  getProfessionalProfileByUid,
  getUserRowByUid,
  updateBusiness,
  updateProfessionalBackground,
  updateProfessionalProfile,
  updateUserProfile,
} from '@/lib/queries'
import { getAvatarUrl } from '@/lib/avatar'
import { isLocalGovernmentInState } from '@/lib/nigeria-locations'
import {
  INDUSTRY_CATEGORIES,
  PROFESSIONAL_QUALIFICATIONS,
  PROFESSIONAL_SERVICE_CATEGORIES,
} from '@/lib/registration-options'
import { BUSINESS_CATEGORY_GROUPS, NIGERIAN_STATE_NAMES, type NigerianState } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const artisanCategories = BUSINESS_CATEGORY_GROUPS.flatMap((group) => group.categories) as [string, ...string[]]
const currentYear = new Date().getFullYear()

const artisanBusinessSchema = z.object({
  action: z.literal('artisan-business'),
  businessName: z.string().trim().min(2, 'Enter your business or trading name').max(255),
  category: z.enum(artisanCategories),
  businessContact: z.string().trim().min(7, 'Enter a valid business phone number').max(50),
  yearsOfExperience: z.coerce.number().int().min(0).max(80),
})

const personalSchema = z.object({
  action: z.literal('personal'),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(50),
  state: z.enum(NIGERIAN_STATE_NAMES),
  lga: z.string().trim().min(1, 'Select your local government').max(100),
  address: z.string().trim().min(5, 'Enter an address or service location').max(500),
  bio: z.string().trim().max(1000),
}).superRefine((data, context) => {
  if (!isLocalGovernmentInState(data.state as NigerianState, data.lga)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['lga'], message: 'Select a local government in the chosen state' })
  }
})

const professionalCoreSchema = z.object({
  action: z.literal('professional-core'),
  industryCategory: z.enum(INDUSTRY_CATEGORIES),
  professionalServiceCategory: z.enum(PROFESSIONAL_SERVICE_CATEGORIES),
  jobTitle: z.string().trim().min(2, 'Enter your current or preferred job title').max(160),
  qualification: z.enum(PROFESSIONAL_QUALIFICATIONS),
  yearsExperience: z.coerce.number().int().min(0).max(70),
  linkedinOrPortfolioUrl: z.union([z.literal(''), z.string().url('Enter a valid LinkedIn or portfolio URL')]),
})

const certificationSchema = z.object({
  name: z.string().trim().min(2).max(180),
  yearObtained: z.coerce.number().int().min(1950).max(currentYear),
})

const experienceSchema = z.object({
  jobTitle: z.string().trim().min(2, 'Enter your role').max(160),
  employer: z.string().trim().min(2, 'Enter the employer or organisation').max(180),
  startYear: z.coerce.number().int().min(1950).max(currentYear),
  endYear: z.coerce.number().int().min(1950).max(currentYear).optional(),
  current: z.boolean(),
  description: z.string().trim().max(1200).optional(),
}).superRefine((experience, context) => {
  if (!experience.current && !experience.endYear) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endYear'], message: 'Enter the year this role ended' })
  }
  if (experience.endYear && experience.endYear < experience.startYear) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endYear'], message: 'End year cannot be before start year' })
  }
})

const professionalBackgroundSchema = z.object({
  action: z.literal('professional-background'),
  schoolName: z.string().trim().min(2, 'Enter your school or training institution').max(220),
  certifications: z.array(certificationSchema).max(20),
  workExperience: z.array(experienceSchema).min(1, 'Add at least one work experience').max(20),
})

const setupUpdateSchema = z.union([
  artisanBusinessSchema,
  personalSchema,
  professionalCoreSchema,
  professionalBackgroundSchema,
])

export async function GET() {
  const session = await getVerifiedSession()
  if (!session) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  if (session.role !== 'artisan' && session.role !== 'professional') {
    return NextResponse.json({ success: false, error: 'Profile setup is available to artisan and professional accounts' }, { status: 403 })
  }

  const user = await getUserRowByUid(session.id)
  if (!user) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })

  const names = user.fullName.trim().split(/\s+/)
  const personal = {
    id: session.id,
    role: session.role,
    firstName: names[0] || session.firstName || '',
    lastName: names.slice(1).join(' ') || session.lastName || '',
    email: user.email,
    phone: user.phoneNumber || '',
    state: user.state || '',
    lga: user.lga || '',
    address: user.address || '',
    bio: user.bio || '',
    avatarUrl: getAvatarUrl(user.profileImage),
  }

  if (session.role === 'artisan') {
    const business = await getBusinessByUid(session.id)
    return NextResponse.json({
      success: true,
      data: {
        role: session.role,
        user: personal,
        artisan: business ? {
          businessName: business.businessName || '',
          category: business.category || '',
          businessContact: business.businessContact || '',
          description: business.description || '',
          location: business.location || '',
          state: business.state || '',
          lga: business.lga || '',
          yearsOfExperience: business.yearsOfExperience,
        } : null,
      },
    })
  }

  const [profile, background] = await Promise.all([
    getProfessionalProfileByUid(session.id),
    getProfessionalBackgroundByUid(session.id),
  ])
  return NextResponse.json({
    success: true,
    data: {
      role: session.role,
      user: personal,
      professional: profile ? {
        industryCategory: profile.industry_category || '',
        professionalServiceCategory: profile.professional_service_category || '',
        jobTitle: profile.job_title || '',
        qualification: profile.qualification || '',
        yearsExperience: profile.years_experience,
        linkedinOrPortfolioUrl: profile.linkedin_or_portfolio_url || '',
        coverImageUrl: profile.cover_image_url || '',
        schoolName: background?.schoolName || '',
        certifications: background?.certifications || [],
        workExperience: background?.workExperience || [],
      } : null,
    },
  })
}

export async function PATCH(request: NextRequest) {
  const session = await getVerifiedSession()
  if (!session) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  if (session.role !== 'artisan' && session.role !== 'professional') {
    return NextResponse.json({ success: false, error: 'Profile setup is unavailable for this account' }, { status: 403 })
  }

  try {
    const parsed = setupUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Check your profile details' }, { status: 400 })
    }

    const data = parsed.data
    if (data.action === 'artisan-business') {
      if (session.role !== 'artisan') return NextResponse.json({ success: false, error: 'Artisan account required' }, { status: 403 })
      await updateBusiness(session.id, data)
    } else if (data.action === 'personal') {
      await updateUserProfile(session.id, {
        fullName: `${data.firstName} ${data.lastName}`,
        phoneNumber: data.phone,
        state: data.state,
        lga: data.lga,
        address: data.address,
        bio: data.bio,
      })
      if (session.role === 'artisan') {
        await updateBusiness(session.id, {
          businessContact: data.phone,
          description: data.bio,
          location: data.address,
          state: data.state,
          lga: data.lga,
        })
      }
    } else if (data.action === 'professional-core') {
      if (session.role !== 'professional') return NextResponse.json({ success: false, error: 'Professional account required' }, { status: 403 })
      await updateProfessionalProfile(session.id, data)
    } else if (data.action === 'professional-background') {
      if (session.role !== 'professional') return NextResponse.json({ success: false, error: 'Professional account required' }, { status: 403 })
      await updateProfessionalBackground(session.id, data)
    }

    return NextResponse.json({ success: true, message: 'Profile updated' })
  } catch (error) {
    console.error('[PROFILE SETUP]', error)
    return NextResponse.json({ success: false, error: 'Could not save this step. Please try again.' }, { status: 500 })
  }
}
