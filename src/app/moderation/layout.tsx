import { requireAdmin } from '@/lib/admin'
import { ModerationShell } from '@/components/moderation/ModerationShell'

export default async function ModerationLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()
  return (
    <ModerationShell
      operator={{
        email: session.email,
        name: `${session.firstName} ${session.lastName}`.trim() || session.email,
      }}
    >
      {children}
    </ModerationShell>
  )
}
