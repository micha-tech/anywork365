import { unstable_cache } from 'next/cache'
import { revalidateTag } from 'next/cache'

export const CACHE_TAGS = {
  PROFESSIONALS: 'professionals',
  PROFESSIONAL: (id: string) => `professional-${id}`,
  ADMIN_STATS: 'admin-stats',
} as const

type CacheKey = string

const DEFAULT_TTL = 300

export function cachedQuery<T>(
  fn: () => Promise<T>,
  keyParts: CacheKey[],
  tags: CacheKey[],
  ttl = DEFAULT_TTL
): Promise<T> {
  const cached = unstable_cache(
    fn,
    keyParts,
    { revalidate: ttl, tags }
  )
  return cached()
}

export { revalidateTag }
