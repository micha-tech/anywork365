import type { ApiResponse } from '@/types'

// In the browser, always use same-origin requests so remote devices
// (for example over Tailscale) do not accidentally call their own localhost.
const BASE_URL =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? '')
    : ''

// ─── Generic Fetch Wrapper ────────────────────────────────────────────────────

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    })
    const data = await res.json()
    if (!res.ok) {
      return { success: false, error: data.error ?? 'Something went wrong' }
    }
    return { success: true, data }
  } catch {
    return { success: false, error: 'Network error. Please try again.' }
  }
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: (payload: { email: string; password: string }) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),

  signup: (payload: object) =>
    request('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),

  logout: () =>
    request('/api/auth/logout', { method: 'POST' }),
}

// ─── Jobs API ─────────────────────────────────────────────────────────────────

export const jobsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/api/jobs${qs}`)
  },

  get: (id: string) => request(`/api/jobs/${id}`),

  create: (payload: object) =>
    request('/api/jobs', { method: 'POST', body: JSON.stringify(payload) }),
}

// ─── Users API ────────────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/api/users${qs}`)
  },

  get: (id: string) => request(`/api/users/${id}`),

  updateProfile: (payload: object) =>
    request('/api/users/me', { method: 'PATCH', body: JSON.stringify(payload) }),
}
