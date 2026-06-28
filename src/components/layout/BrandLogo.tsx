'use client'

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type BrandLogoProps = {
  className?: string
  href?: string
  imageClassName?: string
  priority?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_STYLES = {
  sm: {
    wrapper: 'h-10 w-10',
    image: 'h-full w-auto max-w-full',
  },
  md: {
    wrapper: 'h-11 w-11 sm:h-12 sm:w-12',
    image: 'h-full w-auto max-w-full',
  },
  lg: {
    wrapper: 'h-16 w-16 sm:h-20 sm:w-20',
    image: 'h-full w-auto max-w-full',
  },
} as const

export function BrandLogo({
  className,
  href = '/',
  imageClassName,
  priority = false,
  size = 'md',
}: BrandLogoProps) {
  const styles = SIZE_STYLES[size]

  const content = (
    <span className={cn('inline-flex min-w-0 items-center', styles.wrapper, className)}>
      <Image
        src="/logo.png"
        alt="Anywork365.ng"
        width={512}
        height={512}
        priority={priority}
        sizes="(max-width: 640px) 40px, (max-width: 1024px) 48px, 80px"
        className={cn('block', styles.image, imageClassName)}
      />
    </span>
  )

  if (!href) return content

  return (
    <Link href={href} className="inline-flex min-w-0 items-center">
      {content}
    </Link>
  )
}
