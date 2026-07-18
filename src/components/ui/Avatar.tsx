'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const AVATAR_COLORS = [
  'bg-brand-500',
  'bg-blue-600',
  'bg-purple-600',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-600',
  'bg-indigo-600',
]

interface AvatarProps {
  initials: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  colorIndex?: number
  className?: string
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
}

export function Avatar({ initials, src, size = 'md', colorIndex = 0, className }: AvatarProps) {
  const imageSrc = src?.trim() || null
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = imageSrc !== null && imageSrc !== failedSrc
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]

  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white',
        sizeMap[size],
        color,
        className
      )}
    >
      {showImage ? (
        <Image
          src={imageSrc}
          alt={initials}
          width={80}
          height={80}
          className="h-full w-full object-cover"
          unoptimized
          onError={() => setFailedSrc(imageSrc)}
        />
      ) : (
        <span className="leading-none">{initials}</span>
      )}
    </div>
  )
}
