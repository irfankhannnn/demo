/**
 * One function per backend endpoint. Each normalises the envelope before
 * handing it to a page, so pages only ever deal with one shape and cannot
 * render `undefined.map`.
 */

import { api, type QueryValue } from './client';
import type {
  AccountsResponse,
  CommentListResponse,
  CommentReplyMode,
  CommentReplyResponse,
  Enquiry,
  InstagramComment,
  EnquiryListResponse,
  EnquiryPatch,
  EnquiryStatus,
  HealthResponse,
  InstagramAccount,
  Media,
  MediaDetailResponse,
  MediaListResponse,
  MediaSnapshot,
  MediaSort,
  OverviewPoint,
  OverviewResponse,
  ReplyResponse,
  Rule,
  RuleInput,
  RuleListResponse,
  SyncResponse,
  Temperature,
  Thread,
  ThreadDetailResponse,
  ThreadListResponse,
  TimeseriesMetric,
  TimeseriesPoint,
  TimeseriesResponse,
  CrmSync,
  WindowState,
} from './types';

/** Pull an array out of whatever envelope the service used. Never returns undefined. */
function toList<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const candidate of [key, 'items', 'data', 'results']) {
      if (Array.isArray(record[candidate])) return record[candidate] as T[];
    }
  }
  return [];
}

function toCursor(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>).cursor;
  return typeof value === 'string' && value ? value : null;
}

/* ------------------------------------------------------------------ */
/* Overview + insights                                                 */
/* ------------------------------------------------------------------ */

export async function getOverview(signal?: AbortSignal): Promise<OverviewResponse> {
  const raw = await api.get<Record<string, unknown>>('/overview', undefined, signal);
  return {
    counters: (raw.counters as OverviewResponse['counters']) ?? {},
    series: toList<OverviewPoint>(raw.series, 'series'),
    accounts: toList<InstagramAccount>(raw.accounts, 'accounts'),
  };
}

export async function getTimeseries(
  metric: TimeseriesMetric,
  days = 30,
  signal?: AbortSignal,
): Promise<TimeseriesResponse> {
  const raw = await api.get<Record<string, unknown>>('/insights/timeseries', { metric, days }, signal);
  return { metric, days, points: toList<TimeseriesPoint>(raw.points, 'points') };
}

/* ------------------------------------------------------------------ */
/* Instagram accounts                                                  */
/* ------------------------------------------------------------------ */

export async function getAccounts(signal?: AbortSignal): Promise<AccountsResponse> {
  const raw = await api.get<Record<string, unknown>>('/accounts', undefined, signal);
  return {
    accounts: toList<InstagramAccount>(raw, 'accounts'),
    instagramConfigured: raw.instagramConfigured === true,
    dryRunSends: raw.dryRunSends === true,
    killSwitch: raw.killSwitch === true,
  };
}

/** Returns the Instagram consent-screen URL; the caller navigates the browser to it. */
export async function startInstagramConnect(signal?: AbortSignal): Promise<string> {
  const raw = await api.post<{ authorizeUrl?: string }>('/oauth/start', undefined, signal);
  if (!raw.authorizeUrl) throw new Error('The service did not return an Instagram login URL');
  return raw.authorizeUrl;
}

export function syncAccount(igUserId: string, signal?: AbortSignal): Promise<SyncResponse> {
  return api.post<SyncResponse>(`/accounts/${encodeURIComponent(igUserId)}/sync`, undefined, signal);
}

export function disconnectAccount(igUserId: string, signal?: AbortSignal): Promise<void> {
  return api.delete<void>(`/accounts/${encodeURIComponent(igUserId)}`, signal);
}

/* ------------------------------------------------------------------ */
/* Media — the reel leaderboard                                        */
/* ------------------------------------------------------------------ */

export async function getMedia(
  params: { sort?: MediaSort; limit?: number } = {},
  signal?: AbortSignal,
): Promise<MediaListResponse> {
  const raw = await api.get<Record<string, unknown>>('/media', { sort: params.sort, limit: params.limit }, signal);
  return { media: toList<Media>(raw, 'media') };
}

export async function getMediaDetail(mediaId: string, signal?: AbortSignal): Promise<MediaDetailResponse> {
  const raw = await api.get<Record<string, unknown>>(`/media/${encodeURIComponent(mediaId)}`, undefined, signal);
  return {
    media: (raw.media ?? raw) as Media,
    snapshots: toList<MediaSnapshot>(raw.snapshots, 'snapshots'),
  };
}

/* ------------------------------------------------------------------ */
/* Enquiries                                                           */
/* ------------------------------------------------------------------ */

export interface EnquiryQuery {
  status?: EnquiryStatus | '';
  temperature?: Temperature | '';
  limit?: number;
  cursor?: string | null;
}

export async function getEnquiries(query: EnquiryQuery = {}, signal?: AbortSignal): Promise<EnquiryListResponse> {
  const params: Record<string, QueryValue> = {
    status: query.status || undefined,
    temperature: query.temperature || undefined,
    limit: query.limit,
    cursor: query.cursor || undefined,
  };
  const raw = await api.get<Record<string, unknown>>('/enquiries', params, signal);
  return { enquiries: toList<Enquiry>(raw, 'enquiries'), cursor: toCursor(raw) };
}

export async function patchEnquiry(enquiryId: string, patch: EnquiryPatch, signal?: AbortSignal): Promise<Enquiry> {
  const raw = await api.patch<Record<string, unknown>>(`/enquiries/${encodeURIComponent(enquiryId)}`, patch, signal);
  return (raw.enquiry ?? raw) as Enquiry;
}

export async function pushEnquiryToCrm(enquiryId: string, signal?: AbortSignal): Promise<CrmSync> {
  const raw = await api.post<{ crmSync: CrmSync }>(`/enquiries/${encodeURIComponent(enquiryId)}/push-to-crm`, undefined, signal);
  return raw.crmSync;
}

/* ------------------------------------------------------------------ */
/* Threads                                                             */
/* ------------------------------------------------------------------ */

export interface ThreadQuery {
  windowState?: WindowState | '';
  unanswered?: boolean;
}

export async function getThreads(query: ThreadQuery = {}, signal?: AbortSignal): Promise<ThreadListResponse> {
  const params: Record<string, QueryValue> = {
    windowState: query.windowState || undefined,
    unanswered: query.unanswered ? 'true' : undefined,
  };
  const raw = await api.get<Record<string, unknown>>('/threads', params, signal);
  return { threads: toList<Thread>(raw, 'threads') };
}

export function getThread(threadId: string, signal?: AbortSignal): Promise<ThreadDetailResponse> {
  return api.get<ThreadDetailResponse>(`/threads/${encodeURIComponent(threadId)}`, undefined, signal);
}

export function sendThreadReply(threadId: string, text: string, signal?: AbortSignal): Promise<ReplyResponse> {
  return api.post<ReplyResponse>(`/threads/${encodeURIComponent(threadId)}/reply`, { text }, signal);
}

export function analyseThread(threadId: string, signal?: AbortSignal): Promise<{ thread: Thread; enquiry: Enquiry | null }> {
  return api.post(`/threads/${encodeURIComponent(threadId)}/analyse`, undefined, signal);
}

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

export async function getComments(query: { mediaId?: string } = {}, signal?: AbortSignal): Promise<CommentListResponse> {
  const raw = await api.get<Record<string, unknown>>('/comments', { mediaId: query.mediaId || undefined }, signal);
  return { comments: toList<InstagramComment>(raw, 'comments') };
}

export function replyToComment(
  commentId: string,
  text: string,
  mode: CommentReplyMode,
  signal?: AbortSignal,
): Promise<CommentReplyResponse> {
  return api.post<CommentReplyResponse>(`/comments/${encodeURIComponent(commentId)}/reply`, { text, mode }, signal);
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export async function getRules(signal?: AbortSignal): Promise<RuleListResponse> {
  const raw = await api.get<Record<string, unknown>>('/rules', undefined, signal);
  return { rules: toList<Rule>(raw, 'rules') };
}

export async function saveRule(rule: RuleInput, signal?: AbortSignal): Promise<Rule> {
  const raw = await api.post<Record<string, unknown>>('/rules', rule, signal);
  return (raw.rule ?? raw) as Rule;
}

export function deleteRule(ruleId: string, signal?: AbortSignal): Promise<void> {
  return api.delete<void>(`/rules/${encodeURIComponent(ruleId)}`, signal);
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return api.get<HealthResponse>('/health', undefined, signal);
}
