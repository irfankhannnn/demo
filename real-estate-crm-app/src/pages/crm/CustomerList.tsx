import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Plus,
  Eye,
  Phone,
  Mail,
  MapPin,
  IndianRupee,
  ArrowLeft,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMCustomer } from '../../types/crm';
import GlassDataTable, { Column } from '../../components/GlassDataTable';

export default function CustomerList() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CRMCustomer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CRMCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [customers, searchQuery, statusFilter, priorityFilter]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...customers];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.preferredArea?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter((c) => c.priority === priorityFilter);
    }

    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setFilteredCustomers(filtered);
  };

  const columns: Column<CRMCustomer>[] = [
    {
      key: 'name',
      header: 'Tenant',
      sortable: true,
      render: (customer) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-500/20">
            <span className="text-white font-semibold text-sm">
              {customer.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{customer.name}</p>
            {customer.email && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {customer.email}
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
      render: (customer) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-400" />
          <span>{customer.phone || '-'}</span>
        </div>
      ),
    },
    {
      key: 'preferredArea',
      header: 'Preferred Area',
      sortable: true,
      render: (customer) => customer.preferredArea ? (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-gray-400" />
          <span className="text-sm">{customer.preferredArea}</span>
        </div>
      ) : <span className="text-gray-400">-</span>,
    },
    {
      key: 'budget',
      header: 'Budget',
      sortable: true,
      render: (customer) => customer.budget > 0 ? (
        <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
          <IndianRupee className="h-4 w-4 text-gray-400" />
          {customer.budget.toLocaleString()}/mo
        </div>
      ) : <span className="text-gray-400">-</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (customer) => {
        const statusStyles: Record<string, string> = {
          active: 'bg-emerald-100 text-emerald-700',
          inactive: 'bg-gray-100 text-gray-600',
          closed: 'bg-red-100 text-red-700',
        };
        const dotStyles: Record<string, string> = {
          active: 'bg-emerald-500',
          inactive: 'bg-gray-400',
          closed: 'bg-red-500',
        };
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[customer.status] || 'bg-gray-100 text-gray-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotStyles[customer.status] || 'bg-gray-400'}`}></span>
            {customer.status}
          </span>
        );
      },
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (customer) => {
        const priorityStyles: Record<string, string> = {
          high: 'bg-red-100 text-red-700',
          medium: 'bg-amber-100 text-amber-700',
          low: 'bg-blue-100 text-blue-700',
        };
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${priorityStyles[customer.priority] || 'bg-gray-100 text-gray-600'}`}>
            {customer.priority}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '100px',
      render: (customer) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/crm/customers/${customer.customerId}`);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-lg hover:from-teal-600 hover:to-emerald-700 transition-all duration-200 shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 text-sm font-medium"
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="w-full px-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
        >
          <option value="all">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50">
      {/* Header */}
      <header className="glass-premium border-b border-white/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/crm')}
                className="p-2 hover:bg-white/50 rounded-xl transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-slate-500" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tenants</h1>
                  <p className="text-sm text-gray-500">{filteredCustomers.length} total</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={loadCustomers}
                disabled={loading}
                className="p-2.5 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white transition-all shadow-sm"
               aria-label="Refresh data">
                <RefreshCw className={`h-5 w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => navigate('/crm/customers/new')}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl hover:from-teal-600 hover:to-emerald-700 transition-all shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline font-medium">Add Tenant</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="glass-premium rounded-2xl p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/30 group-hover:scale-110 transition-transform">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
                <p className="text-xs text-gray-500">Total Tenants</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-2xl p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                <UserCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{customers.filter(c => c.status === 'active').length}</p>
                <p className="text-xs text-gray-500">Active</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-2xl p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 group-hover:scale-110 transition-transform">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{customers.filter(c => c.priority === 'high').length}</p>
                <p className="text-xs text-gray-500">High Priority</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-2xl p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center shadow-lg shadow-gray-500/30 group-hover:scale-110 transition-transform">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-600">{customers.filter(c => c.status === 'inactive').length}</p>
                <p className="text-xs text-gray-500">Inactive</p>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <GlassDataTable
          data={filteredCustomers}
          columns={columns}
          keyExtractor={(customer) => customer.customerId}
          onRowClick={(customer) => navigate(`/crm/customers/${customer.customerId}`)}
          searchPlaceholder="Search by name, phone, email, or area..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          loading={loading}
          emptyMessage={searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' ? 'No tenants match your search' : 'No tenants yet'}
          filters={filterContent}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
        />
      </main>
    </div>
  );
}
