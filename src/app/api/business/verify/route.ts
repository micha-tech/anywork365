import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getBusinessByUid, submitVerification, getLatestVerification } from '@/lib/queries'
import type { ApiResponse } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (session.role !== 'vendor') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only vendors can submit business verification' },
        { status: 403 }
      )
    }

    const business = await getBusinessByUid(session.id)
    if (!business) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Business account not found' },
        { status: 404 }
      )
    }

    const schema = z.object({
      nin: z.string().length(11, 'NIN must be exactly 11 digits').regex(/^\d+$/, 'NIN must contain only numbers'),
      photo_url: z.string().url().nullable().optional(),
      nin_card_url: z.string().url().nullable().optional(),
      utility_bill_url: z.string().url().nullable().optional(),
      business_registration_url: z.string().url().nullable().optional(),
      trade_certificate_url: z.string().url().nullable().optional(),
    })

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const existing = await getLatestVerification(business.businessId)
    if (existing && existing.status === 'pending') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'You already have a pending verification request' },
        { status: 409 }
      )
    }

    const id = await submitVerification({
      businessId: business.businessId,
      nin: parsed.data.nin,
      photo_url: parsed.data.photo_url ?? null,
      nin_card_url: parsed.data.nin_card_url ?? null,
      utility_bill_url: parsed.data.utility_bill_url ?? null,
      business_registration_url: parsed.data.business_registration_url ?? null,
      trade_certificate_url: parsed.data.trade_certificate_url ?? null,
    })

    return NextResponse.json<ApiResponse<{ id: number }>>(
      { success: true, data: { id }, message: 'Verification submitted successfully. Pending review.' },
      { status: 201 }
    )
  } catch (err) {
    console.error('[BUSINESS VERIFY]', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to submit verification' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (session.role !== 'vendor') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only vendors can check verification status' },
        { status: 403 }
      )
    }

    const business = await getBusinessByUid(session.id)
    if (!business) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Business account not found' },
        { status: 404 }
      )
    }

    const verification = await getLatestVerification(business.businessId)

    return NextResponse.json({
      success: true,
      data: {
        isVerified: business.verified === 1,
        verification: verification
          ? {
              id: verification.id,
              status: verification.status,
              nin: verification.nin,
              photo_url: verification.photo_url,
              nin_card_url: verification.nin_card_url,
              utility_bill_url: verification.utility_bill_url,
              business_registration_url: verification.business_registration_url,
              trade_certificate_url: verification.trade_certificate_url,
              admin_notes: verification.admin_notes,
              submitted_at: verification.submitted_at,
              reviewed_at: verification.reviewed_at,
            }
          : null,
      },
    })
  } catch (err) {
    console.error('[BUSINESS VERIFY GET]', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to load verification status' },
      { status: 500 }
    )
  }
}
