import type { ReactNode } from 'react';
import { cn } from '../lib/format';
import type { EnquiryStatus, Temperature, WindowState } from '../api/types';

export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-blue-50 text-brand ring-blue-200',
  success: 'bg-green-50 text-green-700 ring-green-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  title?: string;
}

export function Badge({ children, tone = 'neutral', className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Domain badges — one place that decides what each enum looks like    */
/* ------------------------------------------------------------------ */

const TEMPERATURE_TONE: Record<Temperature, BadgeTone> = {
  hot: 'danger',
  warm: 'warning',
  cold: 'info',
};

export function TemperatureBadge({ value }: { value?: Temperature }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const icon = value === 'hot' ? '🔥' : value === 'warm' ? '☀️' : '❄️';
  return (
    <Badge tone={TEMPERATURE_TONE[value] ?? 'neutral'}>
      <span aria-hidden>{icon}</span>
      {value}
    </Badge>
  );
}

const STATUS_TONE: Record<EnquiryStatus, BadgeTone> = {
  new: 'brand',
  contacted: 'info',
  qualified: 'info',
  site_visit: 'warning',
  won: 'success',
  lost: 'neutral',
  spam: 'danger',
};

export function statusTone(status?: EnquiryStatus): BadgeTone {
  return status ? STATUS_TONE[status] ?? 'neutral' : 'neutral';
}

/**
 * Meta's messaging window, the single most consequential state in the product:
 * CLOSED means nothing may legally be sent to that person until they write
 * again (F25, F59), so it reads as a hard stop rather than another grey chip.
 */
const WINDOW_TONE: Record<WindowState, BadgeTone> = {
  STANDARD: 'success',
  COMMENT_REPLY: 'brand',
  HUMAN_AGENT: 'warning',
  CLOSED: 'danger',
};

const WINDOW_HELP: Record<WindowState, string> = {
  STANDARD: '24-hour window is open — automated replies are allowed.',
  COMMENT_REPLY: 'Opened by a comment private reply — valid for 7 days.',
  HUMAN_AGENT: 'Human agent tag applied — requires a person, not automation.',
  CLOSED: 'Window shut. Nothing can be sent until this person messages again.',
};

export function WindowStateBadge({ value }: { value?: WindowState }) {
  if (!value) return <span className="text-slate-400">—</span>;
  return (
    <Badge tone={WINDOW_TONE[value] ?? 'neutral'} title={WINDOW_HELP[value]}>
      {value.replace('_', ' ')}
    </Badge>
  );
}

export function ToneDot({ tone, className }: { tone: BadgeTone; className?: string }) {
  const colors: Record<BadgeTone, string> = {
    neutral: 'bg-slate-400',
    brand: 'bg-brand',
    success: 'bg-accent',
    warning: 'bg-warn',
    danger: 'bg-danger',
    info: 'bg-sky-500',
  };
  return (
    <span
      aria-hidden
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full', colors[tone], className)}
    />
  );
}
