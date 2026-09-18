import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'ink' | 'marigold' | 'gulal' | 'tulsi' | 'paper' | 'danger' | 'dust';

const TONES: Record<Tone, string> = {
  ink: 'bg-ink text-paper',
  marigold: 'bg-marigold text-ink',
  gulal: 'bg-gulal text-paper',
  tulsi: 'bg-tulsi-soft text-tulsi-deep',
  paper: 'bg-paper/90 text-ink border border-line backdrop-blur',
  danger: 'bg-danger/10 text-danger',
  dust: 'bg-paper-2 text-dust-dim',
};

export function Badge({ tone = 'ink', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em]',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
