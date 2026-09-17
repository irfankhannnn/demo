import type { ReactNode } from 'react';
import { cn } from '../lib/format';
import type { CrmSync, CrmSyncStatus, EnquiryStatus, LeadScore, Temperature, WindowState } from '../api/types';

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

const LEAD_SCORE: Record<LeadScore, { tone: BadgeTone; label: string; help: string }> = {
  very_hot: { tone: 'danger', label: 'Very hot', help: 'Their number is on record with a real requirement, or a visit is fixed.' },
  hot: { tone: 'warning', label: 'Hot', help: 'A clear requirement and recent activity, but no number yet.' },
  cold: { tone: 'info', label: 'Cold', help: 'Vague, stale, or not interested.' },
};

export function LeadScoreBadge({ value }: { value?: LeadScore }) {
  if (!value || !LEAD_SCORE[value]) return <span className="text-slate-400">—</span>;
  const s = LEAD_SCORE[value];
  return (
    <Badge tone={s.tone} title={s.help}>
      {value === 'very_hot' ? <span aria-hidden>🔥</span> : null}
      {s.label}
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

const CRM_SYNC: Record<CrmSyncStatus, { tone: BadgeTone; label: string }> = {
  created: { tone: 'success', label: 'Lead created' },
  updated: { tone: 'success', label: 'Added to existing lead' },
  duplicate: { tone: 'success', label: 'Already in CRM' },
  skipped: { tone: 'warning', label: 'CRM skipped it' },
  failed: { tone: 'danger', label: 'CRM hand-off failed' },
  waiting_for_phone: { tone: 'neutral', label: 'Waiting for phone' },
  needs_intent: { tone: 'neutral', label: 'Buy/rent/sell unclear' },
  not_configured: { tone: 'neutral', label: 'CRM not connected' },
  disabled: { tone: 'neutral', label: 'CRM hand-off off' },
};

export function CrmSyncBadge({ value }: { value?: CrmSync | null }) {
  if (!value || !CRM_SYNC[value.status]) return <span className="text-xs text-slate-400">not yet</span>;
  const s = CRM_SYNC[value.status];
  return (
    <Badge tone={s.tone} title={value.reason ?? undefined}>
      {s.label}
    </Badge>
  );
}

/**
 * Meta's messaging window, the single most consequential state in the product:
 * CLOSED means nothing may be sent to that person until they write again, so
 * it reads as a hard stop rather than another grey chip.
 */
const WINDOW_TONE: Record<WindowState, BadgeTone> = {
  STANDARD: 'success',
  COMMENT_REPLY: 'brand',
  HUMAN_AGENT: 'warning',
  CLOSED: 'danger',
};

const WINDOW_LABEL: Record<WindowState, string> = {
  STANDARD: 'Can reply',
  COMMENT_REPLY: 'Comment only',
  HUMAN_AGENT: 'Human agent',
  CLOSED: 'Window closed',
};

const WINDOW_HELP: Record<WindowState, string> = {
  STANDARD: 'They messaged within 24 hours — you can reply.',
  COMMENT_REPLY: 'They commented within 7 days — only a private reply to that comment is allowed.',
  HUMAN_AGENT: 'Human agent window.',
  CLOSED: 'Nothing can be sent until this person messages again.',
};

export function WindowStateBadge({ value }: { value?: WindowState }) {
  if (!value) return <span className="text-slate-400">—</span>;
  return (
    <Badge tone={WINDOW_TONE[value] ?? 'neutral'} title={WINDOW_HELP[value]}>
      {WINDOW_LABEL[value] ?? value}
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
