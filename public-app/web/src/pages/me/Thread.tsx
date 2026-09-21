/**
 * /me/enquiries/:threadId — chat with one agency about one listing.
 * Buyer bubbles right, agency left, system chips (ping / visit_request) centred.
 * Polls every 5 s with `since` = newest createdAt; marks read on open.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarCheck, Hand, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { listingPath } from '@/config/env';
import { formatClock, formatDateLabel, formatRupees, formatTimeLabel } from '@/lib/format';
import { errorMessage, isApiError } from '@/services/api';
import { marketplace, qk } from '@/services/marketplace';
import type { Message, Thread as ThreadShape, ThreadDetailResponse } from '@/types/api';
import { ListingImage } from '@/components/listing/ListingImage';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { RequireLogin } from './RequireLogin';
import { ThreadStatusPill } from './Enquiries';

const POLL_MS = 5000;

export default function Thread() {
  return (
    <RequireLogin title="Enquiry" reason="Login to open this conversation.">
      <ThreadInner />
    </RequireLogin>
  );
}

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const map = new Map(existing.map((m) => [m.messageId, m]));
  for (const m of incoming) map.set(m.messageId, m);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function ThreadInner() {
  const { threadId = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const key = qk.thread(threadId);
  const initial = useQuery({
    queryKey: key,
    queryFn: () => marketplace.thread(threadId),
    enabled: !!threadId,
    retry: (n, e) => !(isApiError(e) && e.isNotFound) && n < 2,
    staleTime: Infinity,
  });
  const thread: ThreadShape | undefined = initial.data?.thread;
  const messages = useMemo(() => initial.data?.messages ?? [], [initial.data]);

  // Mark read on open (and again whenever new agency messages land).
  const lastMarked = useRef<string>('');
  useEffect(() => {
    if (!thread) return;
    const newest = messages[messages.length - 1]?.createdAt ?? '';
    if (newest === lastMarked.current) return;
    lastMarked.current = newest;
    void marketplace.markRead(threadId).then(() => qc.invalidateQueries({ queryKey: qk.threads }));
  }, [thread, messages, threadId, qc]);

  // Poll with `since`.
  useEffect(() => {
    if (!initial.isSuccess) return;
    let stopped = false;
    const tick = async () => {
      if (stopped || document.hidden) return;
      const cur = qc.getQueryData<ThreadDetailResponse>(key);
      const since = cur?.messages[cur.messages.length - 1]?.createdAt;
      try {
        const r = await marketplace.thread(threadId, since);
        if (stopped) return;
        qc.setQueryData<ThreadDetailResponse>(key, (old) => ({
          thread: r.thread,
          messages: mergeMessages(old?.messages ?? [], r.messages),
        }));
      } catch {
        /* transient — next tick retries */
      }
    };
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [initial.isSuccess, threadId, qc, key]);

  // Auto-scroll on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: messages.length > 1 ? 'smooth' : 'auto' });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: (body: string) => marketplace.sendMessage(threadId, body),
    onMutate: async (body) => {
      const optimistic: Message = {
        messageId: `tmp-${Date.now()}`,
        threadId,
        senderType: 'buyer',
        senderId: user?.userId ?? 'me',
        senderName: user?.name ?? 'You',
        text: body,
        kind: 'text',
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<ThreadDetailResponse>(key, (old) => (old ? { ...old, messages: [...old.messages, optimistic] } : old));
      setText('');
      return { tmpId: optimistic.messageId };
    },
    onSuccess: ({ message }, _body, ctx) => {
      qc.setQueryData<ThreadDetailResponse>(key, (old) =>
        old ? { ...old, messages: mergeMessages(old.messages.filter((m) => m.messageId !== ctx?.tmpId), [message]) } : old,
      );
      void qc.invalidateQueries({ queryKey: qk.threads });
    },
    onError: (e, body, ctx) => {
      qc.setQueryData<ThreadDetailResponse>(key, (old) => (old ? { ...old, messages: old.messages.filter((m) => m.messageId !== ctx?.tmpId) } : old));
      setText(body);
      toast.error('Message not sent', errorMessage(e));
    },
  });

  if (initial.isError && isApiError(initial.error) && initial.error.isNotFound) {
    return (
      <div className="container-x py-16">
        <EmptyState title="This conversation does not exist" body="It may belong to another account." />
      </div>
    );
  }
  if (initial.isError) {
    return (
      <div className="container-x py-16">
        <ErrorState body={errorMessage(initial.error)} onRetry={() => void initial.refetch()} />
      </div>
    );
  }

  const closed = thread && thread.status !== 'open';
  const canSend = !!thread && !closed && text.trim().length > 0 && !send.isPending;

  return (
    <div className="container-x flex max-w-3xl flex-col py-3 sm:py-6" style={{ minHeight: 'calc(100dvh - 64px)' }}>
      {/* Thread header */}
      <div className="flex items-center gap-3 rounded-card border border-line bg-paper p-3 shadow-card">
        <Link to="/me/enquiries" className="rounded-full p-2 text-ink hover:bg-ink/5" aria-label="Back to enquiries">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        {thread ? (
          <>
            <ListingImage slug={thread.agencySlug} propertyId={thread.propertyId} imageCount={thread.snapshot.imageCount} alt="" className="h-12 w-16 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Link to={listingPath(thread.agencySlug, thread.propertyId)} className="block truncate text-[15px] font-extrabold hover:text-marigold-deep">
                {thread.snapshot.title}
              </Link>
              <p className="truncate text-xs text-dust-dim">
                {thread.snapshot.agencyName} · {formatRupees(thread.snapshot.price, thread.snapshot.mode)}
              </p>
            </div>
            <ThreadStatusPill status={thread.status} />
          </>
        ) : (
          <>
            <Skeleton className="h-12 w-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto py-5" role="log" aria-live="polite" aria-label="Messages">
        {initial.isLoading && (
          <>
            <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
            <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
          </>
        )}
        {messages.map((m, i) => (
          <Bubble key={m.messageId} m={m} prev={messages[i - 1]} />
        ))}
        {thread && messages.length === 0 && <p className="py-10 text-center text-sm text-dust-dim">Say hi — the agency replies here and by phone.</p>}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) send.mutate(text.trim());
        }}
        className="sticky bottom-0 -mx-4 border-t border-line bg-paper/95 px-4 pt-2 backdrop-blur-md safe-bottom sm:mx-0 sm:rounded-card sm:border sm:px-3 sm:py-2"
      >
        {closed ? (
          <p className="py-2 text-center text-sm text-dust-dim">
            {thread?.status === 'listing_removed' ? 'This listing was removed, so the chat is closed. Your history stays here.' : 'This agency has left the marketplace. Your history stays here.'}
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <label htmlFor="composer" className="sr-only">
              Message
            </label>
            <textarea
              id="composer"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) send.mutate(text.trim());
                }
              }}
              rows={1}
              maxLength={1000}
              placeholder="Type a message…"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-line bg-white/70 px-4 py-2.5 text-[15px] leading-snug focus:border-ink focus:outline-none focus:ring-2 focus:ring-marigold/40"
              disabled={!thread}
            />
            <Button type="submit" disabled={!canSend} loading={send.isPending} aria-label="Send" className="h-11 w-11 shrink-0 px-0">
              <Send size={18} aria-hidden />
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

function Bubble({ m, prev }: { m: Message; prev?: Message }) {
  const showDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
  const day = showDay ? new Date(m.createdAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : null;

  if (m.senderType === 'system' || m.kind !== 'text') {
    const isVisit = m.kind === 'visit_request';
    return (
      <>
        {day && <DayChip label={day} />}
        <div className="flex justify-center">
          <div className="inline-flex max-w-[92%] items-start gap-2 rounded-2xl border border-line bg-paper-2/70 px-3.5 py-2 text-[13px] text-ink/85">
            {isVisit ? <CalendarCheck size={15} className="mt-0.5 shrink-0 text-tulsi" aria-hidden /> : <Hand size={15} className="mt-0.5 shrink-0 text-marigold" aria-hidden />}
            <span>
              {isVisit && m.meta?.meetingDate ? (
                <>
                  <span className="font-extrabold">Site visit requested</span> — {formatDateLabel(m.meta.meetingDate)}
                  {m.meta.meetingTime ? ` at ${formatTimeLabel(m.meta.meetingTime)}` : ''}
                  {m.text ? <span className="block text-dust-dim">“{m.text}”</span> : null}
                </>
              ) : (
                m.text || (m.kind === 'ping' ? 'You said you are interested' : 'Update')
              )}
              <span className="ml-2 text-[11px] text-dust-dim">{formatClock(m.createdAt)}</span>
            </span>
          </div>
        </div>
      </>
    );
  }

  const mine = m.senderType === 'buyer';
  return (
    <>
      {day && <DayChip label={day} />}
      <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
        <div className={cn('max-w-[82%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug shadow-sm', mine ? 'rounded-br-md bg-ink text-paper' : 'rounded-bl-md border border-line bg-paper')}>
          {!mine && <p className="mb-0.5 text-[11px] font-extrabold text-marigold-deep">{m.senderName}</p>}
          <p className="whitespace-pre-wrap break-words">{m.text}</p>
          <p className={cn('mt-1 text-right text-[10px] tabular', mine ? 'text-dust' : 'text-dust-dim')}>{formatClock(m.createdAt)}</p>
        </div>
      </div>
    </>
  );
}

function DayChip({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-pill bg-paper-2 px-3 py-1 text-[11px] font-bold text-dust-dim">{label}</span>
    </div>
  );
}
