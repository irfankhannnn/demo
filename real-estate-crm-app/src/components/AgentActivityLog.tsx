import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { getIdToken } from '../utils/authStorage';
import { getTenantHeaders } from '../config/tenant';

const API_URL = import.meta.env.VITE_API_URL as string;

interface AgentLogItem {
  id: string;
  agentId: string;
  action: string;
  creditsCharged: number;
  createdAt: string;
}

export default function AgentActivityLog() {
  const [items, setItems] = useState<AgentLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/admin/agent-activity?limit=20`, {
          headers: { Authorization: `Bearer ${getIdToken()}`, ...getTenantHeaders() },
        });
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="h-5 w-5 text-[#2563EB]" />
        <h3 className="font-semibold text-slate-900">Recent Agent Activity</h3>
      </div>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between border-b border-slate-100 pb-2">
            <span>{item.action} <span className="text-slate-400">({item.agentId})</span></span>
            <span className="text-slate-500">{item.creditsCharged} credits · {new Date(item.createdAt).toLocaleString('en-IN')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
