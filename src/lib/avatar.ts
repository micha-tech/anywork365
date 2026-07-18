export function getAvatarUrl(profileImage?: string | null): string | undefined {
  const value = profileImage?.trim().replace(/\\/g, '/')
  if (!value) return undefined
  if (/^(?:https?:\/\/|\/\/|data:image\/)/i.test(value)) return value

  const localPath = value
    .replace(/^\.?\/?public\/uploads\//i, 'uploads/')
    .replace(/^\.\//, '')

  if (localPath.startsWith('/')) return localPath
  if (/^uploads\//i.test(localPath)) return `/${localPath}`
  return `/uploads/${localPath}`
}
