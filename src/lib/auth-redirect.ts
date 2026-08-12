export const AUTH_REDIRECT_PARAM = 'redirect'

export function getSafeInternalRedirect(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null

  try {
    const url = new URL(value, 'https://anywork365.local')
    if (url.origin !== 'https://anywork365.local') return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function getBrowserAuthRedirect(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const directRedirect = getSafeInternalRedirect(params.get(AUTH_REDIRECT_PARAM))
  if (directRedirect) return directRedirect

  // Firebase email-action links can carry our verification page inside a
  // continueUrl parameter. Recover the original job redirect from it.
  const continueUrl = params.get('continueUrl')
  if (!continueUrl) return null
  try {
    const nestedUrl = new URL(continueUrl)
    return getSafeInternalRedirect(nestedUrl.searchParams.get(AUTH_REDIRECT_PARAM))
  } catch {
    return null
  }
}

export function withAuthRedirect(path: string, redirect: string | null): string {
  const safeRedirect = getSafeInternalRedirect(redirect)
  if (!safeRedirect) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}${AUTH_REDIRECT_PARAM}=${encodeURIComponent(safeRedirect)}`
}
