/**
 * Individual filter controls. Shared by the desktop filter rail, the mobile
 * filter sheet and the intent-chip editor so behaviour never drifts.
 */
import { useEffect, useState } from 'react';
import type { ListingMode } from '@/types/api';
import { formatCompactRupees } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Chip } from '../ui/Chip';
import { Input } from '../ui/Input';

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'villa', label: 'Villa' },
  { value: 'independent-house', label: 'Independent house' },
  { value: 'plot', label: 'Plot' },
  { value: 'penthouse', label: 'Penthouse' },
  { value: 'studio', label: 'Studio' },
];

export const FURNISHING = [
  { value: 'unfurnished', label: 'Unfurnished' },
  { value: 'semi-furnished', label: 'Semi-furnished' },
  { value: 'furnished', label: 'Fully furnished' },
];

const BHK_OPTIONS = [1, 2, 3, 4, 5];

export const SALE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹50 L', max: 5_000_000 },
  { label: '₹50 L – 1 Cr', min: 5_000_000, max: 10_000_000 },
  { label: '₹1 – 2 Cr', min: 10_000_000, max: 20_000_000 },
  { label: '₹2 – 5 Cr', min: 20_000_000, max: 50_000_000 },
  { label: '₹5 Cr +', min: 50_000_000 },
];

export const RENT_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹15k', max: 15_000 },
  { label: '₹15 – 30k', min: 15_000, max: 30_000 },
  { label: '₹30 – 60k', min: 30_000, max: 60_000 },
  { label: '₹60k – 1 L', min: 60_000, max: 100_000 },
  { label: '₹1 L +', min: 100_000 },
];

export function FieldLabel({ children }: { children: string }) {
  return <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-dust-dim">{children}</p>;
}

export function ModeControl({ value, onChange }: { value?: ListingMode; onChange: (m?: ListingMode) => void }) {
  const opts: { v?: ListingMode; label: string }[] = [
    { v: undefined, label: 'Any' },
    { v: 'sale', label: 'Buy' },
    { v: 'rent', label: 'Rent' },
  ];
  return (
    <div>
      <FieldLabel>Looking to</FieldLabel>
      <div role="radiogroup" aria-label="Buy or rent" className="grid grid-cols-3 rounded-2xl border border-line bg-paper-2/60 p-1">
        {opts.map((o) => {
          const active = o.v === value;
          return (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.v)}
              className={cn('h-10 rounded-xl text-sm font-extrabold transition-colors', active ? 'bg-ink text-paper shadow' : 'text-ink hover:bg-ink/5')}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BhkControl({ value, onChange }: { value?: number; onChange: (b?: number) => void }) {
  return (
    <div>
      <FieldLabel>Bedrooms</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {BHK_OPTIONS.map((b) => (
          <Chip key={b} selected={value === b} onClick={() => onChange(value === b ? undefined : b)} aria-label={`${b} BHK`}>
            {b === 5 ? '5+ BHK' : `${b} BHK`}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function parseAmount(s: string): number | undefined {
  const t = s.trim().toLowerCase().replace(/[₹,\s]/g, '');
  if (!t) return undefined;
  const m = /^(\d+(?:\.\d+)?)(k|l|lakh|lac|cr|crore)?$/.exec(t);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2];
  if (unit === 'k') return n * 1000;
  if (unit === 'l' || unit === 'lakh' || unit === 'lac') return n * 100_000;
  if (unit === 'cr' || unit === 'crore') return n * 10_000_000;
  return n;
}

export function PriceControl({ mode, min, max, onChange }: { mode?: ListingMode; min?: number; max?: number; onChange: (min?: number, max?: number) => void }) {
  const presets = mode === 'rent' ? RENT_PRESETS : SALE_PRESETS;
  const [minText, setMinText] = useState(min != null ? formatCompactRupees(min).replace('₹', '') : '');
  const [maxText, setMaxText] = useState(max != null ? formatCompactRupees(max).replace('₹', '') : '');

  useEffect(() => {
    setMinText(min != null ? formatCompactRupees(min).replace('₹', '') : '');
    setMaxText(max != null ? formatCompactRupees(max).replace('₹', '') : '');
  }, [min, max]);

  const commit = () => onChange(parseAmount(minText), parseAmount(maxText));

  return (
    <div>
      <FieldLabel>{mode === 'rent' ? 'Monthly rent' : 'Budget'}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = p.min === min && p.max === max;
          return (
            <Chip key={p.label} size="sm" selected={active} onClick={() => onChange(active ? undefined : p.min, active ? undefined : p.max)}>
              {p.label}
            </Chip>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Input
          label="Min"
          inputMode="decimal"
          placeholder={mode === 'rent' ? '10k' : '40 L'}
          value={minText}
          onChange={(e) => setMinText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <Input
          label="Max"
          inputMode="decimal"
          placeholder={mode === 'rent' ? '45k' : '1.2 Cr'}
          value={maxText}
          onChange={(e) => setMaxText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
      </div>
      <p className="mt-1.5 text-xs text-dust-dim">Type like you say it — 80L, 1.2Cr, 45k.</p>
    </div>
  );
}

export function LocalityControl({ value, onChange, autoFocus }: { value?: string; onChange: (v?: string) => void; autoFocus?: boolean }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  const commit = () => onChange(text.trim() || undefined);
  return (
    <div>
      <FieldLabel>Locality</FieldLabel>
      <Input
        placeholder="Andheri West, Baner, Whitefield…"
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </div>
  );
}

export function PropertyTypeControl({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  return (
    <div>
      <FieldLabel>Property type</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {PROPERTY_TYPES.map((t) => (
          <Chip key={t.value} size="sm" selected={value === t.value} onClick={() => onChange(value === t.value ? undefined : t.value)}>
            {t.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function FurnishingControl({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  return (
    <div>
      <FieldLabel>Furnishing</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {FURNISHING.map((t) => (
          <Chip key={t.value} size="sm" selected={value === t.value} onClick={() => onChange(value === t.value ? undefined : t.value)}>
            {t.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
