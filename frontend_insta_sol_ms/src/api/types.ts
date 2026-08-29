/**
 * Wire types for every response in section 4 of
 * docs/insta-sol-ms-docs/03-ARCHITECTURE.md.
 *
 * Attribute names come from the DynamoDB item tables in section 3, since the
 * contract does not spell out response envelopes field by field. Anything the
 * contract left unspecified is optional here and the UI degrades rather than
 * crashing when it is absent — the only safe reading of a contract that two
 * teams are implementing in parallel.
 */

/* ------------------------------------------------------------------ */
/* Enumerations — section 3                                            */
/* ------------------------------------------------------------------ */

export type Intent = 'buy' | 'rent' | 'heavy_deposit_ok' | 'sell' | 'unknown';

export type Temperature = 'hot' | 'warm' | 'cold';

export type EnquiryStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'site_visit'
  | 'won'
  | 'lost'
  | 'spam';

export type WindowState = 'STANDARD' | 'COMMENT_REPLY' | 'HUMAN_AGENT' | 'CLOSED';

export const TEMPERATURES: Temperature[] = ['hot', 'warm', 'cold'];

export const ENQUIRY_STATUSES: EnquiryStatus[] = [
  'new',
  'contacted',
  'qualified',
  'site_visit',
  'won',
  'lost',
  'spam',
];

export const WINDOW_STATES: WindowState[] = [
  'STANDARD',
  'COMMENT_REPLY',
  'HUMAN_AGENT',
  'CLOSED',
];

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/** Every failure body in this API is `{ error, details? }`. */
export interface ApiErrorBody {
  error: string;
  details?: string;
}

/* ------------------------------------------------------------------ */
/* GET /overview                                                       */
/* ------------------------------------------------------------------ */

/** One day of the 30-day dashboard series. Metric keys are all optional. */
export interface OverviewPoint {
  date: string;
  enquiries?: number;
  followers?: number;
  reach?: number;
  views?: number;
  dms?: number;
}

export interface OverviewCounters {
  enquiries?: number;
  hotEnquiries?: number;
  newEnquiries?: number;
  unansweredThreads?: number;
  threads?: number;
  followers?: number;
  followersDelta?: number;
  reach?: number;
  views?: number;
  media?: number;
}

export interface OverviewResponse {
  counters: OverviewCounters;
  /** 30 days, oldest first. */
  series: OverviewPoint[];
  /** Some deployments inline device health here; /devices stays authoritative. */
  devices?: Device[];
  accounts?: InstagramAccount[];
  killSwitch?: boolean;
  generatedAt?: string;
}

/* ------------------------------------------------------------------ */
/* GET /accounts, GET /devices, POST /devices/pair                     */
/* ------------------------------------------------------------------ */

export type DeviceStatus = 'active' | 'revoked' | 'pending' | (string & {});

export interface Device {
  deviceId: string;
  deviceName?: string;
  platform?: string;
  status?: DeviceStatus;
  igUserId?: string;
  igUsername?: string;
  agentVersion?: string;
  /** ISO timestamp of the last heartbeat. */
  lastSeenAt?: string;
  /** ISO timestamp the long-lived Instagram token expires (F64). */
  tokenExpiresAt?: string;
  revokedAt?: string;
  createdAt?: string;
}

export interface InstagramAccount {
  igUserId: string;
  igUsername?: string;
  followersCount?: number;
  followsCount?: number;
  mediaCount?: number;
  profilePictureUrl?: string;
  deviceId?: string;
  lastSyncAt?: string;
  tokenExpiresAt?: string;
}

export interface AccountsResponse {
  accounts: InstagramAccount[];
  devices?: Device[];
}

export interface DevicesResponse {
  devices: Device[];
}

export interface PairingCodeResponse {
  pairingCode: string;
  /** ISO timestamp, 15 minutes out per the contract. */
  expiresAt: string;
}

/* ------------------------------------------------------------------ */
/* GET /media — the reel leaderboard (F29)                             */
/* ------------------------------------------------------------------ */

export interface MediaMetrics {
  views?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  saved?: number;
  shares?: number;
  totalInteractions?: number;
  avgWatchTimeMs?: number;
}

export interface Media {
  mediaId: string;
  caption?: string;
  permalink?: string;
  mediaType?: string;
  mediaProductType?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  metrics?: MediaMetrics;
  commentCount?: number;
  dmCount?: number;
  enquiryCount?: number;
  /** Enquiries from this reel scored `hot`. */
  hotCount?: number;
}

export interface MediaListResponse {
  media: Media[];
}

/** One dated row of `SNAP#MEDIA#<mediaId>#<date>`. */
export interface MediaSnapshot {
  date: string;
  views?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  saved?: number;
  shares?: number;
  totalInteractions?: number;
  avgWatchTimeMs?: number;
}

export interface MediaDetailResponse {
  media: Media;
  snapshots: MediaSnapshot[];
}

export type MediaSort = 'enquiries' | 'views';

/* ------------------------------------------------------------------ */
/* GET /enquiries, PATCH /enquiries/:enquiryId                         */
/* ------------------------------------------------------------------ */

export interface Enquiry {
  enquiryId: string;
  name?: string;
  phone?: string;
  intent?: Intent;
  budgetBracket?: string;
  preferredArea?: string;
  temperature?: Temperature;
  sourceMediaId?: string;
  igSenderId?: string;
  igUsername?: string;
  status?: EnquiryStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EnquiryListResponse {
  enquiries: Enquiry[];
  /** Opaque; feed straight back as `?cursor=`. */
  cursor?: string | null;
}

export interface EnquiryPatch {
  status?: EnquiryStatus;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* GET /threads                                                        */
/* ------------------------------------------------------------------ */

export interface Thread {
  conversationId: string;
  participantId?: string;
  participantUsername?: string;
  messageCount?: number;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  windowState?: WindowState;
  unanswered?: boolean;
  firstSeenAt?: string;
}

export interface ThreadListResponse {
  threads: Thread[];
  cursor?: string | null;
}

/* ------------------------------------------------------------------ */
/* GET/POST /rules, DELETE /rules/:ruleId                              */
/* ------------------------------------------------------------------ */

export type RuleMatchType = 'exact' | 'contains' | 'starts_with' | 'regex';

export const RULE_MATCH_TYPES: RuleMatchType[] = [
  'exact',
  'contains',
  'starts_with',
  'regex',
];

export interface Rule {
  ruleId: string;
  keyword: string;
  matchType?: RuleMatchType;
  publicReply?: string;
  dmMessage?: string;
  /** `all`, or a specific mediaId the rule is scoped to. */
  mediaScope?: string;
  enabled?: boolean;
  createdAt?: string;
}

export interface RuleListResponse {
  rules: Rule[];
  updatedAt?: string;
}

/** POST /rules body. A present `ruleId` means upsert of an existing rule. */
export type RuleInput = Omit<Rule, 'ruleId' | 'createdAt'> & { ruleId?: string };

/* ------------------------------------------------------------------ */
/* GET /insights/timeseries                                            */
/* ------------------------------------------------------------------ */

export type TimeseriesMetric = 'followers' | 'reach' | 'views';

export interface TimeseriesPoint {
  date: string;
  value: number;
}

export interface TimeseriesResponse {
  metric: TimeseriesMetric;
  days?: number;
  points: TimeseriesPoint[];
}

/* ------------------------------------------------------------------ */
/* GET /health                                                         */
/* ------------------------------------------------------------------ */

export interface HealthResponse {
  ok: boolean;
  service?: string;
  version?: string;
  time?: string;
}
