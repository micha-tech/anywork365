'use client'

import { useEffect } from 'react'
import { AppErrorState } from '@/components/ui/AppErrorState'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Keep the diagnostic available for monitoring without exposing it in the UI.
    console.error('Application error', { digest: error.digest })
  }, [error])

  return <AppErrorState onRetry={reset} />
}
