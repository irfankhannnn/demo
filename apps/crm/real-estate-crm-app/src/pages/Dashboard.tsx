import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  LogOut,
  Users,
  List,
  Settings,
  TrendingUp,
  Home,
  FileCheck,
  ChevronRight,
  MessageSquare,
  Phone,
  Mail,
} from 'lucide-react';
import { api } from '../services/api';
import type { CRMMetrics, CRMProperty } from '../types/crm';

interface DashboardEnquiry {
  enquiryId: string;
  formType: 'contact' | 'consultation';
  name: string;
  email?: string;
  phone: string;
  status: 'new' | 'contacted' | 'converted' | 'closed';
  source: string;
  createdAt: string;
}

interface EnquiryMetrics {
  total: number;
  new: number;
  contacted: number;
  converted: number;
  closed: number;
  byFormType: {
    contact: number;
    consultation: number;
  };
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<CRMMetrics | null>(null);
  const [properties, setProperties] = useState<CRMProperty[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<CRMProperty[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [enquiryMetrics, setEnquiryMetrics] = useState<EnquiryMetrics | null>(null);
  const [recentEnquiries, setRecentEnquiries] = useState<DashboardEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, statusFilter, properties]);

  const loadData = async () => {
    try {
      const [metricsData, propertiesData, enquiryMetricsData, enquiriesDataRaw] =
        await Promise.all([
          api.getCRMMetrics(),
          api.getCRMPropertiesDetailed(),
          api.getEnquiryMetrics(),
          api.getEnquiries(),
        ]);
      setMetrics(metricsData);
      setProperties(propertiesData);
      setFilteredProperties(propertiesData);
      setEnquiryMetrics(enquiryMetricsData);

      const enquiries = (enquiriesDataRaw || []) as DashboardEnquiry[];
      const sortedRecent = [...enquiries].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );
      setRecentEnquiries(sortedRecent.slice(0, 5));
    } catch (error) {
      console.error('Error loading data:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const query = searchQuery.trim().toLowerCase();

    let filtered = properties;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    // Filter by search query
    if (query) {
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.area.toLowerCase().includes(query) ||
          p.city.toLowerCase().includes(query) ||
          (p.owner?.name || '').toLowerCase().includes(query)
      );
    }

    setFilteredProperties(filtered);
  };

  const handleLogout = () => {
    api.clearToken();
    navigate('/login');
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      available: 'bg-green-100 text-green-800',
      on_hold: 'bg-yellow-100 text-yellow-800',
      out_of_stock: 'bg-gray-100 text-gray-800',
      rented: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getAgreementBadge = (status: string) => {
    return status === 'done'
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800';
  };

  const getVerificationBadge = (status: string) => {
    const colors: Record<string, string> = {
      done: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      not_done: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getEnquiryStatusBadge = (status: DashboardEnquiry['status']) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'converted':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatEnquiryDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Real Estate CRM</h1>
              <p className="text-sm text-gray-500 mt-1">Property Management Dashboard</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Quick Actions */}
        <div className="mb-6 flex flex-wrap gap-4">
          <button
            onClick={() => navigate('/rental-list')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            <List className="w-5 h-5" />
            Rental List
          </button>
          <button
            onClick={() => navigate('/crm/customers')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            <Users className="w-5 h-5" />
            Customers
          </button>
          <button
            onClick={() => navigate('/crm/owners')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg hover:from-orange-700 hover:to-amber-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            <Users className="w-5 h-5" />
            Owners
          </button>
          <button
            onClick={() => navigate('/crm/properties')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            <Home className="w-5 h-5" />
            Properties
          </button>
        </div>

        {/* CRM Metrics Dashboard */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/crm/properties')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Properties</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.totalProperties}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {metrics.availableProperties} available • {metrics.rentedProperties} rented
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/crm/owners')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Owners</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.totalOwners}</p>
                  <p className="text-xs text-gray-500 mt-1">{metrics.activeOwners} active</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/crm/customers')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Customers</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.totalCustomers}</p>
                  <p className="text-xs text-gray-500 mt-1">{metrics.activeCustomers} active</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Agreements & Verification</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm">
                      <span className="font-semibold text-green-600">{metrics.agreementsDone}</span>
                      <span className="text-gray-500"> / {metrics.agreementsDone + metrics.agreementsPending} agreements</span>
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold text-green-600">{metrics.verificationsDone}</span>
                      <span className="text-gray-500"> / {metrics.verificationsDone + metrics.verificationsPending} verified</span>
                    </p>
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileCheck className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {enquiryMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
            <div
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate('/crm/enquiries')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Enquiries</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{enquiryMetrics.total}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {enquiryMetrics.byFormType.contact} contact  b7 {enquiryMetrics.byFormType.consultation} consultation
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl shadow-sm p-6 border border-blue-100">
              <p className="text-sm font-medium text-blue-600">New</p>
              <p className="text-3xl font-bold text-blue-700 mt-2">{enquiryMetrics.new}</p>
            </div>

            <div className="bg-yellow-50 rounded-xl shadow-sm p-6 border border-yellow-100">
              <p className="text-sm font-medium text-yellow-600">Contacted</p>
              <p className="text-3xl font-bold text-yellow-700 mt-2">{enquiryMetrics.contacted}</p>
            </div>

            <div className="bg-green-50 rounded-xl shadow-sm p-6 border border-green-100">
              <p className="text-sm font-medium text-green-600">Converted</p>
              <p className="text-3xl font-bold text-green-700 mt-2">{enquiryMetrics.converted}</p>
            </div>

            <div className="bg-gray-50 rounded-xl shadow-sm p-6 border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Closed</p>
              <p className="text-3xl font-bold text-gray-700 mt-2">{enquiryMetrics.closed}</p>
            </div>
          </div>
        )}

        {recentEnquiries.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                Recent Enquiries
              </h2>
              <button
                onClick={() => navigate('/crm/enquiries')}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                View All
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Received
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentEnquiries.map((enquiry) => (
                    <tr
                      key={enquiry.enquiryId}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate('/crm/enquiries')}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">{enquiry.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4 text-gray-400" />
                            {enquiry.phone}
                          </span>
                          {enquiry.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-4 h-4 text-gray-400" />
                              {enquiry.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 capitalize">
                        {enquiry.formType}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getEnquiryStatusBadge(
                            enquiry.status,
                          )}`}
                        >
                          {enquiry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatEnquiryDate(enquiry.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{enquiry.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search properties by title, area, city, or owner..."
                className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="on_hold">On Hold</option>
              <option value="rented">Rented</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Properties List */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-purple-600" />
              Properties ({filteredProperties.length})
            </h2>
            <button
              onClick={() => navigate('/crm/properties/new')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <TrendingUp className="w-5 h-5" />
              Add Property
            </button>
          </div>

          {filteredProperties.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agreement</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verification</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProperties.slice(0, 10).map((property) => (
                    <tr key={property.propertyId} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{property.title}</p>
                          <p className="text-sm text-gray-500">{property.area}, {property.city}</p>
                          <p className="text-xs text-gray-400">{property.bhk} BHK • {property.propertyType}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-900">{property.owner?.name || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{property.owner?.phone || ''}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-gray-900">₹{property.rentAmount.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">Deposit: ₹{property.depositAmount.toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(property.status)}`}>
                          {(property.status || 'unknown').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAgreementBadge(property.agreementStatus)}`}>
                          {property.agreementStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getVerificationBadge(property.verificationStatus)}`}>
                          {(property.verificationStatus || 'not_set').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => navigate(`/crm/properties/${property.propertyId}`)}
                          className="text-purple-600 hover:text-purple-800 font-medium text-sm flex items-center gap-1"
                        >
                          View <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProperties.length > 10 && (
                <div className="text-center py-4">
                  <button
                    onClick={() => navigate('/rental-list')}
                    className="text-purple-600 hover:text-purple-800 font-medium"
                  >
                    View All {filteredProperties.length} Properties →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No properties found</p>
              <button
                onClick={() => navigate('/crm/properties/new')}
                className="mt-4 text-purple-600 hover:text-purple-800 font-medium"
              >
                Add your first property
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
