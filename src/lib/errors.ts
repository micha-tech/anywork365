export const CALM_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists',
  'auth/weak-password': 'Choose a stronger password',
  'auth/invalid-email': 'Please enter a valid email address',
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password',
  'auth/invalid-credential': 'Incorrect email or password',
  'auth/invalid-login-credentials': 'Incorrect email or password',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/user-disabled': 'This account has been disabled',
  auth: 'Please check your credentials and try again',
  network: 'Connection issue. Please check your internet and try again.',
  default: 'Something didn\u2019t work. Please try again.',
}

export function toErrorMessage(e: unknown): string {
  if (typeof e === 'string') return CALM_MESSAGES[e] ?? CALM_MESSAGES.default
  if (e && typeof e === 'object') {
    const code = (e as { code?: string }).code
    if (code && CALM_MESSAGES[code]) return CALM_MESSAGES[code]
  }
  return CALM_MESSAGES.default
}
