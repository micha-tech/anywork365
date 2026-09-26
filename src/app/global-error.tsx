'use client'

import { AppErrorState } from '@/components/ui/AppErrorState'
import './globals.css'

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-[#f7f8f5] font-sans text-[#202724] antialiased">
        <AppErrorState onRetry={reset} fullScreen />
      </body>
    </html>
  )
}
