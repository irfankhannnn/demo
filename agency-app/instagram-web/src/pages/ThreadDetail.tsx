import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Phone, RefreshCw, Send, Sparkles } from 'lucide-react';
import { analyseThread, getThread, pushEnquiryToCrm, sendThreadReply } from '../api/insta';
import { ApiError, CRM_URL } from '../api/client';
import type { Enquiry, Message, ThreadAnalysis } from '../api/types';
import { useApi } from '../lib/useApi';
import { cn, formatDateTime, formatRelative, humanise } from '../lib/format';
import { Badge, CrmSyncBadge, LeadScoreBadge, WindowStateBadge } from '../components/Badge';
import { ErrorState } from '../components/ErrorState';
import { LoadingBlock, Spinner } from '../components/Spinner';

/**
 * One conversation: the messages, the lead analysis with a ready reply, the
 * enquiry and its CRM hand-off. Sending is a person's decision; the backend
 * enforces Instagram's window and this page explains it instead of hiding it.
 */

const MAX_CHARS = 1000;
const REFRESH_MS = 30_000;

function describe(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.details ? `${err.message} — ${err.details}` : err.message;
  return fallback;
}

export default function ThreadDetail() {
  const { threadId = '' } = useParams();
  const { data, loading, error, reload } = useApi((signal) => getThread(threadId, signal), ['thread', threadId]);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<'analyse' | 'crm' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // New DMs arrive by webhook or sync; keep an open conversation current.
  useEffect(() => {
    const timer = window.setInterval(reload, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setActionError(null);
    setNotice(null);
    try {
      const res = await sendThreadReply(threadId, text);
      setDraft('');
      setNotice(res.status === 'dry_run' ? 'Test mode: the reply was recorded but not sent to Instagram.' : 'Reply sent on Instagram.');
      reload();
    } catch (err) {
      setActionError(describe(err, 'Could not send the reply.'));
    } finally {
      setSending(false);
    }
  }

  async function reanalyse() {
    setBusy('analyse');
    setActionError(null);
    try {
      await analyseThread(threadId);
      reload();
    } catch (err) {
      setActionError(describe(err, 'Analysis failed.'));
    } finally {
      setBusy(null);
    }
  }

  async function pushToCrm(enquiry: Enquiry) {
    setBusy('crm');
    setActionError(null);
    try {
      const sync = await pushEnquiryToCrm(enquiry.enquiryId);
      setNotice(sync.status === 'created' || sync.status === 'updated' || sync.status === 'duplicate' ? 'The lead is in the CRM.' : `CRM: ${humanise(sync.status)}${sync.reason ? ` (${sync.reason})` : ''}`);
      reload();
    } catch (err) {
      setActionError(describe(err, 'Could not reach the CRM.'));
    } finally {
      setBusy(null);
    }
  }

  if (error && !data) return <ErrorState error={error} onRetry={reload} context="this conversation" />;
  if (!data) return <LoadingBlock label="Loading the conversation…" />;

  const { thread, messages, enquiry, canReply } = data;
  const analysis = thread.analysis;
  const who = thread.participantUsername ? `@${thread.participantUsername}` : `Instagram user ${thread.participantId ?? ''}`;

  return (
    <div>
      <Link to="/threads" className="mb-3 inline-flex min-h-touch items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand">
        <ArrowLeft className="h-4 w-4" />
        DM inbox
      </Link>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-ink sm:text-2xl">{enquiry?.name || who}</h1>
          <p className="text-sm text-slate-500">
            {enquiry?.name ? `${who} · ` : ''}
            {(() => {
              const count = thread.messageCount ?? messages.length;
              return `${count} message${count === 1 ? '' : 's'}`;
            })()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WindowStateBadge value={thread.windowState} />
          {thread.windowState === 'STANDARD' && thread.windowExpiresAt ? (
            <span className="text-xs text-slate-500" title={formatDateTime(thread.windowExpiresAt)}>
              window closes {formatRelative(thread.windowExpiresAt)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex min-h-touch items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {loading ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      {notice ? <p role="status" className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p> : null}
      {actionError ? <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</p> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
          <ol className="flex max-h-[60vh] min-h-[16rem] flex-col gap-2 overflow-y-auto p-4" aria-label="Messages">
            {messages.length === 0 ? <li className="m-auto text-sm text-slate-400">No messages stored yet.</li> : null}
            {messages.map((m) => (
              <Bubble key={m.messageId} message={m} />
            ))}
          </ol>

          <div className="border-t border-slate-200 p-3">
            {!canReply.allowed ? (
              <p className="mb-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">{canReply.reason}</p>
            ) : null}
            <label htmlFor="reply" className="sr-only">
              Reply
            </label>
            <textarea
              id="reply"
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, MAX_CHARS))}
              disabled={!canReply.allowed || sending}
              rows={3}
              placeholder={canReply.allowed ? 'Write a reply…' : 'Replies are closed for this conversation'}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-slate-50"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {analysis?.suggestedReply && canReply.allowed ? (
                <button
                  type="button"
                  onClick={() => setDraft(analysis.suggestedReply ?? '')}
                  className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand"
                >
                  <Sparkles className="h-4 w-4" />
                  Use suggested reply
                </button>
              ) : null}
              <span className="ml-auto text-xs tabular-nums text-slate-400">
                {draft.length}/{MAX_CHARS}
              </span>
              <button
                type="button"
                onClick={send}
                disabled={!canReply.allowed || sending || !draft.trim()}
                className="inline-flex min-h-touch items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light disabled:opacity-60"
              >
                {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <AnalysisCard analysis={analysis} pending={Boolean(thread.needsAnalysis)} busy={busy === 'analyse'} onAnalyse={reanalyse} />
          {enquiry ? <EnquiryCard enquiry={enquiry} busy={busy === 'crm'} onPush={() => pushToCrm(enquiry)} /> : null}
        </aside>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const outbound = message.direction === 'out';
  return (
    <li className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm',
          outbound ? 'rounded-br-sm bg-brand text-white' : 'rounded-bl-sm bg-slate-100 text-ink',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.text || <em className="opacity-70">[no text]</em>}</p>
        <p className={cn('mt-1 text-[11px]', outbound ? 'text-blue-100' : 'text-slate-400')} title={formatDateTime(message.createdAt)}>
          {formatRelative(message.createdAt)}
          {message.status === 'dry_run' ? ' · test mode, not sent' : ''}
          {message.source === 'rule' ? ' · keyword rule' : ''}
        </p>
      </div>
    </li>
  );
}

function AnalysisCard({ analysis, pending, busy, onAnalyse }: { analysis?: ThreadAnalysis; pending: boolean; busy: boolean; onAnalyse: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Lead analysis</h2>
        <button
          type="button"
          onClick={onAnalyse}
          disabled={busy}
          className="inline-flex min-h-touch items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-brand hover:underline disabled:opacity-60"
        >
          {busy ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          {analysis ? 'Re-analyse' : 'Analyse now'}
        </button>
      </div>

      {!analysis ? (
        <p className="mt-2 text-sm text-slate-500">{pending ? 'Queued — the next sync analyses it.' : 'Not analysed yet.'}</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LeadScoreBadge value={analysis.leadScore} />
            {analysis.leadType ? <Badge tone="neutral">{humanise(analysis.leadType)}</Badge> : null}
            {analysis.needsReview ? <Badge tone="warning">check this reading</Badge> : null}
          </div>
          {analysis.summary ? <p className="mt-3 text-sm text-slate-700">{analysis.summary}</p> : null}
          {analysis.nextAction ? (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Next step</p>
              <p className="text-sm text-slate-700">{analysis.nextAction}</p>
            </div>
          ) : null}
          {analysis.suggestedReply ? (
            <div className="mt-3 rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-brand">Suggested reply</p>
              <p className="mt-1 text-sm text-slate-800">{analysis.suggestedReply}</p>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-slate-400">
            {analysis.analyser === 'gemini' ? 'AI analysis' : 'Rule-based analysis'} · {formatRelative(analysis.analysedAt)}
          </p>
        </>
      )}
    </div>
  );
}

function EnquiryCard({ enquiry, busy, onPush }: { enquiry: Enquiry; busy: boolean; onPush: () => void }) {
  const requirement = [enquiry.propertyType, enquiry.dealType && humanise(enquiry.dealType), enquiry.preferredArea, enquiry.city, enquiry.budgetText]
    .filter(Boolean)
    .join(' · ');
  const inCrm = ['created', 'updated', 'duplicate'].includes(enquiry.crmSync?.status ?? '');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-ink">Enquiry</h2>
      <dl className="mt-2 space-y-2 text-sm">
        <div>
          <dt className="text-xs text-slate-400">Name</dt>
          <dd className="text-slate-700">{enquiry.name || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Phone</dt>
          <dd>
            {enquiry.phone ? (
              <a href={`tel:${enquiry.phone}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                <Phone className="h-3.5 w-3.5" />
                {enquiry.phone}
              </a>
            ) : (
              <span className="text-slate-400">not shared yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Requirement</dt>
          <dd className="text-slate-700">{requirement || '—'}</dd>
        </div>
        {enquiry.meetingSchedule ? (
          <div>
            <dt className="text-xs text-slate-400">Meeting</dt>
            <dd className="text-slate-700">{enquiry.meetingSchedule}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-slate-400">CRM</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <CrmSyncBadge value={enquiry.crmSync} />
            {inCrm && CRM_URL ? (
              <a href={`${CRM_URL}/crm/leads?source=Instagram`} className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                Open CRM <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </dd>
        </div>
      </dl>
      {!inCrm && enquiry.phone ? (
        <button
          type="button"
          onClick={onPush}
          disabled={busy}
          className="mt-3 inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand disabled:opacity-60"
        >
          {busy ? <Spinner className="h-4 w-4" /> : null}
          Push to CRM now
        </button>
      ) : null}
    </div>
  );
}
