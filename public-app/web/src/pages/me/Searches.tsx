import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, MapPin, Play, Trash2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { formatCompactRupees, formatRelativeTime } from '@/lib/format';
import { toSearchParams } from '@/lib/searchState';
import { errorMessage } from '@/services/api';
import { marketplace, qk } from '@/services/marketplace';
import type { SavedSearch } from '@/types/api';
import { LinkButton } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { MePageHeader, RequireLogin } from './RequireLogin';

export default function Searches() {
  return (
    <RequireLogin title="Saved searches" reason="Login to see and re-run your saved searches.">
      <SearchesInner />
    </RequireLogin>
  );
}

function searchUrl(s: SavedSearch): string {
  const f = s.filters ?? {};
  const p = toSearchParams({
    q: s.query ?? '',
    city: s.city ?? '',
    mode: f.mode,
    bhk: f.bhk,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    locality: f.locality,
    propertyType: f.propertyType,
    furnishing: f.furnishing,
  });
  return `/search?${p.toString()}`;
}

function filterSummary(s: SavedSearch): string[] {
  const f = s.filters ?? {};
  const out: string[] = [];
  if (f.mode) out.push(f.mode === 'rent' ? 'Rent' : 'Buy');
  if (f.bhk != null) out.push(`${f.bhk} BHK`);
  if (f.minPrice != null && f.maxPrice != null) out.push(`${formatCompactRupees(f.minPrice)} – ${formatCompactRupees(f.maxPrice)}`);
  else if (f.maxPrice != null) out.push(`Under ${formatCompactRupees(f.maxPrice)}`);
  else if (f.minPrice != null) out.push(`Above ${formatCompactRupees(f.minPrice)}`);
  if (f.locality) out.push(f.locality);
  if (f.propertyType) out.push(f.propertyType.replace(/[-_]/g, ' '));
  if (f.furnishing) out.push(f.furnishing.replace(/[-_]/g, ' '));
  return out;
}

function SearchesInner() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.searches, queryFn: () => marketplace.searches(), staleTime: 60_000 });
  const del = useMutation({
    mutationFn: (id: string) => marketplace.deleteSearch(id),
    onSuccess: () => {
      toast.success('Search removed');
      void qc.invalidateQueries({ queryKey: qk.searches });
    },
    onError: (e) => toast.error('Could not remove', errorMessage(e)),
  });

  const items = q.data?.items ?? [];

  return (
    <div className="container-x max-w-3xl py-6 sm:py-10">
      <MePageHeader eyebrow="Re-run anytime" title="Saved searches" count={q.isSuccess ? items.length : undefined} />
      {q.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
      )}
      {q.isError && <ErrorState body={errorMessage(q.error)} onRetry={() => void q.refetch()} />}
      {q.isSuccess && items.length === 0 && (
        <EmptyState
          icon={<Bookmark size={26} aria-hidden />}
          title="No saved searches"
          body="On any search page, tap Save search. Come back here to run it again with one tap."
          action={<LinkButton to="/search">Go search</LinkButton>}
        />
      )}
      <ul className="space-y-3">
        {items.map((s) => {
          const chips = filterSummary(s);
          return (
            <li key={s.searchId} className="flex items-center gap-3 rounded-card border border-line bg-paper p-4 shadow-card">
              <div className="min-w-0 flex-1">
                <Link to={searchUrl(s)} className="block truncate font-display text-[15px] font-extrabold hover:text-marigold-deep">
                  {s.query || `Browse ${s.city}`}
                </Link>
                <p className="mt-1 flex items-center gap-1 text-[13px] text-dust-dim">
                  <MapPin size={13} className="text-marigold" aria-hidden /> {s.city}
                  {s.createdAt && <span className="ml-2">· saved {formatRelativeTime(s.createdAt)}</span>}
                </p>
                {chips.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {chips.map((c) => (
                      <li key={c} className="rounded-pill bg-paper-2 px-2 py-0.5 text-[11px] font-bold text-ink/80">
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <LinkButton to={searchUrl(s)} size="sm" leftIcon={<Play size={14} aria-hidden />}>
                Run
              </LinkButton>
              <IconButton label="Delete saved search" size="sm" onClick={() => del.mutate(s.searchId)} disabled={del.isPending}>
                <Trash2 size={15} aria-hidden />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
