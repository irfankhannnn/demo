/**
 * /search URL state — the single source of truth for what the results page
 * shows. Every filter lives in the query string so a search is shareable,
 * back-button friendly and survives a reload.
 *
 *   ?q=&city=&mode=&bhk=&minPrice=&maxPrice=&locality=&propertyType=&furnishing=&sort=
 *
 * The AI assistant strip renders "intent chips" from this state (merged with
 * the intent the server parsed). Editing or removing a chip is a reducer
 * action that produces a new state → new URL → the query re-runs.
 */
import type { ListingMode, ListingSort, SearchFilters, SearchIntent } from '@/types/api';

export interface SearchState {
  q: string;
  city: string;
  mode?: ListingMode;
  bhk?: number;
  minPrice?: number;
  maxPrice?: number;
  locality?: string;
  propertyType?: string;
  furnishing?: string;
  sort?: ListingSort;
}

export type FilterKey = Exclude<keyof SearchState, 'q' | 'city' | 'sort'>;

export const FILTER_KEYS: FilterKey[] = ['mode', 'bhk', 'minPrice', 'maxPrice', 'locality', 'propertyType', 'furnishing'];

const MODES: ListingMode[] = ['sale', 'rent'];
const SORTS: ListingSort[] = ['newest', 'price_asc', 'price_desc'];

function num(v: string | null): number | undefined {
  if (v == null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function str(v: string | null): string | undefined {
  const s = (v ?? '').trim();
  return s ? s : undefined;
}

export function parseSearchParams(params: URLSearchParams): SearchState {
  const mode = str(params.get('mode'));
  const sort = str(params.get('sort'));
  const state: SearchState = {
    q: (params.get('q') ?? '').trim(),
    city: (params.get('city') ?? '').trim(),
    mode: MODES.includes(mode as ListingMode) ? (mode as ListingMode) : undefined,
    bhk: num(params.get('bhk')),
    minPrice: num(params.get('minPrice')),
    maxPrice: num(params.get('maxPrice')),
    locality: str(params.get('locality')),
    propertyType: str(params.get('propertyType')),
    furnishing: str(params.get('furnishing')),
    sort: SORTS.includes(sort as ListingSort) ? (sort as ListingSort) : undefined,
  };
  // A min above max is a typo — swap rather than silently returning nothing.
  if (state.minPrice != null && state.maxPrice != null && state.minPrice > state.maxPrice) {
    [state.minPrice, state.maxPrice] = [state.maxPrice, state.minPrice];
  }
  return state;
}

export function toSearchParams(state: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.city) p.set('city', state.city);
  for (const key of FILTER_KEYS) {
    const v = state[key];
    if (v !== undefined && v !== null && v !== '') p.set(key, String(v));
  }
  if (state.sort) p.set('sort', state.sort);
  return p;
}

export function toSearchFilters(state: SearchState): SearchFilters {
  const f: SearchFilters = {};
  if (state.mode) f.mode = state.mode;
  if (state.bhk != null) f.bhk = state.bhk;
  if (state.minPrice != null) f.minPrice = state.minPrice;
  if (state.maxPrice != null) f.maxPrice = state.maxPrice;
  if (state.locality) f.locality = state.locality;
  if (state.propertyType) f.propertyType = state.propertyType;
  if (state.furnishing) f.furnishing = state.furnishing;
  return f;
}

export function hasAnyFilter(state: SearchState): boolean {
  return FILTER_KEYS.some((k) => state[k] !== undefined);
}

export type SearchAction =
  | { type: 'setQuery'; q: string }
  | { type: 'setCity'; city: string }
  | { type: 'setSort'; sort?: ListingSort }
  | { type: 'setFilter'; key: FilterKey; value: string | number | undefined }
  | { type: 'setPriceRange'; minPrice?: number; maxPrice?: number }
  | { type: 'removeChip'; key: FilterKey | 'q' | 'city' }
  | { type: 'applyIntent'; intent: SearchIntent }
  | { type: 'clearFilters' };

export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'setQuery':
      return { ...state, q: action.q.trim() };
    case 'setCity':
      return { ...state, city: action.city.trim() };
    case 'setSort':
      return { ...state, sort: action.sort };
    case 'setFilter': {
      const next = { ...state };
      const v = action.value;
      if (v === undefined || v === '' || v === null) {
        delete next[action.key];
        return next;
      }
      if (action.key === 'mode') {
        if (!MODES.includes(v as ListingMode)) return state;
        next.mode = v as ListingMode;
        return next;
      }
      if (action.key === 'bhk' || action.key === 'minPrice' || action.key === 'maxPrice') {
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n) || n < 0) return state;
        next[action.key] = n;
        return next;
      }
      next[action.key] = String(v).trim() || undefined;
      if (next[action.key] === undefined) delete next[action.key];
      return next;
    }
    case 'setPriceRange': {
      const next = { ...state };
      if (action.minPrice == null) delete next.minPrice;
      else next.minPrice = action.minPrice;
      if (action.maxPrice == null) delete next.maxPrice;
      else next.maxPrice = action.maxPrice;
      if (next.minPrice != null && next.maxPrice != null && next.minPrice > next.maxPrice) {
        [next.minPrice, next.maxPrice] = [next.maxPrice, next.minPrice];
      }
      return next;
    }
    case 'removeChip': {
      const next = { ...state };
      if (action.key === 'q') next.q = '';
      else if (action.key === 'city') next.city = '';
      else delete next[action.key];
      return next;
    }
    case 'applyIntent': {
      // The server's parsed intent becomes explicit, editable URL filters —
      // but never overrides something the user already set by hand.
      const i = action.intent;
      const next = { ...state };
      if (!next.city && i.city) next.city = i.city;
      if (next.mode === undefined && i.mode) next.mode = i.mode;
      if (next.bhk === undefined && i.bhk != null) next.bhk = i.bhk;
      if (next.minPrice === undefined && i.minPrice != null) next.minPrice = i.minPrice;
      if (next.maxPrice === undefined && i.maxPrice != null) next.maxPrice = i.maxPrice;
      if (next.locality === undefined && i.locality) next.locality = i.locality;
      if (next.propertyType === undefined && i.propertyType) next.propertyType = i.propertyType;
      return next;
    }
    case 'clearFilters': {
      const next: SearchState = { q: state.q, city: state.city, sort: state.sort };
      return next;
    }
    default:
      return state;
  }
}

export interface IntentChip {
  key: FilterKey | 'city';
  label: string;
  /** true when the value came from the AI's parse, not a manual filter */
  fromIntent: boolean;
}

/** Build the chip row for the assistant strip. */
export function buildIntentChips(
  state: SearchState,
  intent: SearchIntent | null,
  fmt: { price: (n: number) => string },
): IntentChip[] {
  const chips: IntentChip[] = [];
  const city = state.city || intent?.city || '';
  if (city) chips.push({ key: 'city', label: city, fromIntent: !state.city && !!intent?.city });

  const mode = state.mode ?? intent?.mode ?? undefined;
  if (mode) chips.push({ key: 'mode', label: mode === 'rent' ? 'Rent' : 'Buy', fromIntent: state.mode === undefined });

  const bhk = state.bhk ?? intent?.bhk ?? undefined;
  if (bhk != null) chips.push({ key: 'bhk', label: `${bhk} BHK`, fromIntent: state.bhk === undefined });

  const minPrice = state.minPrice ?? intent?.minPrice ?? undefined;
  const maxPrice = state.maxPrice ?? intent?.maxPrice ?? undefined;
  if (minPrice != null && maxPrice != null) {
    chips.push({ key: 'maxPrice', label: `${fmt.price(minPrice)} – ${fmt.price(maxPrice)}`, fromIntent: state.maxPrice === undefined });
  } else if (maxPrice != null) {
    chips.push({ key: 'maxPrice', label: `Under ${fmt.price(maxPrice)}`, fromIntent: state.maxPrice === undefined });
  } else if (minPrice != null) {
    chips.push({ key: 'minPrice', label: `Above ${fmt.price(minPrice)}`, fromIntent: state.minPrice === undefined });
  }

  const locality = state.locality ?? intent?.locality ?? undefined;
  if (locality) chips.push({ key: 'locality', label: locality, fromIntent: state.locality === undefined });

  const propertyType = state.propertyType ?? intent?.propertyType ?? undefined;
  if (propertyType) {
    chips.push({ key: 'propertyType', label: propertyType.replace(/[-_]/g, ' '), fromIntent: state.propertyType === undefined });
  }

  if (state.furnishing) chips.push({ key: 'furnishing', label: state.furnishing.replace(/[-_]/g, ' '), fromIntent: false });

  return chips;
}
