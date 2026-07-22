import type { Job, JobTimeline, JobType } from '@/types'
import type { VacancyRow } from '@/lib/queries'

const TIMELINES: JobTimeline[] = ['urgent', 'this_week', 'this_month', 'flexible']

export function vacancyRowToJob(row: VacancyRow): Job {
  const deadlinePassed = Boolean(row.closing_date && new Date(row.closing_date).getTime() < Date.now())
  const normalizedType = row.job_type.toLowerCase()

  return {
    id: String(row.vacancy_id),
    title: row.vacancy_title,
    shortDescription: row.short_description || row.job_description.slice(0, 320),
    description: row.job_description,
    category: row.category || 'Other',
    budget: Number(row.budget || 0),
    city: row.vacancy_location,
    status: row.closed || deadlinePassed ? 'completed' : 'open',
    timeline: TIMELINES.includes(row.timeline as JobTimeline) ? row.timeline as JobTimeline : 'flexible',
    posterId: row.posted_by_uid || '',
    posterName: row.poster_name || 'Recruiter',
    businessName: row.company_name || 'Hiring company',
    businessAddress: row.company_address || row.vacancy_location,
    jobType: (normalizedType === 'contract' ? 'contract' : 'full-time') as JobType,
    closingDate: row.closing_date || '',
    applicationCount: Number(row.application_count || 0),
    createdAt: row.date_created,
  }
}
