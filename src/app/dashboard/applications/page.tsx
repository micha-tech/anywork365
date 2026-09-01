import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getVerifiedSession } from '@/lib/auth'
import { getApplicationsForRecruiter } from '@/lib/queries'
import type { WorkExperience } from '@/types'

export const dynamic = 'force-dynamic'

function parseQualification(value: string | null): string {
  if (!value) return ''
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'string' ? parsed : value
  } catch {
    return value
  }
}

function parseExperience(value: string | null): WorkExperience[] {
  if (!value) return []
  try {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed as WorkExperience[] : []
  } catch {
    return []
  }
}

export default async function RecruiterApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>
}) {
  const session = await getVerifiedSession()
  if (!session || session.role !== 'recruiter') redirect('/jobs')

  const { job } = await searchParams
  const vacancyId = job && Number.isInteger(Number(job)) ? Number(job) : undefined
  const applications = await getApplicationsForRecruiter(session.id, vacancyId)

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 rounded-3xl border border-brand-100 bg-[#efffde] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">Job applications</h1>
            <p className="mt-1 text-sm text-slate-600">Review candidates who applied to your published jobs.</p>
          </div>
          <Link href="/dashboard/jobs" className="btn-ghost px-4 py-2.5 text-sm">Manage jobs</Link>
        </div>
      </div>

      {vacancyId && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span>Filtered to job #{vacancyId}</span>
          <Link href="/dashboard/applications" className="font-semibold text-brand-600">View all</Link>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="friendly-card px-5 py-14 text-center">
          <h2 className="font-semibold text-slate-900">No applications yet</h2>
          <p className="mt-1 text-sm text-slate-500">Applications will appear here as candidates submit them.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((application) => {
            const experience = parseExperience(application.work_experience)
            return (
              <article key={application.application_id} className="friendly-card p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{application.vacancy_title}</p>
                    <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">{application.first_name} {application.last_name}</h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      {application.applicant_email && <a href={`mailto:${application.applicant_email}`} className="hover:text-brand-600">{application.applicant_email}</a>}
                      {application.applicant_phone && <a href={`tel:${application.applicant_phone}`} className="hover:text-brand-600">{application.applicant_phone}</a>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold capitalize text-amber-700">{application.status}</span>
                    <span className="text-xs text-slate-500">{new Date(application.applied_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={`/api/job-applications/${application.application_id}/cv`} className="btn-primary px-4 py-2 text-xs">
                    Download CV{application.cv_original_name ? ` · ${application.cv_original_name}` : ''}
                  </a>
                  {application.applicant_email && <a href={`mailto:${application.applicant_email}`} className="btn-ghost px-4 py-2 text-xs">Email candidate</a>}
                </div>

                <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-800">Review full application</summary>
                  <div className="mt-4 space-y-5 text-sm">
                    <section>
                      <h3 className="font-semibold text-slate-900">Cover letter</h3>
                      <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-600">{application.cover_letter}</p>
                    </section>
                    <section>
                      <h3 className="font-semibold text-slate-900">Professional qualification</h3>
                      <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-600">{parseQualification(application.education)}</p>
                    </section>
                    <section>
                      <h3 className="font-semibold text-slate-900">Work experience</h3>
                      <div className="mt-2 space-y-3">
                        {experience.map((item, index) => (
                          <div key={`${item.employer}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
                            <p className="font-semibold text-slate-800">{item.jobTitle} · {item.employer}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{item.startDate} – {item.current ? 'Present' : item.endDate}</p>
                            {item.description && <p className="mt-2 whitespace-pre-wrap text-slate-600">{item.description}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </details>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
