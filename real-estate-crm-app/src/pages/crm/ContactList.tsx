import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Eye,
  Phone,
  Mail,
  MapPin,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  UserCheck,
  Home,
  ShoppingCart,
  Key,
  Tag,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMContact } from '../../types/crm';

type RoleFilter = 'all' | 'owner' | 'seller' | 'buyer' | 'tenant';

export default function ContactList() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [contacts, searchQuery, roleFilter, statusFilter]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await api.getContacts();
      setContacts(data);
    } catch (error) {
      console.error('Error loading contacts:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...contacts];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.address?.toLowerCase().includes(query)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter((c) => c.roles && c.roles[roleFilter] === true);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // Sort by updated date (most recent first)
    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    setFilteredContacts(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleBadges = (roles: CRMContact['roles']) => {
    const badges = [];
    if (roles?.owner) badges.push({ label: 'Owner', color: 'bg-blue-100 text-blue-800', icon: Home });
    if (roles?.seller) badges.push({ label: 'Seller', color: 'bg-purple-100 text-purple-800', icon: Tag });
    if (roles?.buyer) badges.push({ label: 'Buyer', color: 'bg-orange-100 text-orange-800', icon: ShoppingCart });
    if (roles?.tenant) badges.push({ label: 'Tenant', color: 'bg-teal-100 text-teal-800', icon: Key });
    return badges;
  };

  const getRoleCount = (role: RoleFilter) => {
    if (role === 'all') return contacts.length;
    return contacts.filter((c) => c.roles && c.roles[role] === true).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600 animate-pulse">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm')}
                className="p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">Contacts</h1>
                  <p className="text-xs sm:text-sm text-gray-500">{filteredContacts.length} contacts</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={loadContacts}
                className="p-2 sm:p-2.5 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white transition-all shadow-sm"
              >
                <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
              </button>
              <button
                onClick={() => navigate('/crm/contacts/new')}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 font-medium"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline text-sm">Add</span>
                <span className="sm:hidden text-sm">New</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Role Quick Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(['all', 'owner', 'seller', 'buyer', 'tenant'] as RoleFilter[]).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                roleFilter === role
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/30'
                  : 'bg-white/70 backdrop-blur-sm text-gray-700 border border-white/20 hover:bg-white/90'
              }`}
            >
              {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1)}s
              <span className="ml-1.5 text-xs opacity-75">({getRoleCount(role)})</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-xl p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Search */}
            <div className="sm:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, phone, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contact Cards */}
        {filteredContacts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 sm:p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'No contacts match your filters'
                : 'No contacts yet'}
            </p>
            {!searchQuery && roleFilter === 'all' && statusFilter === 'all' && (
              <button
                onClick={() => navigate('/crm/contacts/new')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Add Your First Contact
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredContacts.map((contact) => (
              <div
                key={contact.contactId}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/crm/contacts/${contact.contactId}`)}
              >
                <div className="p-4 sm:p-6">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 truncate">
                        {contact.name}
                      </h3>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          contact.status
                        )}`}
                      >
                        {contact.status}
                      </span>
                    </div>
                    <UserCheck className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                  </div>

                  {/* Role Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {getRoleBadges(contact.roles).map((badge) => (
                      <span
                        key={badge.label}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
                      >
                        <badge.icon className="h-3 w-3" />
                        {badge.label}
                      </span>
                    ))}
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{contact.phone}</span>
                    </div>
                    {contact.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.address && (
                      <div className="flex items-start text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{contact.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Source */}
                  {contact.source && (
                    <div className="text-xs text-gray-500 mb-3">
                      Source: {contact.source}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex space-x-2 pt-3 border-t">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/crm/contacts/${contact.contactId}`);
                      }}
                      className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 active:scale-95 text-sm"
                    >
                      <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>View Details</span>
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
