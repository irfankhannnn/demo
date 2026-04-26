import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  ArrowLeft,
  Building2,
  User,
  Users,
  MapPin,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  ShieldCheck,
  Calendar,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMProperty } from '../../types/crm';

// Helper function to calculate agreement expiry date
const calculateExpiryDate = (moveInDate?: string, tenureMonths?: number): string | null => {
  if (!moveInDate || !tenureMonths) return null;
  const date = new Date(moveInDate);
  date.setMonth(date.getMonth() + tenureMonths);
  return date.toISOString().split('T')[0];
};

// Helper function to get days until expiry
const getDaysUntilExpiry = (expiryDate: string | null): number | null => {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

type ExpiryFilter = 'all' | 'expired' | '1week' | '2weeks' | '1month' | '2months' | '3months';

export default function RentedProperties() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<CRMProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('all');
  const [agreementFilter, setAgreementFilter] = useState<string>('all');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadRentedProperties();
  }, []);

  const loadRentedProperties = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCRMProperties('rented');
      setProperties(data);
    } catch (err) {
      console.error('Failed to load rented properties:', err);
      setError(err instanceof Error ? err.message : 'Failed to load properties');
      if (err instanceof Error && err.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Get unique areas for filter dropdown
  const uniqueAreas = useMemo(() => {
    const areas = new Set(properties.map(p => p.area).filter(Boolean));
    return Array.from(areas).sort();
  }, [properties]);

  // Filter and sort properties
  const filteredProperties = useMemo(() => {
    return properties.filter(property => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          property.title?.toLowerCase().includes(search) ||
          property.area?.toLowerCase().includes(search) ||
          property.buildingName?.toLowerCase().includes(search) ||
          property.flatNumber?.toLowerCase().includes(search) ||
          property.owner?.name?.toLowerCase().includes(search) ||
          property.tenant?.name?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Area filter
      if (areaFilter !== 'all' && property.area !== areaFilter) return false;

      // Agreement status filter
      if (agreementFilter !== 'all' && property.agreementStatus !== agreementFilter) return false;

      // Verification status filter
      if (verificationFilter !== 'all' && property.verificationStatus !== verificationFilter) return false;

      // Expiry filter
      if (expiryFilter !== 'all') {
        const expiryDate = calculateExpiryDate(property.tenantMoveInDate, property.tenureMonths);
        const daysUntilExpiry = getDaysUntilExpiry(expiryDate);
        
        if (daysUntilExpiry === null) return false;
        
        switch (expiryFilter) {
          case 'expired':
            if (daysUntilExpiry >= 0) return false;
            break;
          case '1week':
            if (daysUntilExpiry < 0 || daysUntilExpiry > 7) return false;
            break;
          case '2weeks':
            if (daysUntilExpiry < 0 || daysUntilExpiry > 14) return false;
            break;
          case '1month':
            if (daysUntilExpiry < 0 || daysUntilExpiry > 30) return false;
            break;
          case '2months':
            if (daysUntilExpiry < 0 || daysUntilExpiry > 60) return false;
            break;
          case '3months':
            if (daysUntilExpiry < 0 || daysUntilExpiry > 90) return false;
            break;
        }
      }

      return true;
    }).sort((a, b) => {
      // Sort by expiry date (soonest first)
      const expiryA = calculateExpiryDate(a.tenantMoveInDate, a.tenureMonths);
      const expiryB = calculateExpiryDate(b.tenantMoveInDate, b.tenureMonths);
      
      if (!expiryA && !expiryB) return 0;
      if (!expiryA) return 1;
      if (!expiryB) return -1;
      
      return new Date(expiryA).getTime() - new Date(expiryB).getTime();
    });
  }, [properties, searchTerm, areaFilter, expiryFilter, agreementFilter, verificationFilter]);

  // Summary stats
  const stats = useMemo(() => {
    let expired = 0;
    let expiringIn1Week = 0;
    let expiringIn1Month = 0;
    let agreementPending = 0;
    let verificationPending = 0;

    properties.forEach(p => {
      const expiryDate = calculateExpiryDate(p.tenantMoveInDate, p.tenureMonths);
      const days = getDaysUntilExpiry(expiryDate);
      
      if (days !== null) {
        if (days < 0) expired++;
        else if (days <= 7) expiringIn1Week++;
        else if (days <= 30) expiringIn1Month++;
      }

      if (p.agreementStatus === 'pending') agreementPending++;
      if (p.verificationStatus === 'pending') verificationPending++;
    });

    return { expired, expiringIn1Week, expiringIn1Month, agreementPending, verificationPending, total: properties.length };
  }, [properties]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <LoadingSpinner message="Loading rented properties..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadRentedProperties}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg w-full"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm')}
                className="p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
                  <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">Rented Properties</h1>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {filteredProperties.length} of {properties.length} properties
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={loadRentedProperties}
              className="p-2 sm:p-2.5 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white transition-all shadow-sm flex-shrink-0"
             aria-label="Refresh data">
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500">Total Rented</div>
          </div>
          <button
            onClick={() => setExpiryFilter('expired')}
            className={`bg-white rounded-lg p-4 border text-left transition-colors ${expiryFilter === 'expired' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300'}`}
          >
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
            <div className="text-xs text-gray-500">Expired</div>
          </button>
          <button
            onClick={() => setExpiryFilter('1week')}
            className={`bg-white rounded-lg p-4 border text-left transition-colors ${expiryFilter === '1week' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}
          >
            <div className="text-2xl font-bold text-orange-600">{stats.expiringIn1Week}</div>
            <div className="text-xs text-gray-500">Expiring in 1 Week</div>
          </button>
          <button
            onClick={() => setExpiryFilter('1month')}
            className={`bg-white rounded-lg p-4 border text-left transition-colors ${expiryFilter === '1month' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-yellow-300'}`}
          >
            <div className="text-2xl font-bold text-yellow-600">{stats.expiringIn1Month}</div>
            <div className="text-xs text-gray-500">Expiring in 1 Month</div>
          </button>
          <button
            onClick={() => setAgreementFilter(agreementFilter === 'pending' ? 'all' : 'pending')}
            className={`bg-white rounded-lg p-4 border text-left transition-colors ${agreementFilter === 'pending' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
          >
            <div className="text-2xl font-bold text-purple-600">{stats.agreementPending}</div>
            <div className="text-xs text-gray-500">Agreement Pending</div>
          </button>
          <button
            onClick={() => setVerificationFilter(verificationFilter === 'pending' ? 'all' : 'pending')}
            className={`bg-white rounded-lg p-4 border text-left transition-colors ${verificationFilter === 'pending' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
          >
            <div className="text-2xl font-bold text-blue-600">{stats.verificationPending}</div>
            <div className="text-xs text-gray-500">Verification Pending</div>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, area, building, tenant, owner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${showFilters ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              <Filter className="h-5 w-5" />
              Filters
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {(expiryFilter !== 'all' || areaFilter !== 'all' || agreementFilter !== 'all' || verificationFilter !== 'all') && (
              <button
                onClick={() => {
                  setExpiryFilter('all');
                  setAreaFilter('all');
                  setAgreementFilter('all');
                  setVerificationFilter('all');
                }}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
              >
                Clear Filters
              </button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Area</label>
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Areas</option>
                  {uniqueAreas.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expiry</label>
                <select
                  value={expiryFilter}
                  onChange={(e) => setExpiryFilter(e.target.value as ExpiryFilter)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All</option>
                  <option value="expired">Expired</option>
                  <option value="1week">Within 1 Week</option>
                  <option value="2weeks">Within 2 Weeks</option>
                  <option value="1month">Within 1 Month</option>
                  <option value="2months">Within 2 Months</option>
                  <option value="3months">Within 3 Months</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Agreement</label>
                <select
                  value={agreementFilter}
                  onChange={(e) => setAgreementFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All</option>
                  <option value="done">Done</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Police Verification</label>
                <select
                  value={verificationFilter}
                  onChange={(e) => setVerificationFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All</option>
                  <option value="done">Done</option>
                  <option value="pending">Pending</option>
                  <option value="not_done">Not Done</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Properties Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Owner</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Tenant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    <FileText className="inline h-3.5 w-3.5 mr-1" />
                    Agreement
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    <ShieldCheck className="inline h-3.5 w-3.5 mr-1" />
                    Police Ver.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    <Calendar className="inline h-3.5 w-3.5 mr-1" />
                    Move-in
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    <Clock className="inline h-3.5 w-3.5 mr-1" />
                    Expiry
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProperties.map((property) => {
                  const expiryDate = calculateExpiryDate(property.tenantMoveInDate, property.tenureMonths);
                  const daysUntilExpiry = getDaysUntilExpiry(expiryDate);
                  
                  return (
                    <tr key={property.propertyId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <Building2 className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <Link 
                              to={`/crm/properties/${property.propertyId}`}
                              className="font-medium text-gray-900 hover:text-purple-600"
                            >
                              {property.flatNumber || property.title}
                            </Link>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {property.buildingName}, {property.area}
                            </div>
                            <div className="text-xs text-gray-400">
                              {property.bhk} BHK • ₹{property.rentAmount?.toLocaleString()}/mo
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {property.owner ? (
                          <Link
                            to={`/crm/owners/${property.ownerId}`}
                            className="text-purple-600 hover:underline flex items-center gap-1"
                          >
                            <User className="h-3.5 w-3.5" />
                            {property.owner.name}
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {property.tenant ? (
                          <Link
                            to={`/crm/tenants/${property.tenantCustomerId}`}
                            className="text-purple-600 hover:underline flex items-center gap-1"
                          >
                            <Users className="h-3.5 w-3.5" />
                            {property.tenant.name}
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {property.agreementStatus === 'done' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3" />
                            Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <AlertTriangle className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {property.verificationStatus === 'done' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3" />
                            Done
                          </span>
                        ) : property.verificationStatus === 'not_done' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Not Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <AlertTriangle className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {property.tenantMoveInDate ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {new Date(property.tenantMoveInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {property.tenureMonths} months tenure
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {expiryDate ? (
                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              daysUntilExpiry !== null && daysUntilExpiry < 0 ? 'bg-red-100 text-red-800' :
                              daysUntilExpiry !== null && daysUntilExpiry <= 30 ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {new Date(expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            {daysUntilExpiry !== null && (
                              <div className={`text-xs mt-1 ${
                                daysUntilExpiry < 0 ? 'text-red-600 font-medium' :
                                daysUntilExpiry <= 7 ? 'text-orange-600 font-medium' :
                                daysUntilExpiry <= 30 ? 'text-yellow-600' :
                                'text-gray-500'
                              }`}>
                                {daysUntilExpiry < 0 ? `Expired ${Math.abs(daysUntilExpiry)} days ago` :
                                 daysUntilExpiry === 0 ? 'Expires today!' :
                                 daysUntilExpiry === 1 ? 'Expires tomorrow' :
                                 `${daysUntilExpiry} days left`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          to={`/crm/properties/${property.propertyId}`}
                          className="text-purple-600 hover:text-purple-800 font-medium hover:underline"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {filteredProperties.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      {properties.length === 0 ? 'No rented properties found' : 'No properties match your filters'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
