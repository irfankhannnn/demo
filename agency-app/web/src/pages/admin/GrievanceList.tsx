import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Search, RefreshCw } from 'lucide-react';
import { getUserProfile } from '../../utils/authStorage';
import { CRM_API_URL } from '../../config/apiConfig';

/**
 * Admin grievance triage. Founder/admin only — non-admins see an access notice.
 * Reads from GET /api/admin/grievances and updates via PATCH /api/admin/grievances/:id.
 */

const API_BASE_URL = CRM_API_URL;

interface Grievance {
  grievanceId: string;
  trackingId: string;
  name: string;
  email: string;
  phone?: string | null;
  category: string;
  description: string;
  status: string;
  assignedTo?: string | null;
  resolutionNotes?: string | null;
  internalNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

const STATUSES = ['new', 'acknowledged', 'in_progress', 'resolved', 'escalated'];
const CATEGORIES = [
  'data_access', 'data_correction', 'data_deletion', 'data_export',
  'account_security', 'billing', 'service_complaint', 'other',
];

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-red-100 text-red-700',
  acknowledged: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  escalated: 'border border-red-400 text-red-700',
};

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_id_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function GrievanceList() {
  const profile = getUserProfile();
  const role = (profile?.role || '').toString().toLowerCase();
  const isAdmin = ['admin', 'founder', 'owner'].includes(role);

  const [items, setItems] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchText, setSearchText] = useState('');

  const [pageKeys, setPageKeys] = useState<(object | null)[]>([null]); // history of start keys
  const [pageIndex, setPageIndex] = useState(0);
  const [nextKey, setNextKey] = useState<object | null>(null);

  const [selected, setSelected] = useState<Grievance | null>(null);
  const [drawerStatus, setDrawerStatus] = useState('');
  const [drawerNotes, setDrawerNotes] = useState('');
  const [drawerResolution, setDrawerResolution] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPage = useCallback(async (startKey: object | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (fromDate) params.set('fromDate', new Date(fromDate).toISOString());
      if (toDate) params.set('toDate', new Date(toDate + 'T23:59:59').toISOString());
      params.set('limit', '20');
      if (startKey) params.set('lastEvaluatedKey', JSON.stringify(startKey));

      const res = await fetch(`${API_BASE_URL}/admin/grievances?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setItems(data.items || []);
      setNextKey(data.lastEvaluatedKey || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load grievances');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, fromDate, toDate]);

  // Reset to first page whenever filters change.
  useEffect(() => {
    if (!isAdmin) return;
    setPageKeys([null]);
    setPageIndex(0);
    fetchPage(null);
  }, [isAdmin, fetchPage]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return items;
    return items.filter((g) =>
      g.name?.toLowerCase().includes(q) ||
      g.email?.toLowerCase().includes(q) ||
      g.trackingId?.toLowerCase().includes(q),
    );
  }, [items, searchText]);

  const openDrawer = (g: Grievance) => {
    setSelected(g);
    setDrawerStatus(g.status);
    setDrawerNotes(g.internalNotes || '');
    setDrawerResolution(g.resolutionNotes || '');
  };

  const closeDrawer = () => setSelected(null);

  const patchGrievance = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE_URL}/admin/grievances/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const applyUpdate = (updated: Grievance) => {
    setItems((prev) => prev.map((g) => (g.grievanceId === updated.grievanceId ? { ...g, ...updated } : g)));
    setSelected((prev) => (prev && prev.grievanceId === updated.grievanceId ? { ...prev, ...updated } : prev));
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await patchGrievance(selected.grievanceId, {
        status: drawerStatus,
        internalNotes: drawerNotes,
        resolutionNotes: drawerResolution,
      });
      applyUpdate(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!selected) return;
    // Optimistic update.
    const prevStatus = selected.status;
    setDrawerStatus('resolved');
    applyUpdate({ ...selected, status: 'resolved' });
    setSaving(true);
    try {
      const updated = await patchGrievance(selected.grievanceId, {
        status: 'resolved',
        resolutionNotes: drawerResolution,
        internalNotes: drawerNotes,
      });
      applyUpdate(updated);
    } catch (e) {
      // Revert on failure.
      setDrawerStatus(prevStatus);
      applyUpdate({ ...selected, status: prevStatus });
      setError(e instanceof Error ? e.message : 'Failed to mark resolved');
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (!nextKey) return;
    const newKeys = pageKeys.slice(0, pageIndex + 1);
    newKeys.push(nextKey);
    setPageKeys(newKeys);
    setPageIndex(pageIndex + 1);
    fetchPage(nextKey);
  };

  const goPrev = () => {
    if (pageIndex === 0) return;
    const target = pageKeys[pageIndex - 1];
    setPageIndex(pageIndex - 1);
    fetchPage(target);
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Access restricted</h1>
          <p className="mt-2 text-sm text-slate-600">Only founders/admins can view grievances.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Grievances</h1>
        <button
          onClick={() => fetchPage(pageKeys[pageIndex])}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search name/email/ID"
            className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Tracking ID</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No grievances found.</td></tr>
            ) : (
              filtered.map((g) => (
                <tr key={g.grievanceId} className="cursor-pointer hover:bg-slate-50" onClick={() => openDrawer(g)}>
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">{g.trackingId}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(g.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-800">{g.name}</td>
                  <td className="px-4 py-3 text-slate-600">{g.email}</td>
                  <td className="px-4 py-3 text-slate-600">{g.category}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[g.status] || 'bg-slate-100 text-slate-700'}`}>
                      {g.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={(e) => { e.stopPropagation(); openDrawer(g); }} className="text-blue-600 hover:underline">View</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-end gap-2 text-sm">
        <button onClick={goPrev} disabled={pageIndex === 0} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
        <span className="text-slate-500">Page {pageIndex + 1}</span>
        <button onClick={goNext} disabled={!nextKey} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={closeDrawer} />
          <div className="relative h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-mono text-lg font-bold text-slate-900">{selected.trackingId}</h2>
                <p className="text-xs text-slate-500">{formatDate(selected.createdAt)}</p>
              </div>
              <button onClick={closeDrawer} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="space-y-2 text-sm">
              <div><dt className="text-slate-500">Name</dt><dd className="text-slate-800">{selected.name}</dd></div>
              <div><dt className="text-slate-500">Email</dt><dd className="text-slate-800">{selected.email}</dd></div>
              <div><dt className="text-slate-500">Phone</dt><dd className="text-slate-800">{selected.phone || '—'}</dd></div>
              <div><dt className="text-slate-500">Category</dt><dd className="text-slate-800">{selected.category}</dd></div>
              <div><dt className="text-slate-500">Description</dt><dd className="whitespace-pre-wrap text-slate-800">{selected.description}</dd></div>
            </dl>

            <div className="mt-5">
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select value={drawerStatus} onChange={(e) => setDrawerStatus(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Internal notes</label>
              <textarea value={drawerNotes} onChange={(e) => setDrawerNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Resolution notes</label>
              <textarea value={drawerResolution} onChange={(e) => setDrawerResolution(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={handleMarkResolved} disabled={saving || selected.status === 'resolved'} className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
                Mark resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
