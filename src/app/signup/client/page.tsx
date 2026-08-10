import { ActiveRegistrationForm } from '@/components/auth/ActiveRegistrationForm'
import { RegistrationShell } from '@/components/auth/RegistrationShell'

export default function ClientRegistrationPage() {
  return (
    <RegistrationShell
      role="Client"
      title="Find and book an artisan"
      description="Create a client account to compare artisans, book services and manage your jobs."
      benefits={['Find the right skills faster', 'Keep every booking organised', 'Pay securely on the platform']}
      imageSrc="/images/registration-client.jpg"
      imageAlt="A confident Anywork365 client"
      imagePosition="center 28%"
      icon={<ClientIcon />}
    >
      <ActiveRegistrationForm accountType="client" />
    </RegistrationShell>
  )
}

function ClientIcon() {
  return <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6" /></svg>
}
