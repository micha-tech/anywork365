'use client'

import { usePullToRefresh } from '@/hooks/usePullToRefresh'

export function PullToRefresh({ onRefresh, children }: { onRefresh: () => void | Promise<void>; children: React.ReactNode }) {
  const { refreshing, pullDistance, handlers } = usePullToRefresh(onRefresh)

  return (
    <div {...handlers} className="relative">
      {refreshing && (
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 ml-2">Refreshing...</span>
        </div>
      )}
      {pullDistance > 0 && !refreshing && (
        <div className="flex items-center justify-center overflow-hidden transition-all" style={{ height: pullDistance }}>
          <span className="text-xs text-slate-400">
            {pullDistance >= 80 ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      )}
      {children}
    </div>
  )
}
