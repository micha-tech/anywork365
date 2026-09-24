import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SectionHeader({ title, description, action, page = false, className }: { title: string; description?: string; action?: ReactNode; page?: boolean; className?: string }) {
  const Heading = page ? 'h1' : 'h2'
  return <header className={cn('section-header', className)}>
    <div className="section-header-copy">
      <Heading className={page ? 'page-heading' : 'section-heading'}>{title}</Heading>
      {description && <p className="page-description">{description}</p>}
    </div>
    {action}
  </header>
}
