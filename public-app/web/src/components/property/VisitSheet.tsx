/**
 * Book a site visit: GET availability → pick a date → pick a slot → optional
 * message → POST visit. Server-side validation errors (details ∈
 * slot_unavailable, date_in_past, …) are mapped to friendly copy.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage, isApiError } from '@/services/api';
import { marketplace, qk } from '@/services/marketplace';
import { formatDateLabel, formatTimeLabel } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { VisitResponse } from '@/types/api';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { Skeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/States';

const DETAIL_COPY: Record<string, string> = {
  slot_unavailable: 'That slot just got taken — pick another one.',
  date_in_past: 'That date has passed. Pick a date from today onwards.',
  date_too_far: 'Too far out — the agency opens slots up to 30 days ahead.',
  invalid_date: 'That date does not look right.',
  invalid_time: 'That time does not look right.',
  property_unavailable: 'This listing is no longer available for visits.',
  missing_name_or_phone: 'Add your name and phone in your profile first.',
};

export function VisitSheet({ open, onClose, slug, propertyId, title, onBooked }: { open: boolean; onClose: () => void; slug: string; propertyId: string; title: string; onBooked?: (r: VisitResponse) => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const availability = useQuery({
    queryKey: qk.availability(slug, propertyId),
    queryFn: () => marketplace.availability(slug, propertyId),
    enabled: open,
    staleTime: 60_000,
  });

  const dates = useMemo(() => (availability.data?.dates ?? []).filter((d) => d.slots.length > 0), [availability.data]);
  const slots = useMemo(() => dates.find((d) => d.date === date)?.slots ?? [], [dates, date]);

  const book = useMutation({
    mutationFn: () => marketplace.bookVisit(slug, propertyId, { date: date!, time: time!, message: message.trim() || undefined }),
    onSuccess: (r) => {
      toast.success('Visit requested', `${formatDateLabel(r.meetingDate)} at ${formatTimeLabel(r.meetingTime)} — the agency will confirm.`);
      void qc.invalidateQueries({ queryKey: qk.threads });
      onBooked?.(r);
      onClose();
      setDate(null);
      setTime(null);
      setMessage('');
    },
    onError: (e) => {
      const detail = isApiError(e) && e.details ? DETAIL_COPY[e.details] : undefined;
      toast.error('Could not book the visit', detail ?? errorMessage(e));
      if (isApiError(e) && e.details === 'slot_unavailable') {
        setTime(null);
        void availability.refetch();
      }
    },
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Book a site visit"
      description={title}
      footer={
        <Button full size="lg" disabled={!date || !time} loading={book.isPending} onClick={() => book.mutate()} leftIcon={<CalendarCheck size={18} aria-hidden />}>
          {date && time ? `Request ${formatDateLabel(date)}, ${formatTimeLabel(time)}` : 'Pick a date and slot'}
        </Button>
      }
    >
      {availability.isLoading && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-16 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-4 w-1/3" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-20 rounded-pill" />
            ))}
          </div>
        </div>
      )}
      {availability.isError && <ErrorState onRetry={() => void availability.refetch()} />}
      {availability.isSuccess && dates.length === 0 && <p className="rounded-xl bg-paper-2 px-4 py-6 text-center text-sm text-dust-dim">No open slots right now — chat with the agency and they will find a time.</p>}
      {availability.isSuccess && dates.length > 0 && (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-dust-dim">Date</p>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup" aria-label="Date">
              {dates.map((d) => {
                const active = d.date === date;
                const label = formatDateLabel(d.date).split(' ');
                return (
                  <button
                    key={d.date}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setDate(d.date);
                      setTime(null);
                    }}
                    className={cn(
                      'flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-2xl border text-center transition-colors',
                      active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink/50',
                    )}
                  >
                    <span className="text-[11px] font-bold uppercase opacity-70">{label[0]?.replace(',', '')}</span>
                    <span className="font-display text-lg font-extrabold leading-none">{label[1]}</span>
                    <span className="text-[11px] font-bold opacity-70">{label[2]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {date && (
            <div className="animate-rise">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-dust-dim">Slot {availability.data?.timeZone ? `(${availability.data.timeZone})` : ''}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Time slot">
                {slots.map((s) => {
                  const active = s === time;
                  return (
                    <button key={s} type="button" role="radio" aria-checked={active} onClick={() => setTime(s)} className={cn('h-10 rounded-pill border px-4 text-sm font-bold tabular transition-colors', active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink/50')}>
                      {formatTimeLabel(s)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {time && (
            <div className="animate-rise">
              <Textarea label="Anything the agency should know? (optional)" placeholder="Coming with family, want to see the parking too…" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3} />
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
