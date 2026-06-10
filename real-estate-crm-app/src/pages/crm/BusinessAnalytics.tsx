import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  TrendingUp,
  Calendar,
  FileText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  Building2,
  BarChart3,
  Activity,
  ArrowLeft,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';

interface AgreementExpiry {
  propertyId: string;
  propertyAddress: string;
  tenantName: string;
  ownerName: string;
  agreementEndDate: string;
  daysUntilExpiry: number;
  monthlyRent: number;
  status: 'active' | 'expiring_soon' | 'expired';
}

interface VerificationStatus {
  propertyId: string;
  propertyAddress: string;
  tenantName: string;
  agreementStatus: 'done' | 'pending' | 'not_started';
  policeVerificationStatus: 'done' | 'pending' | 'not_started';
  agreementDate?: string;
  verificationDate?: string;
}

interface BusinessMetrics {
  totalRevenue: number;
  activeProperties: number;
  expiringThisMonth: number;
  expiringNextMonth: number;
  expiredAgreements: number;
  pendingAgreements: number;
  completedAgreements: number;
  pendingVerifications: number;
  completedVerifications: number;
  occupancyRate: number;
  averageRent: number;
  totalTenants: number;
  revenueGrowth: number;
}

interface AnalyticsData {
  metrics: BusinessMetrics;
  agreementExpiries: AgreementExpiry[];
  verificationStatus: VerificationStatus[];
  monthlyRevenue: { month: string; revenue: number }[];
  propertyStatusDistribution: { status: string; count: number }[];
}

export default function BusinessAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [filterDays, setFilterDays] = useState<number>(90);
  const [sortBy, setSortBy] = useState<'date' | 'rent'>('date');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const analyticsData = await api.getBusinessAnalytics();
      setData(analyticsData);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const getExpiryStatusColor = (status: string) => {
    switch (status) {
      case 'expired': return 'bg-red-100 text-red-800 border-red-200';
      case 'expiring_soon': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'not_started': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const exportToCSV = () => {
    if (!data) return;
    
    const csv = [
      ['Property Address', 'Tenant', 'Owner', 'Expiry Date', 'Days Until Expiry', 'Monthly Rent', 'Status'],
      ...data.agreementExpiries.map(item => [
        item.propertyAddress,
        item.tenantName,
        item.ownerName,
        item.agreementEndDate,
        item.daysUntilExpiry.toString(),
        item.monthlyRent.toString(),
        item.status
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `business-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredExpiries = data?.agreementExpiries
    .filter(item => item.daysUntilExpiry <= filterDays)
    .sort((a, b) => {
      if (sortBy === 'date') {
        return a.daysUntilExpiry - b.daysUntilExpiry;
      }
      return b.monthlyRent - a.monthlyRent;
    }) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <LoadingSpinner message="Loading Analytics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">Failed to Load Analytics</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadAnalytics}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg w-full"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="glass-premium border-b border-white/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm')}
                className="p-1.5 sm:p-2 hover:bg-white/60 rounded-xl transition-all duration-200 flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                  <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">Business Analytics</h1>
                  <p className="text-xs sm:text-sm text-slate-400 font-semibold">Comprehensive insights & metrics</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={loadAnalytics}
                className="p-2 sm:p-2.5 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white transition-all shadow-sm"
               aria-label="Refresh data">
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 font-medium"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline text-sm sm:text-base">Export CSV</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Revenue */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <DollarSign className="w-6 h-6" />
              </div>
              {metrics && metrics.revenueGrowth > 0 && (
                <div className="flex items-center gap-1 text-sm bg-white/20 px-2 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  {metrics.revenueGrowth}%
                </div>
              )}
            </div>
            <p className="text-sm opacity-90 mb-1">Total Monthly Revenue</p>
            <h3 className="text-3xl font-bold">₹{(metrics?.totalRevenue || 0).toLocaleString('en-IN')}</h3>
          </div>

          {/* Occupancy Rate */}
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Building2 className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm opacity-90 mb-1">Occupancy Rate</p>
            <h3 className="text-3xl font-bold">{metrics?.occupancyRate || 0}%</h3>
            <p className="text-xs mt-2 opacity-75">{metrics?.activeProperties || 0} properties rented</p>
          </div>

          {/* Expiring Soon */}
          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <AlertTriangle className="w-6 h-6" />
              </div>
              {(metrics?.expiringThisMonth || 0) > 0 && (
                <div className="animate-pulse bg-white/20 px-2 py-1 rounded-full text-xs">
                  Action Required
                </div>
              )}
            </div>
            <p className="text-sm opacity-90 mb-1">Agreements Expiring</p>
            <h3 className="text-3xl font-bold">{metrics?.expiringThisMonth || 0}</h3>
            <p className="text-xs mt-2 opacity-75">This month • {metrics?.expiringNextMonth || 0} next month</p>
          </div>

          {/* Pending Actions */}
          <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Activity className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm opacity-90 mb-1">Pending Actions</p>
            <h3 className="text-3xl font-bold">
              {(metrics?.pendingAgreements || 0) + (metrics?.pendingVerifications || 0)}
            </h3>
            <p className="text-xs mt-2 opacity-75">
              {metrics?.pendingAgreements || 0} agreements • {metrics?.pendingVerifications || 0} verifications
            </p>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <span className="font-semibold text-gray-900">Agreements</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completed</span>
                <span className="font-bold text-green-600">{metrics?.completedAgreements || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pending</span>
                <span className="font-bold text-yellow-600">{metrics?.pendingAgreements || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Expired</span>
                <span className="font-bold text-red-600">{metrics?.expiredAgreements || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                </div>
                <span className="font-semibold text-gray-900">Verifications</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completed</span>
                <span className="font-bold text-green-600">{metrics?.completedVerifications || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pending</span>
                <span className="font-bold text-yellow-600">{metrics?.pendingVerifications || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completion Rate</span>
                <span className="font-bold text-indigo-600">
                  {(() => {
                    const total = (metrics?.completedVerifications || 0) + (metrics?.pendingVerifications || 0);
                    return total > 0
                      ? Math.round(((metrics?.completedVerifications || 0) / total) * 100) + '%'
                      : 'N/A';
                  })()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="font-semibold text-gray-900">Tenants</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Active</span>
                <span className="font-bold text-gray-900">{metrics?.totalTenants || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Average Rent</span>
                <span className="font-bold text-gray-900">₹{(metrics?.averageRent || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Rented Properties</span>
                <span className="font-bold text-gray-900">{metrics?.activeProperties || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Agreement Expiry Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  Agreement Expiry Timeline
                </h2>
                <p className="text-sm text-gray-500 mt-1">Track agreements by expiration date</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <select
                  value={filterDays}
                  onChange={(e) => setFilterDays(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={30}>Next 30 Days</option>
                  <option value={60}>Next 60 Days</option>
                  <option value={90}>Next 90 Days</option>
                  <option value={180}>Next 6 Months</option>
                  <option value={365}>Next Year</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'rent')}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="date">Sort by Date</option>
                  <option value="rent">Sort by Rent</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Left</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Rent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExpiries.length > 0 ? (
                  filteredExpiries.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.propertyAddress}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.tenantName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.ownerName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{new Date(item.agreementEndDate).toLocaleDateString('en-IN')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${
                          item.daysUntilExpiry < 0 ? 'text-red-600' :
                          item.daysUntilExpiry <= 30 ? 'text-orange-600' :
                          'text-gray-600'
                        }`}>
                          {item.daysUntilExpiry < 0 ? `${Math.abs(item.daysUntilExpiry)} days ago` : `${item.daysUntilExpiry} days`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">₹{item.monthlyRent.toLocaleString('en-IN')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getExpiryStatusColor(item.status)}`}>
                          {item.status === 'expired' ? 'Expired' : item.status === 'expiring_soon' ? 'Expiring Soon' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => navigate(`/crm/properties/${item.propertyId}`)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No agreements expiring in this period</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Verification Status Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Agreement & Verification Status
            </h2>
            <p className="text-sm text-gray-500 mt-1">Track completion of agreements and police verifications</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Agreement Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Agreement Date</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Police Verification</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Verification Date</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.verificationStatus && data.verificationStatus.length > 0 ? (
                  data.verificationStatus.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.propertyAddress}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.tenantName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {getStatusIcon(item.agreementStatus)}
                          <span className={`text-xs font-medium capitalize ${
                            item.agreementStatus === 'done' ? 'text-green-600' :
                            item.agreementStatus === 'pending' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {item.agreementStatus.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900">
                          {item.agreementDate ? new Date(item.agreementDate).toLocaleDateString('en-IN') : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {getStatusIcon(item.policeVerificationStatus)}
                          <span className={`text-xs font-medium capitalize ${
                            item.policeVerificationStatus === 'done' ? 'text-green-600' :
                            item.policeVerificationStatus === 'pending' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {item.policeVerificationStatus.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900">
                          {item.verificationDate ? new Date(item.verificationDate).toLocaleDateString('en-IN') : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        <button
                          onClick={() => navigate(`/crm/properties/${item.propertyId}`)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No verification data available</p>
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
