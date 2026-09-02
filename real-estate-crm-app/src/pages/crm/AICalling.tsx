import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Loader2, PhoneCall, PhoneOutgoing,
  RefreshCw, Search, Settings, X,
} from 'lucide-react';
import { api } from '../../services/api';
import { aiCallingApi, AICallingUnavailableError } from '../../services/aiCallingApi';
import AICallTranscriptDrawer from '../../components/AICallTranscriptDrawer';
import LeadTemperatureBadge from '../../components/LeadTemperatureBadge';
import Toast from '../../components/Toast';
import type { CRMLead } from '../../types/crm';
import type {
  AIAgentConfig, AICallMetrics, AICallPurpose, AICallSession, AICallStatus,
} from '../../types/aiCalling';
import {
  AI_CALL_IN_FLIGHT_STATUSES,
  AI_CALL_PURPOSE_LABELS,
  AI_CALL_STARTABLE_PURPOSES,
  AI_CALL_STATUS_LABELS,
} from '../../types/aiCalling';

function statusStyle(status: AICallStatus): string {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700';
    case 'in_progress':
    case 'connected': return 'bg-blue-100 text-blue-700';
    case 'ringing':
    case 'initiated': return 'bg-amber-100 text-amber-700';
    case 'failed': return 'bg-red-100 text-red-700';
    case 'no_answer':
    case 'busy':
    case 'cancelled': return 'bg-slate-200 text-slate-600';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatWhen(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function AICalling() {
  const navigate = useNavigate();

  const [calls, setCalls] = useState<AICallSession[]>([]);
  const [metrics, setMetrics] = useState<AICallMetrics | null>(null);
  const [config, setConfig] = useState<AIAgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCall, setSelectedCall] = useState<AICallSession | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setRefreshing(true);
    try {
      const [callList, configResult] = await Promise.all([
        aiCallingApi.listCalls({ limit: 50, status: statusFilter || undefined }),
        aiCallingApi.getAgentConfig().catch(() => null),
      ]);
      setCalls(callList);
      if (configResult) setConfig(configResult);
      // Metrics are a nice-to-have; a failure there must not blank the page.
      aiCallingApi.getMetrics().then(setMetrics).catch(() => undefined);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (err instanceof AICallingUnavailableError) {
        setUnavailable(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load AI calls');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    load({ silent: true });
  }, [load]);

  // Poll while any call is still live, matching CallRecordings' idiom.
  const hasInFlight = useMemo(
    () => calls.some((call) => AI_CALL_IN_FLIGHT_STATUSES.includes(call.status)),
    [calls],
  );

  useEffect(() => {
    if (!hasInFlight || unavailable) return undefined;
    const timer = setInterval(() => load({ silent: true }), 8000);
    return () => clearInterval(timer);
  }, [hasInFlight, unavailable, load]);

  const handleStarted = useCallback((message: string) => {
    setToast({ message, type: 'success' });
    setShowStartModal(false);
    load({ silent: true });
  }, [load]);

  const needsConfig = config !== null && config.configured === false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/crm')}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white"
            aria-label="Back to CRM"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <PhoneOutgoing className="w-7 h-7 text-green-600" />
              AI Calling
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Your AI agent calls leads, answers their questions in Hinglish, and books site visits.
            </p>
          </div>
          <button
            onClick={() => setShowConfig(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white"
            aria-label="Agent settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={() => load()}
            disabled={refreshing || unavailable}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {unavailable && (
          <div className="px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-sm">
            AI calling isn&apos;t switched on for this deployment yet. Once the service is
            deployed and connected, your calls will show up here.
          </div>
        )}

        {!unavailable && needsConfig && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="flex-1">
              Your AI agent isn&apos;t set up yet, so calls can&apos;t start.{' '}
              <button
                onClick={() => setShowConfig(true)}
                className="font-semibold underline hover:text-amber-900"
              >
                Set it up now
              </button>
            </span>
          </div>
        )}

        {!unavailable && (
          <>
            {metrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Total calls', value: metrics.totalCalls ?? 0 },
                  { label: 'Completed', value: metrics.completedCalls ?? 0 },
                  { label: 'Failed', value: metrics.failedCalls ?? 0 },
                  { label: 'Avg duration', value: formatDuration(metrics.averageDuration) },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-xs text-slate-500">{stat.label}</p>
                    <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <button
                onClick={() => setShowStartModal(true)}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <PhoneOutgoing className="w-4 h-4" />
                Start a call
              </button>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 sm:ml-auto"
              >
                <option value="">All statuses</option>
                {Object.entries(AI_CALL_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3 pb-10">
              {loading && (
                <div className="flex items-center justify-center py-16 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading calls…
                </div>
              )}

              {!loading && calls.length === 0 && (
                <div className="text-center py-16 bg-white/60 rounded-2xl border border-slate-200">
                  <PhoneCall className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-700 font-medium">
                    {statusFilter ? 'No calls with this status' : 'No AI calls yet'}
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                    {statusFilter
                      ? 'Try a different status filter.'
                      : 'Start a call from here, or from any lead in your list.'}
                  </p>
                </div>
              )}

              {!loading && calls.map((call) => (
                <button
                  key={call.callSessionId}
                  onClick={() => setSelectedCall(call)}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-green-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-slate-900 truncate">
                      {call.leadName || 'Unknown lead'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle(call.status)}`}>
                      {AI_CALL_STATUS_LABELS[call.status] || call.status}
                    </span>
                    {call.temperature && <LeadTemperatureBadge temperature={call.temperature} />}
                    {call.qualificationStatus === 'failed' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        No score
                      </span>
                    )}
                    <span className="ml-auto text-xs text-slate-400 tabular-nums">
                      {formatWhen(call.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span>{AI_CALL_PURPOSE_LABELS[call.callPurpose] || call.callPurpose}</span>
                    <span className="tabular-nums">{formatDuration(call.duration)}</span>
                    {call.leadPhone && <span className="tabular-nums">{call.leadPhone}</span>}
                    {call.outcome && <span className="truncate">{call.outcome}</span>}
                  </div>
                  {call.transcriptSummary && (
                    <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">{call.transcriptSummary}</p>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedCall && (
        <AICallTranscriptDrawer call={selectedCall} onClose={() => setSelectedCall(null)} />
      )}

      {showStartModal && (
        <StartCallModal
          onClose={() => setShowStartModal(false)}
          onStarted={handleStarted}
          onError={(message) => setToast({ message, type: 'error' })}
        />
      )}

      {showConfig && (
        <AgentConfigModal
          config={config}
          onClose={() => setShowConfig(false)}
          onSaved={(saved) => {
            setConfig({ ...saved, configured: true });
            setShowConfig(false);
            setToast({ message: 'Agent settings saved', type: 'success' });
          }}
          onError={(message) => setToast({ message, type: 'error' })}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Start call                                                          */
/* ------------------------------------------------------------------ */

interface StartCallModalProps {
  onClose: () => void;
  onStarted: (message: string) => void;
  onError: (message: string) => void;
}

function StartCallModal({ onClose, onStarted, onError }: StartCallModalProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CRMLead[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CRMLead | null>(null);
  const [purpose, setPurpose] = useState<AICallPurpose>('lead_qualification');
  const [starting, setStarting] = useState(false);

  // Debounced lead lookup — the same shape PartySearchSelector uses.
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.getLeads({ search: query, limit: 8, excludeConverted: true });
        setResults(response.leads);
      } catch {
        // A failed lookup just shows no matches; the user can retype. Surfacing
        // a toast per keystroke would be worse than silence here.
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const start = async () => {
    if (!selected) return;
    setStarting(true);
    try {
      // Qualification goes through the CRM's existing, already-deployed
      // `POST /crm/leads/:id/qualify-call`. That route hardcodes the purpose
      // server-side, so it can't serve follow-ups — but reusing it means
      // qualification calls work without waiting on the wider proxy.
      if (purpose === 'lead_qualification') {
        await api.triggerQualifyCall(selected.leadId);
      } else {
        await aiCallingApi.startCall({ leadId: selected.leadId, callPurpose: purpose });
      }
      onStarted(`Calling ${selected.name}…`);
    } catch (err) {
      // Surface the real reason — out of credits, agent not configured, bad
      // phone number are all things the user can actually act on.
      onError(err instanceof Error ? err.message : 'Failed to start the call');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-label="Start an AI call" className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center">
          <h2 className="text-lg font-bold text-slate-900 flex-1">Start an AI call</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="ai-call-lead" className="block text-sm font-medium text-slate-700 mb-1">Lead</label>
            {selected ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{selected.name}</p>
                  <p className="text-xs text-slate-500 tabular-nums">{selected.phone || 'No phone number'}</p>
                </div>
                <button onClick={() => { setSelected(null); setSearch(''); }} className="text-xs font-medium text-slate-500 hover:text-slate-900 underline">
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="ai-call-lead"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name or phone"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
                  />
                </div>
                {searching && <p className="text-xs text-slate-400 mt-1.5">Searching…</p>}
                {!searching && results.length > 0 && (
                  <ul className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-52 overflow-y-auto">
                    {results.map((lead) => (
                      <li key={lead.leadId}>
                        <button
                          onClick={() => setSelected(lead)}
                          disabled={!lead.phone}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <p className="text-sm text-slate-900">{lead.name}</p>
                          <p className="text-xs text-slate-500 tabular-nums">
                            {lead.phone || 'No phone number — can’t be called'}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-slate-700 mb-1">What should the agent do?</legend>
            <div className="space-y-2">
              {AI_CALL_STARTABLE_PURPOSES.map((option) => (
                <label
                  key={option.value}
                  className={`flex gap-2.5 p-3 rounded-lg border cursor-pointer ${
                    purpose === option.value ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="callPurpose"
                    value={option.value}
                    checked={purpose === option.value}
                    onChange={() => setPurpose(option.value)}
                    className="mt-0.5 accent-green-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <footer className="px-5 py-4 border-t border-slate-200 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={start}
            disabled={!selected || !selected.phone || starting}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {starting && <Loader2 className="w-4 h-4 animate-spin" />}
            {starting ? 'Starting…' : 'Call now'}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Agent configuration                                                 */
/* ------------------------------------------------------------------ */

interface AgentConfigModalProps {
  config: AIAgentConfig | null;
  onClose: () => void;
  onSaved: (config: AIAgentConfig) => void;
  onError: (message: string) => void;
}

function AgentConfigModal({ config, onClose, onSaved, onError }: AgentConfigModalProps) {
  const [agencyName, setAgencyName] = useState(config?.agencyName ?? '');
  const [greeting, setGreeting] = useState(config?.greeting ?? '');
  const [escalationPhone, setEscalationPhone] = useState(config?.escalationPhone ?? '');
  const [maxCallDuration, setMaxCallDuration] = useState(String(config?.maxCallDuration ?? 600));
  const [enableRecording, setEnableRecording] = useState(config?.enableRecording ?? true);
  const [agentId, setAgentId] = useState(config?.agentId ?? '');
  const [agentPhoneNumberId, setAgentPhoneNumberId] = useState(config?.agentPhoneNumberId ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!agencyName.trim()) {
      onError('Agency name is required');
      return;
    }
    setSaving(true);
    try {
      const saved = await aiCallingApi.saveAgentConfig({
        agencyName: agencyName.trim(),
        greeting: greeting.trim() || undefined,
        escalationPhone: escalationPhone.trim() || undefined,
        maxCallDuration: Number(maxCallDuration) || undefined,
        enableRecording,
        agentId: agentId.trim() || undefined,
        agentPhoneNumberId: agentPhoneNumberId.trim() || undefined,
      });
      onSaved(saved);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save agent settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-label="Agent settings" className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center">
          <h2 className="text-lg font-bold text-slate-900 flex-1">Agent settings</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <p className="text-xs text-slate-500">
            These settings tell the AI agent who it is calling on behalf of. The agency
            name is spoken on every call.
          </p>

          <div>
            <label htmlFor="cfg-agency" className="block text-sm font-medium text-slate-700 mb-1">
              Agency name <span className="text-red-500">*</span>
            </label>
            <input
              id="cfg-agency"
              value={agencyName}
              onChange={(event) => setAgencyName(event.target.value)}
              placeholder="e.g. Acme Real Estate"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
            />
          </div>

          <div>
            <label htmlFor="cfg-greeting" className="block text-sm font-medium text-slate-700 mb-1">Opening line</label>
            <textarea
              id="cfg-greeting"
              value={greeting}
              onChange={(event) => setGreeting(event.target.value)}
              rows={2}
              placeholder="Leave blank to let the agent open naturally"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
            />
          </div>

          <div>
            <label htmlFor="cfg-escalation" className="block text-sm font-medium text-slate-700 mb-1">Callback number</label>
            <input
              id="cfg-escalation"
              value={escalationPhone}
              onChange={(event) => setEscalationPhone(event.target.value)}
              placeholder="+91…"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-green-500/30"
            />
            <p className="text-xs text-slate-400 mt-1">Given to the customer when they ask for a human.</p>
          </div>

          <div>
            <label htmlFor="cfg-duration" className="block text-sm font-medium text-slate-700 mb-1">Maximum call length (seconds)</label>
            <input
              id="cfg-duration"
              type="number"
              min={60}
              max={1800}
              value={maxCallDuration}
              onChange={(event) => setMaxCallDuration(event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-green-500/30"
            />
            <p className="text-xs text-slate-400 mt-1">Qualification calls are always capped at 3 minutes.</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableRecording}
              onChange={(event) => setEnableRecording(event.target.checked)}
              className="accent-green-600"
            />
            <span className="text-sm text-slate-700">Record calls</span>
          </label>

          <details className="border-t border-slate-100 pt-3">
            <summary className="text-sm font-medium text-slate-700 cursor-pointer">Advanced</summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs text-slate-500">
                Leave both blank unless this agency needs its own ElevenLabs agent or
                phone number. By default every agency shares one agent, personalised
                per call.
              </p>
              <div>
                <label htmlFor="cfg-agent-id" className="block text-sm font-medium text-slate-700 mb-1">ElevenLabs agent ID</label>
                <input
                  id="cfg-agent-id"
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  placeholder="agent_…"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/30"
                />
              </div>
              <div>
                <label htmlFor="cfg-phone-id" className="block text-sm font-medium text-slate-700 mb-1">Phone number ID</label>
                <input
                  id="cfg-phone-id"
                  value={agentPhoneNumberId}
                  onChange={(event) => setAgentPhoneNumberId(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/30"
                />
              </div>
            </div>
          </details>
        </div>

        <footer className="px-5 py-4 border-t border-slate-200 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  );
}
