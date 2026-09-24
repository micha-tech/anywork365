import Image from 'next/image'
import { cn } from '@/lib/utils'

export type StoryArtKind = 'people' | 'work' | 'inbox' | 'ready'

/** Decorative storytelling only; never substitutes for a user's photograph. */
export function StoryArt({ kind, className, priority = false }: { kind: StoryArtKind; className?: string; priority?: boolean }) {
  return <Image src={`/images/story/${kind}.webp`} alt="" width={kind === 'people' ? 768 : 384} height={kind === 'people' ? 512 : 320} sizes={kind === 'people' ? '(max-width: 768px) 90vw, 560px' : '192px'} priority={priority} className={cn('story-art', className)} />
}
