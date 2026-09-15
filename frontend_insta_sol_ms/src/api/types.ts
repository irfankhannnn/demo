/**
 * Wire types for backend_insta_sol_ms. Attribute names match what the routes
 * in backend_insta_sol_ms/routes return; fields the backend may omit are
 * optional so the UI degrades rather than crashing.
 */

/* ------------------------------------------------------------------ */
/* Enumerations                                                        */
/* ------------------------------------------------------------------ */

export type Intent = 'buy' | 'rent' | 'heavy_deposit_ok' | 'sell' | 'unknown';

export type Temperature = 'hot' | 'warm' | 'cold';

export type LeadScore = 'very_hot' | 'hot' | 'cold';

export type EnquiryStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'site_visit'
  | 'won'
  | 'lost'
  | 'spam';

export type WindowState = 'STANDARD' | 'COMMENT_REPLY' | 'HUMAN_AGENT' | 'CLOSED';

export type AccountStatus = 'connected' | 'reconnect_required' | 'disconnected';

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

/** HUMAN_AGENT is never produced by this backend; filters only offer real states. */
export const WINDOW_STATES: WindowState[] = ['STANDARD', 'COMMENT_REPLY', 'CLOSED'];

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/** Every failure body in this API is `{ error, details? }`. */
export interface ApiErrorBody {
  error: string;
  details?: string;
}

/* ------------------------------------------------------------------ */
/* Instagram accounts                                                  */
/* ------------------------------------------------------------------ */

export interface InstagramAccount {
  igUserId: string;
  username?: string | null;
  name?: string | null;
  accountType?: string | null;
  profilePictureUrl?: string | null;
  followersCount?: number | null;
  followsCount?: number | null;
  mediaCount?: number | null;
  /** Meta's totals for the last 30 days, from the latest profile sync. */
  insights30d?: {
    reach?: number | null;
    views?: number | null;
    accountsEngaged?: number | null;
    totalInteractions?: number | null;
    profileLinksTaps?: number | null;
    measuredAt?: string;
  } | null;
  status: AccountStatus;
  tokenExpiresAt?: string | null;
  tokenExpiringSoon?: boolean | null;
  webhookSubscribed?: boolean;
  webhookError?: string | null;
  connectedAt?: string | null;
  lastConversationsSyncAt?: string | null;
  lastMediaSyncAt?: string | null;
  lastProfileSyncAt?: string | null;
  lastWebhookAt?: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
}

export interface AccountsResponse {
  accounts: InstagramAccount[];
  instagramConfigured: boolean;
  dryRunSends: boolean;
  killSwitch: boolean;
}

export interface SyncSummary {
  accounts: number;
  jobs: Record<string, number>;
  errors: Array<{ igUserId: string; job: string; message: string }>;
}

export interface SyncResponse {
  account: InstagramAccount;
  summary: SyncSummary;
}

/* ------------------------------------------------------------------ */
/* GET /overview, GET /insights/timeseries                             */
/* ------------------------------------------------------------------ */

export interface OverviewPoint {
  date: string;
  enquiries?: number;
  followers?: number;
  reach?: number;
  views?: number;
}

export interface OverviewCounters {
  accounts?: number;
  accountsNeedingReconnect?: number;
  enquiries?: number;
  hotEnquiries?: number;
  newEnquiries?: number;
  unansweredThreads?: number;
  threads?: number;
  followers?: number;
  /** Last 30 days. Reach is unique accounts. */
  reach?: number;
  views?: number;
  accountsEngaged?: number;
  totalInteractions?: number;
  media?: number;
}

export interface OverviewResponse {
  counters: OverviewCounters;
  /** Oldest first. */
  series: OverviewPoint[];
  accounts: InstagramAccount[];
}

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
/* Media — the reel leaderboard                                        */
/* ------------------------------------------------------------------ */

export interface MediaMetrics {
  views?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  saved?: number;
  shares?: number;
  totalInteractions?: number;
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
  hotCount?: number;
}

export interface MediaListResponse {
  media: Media[];
}

export interface MediaSnapshot extends MediaMetrics {
  date: string;
}

export interface MediaDetailResponse {
  media: Media;
  snapshots: MediaSnapshot[];
}

export type MediaSort = 'enquiries' | 'views';

/* ------------------------------------------------------------------ */
/* Enquiries                                                           */
/* ------------------------------------------------------------------ */

export type CrmSyncStatus =
  | 'created'
  | 'updated'
  | 'duplicate'
  | 'skipped'
  | 'failed'
  | 'waiting_for_phone'
  | 'needs_intent'
  | 'not_configured'
  | 'disabled';

export interface CrmSync {
  status: CrmSyncStatus;
  leadId?: string | null;
  reason?: string | null;
  at?: string;
}

export interface Enquiry {
  enquiryId: string;
  threadId?: string;
  igUserId?: string;
  name?: string | null;
  phone?: string | null;
  intent?: Intent;
  budgetBracket?: string;
  budgetText?: string;
  preferredArea?: string | null;
  city?: string | null;
  propertyType?: string;
  dealType?: string;
  leadType?: string;
  leadScore?: LeadScore;
  temperature?: Temperature;
  summary?: string;
  nextAction?: string;
  suggestedReply?: string;
  meetingSchedule?: string;
  callRequested?: boolean;
  needsReview?: boolean;
  analyser?: string;
  sourceMediaId?: string | null;
  igSenderId?: string;
  igUsername?: string | null;
  status?: EnquiryStatus;
  notes?: string | null;
  crmSync?: CrmSync | null;
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
/* Threads                                                             */
/* ------------------------------------------------------------------ */

export interface ThreadAnalysis {
  analyser?: string;
  leadScore?: LeadScore;
  leadType?: string;
  temperature?: Temperature;
  summary?: string;
  nextAction?: string;
  suggestedReply?: string;
  needsReview?: boolean;
  isLead?: boolean;
  analysedAt?: string;
}

export interface Thread {
  threadId: string;
  igUserId?: string;
  conversationId?: string | null;
  participantId?: string;
  participantUsername?: string | null;
  messageCount?: number;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  lastMessageAt?: string | null;
  lastMessageText?: string | null;
  lastMessageDirection?: 'in' | 'out' | null;
  windowState?: WindowState;
  windowExpiresAt?: string | null;
  unanswered?: boolean;
  needsAnalysis?: boolean;
  sourceMediaId?: string | null;
  enquiryId?: string;
  analysis?: ThreadAnalysis;
  firstSeenAt?: string;
}

export interface ThreadListResponse {
  threads: Thread[];
}

export interface Message {
  messageId: string;
  direction: 'in' | 'out';
  text: string;
  createdAt: string;
  source?: string | null;
  status?: string | null;
}

export interface ThreadDetailResponse {
  thread: Thread;
  messages: Message[];
  enquiry: Enquiry | null;
  canReply: { allowed: boolean; reason: string };
}

export interface ReplyResponse {
  messageId: string;
  status: 'sent' | 'dry_run';
  thread: Thread;
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

/* Comments                                                            */

export type CommentReplyMode = 'public' | 'private';

export interface CommentReply {
  mode: CommentReplyMode;
  text: string;
  status: 'sent' | 'dry_run';
  at: string;
  by?: string | null;
}

export interface InstagramComment {
  commentId: string;
  igUserId?: string | null;
  mediaId?: string | null;
  text: string;
  fromId?: string | null;
  fromUsername?: string | null;
  createdAt?: string | null;
  /** What the keyword rules did: seen, no_rule, replied, dry_run, paused, rate_capped, failed, own_comment. */
  status?: string | null;
  ruleId?: string | null;
  lastReply?: CommentReply | null;
  privateReplyAllowed: boolean;
  privateReplyReason: string;
  media?: { caption?: string | null; permalink?: string | null; thumbnailUrl?: string | null } | null;
}

export interface CommentListResponse {
  comments: InstagramComment[];
}

export interface CommentReplyResponse {
  comment: InstagramComment;
  status: 'sent' | 'dry_run';
}

export type RuleMatchType = 'exact' | 'contains' | 'starts_with' | 'regex';

export const RULE_MATCH_TYPES: RuleMatchType[] = ['exact', 'contains', 'starts_with', 'regex'];

export interface Rule {
  ruleId: string;
  keyword: string;
  matchType?: RuleMatchType;
  publicReply?: string | null;
  dmMessage?: string | null;
  /** `all`, or a comma-separated list of media ids the rule is scoped to. */
  mediaScope?: string;
  enabled?: boolean;
  createdAt?: string;
}

export interface RuleListResponse {
  rules: Rule[];
}

/** POST /rules body. A present `ruleId` means upsert of an existing rule. */
export type RuleInput = Omit<Rule, 'ruleId' | 'createdAt'> & { ruleId?: string };

/* ------------------------------------------------------------------ */
/* GET /health                                                         */
/* ------------------------------------------------------------------ */

export interface HealthResponse {
  status: string;
  service?: string;
  instagramConfigured?: boolean;
  serverTime?: string;
}
