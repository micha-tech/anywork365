import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDashboardStats, getRecentActivity } from '@/lib/queries'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    )
  }

  const [stats, activity] = await Promise.all([
    getDashboardStats(session.id, session.role),
    getRecentActivity(session.id, session.role),
  ])

  const changeMap: Record<string, string> = {
    activeJobs: stats.activeJobs > 0 ? `↑ ${stats.activeJobs} active` : 'No active jobs',
    applications: stats.applications > 0 ? `↑ ${stats.applications} total` : 'No applications yet',
    hiredPros: stats.hiredPros > 0 ? `↑ ${stats.hiredPros} hired` : 'No hires yet',
    jobsCompleted: stats.jobsCompleted > 0 ? `↑ ${stats.jobsCompleted} completed` : 'No completed jobs',
  }

  return NextResponse.json<ApiResponse<{ stats: typeof stats; activity: typeof activity; changeMap: typeof changeMap }>>(
    { success: true, data: { stats, activity, changeMap } },
    { status: 200, headers: { 'Cache-Control': 'private, no-cache' } }
  )
}
