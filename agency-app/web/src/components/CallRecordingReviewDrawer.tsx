import { useCallback, useEffect, useState } from 'react';
import {
  X, Check, XCircle, RefreshCw, Loader2, AlertTriangle, FileText, Play,
  Link2, Sparkles, Clock, IndianRupee, Wrench, CalendarClock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  CallProposedAction,
  CallRecordingDetail,
  CallTranscript,
} from '../types/callIntelligence';
import { STATUS_LABELS } from '../types/callIntelligence';

interface Props {
  recordingId: string;
  onClose: () => void;
  /** Called whenever the recording changes so the list can refresh in place. */
  onUpdated?: (recording: CallRecordingDetail) => void;
}

const ENTITY_ROUTE: Record<string, string> = {
  lead: '/crm/leads',
  tenant: '/crm/tenants',
  owner: '/crm/owners',
  buyer: '/crm/buyers',
  contact: '/crm/contacts',
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—';
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;
}

function actionBadgeClass(status: string): string {
  switch (status) {
    case 'applied': return 'bg-green-100 text-green-700 border-green-200';
    case 'rejected': return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'failed': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-amber-100 text-amber-700 border-amber-200';
  }
}

export default function CallRecordingReviewDrawer({ recordingId, onClose, onUpdated }: Props) {
  const [recording, setRecording] = useState<CallRecordingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<CallTranscript | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.getCallRecording(recordingId);
      setRecording(response.recording);
      onUpdated?.(response.recording);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recording');
    } finally {
      setLoading(false);
    }
  }, [recordingId, onUpdated]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Keep polling while the pipeline is still working on this recording.
  useEffect(() => {
    if (!recording) return undefined;
    const inFlight = ['UPLOADED', 'QUEUED', 'TRANSCRIBING', 'TRANSCRIBED', 'ANALYZING'];
    if (!inFlight.includes(recording.status)) return undefined;
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [recording, load]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleApprove = async (action: CallProposedAction) => {
    setBusyActionId(action.actionId);
    setError(null);
    try {
      const response = await api.approveCallRecordingAction(recordingId, action.actionId);
      setRecording(response.recording);
      onUpdated?.(response.recording);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply this action');
      await load();
    } finally {
      setBusyActionId(null);
    }
  };

  const handleReject = async (action: CallProposedAction) => {
    setBusyActionId(action.actionId);
    setError(null);
    try {
      const response = await api.rejectCallRecordingAction(recordingId, action.actionId);
      setRecording(response.recording);
      onUpdated?.(response.recording);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject this action');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    setError(null);
    try {
      const response = await api.reanalyzeCallRecording(recordingId);
      setRecording(response.recording);
      onUpdated?.(response.recording);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-analysis failed');
    } finally {
      setReanalyzing(false);
    }
  };

  const handleToggleTranscript = async () => {
    if (transcriptOpen) {
      setTranscriptOpen(false);
      return;
    }
    setTranscriptOpen(true);
    if (transcript || !recording?.hasTranscript) return;
    setTranscriptLoading(true);
    try {
      const response = await api.getCallRecordingTranscript(recordingId);
      setTranscript(response.transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transcript');
    } finally {
      setTranscriptLoading(false);
    }
  };

  const handlePlay = async () => {
    try {
      const response = await api.getCallRecordingAudioUrl(recordingId);
      setAudioUrl(response.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audio');
    }
  };

  const extracted = recording?.extracted;
  const pendingActions = (recording?.proposedActions || []).filter((a) => a.status === 'pending');
  const otherActions = (recording?.proposedActions || []).filter((a) => a.status !== 'pending');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className="relative w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Call recording review"
      >
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 truncate">
              {recording?.matchedEntityName || recording?.phone || recording?.filename || 'Call recording'}
            </h2>
            <p className="text-sm text-slate-500 truncate">
              {recording ? `${STATUS_LABELS[recording.status]} · ${recording.callDate}` : 'Loading…'}
              {recording?.audioDurationSeconds ? ` · ${formatDuration(recording.audioDurationSeconds)}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading analysis…
          </div>
        )}

        {!loading && error && !recording && (
          <div className="m-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {recording && (
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {recording.status === 'FAILED' && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center gap-2 text-red-800 font-medium text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Processing failed{recording.failureStage ? ` at ${recording.failureStage.toLowerCase()}` : ''}
                </div>
                <p className="text-sm text-red-700 mt-1 break-words">{recording.failureReason}</p>
                <button
                  onClick={handleReanalyze}
                  disabled={reanalyzing}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {reanalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Retry
                </button>
              </div>
            )}

            {['UPLOADED', 'QUEUED', 'TRANSCRIBING', 'TRANSCRIBED', 'ANALYZING'].includes(recording.status) && (
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-3 text-sm text-blue-800">
                <Loader2 className="w-4 h-4 animate-spin" />
                {STATUS_LABELS[recording.status]}… this page refreshes automatically.
              </div>
            )}

            {/* Who the call was with */}
            <section className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Matched record</p>
                  {recording.matchedEntityType !== 'unmatched' ? (
                    <a
                      href={`${ENTITY_ROUTE[recording.matchedEntityType] || '/crm'}/${recording.matchedEntityId}`}
                      className="text-slate-900 font-medium hover:text-blue-600 inline-flex items-center gap-1"
                    >
                      {recording.matchedEntityName || recording.matchedEntityId}
                      <span className="text-xs text-slate-500 capitalize">({recording.matchedEntityType})</span>
                    </a>
                  ) : (
                    <p className="text-amber-700 font-medium flex items-center gap-1">
                      <Link2 className="w-4 h-4" /> No CRM record matched
                    </p>
                  )}
                  <p className="text-sm text-slate-500 mt-0.5">
                    {recording.phone ? `+91 ${recording.phone}` : 'No phone number found in the file name'}
                    {recording.phoneConfidence && recording.phoneConfidence !== 'high'
                      ? ` · ${recording.phoneConfidence} confidence`
                      : ''}
                  </p>
                </div>
                <button
                  onClick={handlePlay}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  <Play className="w-4 h-4" /> Audio
                </button>
              </div>

              {audioUrl && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio controls src={audioUrl} className="w-full mt-3" />
              )}

              {recording.matchCandidates.length > 1 && (
                <p className="mt-3 text-xs text-slate-500">
                  This number also matches:{' '}
                  {recording.matchCandidates.slice(1).map((c) => `${c.name || c.entityId} (${c.entityType})`).join(', ')}
                </p>
              )}
            </section>

            {/* Summary */}
            {recording.summary && (
              <section>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-600" /> Summary
                </h3>
                <p className="text-sm text-slate-700 whitespace-pre-line">{recording.summary}</p>

                {recording.keyPoints.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {recording.keyPoints.map((point) => (
                      <li key={point} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-slate-400">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {recording.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {recording.topics.map((topic) => (
                      <span key={topic} className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                        {topic.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Extracted facts */}
            {extracted && (
              <section className="grid grid-cols-2 gap-3">
                {extracted.requirements?.budgetMax != null && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-400">Budget</p>
                    <p className="text-sm text-slate-800">{formatMoney(extracted.requirements.budgetMax)}</p>
                  </div>
                )}
                {extracted.requirements?.bhk && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-400">Configuration</p>
                    <p className="text-sm text-slate-800">{extracted.requirements.bhk}</p>
                  </div>
                )}
                {(extracted.requirements?.locations?.length || 0) > 0 && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-400">Locations</p>
                    <p className="text-sm text-slate-800">{extracted.requirements?.locations.join(', ')}</p>
                  </div>
                )}
                {extracted.intentLevel && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-400">Intent</p>
                    <p className="text-sm text-slate-800">{extracted.intentLevel}</p>
                  </div>
                )}
                {extracted.maintenance?.required && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 col-span-2">
                    <p className="text-xs text-orange-500 flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> Property work discussed
                    </p>
                    <p className="text-sm text-orange-900">
                      {extracted.maintenance.workType || 'maintenance'}
                      {extracted.maintenance.description ? ` — ${extracted.maintenance.description}` : ''}
                      {extracted.maintenance.estimatedCost
                        ? ` (${formatMoney(extracted.maintenance.estimatedCost)})`
                        : ''}
                    </p>
                  </div>
                )}
                {extracted.siteVisit?.requested && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 col-span-2">
                    <p className="text-xs text-blue-500 flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" /> Site visit requested
                    </p>
                    <p className="text-sm text-blue-900">
                      {extracted.siteVisit.preferredDate || 'date not stated'}
                      {extracted.siteVisit.preferredTime ? ` at ${extracted.siteVisit.preferredTime}` : ''}
                    </p>
                  </div>
                )}
              </section>
            )}

            {recording.financialHints.length > 0 && (
              <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-600 flex items-center gap-1 mb-1">
                  <IndianRupee className="w-3 h-3" /> Money discussed
                </p>
                {recording.financialHints.map((hint) => (
                  <p key={hint} className="text-sm text-emerald-900">{hint}</p>
                ))}
              </section>
            )}

            {/* Proposed actions */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Suggested CRM updates
                {pendingActions.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                    {pendingActions.length} need approval
                  </span>
                )}
              </h3>

              {recording.proposedActions.length === 0 && (
                <p className="text-sm text-slate-500">
                  {recording.status === 'COMPLETED' || recording.status === 'ANALYZED'
                    ? 'Nothing needs to change in the CRM from this call.'
                    : 'Suggestions appear once the analysis finishes.'}
                </p>
              )}

              <div className="space-y-3">
                {[...pendingActions, ...otherActions].map((action) => (
                  <div key={action.actionId} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{action.title}</p>
                        {action.description && (
                          <p className="text-sm text-slate-600 mt-0.5">{action.description}</p>
                        )}
                        {action.reason && (
                          <p className="text-xs text-slate-400 mt-1">{action.reason}</p>
                        )}
                      </div>
                      <span className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full border capitalize ${actionBadgeClass(action.status)}`}>
                        {action.status}
                      </span>
                    </div>

                    {action.executionError && (
                      <p className="mt-2 text-xs text-red-600 break-words">{action.executionError}</p>
                    )}

                    {(action.status === 'pending' || action.status === 'failed') && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleApprove(action)}
                          disabled={busyActionId === action.actionId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {busyActionId === action.actionId
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Check className="w-4 h-4" />}
                          {action.status === 'failed' ? 'Retry' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(action)}
                          disabled={busyActionId === action.actionId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Transcript */}
            {recording.hasTranscript && (
              <section>
                <button
                  onClick={handleToggleTranscript}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" /> Full transcript
                  </span>
                  {transcriptOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {transcriptOpen && (
                  <div className="mt-3 rounded-xl border border-slate-200 p-4 max-h-96 overflow-y-auto bg-slate-50">
                    {transcriptLoading && (
                      <p className="text-sm text-slate-500 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading transcript…
                      </p>
                    )}
                    {!transcriptLoading && transcript && transcript.segments.length > 0 && (
                      <div className="space-y-2">
                        {transcript.segments.map((segment, index) => (
                          <p key={`${segment.speaker}-${segment.start}-${index}`} className="text-sm text-slate-700">
                            <span className="text-xs text-slate-400 mr-2">
                              {segment.speaker.replace('spk_', 'Speaker ')} · {Math.floor(segment.start / 60)}:
                              {Math.floor(segment.start % 60).toString().padStart(2, '0')}
                            </span>
                            {segment.text}
                          </p>
                        ))}
                      </div>
                    )}
                    {!transcriptLoading && transcript && transcript.segments.length === 0 && (
                      <p className="text-sm text-slate-700 whitespace-pre-line">{transcript.transcript}</p>
                    )}
                  </div>
                )}
              </section>
            )}

            <footer className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Uploaded {new Date(recording.createdAt).toLocaleString('en-IN')}
              </span>
              {['ANALYZED', 'AWAITING_APPROVAL', 'COMPLETED'].includes(recording.status) && (
                <button
                  onClick={handleReanalyze}
                  disabled={reanalyzing}
                  className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-60"
                >
                  {reanalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Re-analyse
                </button>
              )}
            </footer>
          </div>
        )}
      </aside>
    </div>
  );
}
