/**
 * "AI Follow-up" section for the lead detail page: schedule a follow-up call
 * by the followup-agent-service and show the job/attempt timeline.
 *
 * Polls every 30 s while any job is `calling` so the row flips to its
 * outcome without a manual refresh.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, PhoneOutgoing, RefreshCw, XCircle } from 'lucide-react';
import {
  followupApi,
  FollowupUnavailableError,
  type FollowupAttempt,
  type FollowupJob,
  type FollowupJobStatus,
} from '../services/followupApi';

interface AiFollowupCardProps {
  leadId: string;
  /** Whether the lead has a phone at all (masked or not). */
  hasPhone: boolean;
  /** Converted/archived leads are read-only. */
  disabled?: boolean;
  onToast?: (message: string, type: 'success' | 'error') => void;
}

const POLL_INTERVAL_MS = 30_000;

const STATUS_STYLES: Record<FollowupJobStatus, string> = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  calling: 'bg-amber-50 text-amber-700 border-amber-200',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  needs_human: 'bg-orange-50 text-orange-700 border-orange-200',
  escalated: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<FollowupJobStatus, string> = {
  scheduled: 'Scheduled',
  calling: 'Calling',
  done: 'Done',
  needs_human: 'Needs human',
  escalated: 'Escalated',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

const JOB_TYPE_LABELS: Record<string, string> = {
  site_visit_confirmation: 'Site visit confirmation',
  post_visit_feedback: 'Post-visit feedback',
};

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function humanize(value?: string | null): string {
  if (!value) return '';
  return value.replace(/_/g, ' ');
}

function StatusPill({ status }: { status: FollowupJobStatus }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.scheduled;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {status === 'calling' && <Loader2 className="h-3 w-3 animate-spin" />}
      {STATUS_LABELS[status] ?? humanize(status)}
    </span>
  );
}

function AttemptRow({ attempt, index }: { attempt: FollowupAttempt; index: number }) {
  const n = attempt.attemptNo ?? attempt.attempt ?? index + 1;
  return (
    <li className="text-xs text-gray-600 flex flex-wrap gap-x-2">
      <span className="font-medium text-gray-700">Attempt {n}</span>
      <span>{formatWhen(attempt.startedAt || attempt.createdAt)}</span>
      {attempt.outcome && <span className="capitalize">· {humanize(attempt.outcome)}</span>}
      {typeof attempt.durationSeconds === 'number' && <span>· {attempt.durationSeconds}s</span>}
      {attempt.summary && <span className="basis-full text-gray-500 whitespace-pre-wrap">{attempt.summary}</span>}
    </li>
  );
}

export default function AiFollowupCard({ leadId, hasPhone, disabled = false, onToast }: AiFollowupCardProps) {
  const [jobs, setJobs] = useState<FollowupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await followupApi.listForLead(leadId);
      if (!mounted.current) return;
      setJobs(list);
      setUnavailable(false);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof FollowupUnavailableError) {
        setUnavailable(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load follow-ups');
      }
    } finally {
      if (mounted.current && !silent) setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const anyCalling = jobs.some((j) => j.status === 'calling');
  useEffect(() => {
    if (!anyCalling) return;
    const timer = window.setInterval(() => void load(true), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [anyCalling, load]);

  const handleSchedule = async () => {
    setScheduling(true);
    try {
      const result = await followupApi.scheduleCall(leadId, { jobType: 'site_visit_confirmation' });
      onToast?.(
        result.duplicate
          ? 'A follow-up call is already scheduled for this lead.'
          : 'AI follow-up call scheduled.',
        'success',
      );
      await load(true);
    } catch (err) {
      if (err instanceof FollowupUnavailableError) {
        setUnavailable(true);
      } else {
        onToast?.(err instanceof Error ? err.message : 'Failed to schedule follow-up', 'error');
      }
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async (jobId: string) => {
    setCancellingId(jobId);
    try {
      const updated = await followupApi.cancel(jobId);
      setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, ...updated } : j)));
      onToast?.('Follow-up call cancelled.', 'success');
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Failed to cancel follow-up', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  const scheduleDisabledReason = !hasPhone
    ? 'Add a phone number to the lead first'
    : disabled
      ? 'This lead is read-only'
      : unavailable
        ? 'AI follow-up calls are not available on this deployment'
        : null;

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Bot className="h-5 w-5 mr-2 text-violet-600" />
          AI Follow-up
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg"
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleSchedule}
            disabled={scheduling || !!scheduleDisabledReason}
            title={scheduleDisabledReason ?? 'The AI agent calls the lead to confirm the site visit'}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOutgoing className="h-4 w-4" />}
            Schedule AI follow-up call
          </button>
        </div>
      </div>

      {unavailable ? (
        <div className="text-sm text-gray-500">AI follow-up calls are not available on this deployment.</div>
      ) : loading ? (
        <div className="text-sm text-gray-500">Loading follow-ups...</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : jobs.length === 0 ? (
        <div className="text-sm text-gray-500">No AI follow-up calls yet for this lead.</div>
      ) : (
        <ol className="space-y-3">
          {jobs.map((job) => (
            <li key={job.jobId} className="p-3 border rounded-lg bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {JOB_TYPE_LABELS[job.jobType] ?? humanize(job.jobType)}
                    </span>
                    <StatusPill status={job.status} />
                  </div>
                  <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Due: {formatWhen(job.dueAt)}</span>
                    <span>
                      Attempts: {job.attemptCount ?? 0}/{job.maxAttempts ?? '—'}
                    </span>
                    {job.lastAttemptAt && <span>Last try: {formatWhen(job.lastAttemptAt)}</span>}
                    {job.source && <span className="text-gray-400">via {job.source}</span>}
                  </div>
                  {job.lastOutcome && (
                    <div className="text-sm text-gray-700 mt-1.5">
                      <span className="text-gray-500">Last outcome:</span> <span className="capitalize">{humanize(job.lastOutcome)}</span>
                    </div>
                  )}
                  {(job.status === 'escalated' || job.escalationReason) && (
                    <div className="text-sm text-red-700 mt-1.5">
                      <span className="font-medium">Escalated</span>
                      {job.escalatedAt ? ` ${formatWhen(job.escalatedAt)}` : ''}
                      {job.escalationReason ? ` · ${humanize(job.escalationReason)}` : ''}
                    </div>
                  )}
                  {job.context?.note && (
                    <div className="text-xs text-gray-500 mt-1.5 whitespace-pre-wrap">Note: {job.context.note}</div>
                  )}
                  {job.attempts && job.attempts.length > 0 && (
                    <ul className="mt-2 space-y-1 border-l-2 border-gray-200 pl-3">
                      {job.attempts.map((a, i) => (
                        <AttemptRow key={a.callSessionId ?? `${job.jobId}-${i}`} attempt={a} index={i} />
                      ))}
                    </ul>
                  )}
                </div>
                {job.status === 'scheduled' && (
                  <button
                    type="button"
                    onClick={() => void handleCancel(job.jobId)}
                    disabled={cancellingId === job.jobId || disabled}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    {cancellingId === job.jobId ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                    Cancel
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
