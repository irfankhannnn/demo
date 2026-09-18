/**
 * Filter rail (desktop, always visible) / filter sheet (mobile, opened from
 * the toolbar). Both render the same controls against a draft state; the
 * sheet applies on "Show homes", the rail applies immediately.
 */
import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { FILTER_KEYS, type SearchAction, type SearchState } from '@/lib/searchState';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { BhkControl, FurnishingControl, LocalityControl, ModeControl, PriceControl, PropertyTypeControl } from './FilterControls';

function Controls({ state, onChange }: { state: SearchState; onChange: (next: SearchState) => void }) {
  return (
    <div className="space-y-6">
      <ModeControl value={state.mode} onChange={(mode) => onChange({ ...state, mode, minPrice: undefined, maxPrice: undefined })} />
      <BhkControl value={state.bhk} onChange={(bhk) => onChange({ ...state, bhk })} />
      <PriceControl mode={state.mode} min={state.minPrice} max={state.maxPrice} onChange={(minPrice, maxPrice) => onChange({ ...state, minPrice, maxPrice })} />
      <LocalityControl value={state.locality} onChange={(locality) => onChange({ ...state, locality })} />
      <PropertyTypeControl value={state.propertyType} onChange={(propertyType) => onChange({ ...state, propertyType })} />
      <FurnishingControl value={state.furnishing} onChange={(furnishing) => onChange({ ...state, furnishing })} />
    </div>
  );
}

function diffToActions(prev: SearchState, next: SearchState): SearchAction[] {
  const actions: SearchAction[] = [];
  if (prev.minPrice !== next.minPrice || prev.maxPrice !== next.maxPrice) {
    actions.push({ type: 'setPriceRange', minPrice: next.minPrice, maxPrice: next.maxPrice });
  }
  for (const key of FILTER_KEYS) {
    if (key === 'minPrice' || key === 'maxPrice') continue;
    if (prev[key] !== next[key]) actions.push({ type: 'setFilter', key, value: next[key] });
  }
  return actions;
}

export function countActiveFilters(state: SearchState): number {
  return FILTER_KEYS.filter((k) => state[k] !== undefined).length;
}

export function FilterRail({ state, dispatch }: { state: SearchState; dispatch: (a: SearchAction) => void }) {
  const apply = (next: SearchState) => diffToActions(state, next).forEach(dispatch);
  const active = countActiveFilters(state);
  return (
    <aside className="hidden w-72 shrink-0 lg:block" aria-label="Filters">
      <div className="sticky top-20 rounded-card border border-line bg-paper-2/40 p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-sm font-extrabold">
            <SlidersHorizontal size={16} aria-hidden /> Filters
          </h2>
          {active > 0 && (
            <button type="button" className="text-xs font-bold text-marigold-deep hover:underline" onClick={() => dispatch({ type: 'clearFilters' })}>
              Clear ({active})
            </button>
          )}
        </div>
        <Controls state={state} onChange={apply} />
      </div>
    </aside>
  );
}

export function FilterSheet({ open, onClose, state, dispatch, resultCount }: { open: boolean; onClose: () => void; state: SearchState; dispatch: (a: SearchAction) => void; resultCount?: number }) {
  const [draft, setDraft] = useState(state);
  useEffect(() => {
    if (open) setDraft(state);
  }, [open, state]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      alwaysSheet
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setDraft({ q: state.q, city: state.city, sort: state.sort });
            }}
          >
            Reset
          </Button>
          <Button
            full
            onClick={() => {
              diffToActions(state, draft).forEach(dispatch);
              onClose();
            }}
          >
            Show homes{resultCount != null ? ` (${resultCount}${resultCount >= 50 ? '+' : ''})` : ''}
          </Button>
        </div>
      }
    >
      <Controls state={draft} onChange={setDraft} />
    </Sheet>
  );
}
