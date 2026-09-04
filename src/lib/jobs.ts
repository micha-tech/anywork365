import type { Job, JobLevel, JobTimeline, JobType, WorkArrangement } from '@/types'
import type { VacancyRow } from '@/lib/queries'
import { formatCurrency } from '@/lib/utils'

const TIMELINES: JobTimeline[] = ['urgent', 'this_week', 'this_month', 'flexible']
const JOB_TYPES: JobType[] = ['full-time', 'part-time', 'contract', 'temporary', 'internship']
const WORK_ARRANGEMENTS: WorkArrangement[] = ['on-site', 'remote', 'hybrid']

export function vacancyRowToJob(row: VacancyRow): Job {
  const deadlinePassed = Boolean(row.closing_date && new Date(row.closing_date).getTime() < Date.now())
  const normalizedType = row.job_type.toLowerCase().replace(/\s+/g, '-') as JobType
  const normalizedArrangement = row.work_type.toLowerCase().replace(/\s+/g, '-') as WorkArrangement
  const normalizedLevel = (row.job_type === 'internship' ? 'internship' : row.job_level || 'mid-level') as JobLevel
  const budgetMin = Number(row.budget_min ?? row.budget ?? 0)
  const budgetMax = Number(row.budget_max ?? row.budget ?? budgetMin)

  return {
    id: String(row.vacancy_id),
    title: row.vacancy_title,
    shortDescription: row.short_description || row.job_description.slice(0, 320),
    description: row.job_description,
    category: row.category || 'Other',
    budget: budgetMin,
    budgetMin,
    budgetMax,
    city: row.vacancy_location,
    status: row.closed || deadlinePassed ? 'completed' : 'open',
    timeline: TIMELINES.includes(row.timeline as JobTimeline) ? row.timeline as JobTimeline : 'flexible',
    posterId: row.posted_by_uid || '',
    posterName: row.poster_name || 'Recruiter',
    businessName: row.company_name || 'Hiring company',
    businessAddress: row.company_address || row.vacancy_location,
    jobType: JOB_TYPES.includes(normalizedType) ? normalizedType : 'full-time',
    workArrangement: WORK_ARRANGEMENTS.includes(normalizedArrangement) ? normalizedArrangement : 'on-site',
    jobLevel: ['internship', 'entry-level', 'mid-level', 'senior-level', 'executive'].includes(normalizedLevel) ? normalizedLevel : 'mid-level',
    closingDate: row.closing_date || '',
    applicationCount: Number(row.application_count || 0),
    createdAt: row.date_created,
  }
}

export function formatJobBudget(job: Pick<Job, 'budget' | 'budgetMin' | 'budgetMax'>): string {
  const min = Number(job.budgetMin ?? job.budget ?? 0)
  const max = Number(job.budgetMax ?? min)
  return min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`
}
