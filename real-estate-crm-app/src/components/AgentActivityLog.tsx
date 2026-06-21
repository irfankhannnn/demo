import { useEffect, useState, useCallback } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import { getIdToken } from '../utils/authStorage';
import { getTenantHeaders } from '../config/tenant';

const API_URL = import.meta.env.VITE_API_URL as string;

interface AgentLogItem {
  id: string;
  agentId: string;
  action: string;
  status?: 'success' | 'error';
  creditsCharged: number;
  createdAt: string;
  errorMessage?: string;
}

const AGENT_LABELS: Record<string, string> = {
  qualifier: 'Lead Qualifier',
  router: 'Lead Router',
  followup: 'Follow-up Agent',
  whatsapp: 'WhatsApp Bot',
  mcp: 'Claude Desktop',
};

export function AgentActivityLog() {
  const [items, setItems] = useState<AgentLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/crm/agents/activity?limit=${limit}`, {
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

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mt-4 flex items-center justify-center h-24">
      <div className="animate-spin h-6 w-6 border-2 border-[#2563EB] rounded-full border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4 text-sm text-red-700">{error}</div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[#2563EB]" />
          <h3 className="font-semibold text-slate-900">Recent Agent Activity</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-600"
          >
            <option value={20}>Last 20</option>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
          </select>
          <button
            onClick={load}
            className="text-slate-400 hover:text-[#2563EB] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No agent activity yet</p>
          <p className="text-xs mt-1">Agents will appear here once AI Employee is active</p>
        </div>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between items-start border-b border-slate-100 pb-2 last:border-0">
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AgentActivityLog;
