/**
 * Types mirroring docs/public-app/api/API-CONTRACT.md §2 and §3.
 * Keep these in lock-step with the contract — the web app is coded strictly
 * against it while marketplace-api and marketplace-authentication are built.
 */

export type ListingMode = 'sale' | 'rent';
export type ListingSort = 'newest' | 'price_asc' | 'price_desc';

export interface ApiError {
  error: string;
  details?: string;
}

export interface City {
  name: string;
  cityKey: string;
  sale: number;
  rent: number;
  total: number;
}

export interface AgencyCard {
  name: string;
  slug: string;
  logoS3Key: string | null;
  brandPrimaryColor: string | null;
}

export interface ListingDocument {
  kind: string;
  label: string;
}

export interface ListingPricing {
  mode: ListingMode;
  amount: number | null;
  deposit: number | null;
}

export interface MarketplaceListing {
  propertyId: string;
  slug: string;
  title: string;
  description: string | null;
  propertyType: string | null;
  bhk: number | null;
  furnishing: string | null;
  facing: string | null;
  carpetArea: number | null;
  builtUpArea: number | null;
  amenities: string[];
  locality: string | null;
  city: string;
  buildingName: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  pricing: ListingPricing;
  imageCount: number;
  documents: ListingDocument[];
  availableFrom: string | null;
  updatedAt: string;
  tenantId: string;
  agencySlug: string;
  agency: AgencyCard;
  listedAt: string;
  /** Only on search / similar results (1 - cosine distance). */
  matchScore?: number;
  /** Plain-English reason, only on POST /search/ai results (top 8). */
  why?: string;
}

export interface ListingsQuery {
  city: string;
  mode?: ListingMode;
  locality?: string;
  minPrice?: number;
  maxPrice?: number;
  bhk?: number;
  minBhk?: number;
  maxBhk?: number;
  propertyType?: string;
  furnishing?: string;
  sort?: ListingSort;
  limit?: number;
  cursor?: string;
}

export interface ListingsResponse {
  items: MarketplaceListing[];
  nextCursor: string | null;
  cityKey: string;
  mode: ListingMode | null;
}

export interface Agency {
  tenantId: string;
  slug: string;
  name: string;
  logoS3Key: string | null;
  brandPrimaryColor: string | null;
  publicPhone: string | null;
  publicEmail: string | null;
  publicAddress: string | null;
  about: string | null;
  marketplaceEnabled: boolean;
}

export interface SearchFilters {
  mode?: ListingMode;
  propertyType?: string;
  bhk?: number;
  minPrice?: number;
  maxPrice?: number;
  locality?: string;
  furnishing?: string;
}

export interface AiSearchRequest {
  query: string;
  city?: string;
  filters?: SearchFilters;
  conversationId?: string;
}

export interface SearchIntent {
  cityKey: string | null;
  city: string | null;
  mode: ListingMode | null;
  propertyType: string | null;
  bhk: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  locality: string | null;
  mustHaves: string[];
  canonicalQuery: string;
}

export interface AiSearchResponse {
  intent: SearchIntent;
  results: MarketplaceListing[];
  followUps: string[];
  assistantMessage: string;
  needsCity: boolean;
}

export interface Availability {
  timeZone: string;
  dates: { date: string; slots: string[] }[];
}

export interface ConsumerProfile {
  userId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  preferredCities: string[];
  createdAt: string;
}

export interface SavedItem {
  propertyId: string;
  tenantId: string;
  agencySlug: string;
  savedAt: string;
  snapshot: {
    title: string;
    price: number | null;
    mode: ListingMode;
    locality: string | null;
    city: string;
    imageCount: number;
  };
}

export interface SavedSearch {
  searchId: string;
  query: string;
  city: string;
  filters: SearchFilters;
  createdAt?: string;
}

export type ThreadStatus = 'open' | 'listing_removed' | 'agency_closed';

export interface Thread {
  threadId: string;
  buyerUserId: string;
  tenantId: string;
  agencySlug: string;
  propertyId: string;
  leadId: string | null;
  status: ThreadStatus;
  snapshot: {
    title: string;
    agencyName: string;
    city: string;
    locality: string | null;
    price: number | null;
    mode: ListingMode;
    imageCount: number;
  };
  lastMessageAt: string;
  lastPreview: string;
  unreadBuyer: number;
  unreadAgency: number;
  createdAt: string;
}

export type MessageKind = 'text' | 'ping' | 'visit_request';

export interface Message {
  messageId: string;
  threadId: string;
  senderType: 'buyer' | 'agency' | 'system';
  senderId: string;
  senderName: string;
  text: string;
  kind: MessageKind;
  meta?: { meetingId?: string; meetingDate?: string; meetingTime?: string };
  createdAt: string;
}

export interface ThreadsResponse {
  items: Thread[];
  nextCursor: string | null;
}

export interface ThreadDetailResponse {
  thread: Thread;
  messages: Message[];
}

export interface VisitResponse {
  ok: boolean;
  meetingId: string;
  meetingDate: string;
  meetingTime: string;
  thread: Thread;
}

// ---- marketplace-authentication (§3) -------------------------------------

export interface AuthUser {
  userId: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  createdAt?: string;
  isNew?: boolean;
}

export interface PhoneStartResponse {
  session: string;
  phone: string;
  expiresInSeconds: number;
}

export interface TokenResponse {
  accessToken: string;
  idToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  idToken: string;
  expiresIn: number;
}

export interface GoogleUrlResponse {
  url: string;
  state: string;
  codeVerifier: string;
}
