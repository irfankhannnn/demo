import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Clock,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { aiCallingApi } from '../../../services/aiCallingApi';
import type { CallSession, CallStatus } from '../../../types/aiCalling';

const statusConfig: Record<CallStatus, { color: string; bgColor: string; icon: React.ReactNode }> = {
  initiated: { color: 'text-blue-600', bgColor: 'bg-blue-50', icon: <Phone className="w-4 h-4" /> },
  ringing: { color: 'text-yellow-600', bgColor: 'bg-yellow-50', icon: <Phone className="w-4 h-4" /> },
  connected: { color: 'text-green-600', bgColor: 'bg-green-50', icon: <PhoneCall className="w-4 h-4" /> },
  in_progress: { color: 'text-green-600', bgColor: 'bg-green-50', icon: <PhoneCall className="w-4 h-4" /> },
  completed: { color: 'text-gray-600', bgColor: 'bg-gray-50', icon: <CheckCircle2 className="w-4 h-4" /> },
  failed: { color: 'text-red-600', bgColor: 'bg-red-50', icon: <XCircle className="w-4 h-4" /> },
  no_answer: { color: 'text-orange-600', bgColor: 'bg-orange-50', icon: <PhoneMissed className="w-4 h-4" /> },
  busy: { color: 'text-purple-600', bgColor: 'bg-purple-50', icon: <Phone className="w-4 h-4" /> },
  cancelled: { color: 'text-gray-500', bgColor: 'bg-gray-50', icon: <XCircle className="w-4 h-4" /> },
};

const statusFilters: { value: CallStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Calls' },
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'failed', label: 'Failed' },
  { value: 'no_answer', label: 'No Answer' },
];

export default function CallHistory() {
  const navigate = useNavigate();
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CallStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadCalls();
  }, [statusFilter]);

  const loadCalls = async () => {
    try {
      setLoading(true);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const callsData = await aiCallingApi.getCalls(status, 100);
      setCalls(callsData);
    } catch (err) {
      console.error('Error loading calls:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = calls.filter(call => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      call.leadName?.toLowerCase().includes(query) ||
      call.leadPhone?.includes(query)
    );
  });

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="glass-premium border-b border-white/30 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/ai-calling')}
                className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-white/50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Call History</h1>
                <p className="text-xs sm:text-sm text-slate-400 font-semibold">{calls.length} calls</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>
              <button
                onClick={loadCalls}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
               aria-label="Refresh data">
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === filter.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading calls...</p>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <PhoneOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No calls found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try a different search term' : 'Start making AI calls to see them here'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {filteredCalls.map((call) => {
                const status = statusConfig[call.status];
                return (
                  <Link
                    key={call.callSessionId}
                    to={`/crm/ai-calling/calls/${call.callSessionId}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${status.bgColor}`}>
                        <span className={status.color}>{status.icon}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{call.leadName || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">{call.leadPhone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span className="font-mono">{formatDuration(call.duration)}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{formatDateTime(call.createdAt)}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${status.bgColor} ${status.color}`}>
                        {call.status.replace('_', ' ')}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
