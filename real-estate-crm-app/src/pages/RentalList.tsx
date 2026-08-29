import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Search,
  LogOut,
  Home,
  Users,
  CheckCircle,
  XCircle,
  Phone,
  ArrowUpDown,
  ChevronLeft,
  IndianRupee,
} from 'lucide-react';
import { api } from '../services/api';
import type { CRMProperty } from '../types/crm';
import { clearAuthSilently } from '../utils/authStorage';
import { redirectToLogout } from '../utils/cognitoAuth';

type SortField = 'title' | 'area' | 'ownerName' | 'tenantName' | 'rentAmount' | 'status';
type SortOrder = 'asc' | 'desc';

export default function RentalList() {
  const [properties, setProperties] = useState<CRMProperty[]>([]);
  const [filteredData, setFilteredData] = useState<CRMProperty[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAgreement, setFilterAgreement] = useState<'all' | 'done' | 'pending'>('all');
  const [filterVerification, setFilterVerification] = useState<'all' | 'done' | 'pending' | 'not_done'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    filterAndSortData();
  }, [properties, searchQuery, sortField, sortOrder, filterStatus, filterAgreement, filterVerification]);

  const loadProperties = async () => {
    try {
      const data = await api.getCRMPropertiesDetailed();
      setProperties(data);
    } catch (error) {
      console.error('Error loading properties:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortData = () => {
    let filtered = [...properties];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.area.toLowerCase().includes(query) ||
          item.city.toLowerCase().includes(query) ||
          (item.owner?.name || '').toLowerCase().includes(query) ||
          (item.tenant?.name || '').toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter((item) => item.status === filterStatus);
    }

    // Apply agreement filter
    if (filterAgreement !== 'all') {
      filtered = filtered.filter((item) =>
        filterAgreement === 'done' ? item.agreementStatus === 'done' : item.agreementStatus === 'pending'
      );
    }

    // Apply verification filter
    if (filterVerification !== 'all') {
      filtered = filtered.filter((item) => item.verificationStatus === filterVerification);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'title':
          aVal = a.title;
          bVal = b.title;
          break;
        case 'area':
          aVal = a.area;
          bVal = b.area;
          break;
        case 'ownerName':
          aVal = a.owner?.name || '';
          bVal = b.owner?.name || '';
          break;
        case 'tenantName':
          aVal = a.tenant?.name || '';
          bVal = b.tenant?.name || '';
          break;
        case 'rentAmount':
          aVal = a.rentAmount;
          bVal = b.rentAmount;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortOrder === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredData(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleLogout = () => {
    clearAuthSilently();
    redirectToLogout();
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      available: 'bg-emerald-100 text-emerald-800',
      'for-sale': 'bg-blue-100 text-blue-800',
      'for-rent': 'bg-yellow-100 text-yellow-800',
      rented: 'bg-indigo-100 text-indigo-800',
      sold: 'bg-red-100 text-red-800',
      'on-hold': 'bg-amber-100 text-amber-800',
      'out-of-stock': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading rental data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Property Rental List</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {filteredData.length} of {properties.length} properties
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, area, city, owner, or tenant..."
                className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="for-sale">For Sale</option>
              <option value="for-rent">For Rent</option>
              <option value="rented">Rented</option>
              <option value="sold">Sold</option>
              <option value="on-hold">On Hold</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
            <select
              value={filterAgreement}
              onChange={(e) => setFilterAgreement(e.target.value as 'all' | 'done' | 'pending')}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Agreements</option>
              <option value="done">Agreement Done</option>
              <option value="pending">Agreement Pending</option>
            </select>
            <select
              value={filterVerification}
              onChange={(e) => setFilterVerification(e.target.value as 'all' | 'done' | 'pending' | 'not_done')}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Verifications</option>
              <option value="done">Verification Done</option>
              <option value="pending">Verification Pending</option>
              <option value="not_done">Not Done</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-blue-700" onClick={() => handleSort('title')}>
                    <div className="flex items-center gap-2">
                      <Home className="w-4 h-4" />
                      Property
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-blue-700" onClick={() => handleSort('area')}>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Location
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-blue-700" onClick={() => handleSort('ownerName')}>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Owner
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-blue-700" onClick={() => handleSort('tenantName')}>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Tenant
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-blue-700" onClick={() => handleSort('rentAmount')}>
                    <div className="flex items-center gap-2">
                      <IndianRupee className="w-4 h-4" />
                      Rent
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-blue-700" onClick={() => handleSort('status')}>
                    Status
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                    Agreement
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                    Verification
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No properties found</p>
                      <p className="text-sm mt-1">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr
                      key={item.propertyId}
                      className={`hover:bg-blue-50 transition-colors cursor-pointer ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                      onClick={() => navigate(`/crm/properties/${item.propertyId}`)}
                    >
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{item.title}</div>
                          <div className="text-xs text-gray-500">{item.bhk} BHK • {item.propertyType}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          <div>
                            <span className="font-medium text-gray-900">{item.area}</span>
                            <span className="text-xs text-gray-500 block">{item.city}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{item.owner?.name || 'N/A'}</div>
                          {item.owner?.phone && (
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Phone className="w-3 h-3" />
                              {item.owner.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{item.tenant?.name || 'No Tenant'}</div>
                          {item.tenant?.phone && (
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Phone className="w-3 h-3" />
                              {item.tenant.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-gray-900">₹{item.rentAmount.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Deposit: ₹{item.depositAmount.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadge(item.status)}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {item.agreementStatus === 'done' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            <CheckCircle className="w-4 h-4" />
                            Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                            <XCircle className="w-4 h-4" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {item.verificationStatus === 'done' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            <CheckCircle className="w-4 h-4" />
                            Done
                          </span>
                        ) : item.verificationStatus === 'not_done' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            <XCircle className="w-4 h-4" />
                            Not Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                            <XCircle className="w-4 h-4" />
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats Footer */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <p className="text-sm text-gray-600 font-medium">Total Properties</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{filteredData.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <p className="text-sm text-gray-600 font-medium">Agreements Done</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {filteredData.filter((d) => d.agreementStatus === 'done').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <p className="text-sm text-gray-600 font-medium">Verifications Done</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {filteredData.filter((d) => d.verificationStatus === 'done').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <p className="text-sm text-gray-600 font-medium">Rented Properties</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              {filteredData.filter((d) => d.status === 'rented').length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
