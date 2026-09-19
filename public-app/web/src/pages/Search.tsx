/**
 * /search — two modes driven by URL state (see lib/searchState.ts):
 *   q present  → POST /search/ai  (assistant strip + ranked grid with match badges)
 *   no q       → GET /listings    (filter browse, cursor infinite scroll)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bookmark, MapPin, Search as SearchIcon, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCity } from '@/contexts/CityContext';
import { useToast } from '@/contexts/ToastContext';
import { useInfiniteListings, useIntersection } from '@/hooks/useInfiniteListings';
import { formatCompactRupees } from '@/lib/format';
import { buildIntentChips, parseSearchParams, searchReducer, toSearchFilters, toSearchParams, type SearchAction } from '@/lib/searchState';
import { usePageMeta } from '@/lib/seo';
import { errorMessage, isApiError } from '@/services/api';
import { marketplace } from '@/services/marketplace';
import type { ListingSort } from '@/types/api';
import { AssistantStrip } from '@/components/search/AssistantStrip';
import { CityPicker } from '@/components/search/CityPicker';
import { FilterRail, FilterSheet, countActiveFilters } from '@/components/search/FilterPanel';
import { ListingGrid } from '@/components/listing/ListingGrid';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Input';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/States';

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export default function Search() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { city: defaultCity } = useCity();
  const { requireAuth } = useAuth();
  const toast = useToast();

  const state = useMemo(() => parseSearchParams(params), [params]);
  const city = state.city || defaultCity;
  const aiMode = state.q.length >= 2;

  const dispatch = useCallback(
    (action: SearchAction) => {
      const next = searchReducer(parseSearchParams(new URLSearchParams(window.location.search)), action);
      setParams(toSearchParams(next), { replace: action.type === 'setSort' });
    },
    [setParams],
  );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [draftQ, setDraftQ] = useState(state.q);
  useEffect(() => setDraftQ(state.q), [state.q]);

  usePageMeta({
    title: aiMode ? `${state.q} · Homes` : city ? `Homes in ${city}` : 'Search homes',
    description: aiMode ? `AI-matched homes for "${state.q}"${city ? ` in ${city}` : ''}.` : `Browse homes ${city ? `in ${city}` : ''} from partner agencies.`,
  });

  // ---- AI mode --------------------------------------------------------------
  const filters = useMemo(() => toSearchFilters(state), [state]);
  const ai = useQuery({
    queryKey: ['aiSearch', state.q, city, filters],
    queryFn: ({ signal }) => marketplace.aiSearch({ query: state.q, city: city || undefined, filters }, signal),
    enabled: aiMode,
    staleTime: 5 * 60 * 1000,
    retry: (count, err) => !(isApiError(err) && (err.status === 400 || err.status === 429)) && count < 1,
  });

  // ---- Browse mode ----------------------------------------------------------
  const browseQuery = useMemo(
    () => ({
      city,
      mode: state.mode,
      locality: state.locality,
      minPrice: state.minPrice,
      maxPrice: state.maxPrice,
      bhk: state.bhk,
      propertyType: state.propertyType,
      furnishing: state.furnishing,
      sort: state.sort ?? 'newest',
      limit: 24,
    }),
    [city, state],
  );
  const browse = useInfiniteListings(browseQuery, !aiMode);
  const sentinel = useIntersection(() => {
    if (browse.hasNextPage && !browse.isFetchingNextPage) void browse.fetchNextPage();
  }, !aiMode && !!browse.hasNextPage);

  // ---- Save search ----------------------------------------------------------
  const saveSearch = useMutation({
    mutationFn: async () => {
      const ok = await requireAuth({ reason: 'Login to save this search and re-run it later' });
      if (!ok) return null;
      return marketplace.saveSearch({ query: state.q, city, filters });
    },
    onSuccess: (r) => r && toast.success('Search saved', 'Find it under Saved searches.'),
    onError: (e) => toast.error('Could not save search', errorMessage(e)),
  });

  const submitQuery = (text: string) => {
    const q = text.trim();
    dispatch({ type: 'setQuery', q });
  };

  const activeFilters = countActiveFilters(state);
  const results = aiMode ? ai.data?.results ?? [] : browse.items;
  const loading = aiMode ? ai.isLoading : browse.isLoading;
  const intent = ai.data?.intent ?? null;
  // In AI mode the API decides whether a city is missing: it reads the city
  // out of the query ("2bhk in kurla" is Mumbai) and otherwise searches every
  // live city, so an empty picker alone is no reason to hide results.
  const needsCity = aiMode ? !!ai.data?.needsCity : !city;
  const relaxed = aiMode && !!ai.data?.relaxed && results.length > 0;
  // Where the results are actually from, which can differ from the picker.
  const resultCity = (aiMode && intent?.city) || city;
  const chipsForTitle = buildIntentChips(state, intent, { price: formatCompactRupees });

  return (
    <div className="container-x py-5 sm:py-8">
      {/* Search bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitQuery(draftQ);
        }}
        className="flex items-center gap-2 rounded-2xl border border-line bg-white/70 p-1.5 shadow-card focus-within:border-ink/40"
        role="search"
      >
        <button type="button" onClick={() => setCityOpen(true)} className="hidden h-10 shrink-0 items-center gap-1.5 rounded-xl bg-paper-2 px-3 text-[13px] font-bold sm:inline-flex" aria-label={`City: ${resultCity || 'choose'}`}>
          <MapPin size={14} className="text-marigold" aria-hidden />
          {resultCity || 'City'}
        </button>
        <label htmlFor="search-q" className="sr-only">
          Describe what you want
        </label>
        <input
          id="search-q"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          placeholder="Describe it: 2 BHK near Powai lake, under 1.5 Cr…"
          className="h-10 min-w-0 flex-1 bg-transparent px-2 text-[15px] text-ink placeholder:text-dust-dim focus:outline-none"
          maxLength={500}
        />
        {draftQ && (
          <button
            type="button"
            onClick={() => {
              setDraftQ('');
              dispatch({ type: 'removeChip', key: 'q' });
            }}
            aria-label="Clear search"
            className="rounded-full p-1.5 text-dust-dim hover:bg-ink/5 hover:text-ink"
          >
            <X size={16} aria-hidden />
          </button>
        )}
        <Button type="submit" size="sm" leftIcon={<Sparkles size={14} aria-hidden />} className="shrink-0">
          <span className="hidden sm:inline">Match</span>
          <SearchIcon size={16} className="sm:hidden" aria-hidden />
        </Button>
      </form>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setCityOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-line bg-paper px-3 text-[13px] font-bold sm:hidden">
          <MapPin size={14} className="text-marigold" aria-hidden />
          {resultCity || 'City'}
        </button>
        <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)} leftIcon={<SlidersHorizontal size={14} aria-hidden />} className="lg:hidden">
          Filters{activeFilters > 0 ? ` · ${activeFilters}` : ''}
        </Button>
        {!aiMode && (
          <div className="w-44">
            <Select aria-label="Sort" options={SORT_OPTIONS} value={state.sort ?? 'newest'} onChange={(e) => dispatch({ type: 'setSort', sort: e.target.value as ListingSort })} className="h-9 text-[13px]" />
          </div>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => saveSearch.mutate()} loading={saveSearch.isPending} leftIcon={<Bookmark size={14} aria-hidden />} disabled={!city}>
          Save search
        </Button>
      </div>

      <div className="mt-5 flex gap-6">
        <FilterRail state={state} dispatch={dispatch} />

        <div className="min-w-0 flex-1">
          {/* AI strip */}
          {aiMode && !needsCity && (
            <AssistantStrip
              state={state}
              intent={intent}
              message={ai.data?.assistantMessage}
              followUps={ai.data?.followUps ?? []}
              loading={ai.isLoading}
              dispatch={dispatch}
              onFollowUp={(f) => submitQuery(`${state.q} ${f}`)}
            />
          )}

          {/* City required */}
          {needsCity && (
            <div className="rounded-card border border-marigold/40 bg-marigold-soft/60 p-5 sm:p-6">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-marigold-deep">One thing first</p>
              <h2 className="mt-1 font-display text-lg font-extrabold">{ai.data?.assistantMessage || 'Kaunsa city? We match within one city at a time.'}</h2>
              <div className="mt-4">
                <Button onClick={() => setCityOpen(true)} leftIcon={<MapPin size={16} aria-hidden />}>
                  Choose a city
                </Button>
              </div>
            </div>
          )}

          {/* Browse-mode active chips */}
          {!aiMode && chipsForTitle.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {chipsForTitle.map((c) => (
                <Chip key={c.key} size="sm" selected onRemove={c.key === 'city' ? undefined : () => dispatch({ type: 'removeChip', key: c.key })} onClick={() => (c.key === 'city' ? setCityOpen(true) : setFiltersOpen(true))}>
                  {c.label}
                </Chip>
              ))}
              {activeFilters > 0 && (
                <button type="button" className="text-xs font-bold text-marigold-deep hover:underline" onClick={() => dispatch({ type: 'clearFilters' })}>
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Results header */}
          {!needsCity && (
            <div className="mb-3 mt-5 flex items-baseline justify-between gap-3">
              <h1 className="font-display text-lg font-extrabold sm:text-xl">
                {aiMode
                  ? loading
                    ? 'Matching…'
                    : relaxed
                      ? `No exact match · ${results.length} closest home${results.length === 1 ? '' : 's'}`
                      : `${results.length} match${results.length === 1 ? '' : 'es'}${resultCity && results.length > 0 ? ` in ${resultCity}` : ''}`
                  : city
                    ? `Homes in ${city}`
                    : 'Homes'}
              </h1>
              {!aiMode && browse.data && (
                <span className="text-xs text-dust-dim tabular">
                  {browse.items.length}
                  {browse.hasNextPage ? '+' : ''} shown
                </span>
              )}
            </div>
          )}

          {/* Errors */}
          {aiMode && ai.isError && !needsCity && (
            <ErrorState
              title={isApiError(ai.error) && ai.error.isRateLimited ? 'Thoda slow — too many searches' : 'Matching is taking a break'}
              body={isApiError(ai.error) && ai.error.isRateLimited ? 'You have hit the hourly limit for AI matching. Login for a higher limit, or browse with filters meanwhile.' : errorMessage(ai.error)}
              onRetry={() => void ai.refetch()}
            />
          )}
          {!aiMode && browse.isError && <ErrorState body={errorMessage(browse.error)} onRetry={() => void browse.refetch()} />}

          {/* Grid */}
          {!needsCity && !(aiMode ? ai.isError : browse.isError) && (
            <>
              <ListingGrid items={results} loading={loading} showWhy={aiMode} />
              {!loading && results.length === 0 && (
                <EmptyState
                  className="mt-2"
                  title="Kuch nahi mila yet"
                  body={
                    ai.data?.assistantMessage && aiMode && results.length === 0
                      ? ai.data.assistantMessage
                      : 'Try a wider budget or another locality — or drop a filter and let the matching do more of the work.'
                  }
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      {activeFilters > 0 && (
                        <Button variant="outline" onClick={() => dispatch({ type: 'clearFilters' })}>
                          Clear filters
                        </Button>
                      )}
                      {aiMode && resultCity && (
                        <Button variant="secondary" onClick={() => navigate(`/search?city=${encodeURIComponent(resultCity)}`)}>
                          Browse all in {resultCity}
                        </Button>
                      )}
                    </div>
                  }
                />
              )}
              {!aiMode && (
                <div ref={sentinel} className="flex h-16 items-center justify-center" aria-hidden={!browse.isFetchingNextPage}>
                  {browse.isFetchingNextPage && <Spinner />}
                  {!browse.hasNextPage && browse.items.length > 0 && <p className="text-xs text-dust-dim">Bas, that is everything in {city} for now.</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} state={state} dispatch={dispatch} resultCount={aiMode ? undefined : browse.items.length} />
      <CityPicker open={cityOpen} onClose={() => setCityOpen(false)} onPick={(name) => dispatch({ type: 'setCity', city: name })} />
    </div>
  );
}
