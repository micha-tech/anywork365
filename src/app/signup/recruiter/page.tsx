import { FutureRoleRegistrationForm } from '@/components/auth/FutureRoleRegistrationForm'
import { RegistrationShell } from '@/components/auth/RegistrationShell'

export default function RecruiterRegistrationPage() {
  return (
    <RegistrationShell
      role="Recruiter"
      eyebrow="Hire with confidence"
      title="Find the talent your organisation needs."
      description="Create a recruiter account to represent your organisation, publish opportunities, review candidates, and build a reliable talent pipeline."
      benefits={['Publish opportunities and hiring needs', 'Discover artisans and professionals', 'Organise candidates in one place']}
      icon={<RecruiterIcon />}
    >
      <FutureRoleRegistrationForm accountType="recruiter" />
    </RegistrationShell>
  )
}

function RecruiterIcon() {
  return <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3 19c.6-3.6 2.6-5.4 6-5.4 1.2 0 2.3.2 3.1.7" /><circle cx="17" cy="16" r="3" /><path d="m19.2 18.2 2.3 2.3" /></svg>
}
