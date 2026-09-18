import { Sparkles } from 'lucide-react';
import { formatMatchPercent } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Gulal match badge — the one AI moment allowed per card. */
export function MatchBadge({ score, className, large }: { score?: number | null; className?: string; large?: boolean }) {
  const pct = formatMatchPercent(score);
  if (!pct) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill bg-gulal font-extrabold text-paper shadow-[0_4px_14px_-4px_rgba(255,61,127,0.7)] tabular',
        large ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-[11px] uppercase tracking-[0.06em]',
        className,
      )}
      aria-label={`${pct} match`}
    >
      <Sparkles size={large ? 14 : 11} aria-hidden />
      {pct} match
    </span>
  );
}
