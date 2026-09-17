import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Users } from 'lucide-react';
import { getIdToken, getUserProfile } from '../../utils/authStorage';
import { getTenantHeaders } from '../../config/tenant';
import GlassDataTable from '../../components/GlassDataTable';
import { exportBlobFile } from '../../lib/fileExport';
import { CRM_API_URL } from '../../config/apiConfig';

const API_URL = CRM_API_URL;

interface MemberMetric {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  status: string;
  dealsClosed: number;
  activeLeads: number;
  conversionRate: number;
  lastActivityAt?: string;
}

export default function TeamAnalytics() {
  const navigate = useNavigate();
  const profile = getUserProfile();
  const [items, setItems] = useState<MemberMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<'month' | 'quarter' | 'all'>('month');
  const [selected, setSelected] = useState<MemberMetric | null>(null);

  useEffect(() => {
    if (profile?.role !== 'ADMIN') {
      navigate('/member/no-access');
    }
  }, [profile, navigate]);

  const getDateRange = () => {
    const now = new Date();
    if (range === 'all') return {};
    if (range === 'quarter') {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  };

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const idToken = getIdToken();
      const { startDate, endDate } = getDateRange();
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`${API_URL}/admin/team-analytics?${params}`, {
        headers: { Authorization: `Bearer ${idToken}`, ...getTenantHeaders() },
      });
      if (!res.ok) throw new Error('Failed to load team analytics');
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExport = async () => {
    const idToken = getIdToken();
    const { startDate, endDate } = getDateRange();
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const res = await fetch(`${API_URL}/admin/team-analytics/export?${params}`, {
      headers: { Authorization: `Bearer ${idToken}`, ...getTenantHeaders() },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    await exportBlobFile({
      filename: `team-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`,
      blob,
      shareTitle: 'Team analytics export',
    }).catch((err) => console.error('Export failed:', err));
  };

  const columns = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'phone', header: 'Mobile', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'role', header: 'Role', sortable: true },
    { key: 'status', header: 'Status', sortable: true },
    { key: 'dealsClosed', header: 'Deals Closed', sortable: true },
    { key: 'activeLeads', header: 'Active Leads', sortable: true },
    { key: 'conversionRate', header: 'Conversion %', sortable: true, render: (item: MemberMetric) => `${item.conversionRate}%` },
    { key: 'lastActivityAt', header: 'Last Activity', sortable: true, render: (item: MemberMetric) => item.lastActivityAt ? new Date(item.lastActivityAt).toLocaleDateString('en-IN') : '—' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link to="/admin/members" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Members
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-brand" />
            <h1 className="text-2xl font-bold text-slate-900">Team Analytics</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as typeof range)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="month">This month</option>
              <option value="quarter">Last 3 months</option>
              <option value="all">All time</option>
            </select>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              <Download className="h-4 w-4" /> Download Excel
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">{error}</div>}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading analytics...</div>
        ) : (
          <GlassDataTable
            data={items}
            columns={columns}
            keyExtractor={(item) => (item as MemberMetric).userId}
            onRowClick={(row) => setSelected(row as MemberMetric)}
            emptyMessage="No team members found"
            searchPlaceholder="Search by name, email, phone..."
          />
        )}

        {selected && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelected(null)}>
            <div className="bg-white w-full max-w-md h-full p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4">{selected.name}</h2>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-slate-500">Email</dt><dd>{selected.email || '—'}</dd></div>
                <div><dt className="text-slate-500">Mobile</dt><dd>{selected.phone || '—'}</dd></div>
                <div><dt className="text-slate-500">Role</dt><dd>{selected.role}</dd></div>
                <div><dt className="text-slate-500">Deals Closed</dt><dd>{selected.dealsClosed}</dd></div>
                <div><dt className="text-slate-500">Active Leads</dt><dd>{selected.activeLeads}</dd></div>
                <div><dt className="text-slate-500">Conversion</dt><dd>{selected.conversionRate}%</dd></div>
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
