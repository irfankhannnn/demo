import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  Key,
  Search,
  Plus,
  Eye,
  Phone,
  Mail,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  MapPin,
  Calendar,
  Clock,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMCustomer } from '../../types/crm';

interface TenantWithMeeting extends CRMCustomer {
  nextMeeting?: {
    meetingId: string;
    scheduledAt: string;
    purpose: string;
  };
}

export default function TenantList() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantWithMeeting[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<TenantWithMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tenants, searchQuery, statusFilter, priorityFilter]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const [customersResult, upcomingMeetings] = await Promise.all([
        api.getCustomers(),
        api.getUpcomingMeetings(30),
      ]);

      // Backend returns { customers, total, limit, offset }
      const customers = Array.isArray(customersResult) ? customersResult : (customersResult.customers || []);

      // Attach next meeting to each tenant
      const tenantsWithMeetings = customers.map((customer: CRMCustomer) => {
        const nextMeeting = upcomingMeetings
          .filter((m: any) => m.entityType === 'customer' && m.entityId === customer.customerId)
          .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
        
        return {
          ...customer,
          nextMeeting: nextMeeting ? {
            meetingId: nextMeeting.meetingId,
            scheduledAt: nextMeeting.scheduledAt,
            purpose: nextMeeting.purpose,
          } : undefined,
        };
      });
      
      setTenants(tenantsWithMeetings);
    } catch (error) {
      console.error('Error loading tenants:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...tenants];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.phone?.includes(query) ||
          t.email?.toLowerCase().includes(query) ||
          t.preferredArea?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter((t) => t.priority === priorityFilter);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setFilteredTenants(filtered);
  };

  const formatMeetingDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days > 1 && days < 7) return `In ${days} days`;
    return date.toLocaleDateString();
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <LoadingSpinner message="Loading tenants..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50">
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
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/25 flex-shrink-0 animate-gentlePulse">
                  <Key className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight truncate">Tenants</h1>
                  <p className="text-xs sm:text-sm text-slate-400 font-semibold">{filteredTenants.length} tenants</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={loadTenants}
                className="p-2 sm:p-2.5 glass-premium border border-white/40 rounded-xl hover:bg-white/80 transition-all duration-200 shadow-sm"
               aria-label="Refresh data">
                <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
              </button>
              <button
                onClick={() => navigate('/crm/tenants/new')}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl hover:from-teal-600 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/30 btn-press font-semibold"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline text-sm">Add Tenant</span>
                <span className="sm:hidden text-sm">New</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 stagger-children">
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Key className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{tenants.length}</p>
                <p className="text-xs text-slate-400 font-semibold">Total Tenants</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-emerald-600 tracking-tight">
                  {tenants.filter(t => t.status === 'active').length}
                </p>
                <p className="text-xs text-slate-400 font-semibold">Active</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-orange-600 tracking-tight">
                  {tenants.filter(t => t.priority === 'high').length}
                </p>
                <p className="text-xs text-slate-400 font-semibold">High Priority</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-premium rounded-xl sm:rounded-2xl border border-white/40 shadow-xl p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tenants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm sm:text-base glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(20,184,166,0.10)] focus:border-teal-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
                />
              </div>
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2.5 text-sm sm:text-base glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(20,184,166,0.10)] focus:border-teal-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2.5 text-sm sm:text-base glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(20,184,166,0.10)] focus:border-teal-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
              >
                <option value="all">All Priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {filteredTenants.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 sm:p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {searchQuery || statusFilter !== 'all' ? 'No tenants match your filters' : 'No tenants yet'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button
                onClick={() => navigate('/crm/tenants/new')}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Add Your First Tenant
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredTenants.map((tenant) => (
              <div key={tenant.customerId} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 truncate">
                        {tenant.name}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        tenant.status === 'active' ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tenant.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {tenant.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{tenant.phone}</span>
                      </div>
                    )}
                    {tenant.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{tenant.email}</span>
                      </div>
                    )}
                    {tenant.preferredArea && (
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{tenant.preferredArea}</span>
                      </div>
                    )}
                    {tenant.priority && (
                      <div className="flex items-center text-sm">
                        <Clock className={`h-4 w-4 mr-2 flex-shrink-0 ${getPriorityColor(tenant.priority)}`} />
                        <span className={`truncate capitalize ${getPriorityColor(tenant.priority)}`}>{tenant.priority} Priority</span>
                      </div>
                    )}
                  </div>

                  {tenant.nextMeeting && (
                    <div className="mb-4 p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start">
                        <Calendar className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-blue-900">Next Meeting</p>
                          <p className="text-xs text-blue-700 truncate">{formatMeetingDate(tenant.nextMeeting.scheduledAt)}</p>
                          {tenant.nextMeeting.purpose && (
                            <p className="text-xs text-blue-600 truncate mt-0.5">{tenant.nextMeeting.purpose}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-3 border-t">
                    <button
                      onClick={() => navigate(`/crm/tenants/${tenant.customerId}`)}
                      className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 active:scale-95 text-sm"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
