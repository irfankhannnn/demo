import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Plus,
  Eye,
  Phone,
  Mail,
  ArrowLeft,
  RefreshCw,
  UserPlus,
  Home,
  ShoppingCart,
  Key,
  Tag,
  CheckCircle,
  Sparkles,
  BarChart3,
  Trash2,
  List,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMLead, LeadMetrics } from '../../types/crm';
import GlassDataTable, { Column } from '../../components/GlassDataTable';
import LeadDrawer from './LeadDrawer';
import Toast from '../../components/Toast';

type LeadTypeFilter = 'all' | 'buyer' | 'seller' | 'tenant' | 'owner';
type StatusFilter = 'all' | 'new' | 'contacted' | 'qualified' | 'negotiating' | 'converted' | 'lost';
type ViewMode = 'active' | 'converted' | 'all';

export default function LeadList() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<CRMLead[]>([]);
  const [metrics, setMetrics] = useState<LeadMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<LeadTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [showFilters, setShowFilters] = useState(false);
  
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [deleteLeadName, setDeleteLeadName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
  };

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [leads, searchQuery, typeFilter, statusFilter, viewMode]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const [leadsData, metricsData] = await Promise.all([
        api.getLeads(),
        api.getLeadMetrics(),
      ]);
      setLeads(leadsData);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Error loading leads:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...leads];

    // Apply view mode filter first
    if (viewMode === 'active') {
      filtered = filtered.filter((l) => !l.convertedAt);
    } else if (viewMode === 'converted') {
      filtered = filtered.filter((l) => !!l.convertedAt);
    }
    // 'all' shows everything, no filter needed

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.name.toLowerCase().includes(query) ||
          l.phone?.includes(query) ||
          l.email?.toLowerCase().includes(query)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((l) => l.leadType === typeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((l) => l.status === statusFilter);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setFilteredLeads(filtered);
  };

  const handleDeleteLead = async () => {
    if (!deleteLeadId) return;
    try {
      setDeleting(true);
      await api.deleteLead(deleteLeadId);
      setDeleteLeadId(null);
      setDeleteLeadName('');
      await loadLeads();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete lead', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'buyer': return ShoppingCart;
      case 'seller': return Tag;
      case 'tenant': return Key;
      case 'owner': return Home;
      default: return Target;
    }
  };

  const columns: Column<CRMLead>[] = [
    {
      key: 'name',
      header: 'Lead',
      sortable: true,
      render: (lead) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
            <span className="text-white font-semibold text-sm">
              {lead.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{lead.name}</p>
            {lead.email && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {lead.email}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      sortable: true,
      render: (lead) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-400" />
          <span>{lead.phone || '-'}</span>
        </div>
      ),
    },
    {
      key: 'leadType',
      header: 'Type',
      sortable: true,
      render: (lead) => {
        const typeStyles: Record<string, string> = {
          buyer: 'bg-orange-100 text-orange-700',
          seller: 'bg-purple-100 text-purple-700',
          tenant: 'bg-teal-100 text-teal-700',
          owner: 'bg-blue-100 text-blue-700',
        };
        const Icon = getTypeIcon(lead.leadType);
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${typeStyles[lead.leadType] || 'bg-gray-100 text-gray-700'}`}>
            <Icon className="h-3 w-3" />
            {lead.leadType}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (lead) => {
        const statusStyles: Record<string, string> = {
          new: 'bg-blue-100 text-blue-700',
          contacted: 'bg-yellow-100 text-yellow-700',
          qualified: 'bg-indigo-100 text-indigo-700',
          negotiating: 'bg-orange-100 text-orange-700',
          converted: 'bg-emerald-100 text-emerald-700',
          lost: 'bg-red-100 text-red-700',
        };
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[lead.status] || 'bg-gray-100 text-gray-600'}`}>
            {lead.status}
          </span>
        );
      },
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (lead) => {
        const priorityStyles: Record<string, string> = {
          high: 'bg-red-100 text-red-700',
          medium: 'bg-amber-100 text-amber-700',
          low: 'bg-blue-100 text-blue-700',
        };
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${priorityStyles[lead.priority] || 'bg-gray-100 text-gray-600'}`}>
            {lead.priority}
          </span>
        );
      },
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      render: (lead) => (
        <span className="text-sm text-gray-600">{lead.source || '-'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (lead) => (
        <span className="text-sm text-gray-500">
          {new Date(lead.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '140px',
      render: (lead) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedLeadId(lead.leadId); }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all text-xs font-medium shadow-md shadow-amber-500/20"
          >
            <Eye className="h-3 w-3" />
            View
          </button>
          {lead.convertedAt ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
              <CheckCircle className="h-3 w-3" />
              Converted
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteLeadId(lead.leadId); setDeleteLeadName(lead.name); }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-all text-xs font-medium"
              title="Delete lead"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const filterContent = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as LeadTypeFilter)}
          className="w-full px-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all"
        >
          <option value="all">All Types</option>
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
          <option value="tenant">Tenant</option>
          <option value="owner">Owner</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="w-full px-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all"
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="negotiating">Negotiating</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/crm')}
                className="p-2 hover:bg-white/50 rounded-xl transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Leads</h1>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={loadLeads}
                disabled={loading}
                className="p-2.5 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white transition-all shadow-sm"
               aria-label="Refresh data">
                <RefreshCw className={`h-5 w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => navigate('/crm/leads/new')}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline font-medium">Add Lead</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{metrics.total - (metrics.byStatus.converted || 0)}</p>
                  <p className="text-xs text-gray-500">Active Leads</p>
                </div>
              </div>
            </div>
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{metrics.byStatus.new}</p>
                  <p className="text-xs text-gray-500">New</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setViewMode(viewMode === 'converted' ? 'active' : 'converted')}
              className={`bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group cursor-pointer ${
                viewMode === 'converted' ? 'ring-2 ring-emerald-500 bg-emerald-50/40' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{metrics.byStatus.converted}</p>
                  <p className="text-xs text-gray-500">Converted</p>
                </div>
              </div>
            </button>
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{metrics.conversionRate}%</p>
                  <p className="text-xs text-gray-500">Conversion</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Type Quick Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(['all', 'buyer', 'seller', 'tenant', 'owner'] as LeadTypeFilter[]).map((type) => {
            const Icon = type === 'all' ? Target : getTypeIcon(type);
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  typeFilter === type
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-white/70 backdrop-blur-sm text-gray-700 border border-white/20 hover:bg-white/90'
                }`}
              >
                <Icon className="h-4 w-4" />
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            );
          })}
          <button
            onClick={() => setViewMode('converted')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              viewMode === 'converted'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-white/70 backdrop-blur-sm text-gray-700 border border-white/20 hover:bg-white/90'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            Converted
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              viewMode === 'all'
                ? 'bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-lg shadow-slate-500/30'
                : 'bg-white/70 backdrop-blur-sm text-gray-700 border border-white/20 hover:bg-white/90'
            }`}
          >
            <List className="h-4 w-4" />
            All
          </button>
        </div>

        {/* Data Table */}
        <GlassDataTable
          data={filteredLeads}
          columns={columns}
          keyExtractor={(lead) => lead.leadId}
          onRowClick={(lead) => setSelectedLeadId(lead.leadId)}
          searchPlaceholder="Search by name, phone, or email..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          loading={loading}
          emptyMessage={searchQuery || typeFilter !== 'all' || statusFilter !== 'all' ? 'No leads match your search' : 'No leads yet'}
          filters={filterContent}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
        />
      </main>

      {/* Lead Drawer */}
      {selectedLeadId && (
        <LeadDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdate={loadLeads}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteLeadId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Lead</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Are you sure you want to delete <strong>{deleteLeadName}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteLead}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => { setDeleteLeadId(null); setDeleteLeadName(''); }}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
