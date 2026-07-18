import { FutureRoleRegistrationForm } from '@/components/auth/FutureRoleRegistrationForm'
import { RegistrationShell } from '@/components/auth/RegistrationShell'

export default function ProfessionalRegistrationPage() {
  return (
    <RegistrationShell
      role="Professional"
      eyebrow="Advance your career"
      title="Put your expertise in front of opportunity."
      description="Create a professional profile that presents your qualifications, experience, and career interests to organisations looking for proven talent."
      benefits={['Showcase qualifications and experience', 'Access relevant career opportunities', 'Connect with credible recruiters']}
      icon={<ProfessionalIcon />}
    >
      <FutureRoleRegistrationForm accountType="professional" />
    </RegistrationShell>
  )
}

function ProfessionalIcon() {
  return <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></svg>
}
