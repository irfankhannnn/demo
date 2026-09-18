import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-lg bg-[linear-gradient(90deg,#EEDFC9_0%,#F7EBD9_40%,#EEDFC9_80%)] bg-[length:800px_100%]',
        className,
      )}
    />
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-paper">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3.5 w-3/5" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-16 rounded-pill" />
          <Skeleton className="h-6 w-20 rounded-pill" />
        </div>
      </div>
    </div>
  );
}

export function LineSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
