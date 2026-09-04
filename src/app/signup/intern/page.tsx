import { FutureRoleRegistrationForm } from '@/components/auth/FutureRoleRegistrationForm'
import { RegistrationShell } from '@/components/auth/RegistrationShell'

export default function InternRegistrationPage() {
  return (
    <RegistrationShell
      role="Intern"
      title="Start building your experience"
      description="Choose your intern track and create a profile for practical opportunities."
      benefits={['Find internships that fit your path', 'Show your education and interests', 'Connect with hiring teams']}
      imageSrc="/images/registration-intern.png"
      imageAlt="An intern ready for a new opportunity"
      imagePosition="center center"
      icon={<InternIcon />}
    >
      <FutureRoleRegistrationForm accountType="intern" />
    </RegistrationShell>
  )
}

function InternIcon() {
  return <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" /><path d="M7 10.5V15c2.8 2.4 7.2 2.4 10 0v-4.5" /><path d="M20 8v5" /></svg>
}
