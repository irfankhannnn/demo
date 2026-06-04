import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Plus,
  Eye,
  Phone,
  Mail,
  ArrowLeft,
  RefreshCw,
  Calendar,
  Home as HomeIcon,
  Users,
  UserCheck,
  Building,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMOwner } from '../../types/crm';
import GlassDataTable, { Column } from '../../components/GlassDataTable';

interface OwnerWithMeeting extends CRMOwner {
  nextMeeting?: {
    meetingId: string;
    meetingDate: string;
    meetingTime: string;
    title: string;
  };
  propertyCount?: number;
}

export default function OwnerList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sellersOnly = searchParams.get('sellers') === '1';
  const [owners, setOwners] = useState<OwnerWithMeeting[]>([]);
  const [filteredOwners, setFilteredOwners] = useState<OwnerWithMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadOwners();
  }, [sellersOnly]);

  useEffect(() => {
    applyFilters();
  }, [owners, searchQuery, statusFilter]);

  const loadOwners = async () => {
    try {
      setLoading(true);
      const [ownersData, upcomingMeetings] = await Promise.all([
        api.getOwners(),
        api.getUpcomingMeetings(30),
      ]);

      const properties = sellersOnly ? await api.getCRMProperties('for-sale') : [];
      const sellerOwnerIds = sellersOnly
        ? new Set((Array.isArray(properties) ? properties : []).map((p: any) => p.ownerId).filter(Boolean))
        : null;

      const ownersWithMeetings = ownersData
        .filter((owner: CRMOwner) => (!sellersOnly ? true : sellerOwnerIds?.has(owner.ownerId)))
        .map((owner: CRMOwner) => {
          const nextMeeting = upcomingMeetings
            .filter((m: any) => m.relatedEntityType === 'owner' && m.relatedEntityId === owner.ownerId)
            .sort((a: any, b: any) => new Date(`${a.meetingDate} ${a.meetingTime}`).getTime() - new Date(`${b.meetingDate} ${b.meetingTime}`).getTime())[0];

          return {
            ...owner,
            nextMeeting: nextMeeting ? {
              meetingId: nextMeeting.meetingId,
              meetingDate: nextMeeting.meetingDate,
              meetingTime: nextMeeting.meetingTime,
              title: nextMeeting.title,
            } : undefined,
          };
        });

      setOwners(ownersWithMeetings);
    } catch (error) {
      console.error('Error loading owners:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...owners];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.name.toLowerCase().includes(query) ||
          o.phone?.includes(query) ||
          o.email?.toLowerCase().includes(query) ||
          o.address?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setFilteredOwners(filtered);
  };

  const formatMeetingDate = (dateString: string, timeString: string) => {
    const meetingDateTime = new Date(`${dateString} ${timeString}`);
    const now = new Date();
    const diff = meetingDateTime.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days > 1 && days < 7) return `In ${days} days`;
    return meetingDateTime.toLocaleDateString();
  };

  const columns: Column<OwnerWithMeeting>[] = [
    {
      key: 'name',
      header: 'Owner',
      sortable: true,
      render: (owner) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
            <span className="text-white font-semibold text-sm">
              {owner.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{owner.name}</p>
            {owner.email && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {owner.email}
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
      render: (owner) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-400" />
          <span>{owner.phone || '-'}</span>
        </div>
      ),
    },
    {
      key: 'propertyCount',
      header: 'Properties',
      sortable: true,
      render: (owner) => (
        <div className="flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            (owner.propertyCount || 0) > 0
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            <HomeIcon className="h-3 w-3 inline mr-1" />
            {owner.propertyCount || 0}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (owner) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          owner.status === 'active'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-gray-100 text-gray-600'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            owner.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'
          }`}></span>
          {owner.status}
        </span>
      ),
    },
    {
      key: 'nextMeeting',
      header: 'Next Meeting',
      render: (owner) => owner.nextMeeting ? (
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="h-4 w-4 text-blue-500" />
          <span className="text-blue-600 font-medium">
            {formatMeetingDate(owner.nextMeeting.meetingDate, owner.nextMeeting.meetingTime)}
          </span>
        </div>
      ) : (
        <span className="text-gray-400 text-xs">-</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '100px',
      render: (owner) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/crm/owners/${owner.ownerId}`);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 text-sm font-medium"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
      ),
    },
  ];

  const filterContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-bold text-slate-600 mb-1.5">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2.5 glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(59,130,246,0.10)] focus:border-blue-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="glass-premium border-b border-white/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm')}
                className="p-1.5 sm:p-2 hover:bg-white/60 rounded-xl transition-all duration-200 flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-slate-500" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0 animate-gentlePulse">
                  <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight truncate">{sellersOnly ? 'Sellers' : 'Owners'}</h1>
                  <p className="text-xs sm:text-sm text-slate-400 font-semibold">{filteredOwners.length} total</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={loadOwners}
                disabled={loading}
                className="p-2 sm:p-2.5 glass-premium border border-white/40 rounded-xl hover:bg-white/80 transition-all duration-200 shadow-sm"
               aria-label="Refresh data">
                <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => navigate('/crm/owners/new')}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 btn-press font-semibold"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline text-sm sm:text-base">Add Owner</span>
                <span className="sm:hidden text-sm">New</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 stagger-children">
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{owners.length}</p>
                <p className="text-xs text-slate-400 font-semibold">Total Owners</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-emerald-600 tracking-tight">{owners.filter(o => o.status === 'active').length}</p>
                <p className="text-xs text-slate-400 font-semibold">Active</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Building className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-purple-600 tracking-tight">{owners.filter(o => (o.propertyCount || 0) > 0).length}</p>
                <p className="text-xs text-slate-400 font-semibold">With Properties</p>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <GlassDataTable
          data={filteredOwners}
          columns={columns}
          keyExtractor={(owner) => owner.ownerId}
          onRowClick={(owner) => navigate(`/crm/owners/${owner.ownerId}`)}
          searchPlaceholder="Search by name, phone, email, or address..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          loading={loading}
          emptyMessage={searchQuery || statusFilter !== 'all' ? 'No owners match your search' : 'No owners yet'}
          filters={filterContent}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
        />
      </main>
    </div>
  );
}
