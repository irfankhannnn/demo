/**
 * Marketplace Inbox.
 *
 * Two-pane inbox for conversations that buyers start on the RealEstateFlow
 * consumer marketplace. Threads live in marketplace-api; the CRM only proxies
 * them (see docs/services/marketplace-api/API-CONTRACT.md section 5), so this
 * screen polls rather than subscribes: the thread list every 15 s and the open
 * thread every 5 s using `since=lastMessageAt` so only new messages come back.
 *
 * Reachable at /crm/marketplace/inbox and /crm/marketplace/inbox/:threadId —
 * the latter is what the in-app "new marketplace message" notification links to.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  ChevronLeft,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Store,
} from 'lucide-react';
import Toast from '../../components/Toast';
import {
  marketplaceApi,
  MarketplaceApiError,
  type MarketplaceBuyer,
  type MarketplaceMessage,
  type MarketplaceThread,
} from '../../services/marketplaceApi';
import { formatRelativeTime } from '../../utils/activityTimelineMeta';

const THREAD_POLL_MS = 5000;
const LIST_POLL_MS = 15000;
const LIST_PAGE_SIZE = 50;

type MobileView = 'list' | 'thread';

function initials(name: string | undefined | null): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

function formatPrice(price: number | null | undefined, mode: 'sale' | 'rent'): string | null {
  if (price == null || Number.isNaN(price)) return null;
  let value: string;
  if (price >= 1_00_00_000) value = `₹${(price / 1_00_00_000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  else if (price >= 1_00_000) value = `₹${(price / 1_00_000).toFixed(2).replace(/\.?0+$/, '')} L`;
  else value = `₹${price.toLocaleString('en-IN')}`;
  return mode === 'rent' ? `${value}/mo` : value;
}

function formatMessageTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function mergeMessages(existing: MarketplaceMessage[], incoming: MarketplaceMessage[]): MarketplaceMessage[] {
  if (incoming.length === 0) return existing;
  const byId = new Map<string, MarketplaceMessage>();
  for (const m of existing) byId.set(m.messageId, m);
  for (const m of incoming) byId.set(m.messageId, m);
  return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const STATUS_PILL: Record<MarketplaceThread['status'], { label: string; className: string } | null> = {
  open: null,
  listing_removed: { label: 'Listing removed', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  agency_closed: { label: 'Closed', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function StatusPill({ status }: { status: MarketplaceThread['status'] }) {
  const pill = STATUS_PILL[status];
  if (!pill) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${pill.className}`}>
      {pill.label}
    </span>
  );
}

function SystemChip({ message }: { message: MarketplaceMessage }) {
  const isVisit = message.kind === 'visit_request';
  const Icon = isVisit ? CalendarClock : Bell;
  const visit = message.meta;
  return (
    <div className="flex justify-center my-2">
      <div className="inline-flex items-center gap-1.5 max-w-[85%] px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600 text-center">
        <Icon className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
        <span>
          {message.text ||
            (isVisit ? 'Site visit requested' : message.kind === 'ping' ? 'Buyer is interested' : 'Update')}
          {isVisit && visit?.meetingDate && (
            <span className="ml-1 font-medium text-slate-700">
              {visit.meetingDate}
              {visit.meetingTime ? ` at ${visit.meetingTime}` : ''}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

export default function MarketplaceInbox() {
  const navigate = useNavigate();
  const { threadId: routeThreadId } = useParams<{ threadId?: string }>();

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [threads, setThreads] = useState<MarketplaceThread[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [thread, setThread] = useState<MarketplaceThread | null>(null);
  const [buyer, setBuyer] = useState<MarketplaceBuyer | null>(null);
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>(routeThreadId ? 'thread' : 'list');

  const lastMessageAtRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const openThreadIdRef = useRef<string | null>(routeThreadId ?? null);

  const selectedThreadId = routeThreadId ?? null;

  const handleApiError = useCallback((err: unknown, fallback: string): string => {
    if (err instanceof MarketplaceApiError) {
      if (err.notConfigured) {
        setConfigured(false);
        return 'Marketplace not connected yet';
      }
      if (err.status === 401 || /token/i.test(err.message)) {
        navigate('/login');
      }
      return err.details ? `${err.message}: ${err.details}` : err.message;
    }
    return err instanceof Error ? err.message : fallback;
  }, [navigate]);

  // ---- thread list ---------------------------------------------------------

  const loadThreads = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoadingThreads(true);
    try {
      const { items, nextCursor: cursor } = await marketplaceApi.listThreads({ limit: LIST_PAGE_SIZE });
      setThreads(items);
      setNextCursor(cursor ?? null);
      setListError(null);
      setConfigured(true);
    } catch (err) {
      setListError(handleApiError(err, 'Failed to load marketplace conversations'));
    } finally {
      if (!opts.silent) setLoadingThreads(false);
    }
  }, [handleApiError]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { items, nextCursor: cursor } = await marketplaceApi.listThreads({
        limit: LIST_PAGE_SIZE,
        cursor: nextCursor,
      });
      setThreads((prev) => {
        const seen = new Set(prev.map((t) => t.threadId));
        return [...prev, ...items.filter((t) => !seen.has(t.threadId))];
      });
      setNextCursor(cursor ?? null);
    } catch (err) {
      setToast({ message: handleApiError(err, 'Failed to load more conversations'), type: 'error' });
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, handleApiError]);

  // Initial status check, then the list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { configured: ok } = await marketplaceApi.getStatus();
        if (cancelled) return;
        setConfigured(ok);
        if (ok) await loadThreads();
        else setLoadingThreads(false);
      } catch (err) {
        if (cancelled) return;
        setListError(handleApiError(err, 'Failed to check marketplace status'));
        setLoadingThreads(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadThreads, handleApiError]);

  // Background refresh of the list (unread badges, new threads).
  useEffect(() => {
    if (configured !== true) return;
    const tick = () => {
      if (document.hidden) return;
      loadThreads({ silent: true });
    };
    const interval = setInterval(tick, LIST_POLL_MS);
    return () => clearInterval(interval);
  }, [configured, loadThreads]);

  // ---- open thread ---------------------------------------------------------

  const openThread = useCallback(async (threadId: string) => {
    openThreadIdRef.current = threadId;
    setLoadingThread(true);
    setThreadError(null);
    setMessages([]);
    setThread(null);
    setBuyer(null);
    lastMessageAtRef.current = null;
    try {
      const result = await marketplaceApi.getThread(threadId);
      if (openThreadIdRef.current !== threadId) return;
      setThread(result.thread);
      setBuyer(result.buyer);
      const sorted = [...(result.messages || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      setMessages(sorted);
      lastMessageAtRef.current = sorted.length > 0 ? sorted[sorted.length - 1]!.createdAt : result.thread.lastMessageAt;
      setConfigured(true);

      if (result.thread.unreadAgency > 0) {
        marketplaceApi
          .markRead(threadId)
          .then(() => {
            setThreads((prev) => prev.map((t) => (t.threadId === threadId ? { ...t, unreadAgency: 0 } : t)));
            setThread((prev) => (prev && prev.threadId === threadId ? { ...prev, unreadAgency: 0 } : prev));
          })
          .catch(() => {
            /* non-fatal: badge will refresh on next list poll */
          });
      } else {
        setThreads((prev) => prev.map((t) => (t.threadId === threadId ? { ...t, unreadAgency: 0 } : t)));
      }
    } catch (err) {
      if (openThreadIdRef.current !== threadId) return;
      setThreadError(handleApiError(err, 'Failed to load conversation'));
    } finally {
      if (openThreadIdRef.current === threadId) setLoadingThread(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    if (!selectedThreadId) {
      openThreadIdRef.current = null;
      setThread(null);
      setBuyer(null);
      setMessages([]);
      setThreadError(null);
      return;
    }
    if (configured === false) return;
    setMobileView('thread');
    openThread(selectedThreadId);
  }, [selectedThreadId, configured, openThread]);

  // Poll the open thread for new messages using since=lastMessageAt.
  useEffect(() => {
    if (!selectedThreadId || configured !== true) return;
    let inFlight = false;
    const tick = async () => {
      if (document.hidden || inFlight) return;
      const since = lastMessageAtRef.current;
      inFlight = true;
      try {
        const result = await marketplaceApi.getThread(selectedThreadId, since);
        if (openThreadIdRef.current !== selectedThreadId) return;
        setThread(result.thread);
        if (result.buyer) setBuyer(result.buyer);
        const incoming = result.messages || [];
        if (incoming.length > 0) {
          setMessages((prev) => mergeMessages(prev, incoming));
          const newest = incoming.reduce((max, m) => (m.createdAt > max ? m.createdAt : max), since || '');
          if (newest) lastMessageAtRef.current = newest;
          if (incoming.some((m) => m.senderType !== 'agency')) {
            marketplaceApi.markRead(selectedThreadId).catch(() => {});
          }
          setThreads((prev) =>
            prev.map((t) =>
              t.threadId === selectedThreadId
                ? { ...t, unreadAgency: 0, lastMessageAt: result.thread.lastMessageAt, lastPreview: result.thread.lastPreview }
                : t,
            ),
          );
        }
      } catch {
        /* transient — next tick retries */
      } finally {
        inFlight = false;
      }
    };
    const interval = setInterval(tick, THREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [selectedThreadId, configured]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, selectedThreadId]);

  const handleSelect = (t: MarketplaceThread) => {
    setMobileView('thread');
    if (t.threadId !== selectedThreadId) navigate(`/crm/marketplace/inbox/${t.threadId}`);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !selectedThreadId || sending) return;
    setSending(true);
    try {
      const { message } = await marketplaceApi.sendMessage(selectedThreadId, text);
      setDraft('');
      setMessages((prev) => mergeMessages(prev, [message]));
      lastMessageAtRef.current = message.createdAt;
      setThreads((prev) =>
        prev.map((t) =>
          t.threadId === selectedThreadId
            ? { ...t, lastMessageAt: message.createdAt, lastPreview: message.text }
            : t,
        ),
      );
    } catch (err) {
      setToast({ message: handleApiError(err, 'Failed to send message'), type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = () => {
    loadThreads();
    if (selectedThreadId) openThread(selectedThreadId);
  };

  const selectedFromList = useMemo(
    () => threads.find((t) => t.threadId === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );
  const activeThread = thread ?? selectedFromList;
  const activeBuyer = buyer ?? selectedFromList?.buyer ?? null;
  const canReply = activeThread?.status === 'open';
  const totalUnread = threads.reduce((sum, t) => sum + (t.unreadAgency || 0), 0);

  const groupedMessages = useMemo(() => {
    const groups: Array<{ day: string; items: MarketplaceMessage[] }> = [];
    for (const m of messages) {
      const day = dayLabel(m.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(m);
      else groups.push({ day, items: [m] });
    }
    return groups;
  }, [messages]);

  // ---- render --------------------------------------------------------------

  const notConnected = configured === false;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              to="/crm"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to CRM</span>
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2 min-w-0">
              <Store className="h-5 w-5 text-brand flex-shrink-0" />
              <h1 className="text-xl font-bold text-slate-900 truncate">Marketplace Inbox</h1>
              {totalUnread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand text-white text-[11px] font-semibold">
                  {totalUnread}
                </span>
              )}
            </div>
          </div>
          {!notConnected && (
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>

      {notConnected ? (
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Store className="h-8 w-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Marketplace not connected yet</h2>
            <p className="text-sm text-slate-500">
              This CRM isn't linked to the RealEstateFlow marketplace. Once it is, buyer conversations
              will show up here.
            </p>
            <Link
              to="/crm/settings/public-pages"
              className="inline-flex items-center gap-1.5 mt-5 text-sm font-medium text-brand hover:text-blue-700"
            >
              Marketplace settings
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
          {/* Left pane: thread list */}
          <div
            className={`w-full sm:w-80 md:w-96 flex-shrink-0 h-full bg-white border-r border-slate-200 flex flex-col ${
              mobileView === 'thread' ? 'hidden sm:flex' : 'flex'
            }`}
          >
            {loadingThreads && threads.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 text-brand animate-spin" />
              </div>
            ) : listError && threads.length === 0 ? (
              <div className="p-6 space-y-3">
                <p className="text-sm text-red-700">{listError}</p>
                <button onClick={() => loadThreads()} className="text-sm font-medium text-brand hover:text-blue-700">
                  Try again
                </button>
              </div>
            ) : threads.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 text-slate-400">
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <MessageSquare className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-base font-medium text-slate-600 mb-1">No conversations yet</p>
                <p className="text-sm">
                  When a buyer messages you from the marketplace, the chat appears here.
                </p>
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {threads.map((t) => {
                  const active = t.threadId === selectedThreadId;
                  const unread = t.unreadAgency > 0;
                  return (
                    <li key={t.threadId}>
                      <button
                        type="button"
                        onClick={() => handleSelect(t)}
                        className={`w-full text-left px-4 py-3 flex gap-3 transition-colors ${
                          active ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                            unread ? 'bg-brand text-white' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {initials(t.buyer?.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`truncate text-sm ${unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>
                              {t.buyer?.name || 'Marketplace buyer'}
                            </p>
                            <span className="text-[11px] text-slate-400 flex-shrink-0">
                              {t.lastMessageAt ? formatRelativeTime(t.lastMessageAt) : ''}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{t.snapshot?.title || 'Property'}</p>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className={`text-xs truncate ${unread ? 'text-slate-700' : 'text-slate-400'}`}>
                              {t.lastPreview || ''}
                            </p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <StatusPill status={t.status} />
                              {unread && (
                                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand text-white text-[11px] font-semibold">
                                  {t.unreadAgency}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
                {nextCursor && (
                  <li className="p-3">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="w-full text-sm font-medium text-brand hover:text-blue-700 disabled:opacity-50 py-1.5"
                    >
                      {loadingMore ? 'Loading...' : 'Load more'}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Right pane: conversation */}
          <div
            className={`flex-1 flex-col h-full bg-white min-w-0 ${
              mobileView === 'thread' ? 'flex' : 'hidden sm:flex'
            }`}
          >
            {!selectedThreadId ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400 px-4 text-center">
                <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center mb-4">
                  <MessageSquare className="h-10 w-10 text-slate-400" />
                </div>
                <p className="text-lg font-medium text-slate-600 mb-1">Select a conversation</p>
                <p className="text-sm">Choose a buyer from the list to read and reply</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                  <button
                    onClick={() => {
                      setMobileView('list');
                      navigate('/crm/marketplace/inbox');
                    }}
                    className="sm:hidden inline-flex items-center justify-center p-1 -ml-2 text-slate-600 hover:text-slate-900"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="h-9 w-9 rounded-full bg-brand text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {initials(activeBuyer?.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {activeBuyer?.name || 'Marketplace buyer'}
                      </p>
                      {activeThread && <StatusPill status={activeThread.status} />}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {activeBuyer?.phone ? `${activeBuyer.phone}` : ''}
                      {activeBuyer?.phone && activeBuyer?.email ? ' · ' : ''}
                      {activeBuyer?.email || ''}
                    </p>
                  </div>
                  {activeThread?.leadId && (
                    <Link
                      to={`/crm/leads/${activeThread.leadId}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
                    >
                      Open lead
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>

                {/* Property strip */}
                {activeThread?.snapshot && (
                  <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{activeThread.snapshot.title}</p>
                      <p className="text-slate-500 truncate">
                        {[activeThread.snapshot.locality, activeThread.snapshot.city].filter(Boolean).join(', ')}
                        {formatPrice(activeThread.snapshot.price, activeThread.snapshot.mode)
                          ? ` · ${formatPrice(activeThread.snapshot.price, activeThread.snapshot.mode)}`
                          : ''}
                      </p>
                    </div>
                    <Link
                      to={`/crm/properties/${activeThread.propertyId}`}
                      className="text-brand hover:text-blue-700 font-medium flex-shrink-0"
                    >
                      View property
                    </Link>
                  </div>
                )}

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50">
                  {loadingThread && messages.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 text-brand animate-spin" />
                    </div>
                  ) : threadError ? (
                    <div className="bg-white rounded-xl border border-red-200 p-4 space-y-2">
                      <p className="text-sm text-red-700">{threadError}</p>
                      <button
                        onClick={() => openThread(selectedThreadId)}
                        className="text-sm font-medium text-brand hover:text-blue-700"
                      >
                        Try again
                      </button>
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-12">No messages yet</p>
                  ) : (
                    groupedMessages.map((group) => (
                      <div key={group.day}>
                        <div className="flex justify-center my-3">
                          <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-[11px] text-slate-500">
                            {group.day}
                          </span>
                        </div>
                        {group.items.map((m) => {
                          if (m.senderType === 'system' || m.kind !== 'text') {
                            return <SystemChip key={m.messageId} message={m} />;
                          }
                          const mine = m.senderType === 'agency';
                          return (
                            <div key={m.messageId} className={`flex my-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[80%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                                  mine
                                    ? 'bg-brand text-white rounded-br-md'
                                    : 'bg-white text-slate-900 border border-slate-200 rounded-bl-md'
                                }`}
                              >
                                {mine && m.senderName && (
                                  <p className="text-[11px] font-medium opacity-80 mb-0.5">{m.senderName}</p>
                                )}
                                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                                <p className={`text-[10px] mt-1 text-right ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                                  {formatMessageTime(m.createdAt)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>

                {/* Composer */}
                <div className="border-t border-slate-200 bg-white px-4 py-3">
                  {canReply ? (
                    <div className="flex items-end gap-2">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        rows={2}
                        placeholder="Type a reply... (Enter to send, Shift+Enter for a new line)"
                        className="flex-1 resize-none px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
                        disabled={sending}
                      />
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={sending || !draft.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Send
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-1">
                      {activeThread?.status === 'listing_removed'
                        ? 'This listing is no longer on the marketplace, so the conversation is read-only.'
                        : activeThread?.status === 'agency_closed'
                          ? 'This conversation was closed when the agency left the marketplace.'
                          : 'Replies are disabled for this conversation.'}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
