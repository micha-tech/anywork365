import { NextRequest, NextResponse } from 'next/server'
import { getVacancyById } from '@/lib/queries'
import { vacancyRowToJob } from '@/lib/jobs'
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
