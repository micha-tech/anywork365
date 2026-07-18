import { ActiveRegistrationForm } from '@/components/auth/ActiveRegistrationForm'
import { RegistrationShell } from '@/components/auth/RegistrationShell'

export default function ClientRegistrationPage() {
  return (
    <RegistrationShell
      role="Client"
      eyebrow="Find trusted help"
      title="Get the right person for every job."
      description="Create a client account to discover artisans and professionals, request services, communicate clearly, and keep work organised."
      benefits={['Discover trusted service providers', 'Manage bookings and conversations', 'Pay securely through the platform']}
      icon={<ClientIcon />}
    >
      <ActiveRegistrationForm accountType="client" />
    </RegistrationShell>
  )
}

function ClientIcon() {
  return <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6" /></svg>
}
