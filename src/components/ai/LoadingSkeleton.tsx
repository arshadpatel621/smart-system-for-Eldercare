interface LoadingSkeletonProps {
  count?: number;
}

export function LoadingSkeleton({ count = 1 }: LoadingSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            {/* Header skeleton */}
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-6 w-1/3 animate-pulse rounded-lg bg-slate-200" />
                <div className="h-4 w-1/2 animate-pulse rounded-lg bg-slate-100" />
              </div>
              <div className="h-8 w-20 animate-pulse rounded-full bg-slate-200" />
            </div>

            {/* Content skeleton */}
            <div className="space-y-3">
              <div className="h-4 w-full animate-pulse rounded-lg bg-slate-100" />
              <div className="h-4 w-5/6 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-4 w-4/5 animate-pulse rounded-lg bg-slate-100" />
            </div>

            {/* Metrics skeleton */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
