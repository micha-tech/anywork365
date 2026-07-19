import { ActiveRegistrationForm } from '@/components/auth/ActiveRegistrationForm'
import { RegistrationShell } from '@/components/auth/RegistrationShell'

export default function ArtisanRegistrationPage() {
  return (
    <RegistrationShell
      role="Artisan"
      eyebrow="Grow your business"
      title="Get discovered. Win more work."
      description="Build a trusted profile for your craft, connect with nearby clients and turn great work into repeat business."
      benefits={['Show clients what you do', 'Receive local job requests', 'Build trust with verified reviews']}
      imageSrc="/images/registration-artisan.jpg"
      imageAlt="A carpenter working carefully in his workshop"
      imagePosition="center center"
      icon={<ArtisanIcon />}
    >
      <ActiveRegistrationForm accountType="artisan" />
    </RegistrationShell>
  )
}

function ArtisanIcon() {
  return <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14.7 6.3 3-3a4 4 0 0 1-5 5L6 15l-3 1 1-3 6.7-6.7a4 4 0 0 1 5-5l-3 3 2 2Z" /><path d="m14 14 6 6" /></svg>
}
