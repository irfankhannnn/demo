/**
 * marketplace-api client (API contract §2). Every function maps 1:1 to a route.
 */
import { api } from './api';
import type {
  Agency,
  AiSearchRequest,
  AiSearchResponse,
  Availability,
  City,
  ConsumerProfile,
  ListingsQuery,
  ListingsResponse,
  MarketplaceListing,
  Message,
  SavedItem,
  SavedSearch,
  SearchFilters,
  Thread,
  ThreadDetailResponse,
  ThreadsResponse,
  VisitResponse,
} from '@/types/api';

const enc = encodeURIComponent;
const listingPath = (slug: string, propertyId: string) => `/agencies/${enc(slug)}/listings/${enc(propertyId)}`;

export const marketplace = {
  // ---- public ------------------------------------------------------------
  cities: () => api.get<{ cities: City[] }>('/cities'),

  listings: (q: ListingsQuery, signal?: AbortSignal) => api.get<ListingsResponse>('/listings', { query: { ...q }, signal }),

  agency: (slug: string) => api.get<{ agency: Agency }>(`/agencies/${enc(slug)}`),

  listing: (slug: string, propertyId: string) =>
    api.get<{ listing: MarketplaceListing; saved?: boolean }>(listingPath(slug, propertyId), { auth: 'optional' }),

  similar: (slug: string, propertyId: string, limit = 8) =>
    api.get<{ items: MarketplaceListing[] }>(`${listingPath(slug, propertyId)}/similar`, { query: { limit } }),

  aiSearch: (body: AiSearchRequest, signal?: AbortSignal) => api.post<AiSearchResponse>('/search/ai', body, { auth: 'optional', signal }),

  // ---- consumer ----------------------------------------------------------
  me: () => api.get<{ user: ConsumerProfile }>('/me', { auth: 'required' }),

  updateMe: (patch: { name?: string; email?: string; preferredCities?: string[] }) =>
    api.put<{ user: ConsumerProfile }>('/me', patch, { auth: 'required' }),

  saved: () => api.get<{ items: SavedItem[] }>('/me/saved', { auth: 'required' }),

  save: (slug: string, propertyId: string) => api.put<{ ok: boolean }>(`/me/saved/${enc(slug)}/${enc(propertyId)}`, {}, { auth: 'required' }),

  unsave: (slug: string, propertyId: string) => api.del<{ ok: boolean }>(`/me/saved/${enc(slug)}/${enc(propertyId)}`, { auth: 'required' }),

  searches: () => api.get<{ items: SavedSearch[] }>('/me/searches', { auth: 'required' }),

  saveSearch: (body: { query: string; city: string; filters: SearchFilters }) =>
    api.post<{ search: SavedSearch }>('/me/searches', body, { auth: 'required' }),

  deleteSearch: (searchId: string) => api.del<{ ok: boolean }>(`/me/searches/${enc(searchId)}`, { auth: 'required' }),

  threads: (cursor?: string) => api.get<ThreadsResponse>('/me/threads', { query: { cursor }, auth: 'required' }),

  startThread: (body: { slug: string; propertyId: string; text: string }) =>
    api.post<{ thread: Thread; message: Message }>('/me/threads', body, { auth: 'required' }),

  thread: (threadId: string, since?: string, signal?: AbortSignal) =>
    api.get<ThreadDetailResponse>(`/me/threads/${enc(threadId)}`, { query: { since }, auth: 'required', signal }),

  sendMessage: (threadId: string, text: string) =>
    api.post<{ message: Message }>(`/me/threads/${enc(threadId)}/messages`, { text }, { auth: 'required' }),

  markRead: (threadId: string) => api.post<{ ok: boolean }>(`/me/threads/${enc(threadId)}/read`, {}, { auth: 'required' }),

  ping: (slug: string, propertyId: string) =>
    api.post<{ ok: boolean; thread: Thread }>(`/listings/${enc(slug)}/${enc(propertyId)}/ping`, {}, { auth: 'required' }),

  availability: (slug: string, propertyId: string) =>
    api.get<Availability>(`/listings/${enc(slug)}/${enc(propertyId)}/availability`, { auth: 'required' }),

  bookVisit: (slug: string, propertyId: string, body: { date: string; time: string; message?: string }) =>
    api.post<VisitResponse>(`/listings/${enc(slug)}/${enc(propertyId)}/visit`, body, { auth: 'required' }),
};

/** React Query keys — one place so invalidation stays consistent. */
export const qk = {
  cities: ['cities'] as const,
  listings: (q: ListingsQuery) => ['listings', q] as const,
  listing: (slug: string, id: string) => ['listing', slug, id] as const,
  similar: (slug: string, id: string) => ['similar', slug, id] as const,
  agency: (slug: string) => ['agency', slug] as const,
  agencyListings: (slug: string) => ['agencyListings', slug] as const,
  aiSearch: (body: AiSearchRequest) => ['aiSearch', body] as const,
  me: ['me'] as const,
  saved: ['saved'] as const,
  searches: ['searches'] as const,
  threads: ['threads'] as const,
  thread: (id: string) => ['thread', id] as const,
  availability: (slug: string, id: string) => ['availability', slug, id] as const,
};
