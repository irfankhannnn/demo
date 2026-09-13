import { useCallback, useEffect, useState } from 'react';
import { Loader2, PhoneCall, User, X, Wrench } from 'lucide-react';
import { aiCallingApi, AICallingUnavailableError } from '../services/aiCallingApi';
import type { AICallSession, AICallTranscriptEntry } from '../types/aiCalling';
import {
  AI_CALL_PURPOSE_LABELS,
  AI_CALL_STATUS_LABELS,
} from '../types/aiCalling';
import LeadTemperatureBadge from './LeadTemperatureBadge';

interface AICallTranscriptDrawerProps {
  call: AICallSession;
  onClose: () => void;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AICallTranscriptDrawer({ call, onClose }: AICallTranscriptDrawerProps) {
  const [entries, setEntries] = useState<AICallTranscriptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const transcript = await aiCallingApi.getTranscript(call.callSessionId);
      setEntries(transcript);
      setError(null);
    } catch (err) {
      if (err instanceof AICallingUnavailableError) {
        setError('Transcripts are not available on this deployment yet.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load transcript');
      }
    } finally {
      setLoading(false);
    }
  }, [call.callSessionId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Escape closes, matching the other drawers in the app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-label="Call transcript"
        className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right"
      >
        <header className="px-5 py-4 border-b border-slate-200 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">
              {call.leadName || 'Unknown lead'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {AI_CALL_PURPOSE_LABELS[call.callPurpose] || call.callPurpose}
              {' · '}
              {AI_CALL_STATUS_LABELS[call.status] || call.status}
              {' · '}
              {formatDuration(call.duration)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Close transcript"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {(call.temperature || call.transcriptSummary || call.qualificationStatus === 'failed') && (
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 space-y-2">
            {call.temperature && (
              <div className="flex items-center gap-2 flex-wrap">
                <LeadTemperatureBadge temperature={call.temperature} />
                {call.scoreReasons && (
                  <span className="text-xs text-slate-600">{call.scoreReasons}</span>
                )}
              </div>
            )}
            {call.qualificationStatus === 'failed' && (
              <p className="text-xs text-amber-700">
                This was a qualification call but it ended without a usable score.
              </p>
            )}
            {call.transcriptSummary && (
              <p className="text-sm text-slate-700">{call.transcriptSummary}</p>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading transcript…
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="text-center py-16">
              <PhoneCall className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-700 font-medium">No transcript yet</p>
              <p className="text-slate-500 text-sm mt-1">
                The transcript arrives once the call ends and the post-call webhook is processed.
              </p>
            </div>
          )}

          {!loading && !error && entries.length > 0 && (
            <ol className="space-y-3">
              {entries.map((entry, index) => {
                const isAgent = entry.speaker === 'ai';
                return (
                  <li
                    key={`${entry.timestamp ?? ''}-${index}`}
                    className={`flex gap-2.5 ${isAgent ? '' : 'flex-row-reverse'}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isAgent ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'
                      }`}
                      aria-hidden="true"
                    >
                      {isAgent ? <PhoneCall className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`max-w-[80%] ${isAgent ? '' : 'text-right'}`}>
                      {/*
                        Transcripts are Hinglish — mixed Latin and Devanagari in
                        the same sentence. `break-words` plus the browser's own
                        font fallback keeps both scripts legible; forcing a font
                        stack here would break one or the other.
                      */}
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words text-left ${
                          isAgent
                            ? 'bg-blue-50 text-slate-800 rounded-tl-sm'
                            : 'bg-slate-100 text-slate-800 rounded-tr-sm'
                        }`}
                      >
                        {entry.text}
                      </div>
                      <div className={`mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 ${isAgent ? '' : 'justify-end'}`}>
                        <span>{isAgent ? 'Agent' : 'Customer'}</span>
                        {entry.timestamp && <span>· {formatTime(entry.timestamp)}</span>}
                        {entry.dataSource && (
                          <span className="inline-flex items-center gap-0.5 text-slate-400">
                            · <Wrench className="w-3 h-3" /> {entry.dataSource}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {call.recordingUrl && (
          <footer className="px-5 py-3 border-t border-slate-200">
            <audio controls src={call.recordingUrl} className="w-full">
              <track kind="captions" />
            </audio>
          </footer>
        )}
      </aside>
    </div>
  );
}
