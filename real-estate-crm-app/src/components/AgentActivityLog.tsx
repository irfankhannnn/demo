import { useEffect, useState, useCallback, useMemo } from 'react';
import { Bot, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Calendar, Download } from 'lucide-react';
import { getIdToken } from '../utils/authStorage';
import { getTenantHeaders } from '../config/tenant';
import { exportTextFile } from '../lib/fileExport';

const API_URL = import.meta.env.VITE_API_URL as string;

export interface AgentLogItem {
  id: string;
  agentId: string;
  action: string;
  status?: 'success' | 'error';
  creditsCharged: number;
  createdAt: string;
  errorMessage?: string;
  phone?: string;
  toolDetails?: Record<string, unknown>;
}

const AGENT_LABELS: Record<string, string> = {
  qualifier: 'Lead Qualifier',
  router: 'Lead Router',
  followup: 'Follow-up Agent',
  whatsapp: 'WhatsApp Bot',
  mcp: 'Claude Desktop',
};

const AGENT_OPTIONS: { id: string; label: string }[] = [
  { id: 'all', label: 'All Agents' },
  { id: 'whatsapp', label: 'WhatsApp Bot' },
  { id: 'qualifier', label: 'Qualifier' },
  { id: 'router', label: 'Router' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'mcp', label: 'MCP' },
];

type StatusFilter = 'all' | 'success' | 'error';

interface AgentActivityLogProps {
  showFilters?: boolean;
  showConversationLinks?: boolean;
  showSummary?: boolean;
  onJumpToInbox?: (phone: string) => void;
}

export function AgentActivityLog({
  showFilters,
  showConversationLinks,
  showSummary,
  onJumpToInbox,
}: AgentActivityLogProps = {}) {
  const [items, setItems] = useState<AgentLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/crm/agents/activity?limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${getIdToken()}`,
          ...getTenantHeaders(),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.activities || data.items || []);
      } else {
        setError('Failed to load agent activity');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    let filtered = [...items];
    if (statusFilter !== 'all') {
      filtered = filtered.filter((i) =>
        statusFilter === 'error' ? i.status === 'error' : i.status !== 'error'
      );
    }
    if (agentFilter !== 'all') {
      filtered = filtered.filter((i) => i.agentId === agentFilter);
    }
    if (dateFilter) {
      filtered = filtered.filter((i) => (i.createdAt || '').slice(0, 10) === dateFilter);
    }
    return filtered;
  }, [items, statusFilter, agentFilter, dateFilter]);

  const summary = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthly = items.filter((i) => (i.createdAt || '').slice(0, 7) === thisMonth);
    const totalCredits = monthly.reduce((sum, i) => sum + (i.creditsCharged || 0), 0);
    const totalActions = monthly.length;
    const successes = monthly.filter((i) => i.status !== 'error').length;
    const successRate = totalActions > 0 ? Math.round((successes / totalActions) * 100) : 0;
    return { totalCredits, totalActions, successRate };
  }, [items]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Agent', 'Action', 'Status', 'Credits', 'Phone', 'Error'];
    const rows = filteredItems.map((item) => [
      new Date(item.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      AGENT_LABELS[item.agentId] || item.agentId,
      item.action,
      item.status || 'ok',
      item.creditsCharged,
      item.phone || '',
      item.errorMessage || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"` ).join(',')
      ),
    ].join('\n');

    exportTextFile({
      filename: `agent-activity-${new Date().toISOString().split('T')[0]}.csv`,
      data: csvContent,
      mimeType: 'text/csv',
      shareTitle: 'Agent activity export',
    }).catch((err) => console.error('Export failed:', err));
  };

  if (loading) return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mt-4 flex items-center justify-center h-24">
      <div className="animate-spin h-6 w-6 border-2 border-brand rounded-full border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4 text-sm text-red-700">{error}</div>
  );

  return (
    <div className="space-y-4">
      {showSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Credits this month</p>
            <p className="text-2xl font-bold text-slate-900">{summary.totalCredits}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total actions</p>
            <p className="text-2xl font-bold text-slate-900">{summary.totalActions}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Success rate</p>
            <p className="text-2xl font-bold text-slate-900">{summary.successRate}%</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-brand" />
            <h3 className="font-semibold text-slate-900">Recent Agent Activity</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {showFilters && (
              <>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-600"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                </select>
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-600"
                >
                  {AGENT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <div className="relative">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="text-xs border border-slate-200 rounded pl-7 pr-2 py-1.5 text-slate-600"
                  />
                </div>
              </>
            )}
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-600"
            >
              <option value={20}>Last 20</option>
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
            </select>
            <button
              onClick={load}
              className="text-slate-400 hover:text-brand transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {filteredItems.length > 0 && (
              <button
                onClick={exportToCSV}
                className="text-slate-400 hover:text-brand transition-colors"
                title="Export to CSV"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No agent activity yet</p>
            <p className="text-xs mt-1">Agents will appear here once AI Employee is active</p>
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {filteredItems.map((item) => {
              const isExpanded = expandedIds.has(item.id);
              const hasDetails = item.toolDetails && Object.keys(item.toolDetails).length > 0;
              return (
                <li
                  key={item.id}
                  className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-slate-800">
                        {item.action}
                        {item.errorMessage && (
                          <span className="ml-1 text-xs text-red-500" title={item.errorMessage}>!</span>
                        )}
                      </span>
                      <span className="text-xs text-slate-400">{AGENT_LABELS[item.agentId] || item.agentId}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0 ml-4">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        item.status === 'error'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {item.status || 'ok'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {item.creditsCharged} cr · {new Date(item.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {showConversationLinks && item.phone && onJumpToInbox && (
                      <button
                        onClick={() => onJumpToInbox(item.phone!)}
                        className="inline-flex items-center gap-1 text-xs text-brand hover:text-blue-700 font-medium"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View conversation
                      </button>
                    )}
                    {hasDetails && (
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {isExpanded ? 'Hide details' : 'Show details'}
                      </button>
                    )}
                  </div>

                  {isExpanded && hasDetails && (
                    <div className="mt-2 p-2 bg-slate-100 rounded text-xs text-slate-700 overflow-x-auto">
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(item.toolDetails, null, 2)}
                      </pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AgentActivityLog;
