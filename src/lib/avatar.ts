export function getAvatarUrl(profileImage?: string | null): string | undefined {
  if (!profileImage) return undefined
  if (/^https?:\/\//i.test(profileImage) || profileImage.startsWith('/')) return profileImage
  return `/uploads/${profileImage}`
}
