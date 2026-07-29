import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Target,
  Plus,
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
import { canManageLeads } from '../../utils/rbac';
import { isLeadConverted } from '../../utils/leadConversion';
import GlassDataTable, { Column } from '../../components/GlassDataTable';
import LeadDrawer from './LeadDrawer';
import LeadAssignmentDropdown, { TeamMember } from '../../components/LeadAssignmentDropdown';
import Toast from '../../components/Toast';
import { readFlashToast } from '../../utils/flashToast';

type LeadTypeFilter = 'all' | 'buyer' | 'seller' | 'tenant' | 'owner';
type StatusFilter = 'all' | 'new' | 'contacted' | 'qualified' | 'negotiating' | 'converted' | 'lost';
type AssignmentFilter = 'all' | 'my' | 'unassigned' | `agent:${string}`;
type ViewMode = 'active' | 'converted' | 'all';

const LEADS_PAGE_SIZE = 50;

export default function LeadList() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [totalLeads, setTotalLeads] = useState(0);
  const [pageOffset, setPageOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [deleteLeadName, setDeleteLeadName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const flash = readFlashToast(location.state);
    if (!flash) return;
    showToast(flash.message, flash.type);
    navigate(location.pathname + location.search, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    const delay = searchQuery.trim().length >= 2 ? 400 : 0;
    const timer = setTimeout(() => {
      loadLeads({ reset: true });
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, assignmentFilter, viewMode, searchQuery]);

  const buildLeadFilters = (offset: number) => {
    const profile = getUserProfile();
    const filters: Parameters<typeof api.getLeads>[0] = {
      limit: LEADS_PAGE_SIZE,
      offset,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    if (typeFilter !== 'all') filters.leadType = typeFilter;
    if (statusFilter !== 'all') filters.status = statusFilter;
    if (viewMode === 'active') filters.excludeConverted = true;
    if (viewMode === 'converted') filters.converted = true;
    if (searchQuery.trim().length >= 2) filters.search = searchQuery.trim();

    if (assignmentFilter === 'my') {
      const userId = profile?.userId || profile?.cognitoSub;
      if (userId) filters.assignedTo = userId;
    } else if (assignmentFilter === 'unassigned') {
      filters.unassigned = true;
    } else if (assignmentFilter.startsWith('agent:')) {
      filters.assignedTo = assignmentFilter.slice('agent:'.length);
    }

    return filters;
  };

  const loadLeads = async ({ reset = false, append = false }: { reset?: boolean; append?: boolean } = {}) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      // Converted leads are archived as immutable snapshots — not active LEAD rows
      if (viewMode === 'converted') {
        const [history, metricsData] = await Promise.all([
          api.getLeadConversionHistory({
            leadType: typeFilter !== 'all' ? typeFilter : undefined,
            search: searchQuery.trim().length >= 2 ? searchQuery.trim() : undefined,
          }),
          !append ? api.getLeadMetrics() : Promise.resolve(metrics),
        ]);
        const conversions = Array.isArray(history?.conversions) ? history.conversions : [];
        const mapped: CRMLead[] = conversions.map((snap: any) => {
          const source = snap.sourceLeadSnapshot?.lead || {};
          return {
            ...source,
            leadId: snap.leadId || source.leadId,
            leadType: snap.leadType || source.leadType,
            name: source.name || 'Converted lead',
            status: 'converted',
            convertedAt: snap.convertedAt,
            convertedTo: {
              entityType: snap.entityType,
              entityId: snap.entityId,
              role: snap.role,
            },
            createdAt: source.createdAt || snap.convertedAt,
            updatedAt: snap.convertedAt,
          } as CRMLead;
        });
        setLeads(mapped);
        setTotalLeads(history?.total ?? mapped.length);
        setPageOffset(0);
        if (!append) setMetrics(metricsData);
        return;
      }

      const offset = append ? pageOffset + LEADS_PAGE_SIZE : 0;
      const filters = buildLeadFilters(offset);
      // Active/all views never request converted=true from Lead store
      if (viewMode === 'active') filters.excludeConverted = true;

      const [leadsResult, metricsData, membersData] = await Promise.all([
        api.getLeads(filters),
        !append ? api.getLeadMetrics() : Promise.resolve(metrics),
        members.length ? Promise.resolve(members) : api.getLeadAgents().catch(() => []),
      ]);

      const nextLeads = leadsResult.leads;
      setLeads((prev) => (append ? [...prev, ...nextLeads] : nextLeads));
      setTotalLeads(leadsResult.total);
      setPageOffset(offset);
      if (!append) setMetrics(metricsData);
      if (!members.length) setMembers(Array.isArray(membersData) ? membersData : []);
    } catch (error) {
      console.error('Error loading leads:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'active') {
      setFilteredLeads(leads.filter((lead) => !isLeadConverted(lead)));
    } else if (viewMode === 'converted') {
      setFilteredLeads(leads.filter((lead) => isLeadConverted(lead)));
    } else {
      setFilteredLeads(leads);
    }
  }, [leads, viewMode]);

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setAssignmentFilter('all');
    setShowFilters(false);
    setPageOffset(0);
  };

  const handleAssignmentFilterChange = (value: string) => {
    setAssignmentFilter(value as AssignmentFilter);
    setPageOffset(0);
  };

  const hasMoreLeads = leads.length < totalLeads;

  const handleAssign = async (leadId: string, memberId: string | null) => {
    try {
      await api.updateLead(leadId, { assignedTo: memberId || null });
      await loadLeads({ reset: true });
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
      await loadLeads({ reset: true });
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
      width: '26%',
      render: (lead) => (
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/20">
              <span className="text-white font-semibold text-xs">
                {lead.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{lead.name}</p>
              {lead.email && (
                <p className="text-xs text-gray-500 truncate hidden 2xl:block">
                  {lead.email}
                </p>
              )}
            </div>
          </div>
          {canManageLeads() && !isLeadConverted(lead) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteLeadId(lead.leadId);
                setDeleteLeadName(lead.name);
              }}
              className="shrink-0 p-1 text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              title="Delete lead"
              aria-label={`Delete ${lead.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      sortable: true,
      width: '12%',
      className: 'hidden xl:table-cell',
      render: (lead) => (
        <span className="text-sm whitespace-nowrap">{lead.phone || '-'}</span>
      ),
    },
    {
      key: 'leadType',
      header: 'Type',
      sortable: true,
      width: '10%',
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
      width: '11%',
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
      width: '10%',
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
      header: 'Assigned',
      sortable: true,
      width: '14%',
      render: (lead) => (
        <div onClick={(e) => e.stopPropagation()}>
          <LeadAssignmentDropdown
            leadId={lead.leadId}
            assignedTo={lead.assignedTo}
            members={members}
            onAssign={handleAssign}
            disabled={isLeadConverted(lead)}
            compact
          />
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      width: '10%',
      className: 'hidden lg:table-cell',
      render: (lead) => (
        <span className="text-sm text-gray-600 truncate block">{lead.source || '-'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      width: '9%',
      render: (lead) => (
        <span className="text-sm text-gray-500 whitespace-nowrap">
          {new Date(lead.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const filterContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <label className="block text-sm font-bold text-slate-600 mb-1.5">Agent</label>
        <select
          value={assignmentFilter}
          onChange={(e) => handleAssignmentFilterChange(e.target.value)}
          className="w-full px-3 py-2.5 glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(245,158,11,0.10)] focus:border-amber-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
        >
          <option value="all">All Leads</option>
          <option value="my">My Leads</option>
          <option value="unassigned">Unassigned</option>
          {members.map((member) => (
            <option key={member.userId} value={`agent:${member.userId}`}>
              {member.label || member.username}
            </option>
          ))}
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
        <div className="w-full max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                onClick={() => loadLeads({ reset: true })}
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

      <main className="w-full max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
          onRowClick={(lead) => {
            if (viewMode === 'converted' && lead.convertedTo?.entityId) {
              const t = lead.convertedTo.entityType;
              if (t === 'buyer') navigate(`/crm/buyers/${lead.convertedTo.entityId}`);
              else if (t === 'tenant') navigate(`/crm/tenants/${lead.convertedTo.entityId}`);
              else if (t === 'owner' || t === 'seller') navigate(`/crm/owners/${lead.convertedTo.entityId}`);
              return;
            }
            setSelectedLeadId(lead.leadId);
          }}
          searchPlaceholder="Search by name, phone, or email..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          loading={loading}
          emptyMessage={searchQuery || typeFilter !== 'all' || statusFilter !== 'all' || assignmentFilter !== 'all' ? 'No leads match your search' : 'No leads yet'}
          filters={filterContent}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          tableFixed
          compact
        />

        {!loading && totalLeads > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-slate-500 font-medium">
              Showing {filteredLeads.length} of {totalLeads} leads
            </p>
            {hasMoreLeads && (
              <button
                type="button"
                onClick={() => loadLeads({ append: true })}
                disabled={loadingMore}
                className="px-4 py-2 rounded-xl text-sm font-semibold glass-premium border border-white/40 hover:bg-white/80 transition-all disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </main>

      {/* Lead Drawer */}
      {selectedLeadId && (
        <LeadDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdate={() => loadLeads({ reset: true })}
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
