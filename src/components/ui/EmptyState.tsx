import type { ReactNode } from 'react'
import { StoryArt } from './StoryArt'

export interface EmptyStateProps {
  icon?: 'bookings' | 'jobs' | 'messages' | 'wallet' | 'search' | ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon = 'search', title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {typeof icon === 'string' ? (
        <StoryArt kind={icon === 'messages' ? 'inbox' : 'work'} className="w-36 sm:w-44" />
      ) : <div className="friendly-icon h-16 w-16">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
