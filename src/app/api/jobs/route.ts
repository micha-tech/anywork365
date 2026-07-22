import { NextRequest, NextResponse } from 'next/server'
import { listVacancies, createVacancy } from '@/lib/queries'
import { getVerifiedSession } from '@/lib/auth'
import { vacancyRowToJob } from '@/lib/jobs'
import { jobPostSchema } from '@/lib/validators/job'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse, Job } from '@/types'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const location = searchParams.get('city')
  const job_type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') || '0')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(24, Math.max(1, parseInt(searchParams.get('pageSize') || String(limit || 8))))

  const rows = await listVacancies({ search: search || undefined, location: location || undefined, job_type: job_type || undefined })
  const start = (page - 1) * pageSize
  const sliced = rows.slice(start, start + pageSize)
  const jobs: Job[] = sliced.map(vacancyRowToJob)

  return NextResponse.json<ApiResponse<Job[]> & { meta: { page: number; pageSize: number; total: number; hasMore: boolean } }>(
    {
      success: true,
      data: jobs,
      meta: {
        page,
        pageSize,
        total: rows.length,
        hasMore: start + pageSize < rows.length,
      },
    },
    { status: 200, headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const session = await getVerifiedSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (session.role !== 'recruiter') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only recruiters can post jobs' },
        { status: 403 }
      )
    }

    const rateLimit = checkRateLimit(`jobs:${session.id}`, 3, 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Too many requests. Please try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429 }
      )
    }

    const body = await req.json()
    const parsed = jobPostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const insertId = await createVacancy({
      company_id: 0,
      posted_by_uid: session.id,
      company_name: parsed.data.businessName,
      company_address: parsed.data.businessAddress,
      vacancy_title: parsed.data.title,
      category: parsed.data.category,
      budget: parsed.data.budget,
      timeline: parsed.data.timeline,
      vacancy_location: parsed.data.city,
      job_type: parsed.data.jobType,
      work_type: parsed.data.workArrangement,
      required_skills: parsed.data.description || '',
      short_description: parsed.data.shortDescription,
      job_description: parsed.data.description,
      closing_date: parsed.data.closingDate || undefined,
    })

    const newJob: Job = {
      id: String(insertId),
      title: parsed.data.title,
      shortDescription: parsed.data.shortDescription,
      description: parsed.data.description,
      category: parsed.data.category as Job['category'],
      budget: parsed.data.budget,
      city: parsed.data.city,
      status: 'open',
      timeline: parsed.data.timeline || 'flexible',
      posterId: session.id,
      posterName: `${session.firstName} ${session.lastName}`,
      businessName: parsed.data.businessName || '',
      businessAddress: parsed.data.businessAddress || '',
      jobType: parsed.data.jobType as Job['jobType'],
      workArrangement: parsed.data.workArrangement as Job['workArrangement'],
      closingDate: parsed.data.closingDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      applicationCount: 0,
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json<ApiResponse<Job>>(
      { success: true, data: newJob, message: 'Job posted successfully' },
      { status: 201 }
    )
  } catch (err) {
    console.error('[JOBS POST]', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
