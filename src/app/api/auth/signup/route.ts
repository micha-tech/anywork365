import { NextRequest, NextResponse } from 'next/server'
import { setSession, createSessionCookie } from '@/lib/auth'
import { auth as adminAuth } from '@/lib/firebase/admin'
import { query } from '@/lib/db'
import {
  createBusiness,
  createProfessionalProfile,
  createRecruiterProfile,
  createInternProfile,
  createUser,
  deleteSignupProfileByUid,
  getUserByUid,
} from '@/lib/queries'
import { hardDeleteAccount } from '@/lib/account-delete'
import type { RowDataPacket } from 'mysql2/promise'
import { signupSchema } from '@/lib/validators/auth'
import { checkRateLimit } from '@/lib/wallet'
import { revalidateTag, CACHE_TAGS } from '@/lib/cache'
import { isWelcomeEmailConfigured, sendWelcomeEmail } from '@/lib/email/resend'
import type { ApiResponse, AuthUser } from '@/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let createdProfileUid: string | null = null

  try {
    const { idToken, ...profileData } = await req.json()
    if (!idToken) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'ID token is required' },
        { status: 400 }
      )
    }

    // Rate limiting: 5 signups per IP per minute
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    const rateLimit = checkRateLimit(`signup:${ip}`, 5, 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Too many signup attempts. Please try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429 }
      )
    }

    const decoded = await adminAuth.verifyIdToken(idToken)
    const uid = decoded.uid
    const isGoogleSignup = decoded.firebase?.sign_in_provider === 'google.com'
    const tokenEmail = decoded.email?.trim().toLowerCase() || ''

    if (!tokenEmail || tokenEmail !== String(profileData.email || '').trim().toLowerCase()) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'The signup email does not match the authenticated account.' },
        { status: 400 }
      )
    }

    if (isGoogleSignup && decoded.email_verified !== true) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'We couldn’t verify this Google account.' },
        { status: 401 }
      )
    }

    const existing = await getUserByUid(uid)
    if (existing) {
      const sessionCookie = await createSessionCookie(idToken)
      if (sessionCookie) await setSession(sessionCookie)
      return NextResponse.json<ApiResponse<AuthUser>>(
        { success: true, data: existing, message: 'Account already exists, logged in' },
        { status: 200 }
      )
    }

    const parsed = signupSchema.safeParse(isGoogleSignup
      ? {
          ...profileData,
          password: 'GoogleOAuth1',
          confirmPassword: 'GoogleOAuth1',
        }
      : profileData)
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const {
      firstName,
      lastName,
      phone,
      nin,
      role,
      state,
      artisanServiceCategory,
      industryCategory,
      professionalServiceCategory,
      jobTitle,
      qualification,
      yearsExperience,
      linkedinOrPortfolioUrl,
      companyName,
      companySize,
      recruitmentFunction,
      position,
      companyWebsite,
      internType,
      schoolName,
      fieldOfStudy,
      graduationYear,
    } = parsed.data
    const email = parsed.data.email.trim().toLowerCase()

    const existingFirebaseUser = await adminAuth.getUserByEmail(email).catch(() => null)
    if (existingFirebaseUser?.uid === uid) {
      const staleRows = await query<(RowDataPacket & { uid: string })[]>(
        'SELECT uid FROM users WHERE LOWER(email) = LOWER(?) AND uid <> ?',
        [email, uid]
      )
      if (isGoogleSignup && staleRows.length > 0) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'An account already exists with this email. Log in with your password first to connect Google.',
          },
          { status: 409 }
        )
      }
      for (const row of staleRows) {
        await hardDeleteAccount(row.uid)
      }
    }

    await createUser({
      uid,
      email,
      fullName: `${firstName} ${lastName}`,
      phoneNumber: phone,
      role,
      state,
      nin,
      loginProvider: isGoogleSignup ? 'Google' : 'EmailAndPassword',
    })
    createdProfileUid = uid

    if (role === 'artisan') {
      await createBusiness({
        uid,
        businessName: `${firstName} ${lastName}`,
        category: artisanServiceCategory,
        businessContact: phone,
        state,
      })
      revalidateTag(CACHE_TAGS.PROFESSIONALS)
    }

    if (role === 'professional') {
      await createProfessionalProfile({
        uid,
        industryCategory: industryCategory!,
        professionalServiceCategory: professionalServiceCategory!,
        jobTitle: jobTitle!,
        qualification: qualification!,
        yearsExperience: yearsExperience!,
        linkedinOrPortfolioUrl: linkedinOrPortfolioUrl || undefined,
      })
    }

    if (role === 'recruiter') {
      await createRecruiterProfile({
        uid,
        companyName: companyName!,
        companySize: companySize!,
        industryCategory: industryCategory!,
        recruitmentFunction: recruitmentFunction!,
        position: position!,
        companyWebsite: companyWebsite || undefined,
      })
    }

    if (role === 'intern') {
      await createInternProfile({
        uid,
        internType: internType!,
        schoolName,
        fieldOfStudy,
        graduationYear,
      })
    }

    const authUser: AuthUser = {
      id: uid,
      email,
      firstName,
      lastName,
      role,
      phone,
      city: state,
    }

    const sessionCookie = await createSessionCookie(idToken)
    if (!sessionCookie) throw new Error('Failed to create session')
    await setSession(sessionCookie)

    if (isWelcomeEmailConfigured()) {
      try {
        const welcomeEmail = await sendWelcomeEmail({ uid, email, firstName, role })
        console.info('[WELCOME EMAIL SENT]', { uid, resendId: welcomeEmail.id })
      } catch (emailError) {
        // A non-critical email failure must never roll back a completed signup.
        console.error('[WELCOME EMAIL FAILED]', { uid, error: emailError })
      }
    }

    return NextResponse.json<ApiResponse<AuthUser>>(
      { success: true, data: authUser, message: 'Account created successfully' },
      { status: 201 }
    )
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    console.error('[AUTH SIGNUP]', e)

    if (createdProfileUid) {
      try {
        await deleteSignupProfileByUid(createdProfileUid)
      } catch (cleanupError) {
        console.error('[AUTH SIGNUP CLEANUP]', cleanupError)
      }
    }

    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Signup failed' },
      { status: 400 }
    )
  }
}
