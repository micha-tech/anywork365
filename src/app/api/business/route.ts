import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getBusinessByUid, updateBusiness } from '@/lib/queries'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

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
        { success: false, error: 'Only vendors can access business info' },
        { status: 403 }
      )
    }

    const business = await getBusinessByUid(session.id)
    if (!business) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Business not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        businessId: business.businessId,
        businessName: business.businessName,
        category: business.category,
        businessContact: business.businessContact,
        description: business.description,
        location: business.location,
        state: business.state,
        lga: business.lga,
        yearsOfExperience: business.yearsOfExperience,
        feePerHour: business.feePerHour,
        businessLogo: business.businessLogo,
        verified: business.verified,
      },
    })
  } catch (err) {
    console.error('[BUSINESS GET]', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to load business info' },
      { status: 500 }
    )
  }
}

const updateSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').optional(),
  category: z.string().min(1, 'Category is required').optional(),
  businessContact: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  state: z.string().optional(),
  lga: z.string().optional(),
  yearsOfExperience: z.number().min(0).optional(),
  feePerHour: z.number().min(0).optional(),
})

export async function PUT(req: NextRequest) {
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
        { success: false, error: 'Only vendors can update business info' },
        { status: 403 }
      )
    }

    const business = await getBusinessByUid(session.id)
    if (!business) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Business not found' },
        { status: 404 }
      )
    }

    const parsed = updateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    await updateBusiness(session.id, parsed.data)

    return NextResponse.json<ApiResponse<null>>(
      { success: true, message: 'Business updated successfully' },
      { status: 200 }
    )
  } catch (err) {
    console.error('[BUSINESS PUT]', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to update business' },
      { status: 500 }
    )
  }
}
