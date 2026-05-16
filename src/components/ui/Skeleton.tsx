import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-slate-200', className)}
      aria-hidden="true"
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-1/4 mb-3" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  )
}

export function SkeletonProCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <Skeleton className="w-14 h-14 rounded-full mb-4" />
      <Skeleton className="h-4 w-1/2 mb-2" />
      <Skeleton className="h-3 w-2/3 mb-3" />
      <Skeleton className="h-3 w-1/3 mb-4" />
      <Skeleton className="h-8 w-full rounded-xl" />
    </div>
  )
}

export function SkeletonJobCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <Skeleton className="h-5 w-20 rounded-full mb-3" />
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-1/2 mb-3" />
      <Skeleton className="h-3 w-2/3 mb-3" />
      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-3 w-20 ml-auto" />
      </div>
    </div>
  )
}

export function SkeletonMetricCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
      <Skeleton className="h-3 w-1/2 mb-2" />
      <Skeleton className="h-8 w-1/3 mb-2" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  )
}
