import { NextRequest, NextResponse } from 'next/server'
import { listVacancies, createVacancy, getCompanyByUid } from '@/lib/queries'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'
import { jobPostSchema } from '@/lib/validators/job'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse, Job } from '@/types'
import type { RowDataPacket } from 'mysql2'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const location = searchParams.get('city')
  const job_type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') || '0')

  const rows = await listVacancies({ search: search || undefined, location: location || undefined, job_type: job_type || undefined })
  const sliced = limit > 0 ? rows.slice(0, limit) : rows
  const ids = sliced.map((r) => r.company_id).filter(Boolean)

  const companyMap: Record<number, { name: string; address: string }> = {}
  if (ids.length > 0) {
    interface CompanyRow extends RowDataPacket {
      company_id: number
      company_name: string
      company_address: string | null
    }
    const companies = await query<CompanyRow[]>(
      `SELECT company_id, company_name, company_address FROM companies WHERE company_id IN (${ids.map(() => '?').join(',')})`,
      ids
    )
    for (const c of companies) {
      companyMap[c.company_id] = { name: c.company_name, address: c.company_address || '' }
    }
  }

  const jobs: Job[] = sliced.map((r) => {
    const company = companyMap[r.company_id]
    return {
      id: String(r.vacancy_id),
      title: r.vacancy_title,
      description: r.job_description,
      category: r.work_type === 'Remote' ? 'Professional services' : 'General services' as Job['category'],
      budget: 0,
      city: r.vacancy_location,
      status: r.closed ? 'completed' as Job['status'] : 'open' as Job['status'],
      timeline: 'flexible',
      posterId: '',
      posterName: '',
      businessName: company?.name || '',
      businessAddress: company?.address || '',
      jobType: r.work_type === 'Remote' ? 'contract' : 'full-time',
      closingDate: r.closing_date || '',
      applicationCount: 0,
      createdAt: r.date_created,
    }
  })

  return NextResponse.json<ApiResponse<Job[]>>(
    { success: true, data: jobs },
    { status: 200 }
  )
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
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

    const companies = await getCompanyByUid(session.id)
    const companyId = companies.length > 0 ? companies[0].company_id : 0

    const insertId = await createVacancy({
      company_id: companyId,
      vacancy_title: parsed.data.title,
      vacancy_location: parsed.data.city,
      job_type: parsed.data.jobType || 'Full-Time',
      work_type: 'On-Site',
      required_skills: parsed.data.description || '',
      job_description: parsed.data.description,
      closing_date: parsed.data.closingDate || undefined,
    })

    const newJob: Job = {
      id: String(insertId),
      title: parsed.data.title,
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
      jobType: (parsed.data.jobType || 'full-time') as Job['jobType'],
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