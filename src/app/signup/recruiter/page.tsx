import { FutureRoleRegistrationForm } from '@/components/auth/FutureRoleRegistrationForm'
import { RegistrationShell } from '@/components/auth/RegistrationShell'

export default function RecruiterRegistrationPage() {
  return (
    <RegistrationShell
      role="Recruiter"
      eyebrow="Hire better"
      title="Meet the people your business needs."
      description="Set up your recruiter profile to reach qualified professionals and artisans, share opportunities and manage hiring conversations."
      benefits={['Reach qualified candidates', 'Share the right opportunities', 'Keep hiring conversations organised']}
      imageSrc="/images/registration-recruiter.jpg"
      imageAlt="A recruiter speaking with a candidate"
      imagePosition="center center"
      icon={<RecruiterIcon />}
    >
      <FutureRoleRegistrationForm accountType="recruiter" />
    </RegistrationShell>
  )
}

function RecruiterIcon() {
  return <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3 19c.6-3.6 2.6-5.4 6-5.4 1.2 0 2.3.2 3.1.7" /><circle cx="17" cy="16" r="3" /><path d="m19.2 18.2 2.3 2.3" /></svg>
}
