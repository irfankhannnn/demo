/**
 * The hero search box: a textarea-feel input + city chip + example prompts.
 * Submits to /search?q=&city=.
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Sparkles } from 'lucide-react';
import { useCity } from '@/contexts/CityContext';
import { cn } from '@/lib/cn';
import { CityPicker } from './CityPicker';
import { Chip } from '../ui/Chip';

export const EXAMPLE_PROMPTS = [
  '2 BHK Andheri, under 80 lakh, near metro',
  '3 BHK rent in Baner, furnished, pet friendly',
  'Ready-to-move flat in Thane under 1.2 Cr',
  '1 BHK near Whitefield IT park, ₹25k budget',
];

export function AiSearchBox({ initialQuery = '', size = 'lg', autoFocus, className, onSubmitted }: { initialQuery?: string; size?: 'lg' | 'md'; autoFocus?: boolean; className?: string; onSubmitted?: () => void }) {
  const navigate = useNavigate();
  const { city } = useCity();
  const [q, setQ] = useState(initialQuery);
  const [cityOpen, setCityOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Native autofocus scrolls the field into view, which can nudge a clipped
  // ancestor sideways. Focus it ourselves and tell the browser not to scroll.
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      ref.current?.focus();
      return;
    }
    const p = new URLSearchParams();
    p.set('q', trimmed);
    if (city) p.set('city', city);
    navigate({ pathname: '/search', search: p.toString() });
    onSubmitted?.();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(q);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(q);
    }
  };

  const big = size === 'lg';

  return (
    <div className={className}>
      <form
        onSubmit={onSubmit}
        className={cn(
          'relative rounded-[22px] border border-ink/10 bg-white/80 shadow-card backdrop-blur transition-shadow focus-within:border-ink/30 focus-within:shadow-card-hover',
        )}
      >
        <label htmlFor="ai-search" className="sr-only">
          Describe the home you want
        </label>
        <textarea
          id="ai-search"
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          rows={big ? 2 : 1}
          maxLength={500}
          placeholder="e.g. 2 BHK Andheri, under 80 lakh, near metro"
          className={cn(
            'w-full resize-none bg-transparent px-5 pt-4 text-ink placeholder:text-dust-dim focus:outline-none',
            big ? 'min-h-[76px] text-[17px] leading-snug sm:text-lg' : 'min-h-[52px] text-[15px]',
          )}
        />
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          <button
            type="button"
            onClick={() => setCityOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-line bg-paper px-3 text-[13px] font-bold text-ink hover:border-ink/50"
          >
            <MapPin size={14} className="text-marigold" aria-hidden />
            {city || 'Pick a city'}
          </button>
          <span className="hidden text-xs text-dust-dim sm:inline">Enter to search · Shift+Enter for a new line</span>
          <div className="flex-1" />
          <button
            type="submit"
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl bg-marigold font-extrabold text-ink transition-colors hover:bg-marigold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
              big ? 'h-11 px-5 text-sm' : 'h-10 px-4 text-[13px]',
            )}
          >
            <Sparkles size={16} aria-hidden />
            Find my ghar
            <ArrowRight size={16} aria-hidden className="hidden sm:block" />
          </button>
        </div>
      </form>

      {big && (
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
          <span className="sr-only">Try an example</span>
          {EXAMPLE_PROMPTS.map((p) => (
            <Chip key={p} size="sm" onClick={() => submit(p)} className="shrink-0">
              {p}
            </Chip>
          ))}
        </div>
      )}
      <CityPicker open={cityOpen} onClose={() => setCityOpen(false)} />
    </div>
  );
}
