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
import { getUserProfile } from '../../utils/authStorage';
import GlassDataTable, { Column } from '../../components/GlassDataTable';
import LeadDrawer from './LeadDrawer';
import LeadAssignmentDropdown, { TeamMember } from '../../components/LeadAssignmentDropdown';
import Toast from '../../components/Toast';

type LeadTypeFilter = 'all' | 'buyer' | 'seller' | 'tenant' | 'owner';
type StatusFilter = 'all' | 'new' | 'contacted' | 'qualified' | 'negotiating' | 'converted' | 'lost';
type AssignmentFilter = 'all' | 'my' | 'unassigned';
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
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [showFilters, setShowFilters] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  
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
  }, [leads, searchQuery, typeFilter, statusFilter, assignmentFilter, viewMode]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const [leadsData, metricsData, membersData] = await Promise.all([
        api.getLeads(),
        api.getLeadMetrics(),
        api.getLeadAgents().catch(() => []),
      ]);
      setLeads(leadsData);
      setMetrics(metricsData);
      setMembers(Array.isArray(membersData) ? membersData : []);
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

    const profile = getUserProfile();
    if (assignmentFilter !== 'all') {
      filtered = filtered.filter((l) => {
        if (assignmentFilter === 'unassigned') return !l.assignedTo;
        if (assignmentFilter === 'my') return l.assignedTo === profile?.userId || l.assignedTo === profile?.cognitoSub;
        return true;
      });
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setFilteredLeads(filtered);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setAssignmentFilter('all');
    setShowFilters(false);
  };

  const handleAssign = async (leadId: string, memberId: string | null) => {
    try {
      await api.updateLead(leadId, { assignedTo: memberId || null });
      await loadLeads();
    } catch (error) {
      console.error('Error assigning lead:', error);
      showToast(error instanceof Error ? error.message : 'Failed to assign lead', 'error');
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    if (viewMode === mode) {
      resetFilters();
    } else {
      setViewMode(mode);
    }
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
          buyer: 'bg-orange-50/80 text-orange-700 ring-1 ring-orange-200',
          seller: 'bg-purple-50/80 text-purple-700 ring-1 ring-purple-200',
          tenant: 'bg-teal-50/80 text-teal-700 ring-1 ring-teal-200',
          owner: 'bg-blue-50/80 text-blue-700 ring-1 ring-blue-200',
        };
        const Icon = getTypeIcon(lead.leadType);
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${typeStyles[lead.leadType] || 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'}`}>
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
          new: 'bg-blue-50/80 text-blue-700 ring-1 ring-blue-200',
          contacted: 'bg-amber-50/80 text-amber-700 ring-1 ring-amber-200',
          qualified: 'bg-indigo-50/80 text-indigo-700 ring-1 ring-indigo-200',
          negotiating: 'bg-orange-50/80 text-orange-700 ring-1 ring-orange-200',
          converted: 'bg-emerald-50/80 text-emerald-700 ring-1 ring-emerald-200',
          lost: 'bg-rose-50/80 text-rose-700 ring-1 ring-rose-200',
        };
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusStyles[lead.status] || 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'}`}>
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
          high: 'bg-rose-50/80 text-rose-700 ring-1 ring-rose-200',
          medium: 'bg-amber-50/80 text-amber-700 ring-1 ring-amber-200',
          low: 'bg-blue-50/80 text-blue-700 ring-1 ring-blue-200',
        };
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${priorityStyles[lead.priority] || 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'}`}>
            {lead.priority}
          </span>
        );
      },
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      sortable: true,
      render: (lead) => (
        <div onClick={(e) => e.stopPropagation()}>
          <LeadAssignmentDropdown
            leadId={lead.leadId}
            assignedTo={lead.assignedTo}
            members={members}
            onAssign={handleAssign}
            disabled={lead.convertedAt ? true : false}
          />
        </div>
      ),
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
            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all duration-200 text-xs font-bold shadow-sm shadow-amber-500/15 btn-press"
          >
            <Eye className="h-3 w-3" />
            View
          </button>
          {lead.convertedAt ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50/80 text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle className="h-3 w-3" />
              Converted
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteLeadId(lead.leadId); setDeleteLeadName(lead.name); }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50/80 text-rose-600 ring-1 ring-rose-200 rounded-lg hover:bg-rose-100 transition-all text-xs font-bold btn-press"
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
        <label className="block text-sm font-bold text-slate-600 mb-1.5">Type</label>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as LeadTypeFilter)}
          className="w-full px-3 py-2.5 glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(245,158,11,0.10)] focus:border-amber-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
        >
          <option value="all">All Types</option>
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
          <option value="tenant">Tenant</option>
          <option value="owner">Owner</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-600 mb-1.5">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="w-full px-3 py-2.5 glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(245,158,11,0.10)] focus:border-amber-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
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
      <div>
        <label className="block text-sm font-bold text-slate-600 mb-1.5">Assigned</label>
        <select
          value={assignmentFilter}
          onChange={(e) => setAssignmentFilter(e.target.value as AssignmentFilter)}
          className="w-full px-3 py-2.5 glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(245,158,11,0.10)] focus:border-amber-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
        >
          <option value="all">All Leads</option>
          <option value="my">My Leads</option>
          <option value="unassigned">Unassigned</option>
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
      <header className="glass-premium border-b border-white/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/crm')}
                className="p-2 hover:bg-white/60 rounded-xl transition-all duration-200"
              >
                <ArrowLeft className="h-5 w-5 text-slate-500" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25 animate-gentlePulse">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Leads</h1>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={loadLeads}
                disabled={loading}
                className="p-2.5 glass-premium border border-white/40 rounded-xl hover:bg-white/80 transition-all duration-200 shadow-sm"
               aria-label="Refresh data">
                <RefreshCw className={`h-5 w-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => navigate('/crm/leads/new')}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all duration-300 shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 btn-press font-semibold"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">Add Lead</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 stagger-children">
            <div className="glass-premium rounded-2xl p-4 card-lift group">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 tracking-tight">{metrics.total - (metrics.byStatus.converted || 0)}</p>
                  <p className="text-xs text-slate-400 font-semibold">Active Leads</p>
                </div>
              </div>
            </div>
            <div className="glass-premium rounded-2xl p-4 card-lift group">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600 tracking-tight">{metrics.byStatus.new}</p>
                  <p className="text-xs text-slate-400 font-semibold">New</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => handleViewModeChange('converted')}
              className={`glass-premium rounded-2xl p-4 card-lift group cursor-pointer text-left transition-all duration-200 ${
                viewMode === 'converted' ? 'ring-2 ring-emerald-400/60 bg-emerald-50/40' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600 tracking-tight">{metrics.byStatus.converted}</p>
                  <p className="text-xs text-slate-400 font-semibold">Converted</p>
                </div>
              </div>
            </button>
            <div className="glass-premium rounded-2xl p-4 card-lift group">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600 tracking-tight">{metrics.conversionRate}%</p>
                  <p className="text-xs text-slate-400 font-semibold">Conversion</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Type Quick Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {(['all', 'buyer', 'seller', 'tenant', 'owner'] as LeadTypeFilter[]).map((type) => {
            const Icon = type === 'all' ? Target : getTypeIcon(type);
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 btn-press ${
                  typeFilter === type
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20'
                    : 'glass-premium text-slate-600 border border-white/40 hover:bg-white/80'
                }`}
              >
                <Icon className="h-4 w-4" />
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            );
          })}
          <button
            onClick={() => handleViewModeChange('active')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 btn-press ${
              viewMode === 'active'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20'
                : 'glass-premium text-slate-600 border border-white/40 hover:bg-white/80'
            }`}
          >
            <Target className="h-4 w-4" />
            Active
          </button>
          <button
            onClick={() => handleViewModeChange('converted')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 btn-press ${
              viewMode === 'converted'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                : 'glass-premium text-slate-600 border border-white/40 hover:bg-white/80'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            Converted
          </button>
          <button
            onClick={() => handleViewModeChange('all')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 btn-press ${
              viewMode === 'all'
                ? 'bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-lg shadow-slate-500/20'
                : 'glass-premium text-slate-600 border border-white/40 hover:bg-white/80'
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
          emptyMessage={searchQuery || typeFilter !== 'all' || statusFilter !== 'all' || assignmentFilter !== 'all' ? 'No leads match your search' : 'No leads yet'}
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeInUp">
          <div className="glass-premium rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-white/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Delete Lead</h3>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-6 font-medium">
              Are you sure you want to delete <strong className="text-slate-900">{deleteLeadName}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteLead}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-xl hover:from-rose-600 hover:to-red-700 disabled:opacity-50 font-bold transition-all duration-200 btn-press shadow-lg shadow-rose-500/15"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => { setDeleteLeadId(null); setDeleteLeadName(''); }}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-white/40 text-slate-700 rounded-xl hover:bg-white/80 disabled:opacity-50 font-bold transition-all duration-200"
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
