import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  Eye,
  Phone,
  Mail,
  ArrowLeft,
  RefreshCw,
  IndianRupee,
  MapPin,
  Key,
  Building2,
  UserCheck,
  Users,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMContact } from '../../types/crm';
import GlassDataTable, { Column } from '../../components/GlassDataTable';

export default function BuyerList() {
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<CRMContact[]>([]);
  const [filteredBuyers, setFilteredBuyers] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadBuyers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [buyers, searchQuery, statusFilter]);

  const loadBuyers = async () => {
    try {
      setLoading(true);
      const contacts = await api.getContactsByRole('buyer');
      setBuyers(contacts);
    } catch (error) {
      console.error('Error loading buyers:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...buyers];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.phone?.includes(query) ||
          b.email?.toLowerCase().includes(query) ||
          b.buyerProfile?.preferredArea?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setFilteredBuyers(filtered);
  };

  const columns: Column<CRMContact>[] = [
    {
      key: 'name',
      header: 'Buyer',
      sortable: true,
      render: (buyer) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20">
            <span className="text-white font-semibold text-sm">
              {buyer.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{buyer.name}</p>
            {buyer.email && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {buyer.email}
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
      render: (buyer) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-400" />
          <span>{buyer.phone || '-'}</span>
        </div>
      ),
    },
    {
      key: 'preferredArea',
      header: 'Preferred Area',
      sortable: true,
      render: (buyer) => buyer.buyerProfile?.preferredArea ? (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-gray-400" />
          <span className="text-sm">{buyer.buyerProfile.preferredArea}</span>
        </div>
      ) : <span className="text-gray-400">-</span>,
    },
    {
      key: 'budget',
      header: 'Budget',
      sortable: true,
      render: (buyer) => buyer.buyerProfile?.budget && buyer.buyerProfile.budget > 0 ? (
        <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
          <IndianRupee className="h-4 w-4 text-gray-400" />
          ₹{(buyer.buyerProfile.budget / 10000000).toFixed(2)} Cr
        </div>
      ) : <span className="text-gray-400">-</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (buyer) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          buyer.status === 'active'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-gray-100 text-gray-600'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            buyer.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'
          }`}></span>
          {buyer.status}
        </span>
      ),
    },
    {
      key: 'roles',
      header: 'Other Roles',
      render: (buyer) => {
        const otherRoles = [];
        if (buyer.roles.owner) otherRoles.push({ label: 'Owner', icon: Building2, color: 'bg-blue-100 text-blue-700' });
        if (buyer.roles.tenant) otherRoles.push({ label: 'Tenant', icon: Key, color: 'bg-teal-100 text-teal-700' });
        return otherRoles.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {otherRoles.map((role) => (
              <span key={role.label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${role.color}`}>
                <role.icon className="h-3 w-3" />
                {role.label}
              </span>
            ))}
          </div>
        ) : <span className="text-gray-400">-</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '100px',
      render: (buyer) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/crm/buyers/${buyer.contactId}`);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg hover:from-orange-600 hover:to-amber-700 transition-all duration-200 shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 text-sm font-medium"
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
          className="w-full px-3 py-2.5 glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(249,115,22,0.10)] focus:border-orange-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50">
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
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/25 flex-shrink-0 animate-gentlePulse">
                  <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight truncate">Buyers</h1>
                  <p className="text-xs sm:text-sm text-slate-400 font-semibold">{filteredBuyers.length} total</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={loadBuyers}
                disabled={loading}
                className="p-2 sm:p-2.5 glass-premium border border-white/40 rounded-xl hover:bg-white/80 transition-all duration-200 shadow-sm"
               aria-label="Refresh data">
                <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => navigate('/crm/buyers/new')}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl hover:from-orange-600 hover:to-amber-700 transition-all duration-300 shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 btn-press font-semibold"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline text-sm sm:text-base">Add Buyer</span>
                <span className="sm:hidden text-sm">New</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 stagger-children">
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{buyers.length}</p>
                <p className="text-xs text-slate-400 font-semibold">Total Buyers</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-emerald-600 tracking-tight">{buyers.filter(b => b.status === 'active').length}</p>
                <p className="text-xs text-slate-400 font-semibold">Active</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-purple-600 tracking-tight">{buyers.filter(b => b.roles.owner || b.roles.tenant).length}</p>
                <p className="text-xs text-slate-400 font-semibold">Multi-Role</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-amber-600 tracking-tight">{buyers.filter(b => b.buyerProfile?.budget).length}</p>
                <p className="text-xs text-slate-400 font-semibold">With Budget</p>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <GlassDataTable
          data={filteredBuyers}
          columns={columns}
          keyExtractor={(buyer) => buyer.contactId}
          onRowClick={(buyer) => navigate(`/crm/buyers/${buyer.contactId}`)}
          searchPlaceholder="Search by name, phone, email, or area..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          loading={loading}
          emptyMessage={searchQuery || statusFilter !== 'all' ? 'No buyers match your search' : 'No buyers yet'}
          filters={filterContent}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
        />
      </main>
    </div>
  );
}
