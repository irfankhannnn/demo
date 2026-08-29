/**
 * One function per frontend endpoint in contract section 4.
 *
 * Each one normalises the envelope before handing it to a page. The contract
 * names the endpoints but not their exact JSON shells, so a list endpoint is
 * accepted as a bare array, as `{ items: [] }`, or as `{ <name>: [] }` — the
 * pages then only ever deal with one shape and cannot render `undefined.map`.
 */

import { api, type QueryValue } from './client';
import type {
  AccountsResponse,
  Device,
  DevicesResponse,
  Enquiry,
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
  PairingCodeResponse,
  Rule,
  RuleInput,
  RuleListResponse,
  Temperature,
  Thread,
  ThreadListResponse,
  TimeseriesMetric,
  TimeseriesPoint,
  TimeseriesResponse,
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
  const record = payload as Record<string, unknown>;
  for (const candidate of ['cursor', 'nextCursor', 'lastKey']) {
    const value = record[candidate];
    if (typeof value === 'string' && value) return value;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Overview + insights                                                 */
/* ------------------------------------------------------------------ */

export async function getOverview(signal?: AbortSignal): Promise<OverviewResponse> {
  const raw = await api.get<Record<string, unknown>>('/overview', undefined, signal);
  const counters =
    (raw.counters as OverviewResponse['counters']) ??
    (raw.headline as OverviewResponse['counters']) ??
    // A flat body is also plausible; the unknown keys are simply ignored.
    (raw as OverviewResponse['counters']);

  return {
    counters: counters ?? {},
    series: toList<OverviewPoint>(raw.series ?? raw.trend ?? raw.timeseries, 'series'),
    devices: toList<Device>(raw.devices, 'devices'),
    accounts: toList<InstagramAccount>(raw.accounts, 'accounts'),
    killSwitch: typeof raw.killSwitch === 'boolean' ? raw.killSwitch : undefined,
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : undefined,
  };
}

export async function getTimeseries(
  metric: TimeseriesMetric,
  days = 30,
  signal?: AbortSignal,
): Promise<TimeseriesResponse> {
  const raw = await api.get<Record<string, unknown>>(
    '/insights/timeseries',
    { metric, days },
    signal,
  );
  return {
    metric,
    days,
    points: toList<TimeseriesPoint>(raw.points ?? raw.series, 'points'),
  };
}

/* ------------------------------------------------------------------ */
/* Accounts + devices                                                  */
/* ------------------------------------------------------------------ */

export async function getAccounts(signal?: AbortSignal): Promise<AccountsResponse> {
  const raw = await api.get<Record<string, unknown>>('/accounts', undefined, signal);
  return {
    accounts: toList<InstagramAccount>(raw.accounts ?? raw, 'accounts'),
    devices: toList<Device>(raw.devices, 'devices'),
  };
}

export async function getDevices(signal?: AbortSignal): Promise<DevicesResponse> {
  const raw = await api.get<Record<string, unknown>>('/devices', undefined, signal);
  return { devices: toList<Device>(raw, 'devices') };
}

export function createPairingCode(signal?: AbortSignal): Promise<PairingCodeResponse> {
  return api.post<PairingCodeResponse>('/devices/pair', undefined, signal);
}

export function revokeDevice(deviceId: string, signal?: AbortSignal): Promise<void> {
  return api.delete<void>(`/devices/${encodeURIComponent(deviceId)}`, signal);
}

/* ------------------------------------------------------------------ */
/* Media — the reel leaderboard                                        */
/* ------------------------------------------------------------------ */

export async function getMedia(
  params: { sort?: MediaSort; limit?: number } = {},
  signal?: AbortSignal,
): Promise<MediaListResponse> {
  const raw = await api.get<Record<string, unknown>>(
    '/media',
    { sort: params.sort, limit: params.limit },
    signal,
  );
  return { media: toList<Media>(raw, 'media') };
}

export async function getMediaDetail(
  mediaId: string,
  signal?: AbortSignal,
): Promise<MediaDetailResponse> {
  const raw = await api.get<Record<string, unknown>>(
    `/media/${encodeURIComponent(mediaId)}`,
    undefined,
    signal,
  );
  const media = (raw.media ?? raw) as Media;
  return {
    media,
    snapshots: toList<MediaSnapshot>(raw.snapshots ?? raw.series, 'snapshots'),
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

export async function getEnquiries(
  query: EnquiryQuery = {},
  signal?: AbortSignal,
): Promise<EnquiryListResponse> {
  const params: Record<string, QueryValue> = {
    status: query.status || undefined,
    temperature: query.temperature || undefined,
    limit: query.limit,
    cursor: query.cursor || undefined,
  };
  const raw = await api.get<Record<string, unknown>>('/enquiries', params, signal);
  return {
    enquiries: toList<Enquiry>(raw, 'enquiries'),
    cursor: toCursor(raw),
  };
}

export async function patchEnquiry(
  enquiryId: string,
  patch: EnquiryPatch,
  signal?: AbortSignal,
): Promise<Enquiry> {
  const raw = await api.patch<Record<string, unknown>>(
    `/enquiries/${encodeURIComponent(enquiryId)}`,
    patch,
    signal,
  );
  return (raw.enquiry ?? raw) as Enquiry;
}

/* ------------------------------------------------------------------ */
/* Threads                                                             */
/* ------------------------------------------------------------------ */

export interface ThreadQuery {
  windowState?: WindowState | '';
  unanswered?: boolean;
}

export async function getThreads(
  query: ThreadQuery = {},
  signal?: AbortSignal,
): Promise<ThreadListResponse> {
  const params: Record<string, QueryValue> = {
    windowState: query.windowState || undefined,
    unanswered: query.unanswered ? 'true' : undefined,
  };
  const raw = await api.get<Record<string, unknown>>('/threads', params, signal);
  return {
    threads: toList<Thread>(raw, 'threads'),
    cursor: toCursor(raw),
  };
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export async function getRules(signal?: AbortSignal): Promise<RuleListResponse> {
  const raw = await api.get<Record<string, unknown>>('/rules', undefined, signal);
  return {
    rules: toList<Rule>(raw, 'rules'),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
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
