import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Clock,
  Settings,
  Upload,
  Play,
  History,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { aiCallingApi, isAICallingEnabled } from '../../../services/aiCallingApi';
import type { CallSession, CallMetrics, AgentConfig } from '../../../types/aiCalling';

const statusColors: Record<string, string> = {
  initiated: 'bg-blue-100 text-blue-800',
  ringing: 'bg-yellow-100 text-yellow-800',
  connected: 'bg-green-100 text-green-800',
  in_progress: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800',
  no_answer: 'bg-orange-100 text-orange-800',
  busy: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const statusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="w-4 h-4" />,
  failed: <XCircle className="w-4 h-4" />,
  no_answer: <PhoneMissed className="w-4 h-4" />,
  in_progress: <PhoneCall className="w-4 h-4" />,
  ringing: <Phone className="w-4 h-4 animate-pulse" />,
};

export default function AICallingDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<CallMetrics | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallSession[]>([]);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAICallingEnabled()) {
      setError('AI Calling is not enabled. Please configure VITE_AI_CALLING_API_URL and VITE_AI_CALLING_ENABLED.');
      setLoading(false);
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsData, callsData, configData] = await Promise.all([
        aiCallingApi.getCallMetrics(),
        aiCallingApi.getCalls(undefined, 10),
        aiCallingApi.getAgentConfig(),
      ]);

      setMetrics(metricsData);
      setRecentCalls(callsData);
      setAgentConfig(configData);
    } catch (err) {
      console.error('Error loading AI Calling data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-emerald-50/50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-md border-b border-white/30 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/crm')} className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-lg shadow-sm">
                  <PhoneCall className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">AI Calling</h1>
                  <p className="text-xs text-gray-500">Voice AI Agent for Lead Follow-up</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                title="Refresh"
               aria-label="Refresh data">
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <Link
                to="/crm/ai-calling/settings"
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <Settings className="w-5 h-5" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
              <Link
                to="/crm/ai-calling/start"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Play className="w-5 h-5" />
                <span>Start Call</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-2xl border border-amber-200 bg-amber-50/70 backdrop-blur-md flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">AI Calling service is not reachable</h3>
              <p className="text-sm text-amber-800 mt-1">{error}</p>
              <p className="text-xs text-amber-800 mt-1">
                You can still navigate and configure settings; data will load once the API is available.
              </p>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {!isAICallingEnabled() && (
          <div className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50/70 backdrop-blur-md flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">AI Calling is disabled</h3>
              <p className="text-sm text-red-800 mt-1">
                Set <span className="font-mono">VITE_AI_CALLING_ENABLED=true</span> and configure <span className="font-mono">VITE_AI_CALLING_API_URL</span>.
              </p>
            </div>
          </div>
        )}

        {/* Agent Status Banner */}
        {agentConfig && !agentConfig.configured && (
          <div className="mb-6 p-4 bg-amber-50/70 backdrop-blur-md border border-amber-200 rounded-2xl flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800">Agent Not Configured</h3>
              <p className="text-sm text-amber-700 mt-1">
                Please configure your AI agent settings including Exotel number and greeting message before making calls.
              </p>
              <Link
                to="/crm/ai-calling/settings"
                className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-amber-800 hover:text-amber-900"
              >
                Configure Agent <ArrowLeft className="w-4 h-4 rotate-180" />
              </Link>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm p-5 border border-white/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Total Calls</span>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200/70 rounded-lg animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-gray-900">{metrics?.totalCalls || 0}</p>
            )}
          </div>

          <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm p-5 border border-white/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Completed</span>
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
            </div>
            {loading ? (
              <>
                <div className="h-8 w-16 bg-gray-200/70 rounded-lg animate-pulse" />
                <div className="h-3 w-24 bg-gray-200/70 rounded mt-2 animate-pulse" />
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">{metrics?.completedCalls || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {metrics?.totalCalls ? Math.round((metrics.completedCalls / metrics.totalCalls) * 100) : 0}% success rate
                </p>
              </>
            )}
          </div>

          <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm p-5 border border-white/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Avg Duration</span>
              <div className="p-2 bg-purple-50 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-24 bg-gray-200/70 rounded-lg animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-gray-900">{formatDuration(metrics?.avgDuration || 0)}</p>
            )}
          </div>

          <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm p-5 border border-white/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">No Answer</span>
              <div className="p-2 bg-orange-50 rounded-lg">
                <PhoneMissed className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200/70 rounded-lg animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-gray-900">{metrics?.noAnswerCalls || 0}</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link
            to="/crm/ai-calling/start"
            className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm p-6 border border-white/30 hover:border-green-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-xl group-hover:bg-green-100">
                <Play className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Start AI Call</h3>
                <p className="text-sm text-gray-500">Call a lead with AI agent</p>
              </div>
            </div>
          </Link>

          <Link
            to="/crm/ai-calling/settings"
            className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm p-6 border border-white/30 hover:border-indigo-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100">
                <Settings className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Agent Settings</h3>
                <p className="text-sm text-gray-500">Configure voice, greeting, Exotel</p>
              </div>
            </div>
          </Link>

          <Link
            to="/crm/ai-calling/knowledge"
            className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm p-6 border border-white/30 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Knowledge Base</h3>
                <p className="text-sm text-gray-500">Upload FAQs & documents</p>
              </div>
            </div>
          </Link>

          <Link
            to="/crm/ai-calling/history"
            className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm p-6 border border-white/30 hover:border-purple-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 rounded-xl group-hover:bg-purple-100">
                <History className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Call History</h3>
                <p className="text-sm text-gray-500">View past calls & transcripts</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Calls */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-white/30">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Recent Calls</h2>
            <Link to="/crm/ai-calling/history" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              View All
            </Link>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              <div className="h-14 bg-gray-200/70 rounded-xl animate-pulse" />
              <div className="h-14 bg-gray-200/70 rounded-xl animate-pulse" />
              <div className="h-14 bg-gray-200/70 rounded-xl animate-pulse" />
            </div>
          ) : recentCalls.length === 0 ? (
            <div className="p-12 text-center">
              <PhoneOff className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No calls yet</h3>
              <p className="text-gray-500 mb-4">Start your first AI call to see it here</p>
              <Link
                to="/crm/ai-calling/start"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Play className="w-4 h-4" />
                Start First Call
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentCalls.map((call) => (
                <Link
                  key={call.callSessionId}
                  to={`/crm/ai-calling/calls/${call.callSessionId}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {statusIcons[call.status] || <Phone className="w-5 h-5 text-gray-600" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{call.leadName || call.leadPhone}</p>
                      <p className="text-sm text-gray-500">{formatDate(call.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">{formatDuration(call.duration)}</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[call.status] || 'bg-gray-100 text-gray-800'}`}>
                      {call.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
