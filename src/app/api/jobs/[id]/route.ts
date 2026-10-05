import { NextRequest, NextResponse } from 'next/server'
import { deleteVacancyByRecruiter, getVacancyById, updateVacancyByRecruiter } from '@/lib/queries'
import { vacancyRowToJob } from '@/lib/jobs'
import { getVerifiedSession } from '@/lib/auth'
import { jobPostSchema } from '@/lib/validators/job'
import type { ApiResponse, Job } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const vacancyId = Number(id)
  if (!Number.isInteger(vacancyId) || vacancyId < 1) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Job not found' }, { status: 404 })
  }

  const vacancy = await getVacancyById(vacancyId)
  if (!vacancy) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json<ApiResponse<Job>>(
    { success: true, data: vacancyRowToJob(vacancy) },
    { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' } }
  )
}

async function getRecruiterJob(params: Promise<{ id: string }>) {
  const { id } = await params
  const vacancyId = Number(id)
  const session = await getVerifiedSession()
  if (!session) return { error: NextResponse.json<ApiResponse<null>>({ success: false, error: 'Authentication required' }, { status: 401 }) }
  if (session.role !== 'recruiter') return { error: NextResponse.json<ApiResponse<null>>({ success: false, error: 'Only recruiters can manage jobs' }, { status: 403 }) }
  if (!Number.isInteger(vacancyId) || vacancyId < 1) return { error: NextResponse.json<ApiResponse<null>>({ success: false, error: 'Job not found' }, { status: 404 }) }
  const vacancy = await getVacancyById(vacancyId)
  if (!vacancy || vacancy.posted_by_uid !== session.id) return { error: NextResponse.json<ApiResponse<null>>({ success: false, error: 'You can manage only your own job posts' }, { status: 403 }) }
  return { session, vacancyId }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const managed = await getRecruiterJob(params)
    if ('error' in managed) return managed.error
    const parsed = jobPostSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json<ApiResponse<null>>({ success: false, error: parsed.error.errors[0]?.message || 'Check the job details' }, { status: 400 })
    const updated = await updateVacancyByRecruiter(managed.vacancyId, managed.session.id, {
      company_name: parsed.data.businessName, company_address: parsed.data.businessAddress,
      vacancy_title: parsed.data.title, category: parsed.data.category,
      budgetMin: parsed.data.budgetMin, budgetMax: parsed.data.budgetMax, timeline: parsed.data.timeline,
      vacancy_location: parsed.data.city, job_type: parsed.data.jobType, jobLevel: parsed.data.jobLevel,
      work_type: parsed.data.workArrangement, required_skills: parsed.data.description,
      short_description: parsed.data.shortDescription, job_description: parsed.data.description,
      closing_date: parsed.data.closingDate,
    })
    if (!updated) return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Job could not be updated' }, { status: 409 })
    return NextResponse.json<ApiResponse<null>>({ success: true, message: 'Job updated successfully' })
  } catch (error) {
    console.error('[JOBS PATCH]', error)
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Could not update job' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const managed = await getRecruiterJob(params)
    if ('error' in managed) return managed.error
    const result = await deleteVacancyByRecruiter(managed.vacancyId, managed.session.id)
    if (result === 'has_applications') return NextResponse.json<ApiResponse<null>>({ success: false, error: 'This job has applications and cannot be deleted. Keep it for your hiring records.' }, { status: 409 })
    if (result !== 'deleted') return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Job not found' }, { status: 404 })
    return NextResponse.json<ApiResponse<null>>({ success: true, message: 'Job deleted' })
  } catch (error) {
    console.error('[JOBS DELETE]', error)
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Could not delete job' }, { status: 500 })
  }
}
