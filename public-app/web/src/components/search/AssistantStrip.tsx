/**
 * The "AI assistant strip" on /search when a query is present:
 *   - assistantMessage (what we understood)
 *   - intent chips (editable / removable → dispatch → URL → re-run)
 *   - follow-up suggestion chips
 * Gulal is reserved for these AI moments.
 */
import { useState } from 'react';
import { Pencil, Sparkles } from 'lucide-react';
import { buildIntentChips, type FilterKey, type SearchAction, type SearchState } from '@/lib/searchState';
import { formatCompactRupees } from '@/lib/format';
import type { SearchIntent } from '@/types/api';
import { Chip } from '../ui/Chip';
import { Skeleton } from '../ui/Skeleton';
import { ChipEditor } from './ChipEditor';

export function AssistantStrip({
  state,
  intent,
  message,
  followUps,
  loading,
  dispatch,
  onFollowUp,
}: {
  state: SearchState;
  intent: SearchIntent | null;
  message?: string;
  followUps: string[];
  loading: boolean;
  dispatch: (a: SearchAction) => void;
  onFollowUp: (text: string) => void;
}) {
  const [editing, setEditing] = useState<FilterKey | 'city' | null>(null);
  const chips = buildIntentChips(state, intent, { price: formatCompactRupees });

  return (
    <section aria-label="AI assistant" className="rounded-card border border-gulal/25 bg-gradient-to-br from-gulal-soft/70 via-paper to-paper p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gulal text-paper">
          <Sparkles size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="space-y-2 pt-1">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ) : (
            <p className="text-[15px] leading-relaxed text-ink">{message || 'Here is what we understood from your search.'}</p>
          )}

          {(chips.length > 0 || loading) && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="What we understood">
              {loading && chips.length === 0 && (
                <>
                  <Skeleton className="h-8 w-20 rounded-pill" />
                  <Skeleton className="h-8 w-24 rounded-pill" />
                  <Skeleton className="h-8 w-28 rounded-pill" />
                </>
              )}
              {chips.map((c) => (
                <Chip
                  key={c.key}
                  size="sm"
                  ai
                  icon={<Pencil size={11} aria-hidden />}
                  onClick={() => setEditing(c.key)}
                  onRemove={c.key === 'city' ? undefined : () => dispatch({ type: 'removeChip', key: c.key })}
                  title={c.fromIntent ? 'We read this from your search — tap to change' : 'Tap to change'}
                >
                  {c.label}
                </Chip>
              ))}
            </div>
          )}

          {!loading && followUps.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-dust-dim">Refine</p>
              <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto sm:flex-wrap">
                {followUps.map((f) => (
                  <Chip key={f} size="sm" className="shrink-0" onClick={() => onFollowUp(f)}>
                    {f}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ChipEditor
        editing={editing}
        state={state}
        onClose={() => setEditing(null)}
        onApply={(action) => {
          dispatch(action);
          setEditing(null);
        }}
      />
    </section>
  );
}
