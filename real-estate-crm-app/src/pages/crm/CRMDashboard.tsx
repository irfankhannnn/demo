import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  Home,
  Building2,
  TrendingUp,
  LogOut,
  CheckCircle,
  Clock,
  ChevronRight,
  FileText,
  ShieldAlert,
  Plus,
  ArrowRight,
  Briefcase,
  BarChart3,
  User,
  BookOpen,
  Calendar,
  ShoppingCart,
  PhoneCall,
  UserPlus,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMMetrics } from '../../types/crm';
import LoadingSpinner from '../../components/LoadingSpinner';
import LogoutConfirmModal from '../../components/LogoutConfirmModal';
import NotificationCenter from '../../components/NotificationCenter';
import { getUserProfile, clearAuthSilently } from '../../utils/authStorage';
import { redirectToLogout } from '../../utils/cognitoAuth';

interface UnifiedCrmCounts {
  buyers: number;
  sellers: number;
  owners: number;
  tenants: number;
  leads: number;
}

export default function CRMDashboard() {
  const navigate = useNavigate();
  const profile = getUserProfile();
  const isAdmin = profile?.role === 'ADMIN';
  const [metrics, setMetrics] = useState<CRMMetrics | null>(null);
  const [unifiedCounts, setUnifiedCounts] = useState<UnifiedCrmCounts>({
    buyers: 0,
    sellers: 0,
    owners: 0,
    tenants: 0,
    leads: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        metricsData,
        buyers,
        owners,
        tenants,
        leads,
      ] = await Promise.all([
        api.getCRMMetrics(),
        api.getBuyers(),
        api.getOwners(),
        api.getCustomers(),
        api.getLeads(),
      ]);

      // Get seller count from cached value after getOwners call
      const sellerCount = await api.getSellerCount();

      setMetrics(metricsData);
      setUnifiedCounts({
        buyers: Array.isArray(buyers) ? buyers.length : 0,
        sellers: sellerCount,
        owners: Array.isArray(owners) ? owners.length : 0,
        tenants: Array.isArray(tenants) ? tenants.length : 0,
        leads: Array.isArray(leads) ? leads.length : 0,
      });
    } catch (error) {
      console.error('Error loading CRM dashboard data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthSilently();
    redirectToLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <LoadingSpinner message="Loading Dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors w-full"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const pendingActions = (metrics?.agreementsPending || 0) + (metrics?.verificationsPending || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            {/* Left: Logo and Title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Link
                to="/"
                className="p-1.5 sm:p-2 text-slate-600 hover:text-indigo-600 transition-colors rounded-xl hover:bg-white/50 flex-shrink-0"
                title="Homepage"
              >
                <Home className="h-5 w-5 sm:h-6 sm:w-6" />
              </Link>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate">CRM Dashboard</h1>
                <p className="text-xs text-slate-500 hidden sm:block">Welcome back, Admin</p>
              </div>
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/60 backdrop-blur-sm border border-white/20 text-indigo-700 rounded-xl text-sm font-medium shadow-sm">
                <Clock className="w-4 h-4" />
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              
              <NotificationCenter />

              {isAdmin && (
                <>
                  <Link
                    to="/admin/invites"
                    className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:text-indigo-600 hover:bg-white/50 rounded-xl transition-colors font-medium"
                    title="Team Invites"
                  >
                    <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden sm:inline text-sm">Invites</span>
                  </Link>
                  <Link
                    to="/admin/members"
                    className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:text-indigo-600 hover:bg-white/50 rounded-xl transition-colors font-medium"
                    title="Members"
                  >
                    <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden sm:inline text-sm">Members</span>
                  </Link>
                </>
              )}
              
              <Link
                to="/profile"
                className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:text-indigo-600 hover:bg-white/50 rounded-xl transition-colors font-medium"
                title="Profile"
              >
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline text-sm">Profile</span>
              </Link>
              
              <button
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50/80 rounded-xl transition-colors font-medium"
                title="Logout"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        
        {/* Quick Stats Overview */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group active:scale-95" onClick={() => navigate('/crm/leads')}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Leads</p>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{unifiedCounts.leads}</h3>
                <div className="flex items-center mt-2 text-sm">
                  <span className="text-indigo-600 flex items-center font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Manage conversions
                  </span>
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-amber-50 rounded-lg sm:rounded-xl group-hover:bg-amber-100 transition-colors">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group active:scale-95" onClick={() => navigate('/crm/buyers')}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Buyers</p>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{unifiedCounts.buyers}</h3>
                <div className="flex items-center mt-2 text-sm">
                  <span className="text-orange-600 flex items-center font-medium bg-orange-50 px-2 py-0.5 rounded-full">
                    <ShoppingCart className="w-3 h-3 mr-1" />
                    Contacts
                  </span>
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-orange-50 rounded-lg sm:rounded-xl group-hover:bg-orange-100 transition-colors">
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group active:scale-95" onClick={() => navigate('/crm/owners')}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Owners</p>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{unifiedCounts.owners}</h3>
                <div className="flex items-center mt-2 text-sm">
                  <span className="text-blue-600 flex items-center font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                    <Building2 className="w-3 h-3 mr-1" />
                    Contacts
                  </span>
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-blue-50 rounded-lg sm:rounded-xl group-hover:bg-blue-100 transition-colors">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group active:scale-95" onClick={() => navigate('/crm/properties')}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Total Properties</p>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{metrics?.totalProperties || 0}</h3>
                <div className="flex items-center mt-2 text-sm gap-2">
                  <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs font-medium">
                    {metrics?.availableProperties || 0} Avail
                  </span>
                  <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full text-xs font-medium">
                    {metrics?.rentedProperties || 0} Rented
                  </span>
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-purple-50 rounded-lg sm:rounded-xl group-hover:bg-purple-100 transition-colors">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group active:scale-95" onClick={() => navigate('/crm/tenants')}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Tenants</p>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{unifiedCounts.tenants}</h3>
                <div className="flex items-center mt-2 text-sm">
                  <span className="text-teal-600 flex items-center font-medium bg-teal-50 px-2 py-0.5 rounded-full">
                    <Users className="w-3 h-3 mr-1" />
                    Contacts
                  </span>
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-teal-50 rounded-lg sm:rounded-xl group-hover:bg-teal-100 transition-colors">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group active:scale-95" onClick={() => navigate('/crm/owners?sellers=1')}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Sellers</p>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{unifiedCounts.sellers}</h3>
                <div className="flex items-center mt-2 text-sm">
                  <span className="text-emerald-600 flex items-center font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                    <Users className="w-3 h-3 mr-1" />
                    Owners with listings
                  </span>
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-emerald-50 rounded-lg sm:rounded-xl group-hover:bg-emerald-100 transition-colors">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
          {/* Main Column (Left - 2/3) */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 lg:space-y-8">
            
            {/* Action Center Banner - Blinks continuously until resolved */}
            {pendingActions > 0 && (
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg sm:rounded-xl shadow-md p-4 sm:p-6 text-white animate-pulse-attention relative overflow-hidden">
                {/* Animated border glow effect */}
                <div className="absolute inset-0 rounded-xl border-2 border-white/30 animate-ping opacity-20"></div>
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 animate-bounce" />
                      <span className="animate-pulse text-red-500">Attention Needed</span>
                    </h2>
                    <p className="mt-1 text-sm sm:text-base text-indigo-100 opacity-90">
                      You have {pendingActions} items requiring your attention.
                    </p>
                    <div className="flex flex-wrap gap-2 sm:gap-3 mt-3 sm:mt-4">
                      {(metrics?.agreementsPending || 0) > 0 && (
                        <span className="px-3 py-1 bg-white/20 rounded-full text-sm backdrop-blur-sm border border-white/10 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {metrics?.agreementsPending} Agreements Pending
                        </span>
                      )}
                      {(metrics?.verificationsPending || 0) > 0 && (
                        <span className="px-3 py-1 bg-white/20 rounded-full text-sm backdrop-blur-sm border border-white/10 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          {metrics?.verificationsPending} Verifications Pending
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/crm/properties')}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-indigo-600 rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-50 transition-colors shadow-sm active:scale-95"
                  >
                    View Items
                  </button>
                </div>
              </div>
            )}

            {/* Unified CRM Quick Access */}
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                  Unified CRM
                </h2>
                <button 
                  onClick={() => navigate('/crm/leads')}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  View Leads <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <button
                  onClick={() => navigate('/crm/tenants')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500">Tenants</div>
                      <div className="text-xl font-bold text-gray-900">{unifiedCounts.tenants}</div>
                    </div>
                    <div className="p-2 bg-teal-50 rounded-lg">
                      <Users className="w-5 h-5 text-teal-600" />
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => navigate('/crm/leads/new')}
                  className="p-4 border border-indigo-200 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors text-left active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-indigo-700">Quick Action</div>
                      <div className="text-base font-semibold text-indigo-900">Create Lead</div>
                      <div className="text-xs text-indigo-700 mt-1">Convert to any role</div>
                    </div>
                    <div className="p-2 bg-white rounded-lg">
                      <Plus className="w-5 h-5 text-indigo-600" />
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              <button 
                onClick={() => navigate('/crm/buyers/new')}
                className="bg-white p-4 sm:p-6 rounded-lg sm:rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all text-left group active:scale-95"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-blue-100 transition-colors">
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Add New Buyer</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Create buyer contact profile</p>
              </button>

              <button 
                onClick={() => navigate('/crm/tenants/new')}
                className="bg-white p-4 sm:p-6 rounded-lg sm:rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-purple-300 transition-all text-left group active:scale-95"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 rounded-lg flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-purple-100 transition-colors">
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Add New Tenant</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Create tenant contact profile</p>
              </button>
            </div>
          </div>

          {/* Right Sidebar (1/3) */}
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            
            {/* Property Status Summary */}
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center justify-between">
                <span>Property Status</span>
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{metrics?.totalProperties || 0} Total</span>
              </h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Available</span>
                    <span className="font-medium text-gray-900">{metrics?.availableProperties || 0}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${((metrics?.availableProperties || 0) / (metrics?.totalProperties || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Rented</span>
                    <span className="font-medium text-gray-900">{metrics?.rentedProperties || 0}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${((metrics?.rentedProperties || 0) / (metrics?.totalProperties || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">On Hold</span>
                    <span className="font-medium text-gray-900">{metrics?.onHoldProperties || 0}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full" 
                      style={{ width: `${((metrics?.onHoldProperties || 0) / (metrics?.totalProperties || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => navigate('/crm/properties')}
                className="w-full mt-6 py-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-medium transition-colors"
              >
                Manage Properties
              </button>
            </div>

            {/* Compliance Status */}
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="font-bold text-gray-900 mb-4">Compliance Tracking</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className={`w-5 h-5 ${(metrics?.agreementsPending || 0) > 0 ? 'text-yellow-500' : 'text-green-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Agreements</p>
                      <p className="text-xs text-gray-500">{metrics?.agreementsPending || 0} Pending</p>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900">{metrics?.agreementsDone || 0} Done</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className={`w-5 h-5 ${(metrics?.verificationsPending || 0) > 0 ? 'text-yellow-500' : 'text-green-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Verifications</p>
                      <p className="text-xs text-gray-500">{metrics?.verificationsPending || 0} Pending</p>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900">{metrics?.verificationsDone || 0} Done</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Real Estate Management - DISABLED */}
        {/*
        <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl shadow-lg border border-white/20 p-6 mt-6 sm:mt-8 backdrop-blur-sm">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5 text-purple-600" />
            Real Estate Management
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button 
              onClick={() => navigate('/crm/developers')} 
              className="flex flex-col items-start p-5 bg-white/80 backdrop-blur-xl hover:bg-white rounded-2xl transition-all shadow-md hover:shadow-xl border border-white/20 group"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-gray-900 mb-1">Developers</span>
              <span className="text-xs text-gray-600">Manage real estate developers</span>
              <ChevronRight className="w-5 h-5 text-blue-400 mt-2 group-hover:translate-x-1 transition-transform" />
            </button>

            <button 
              onClick={() => navigate('/crm/real-estate-areas')} 
              className="flex flex-col items-start p-5 bg-white/80 backdrop-blur-xl hover:bg-white rounded-2xl transition-all shadow-md hover:shadow-xl border border-white/20 group"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-gray-900 mb-1">Areas & Communities</span>
              <span className="text-xs text-gray-600">Manage residential areas</span>
              <ChevronRight className="w-5 h-5 text-emerald-400 mt-2 group-hover:translate-x-1 transition-transform" />
            </button>

            <button 
              onClick={() => navigate('/crm/projects')} 
              className="flex flex-col items-start p-5 bg-white/80 backdrop-blur-xl hover:bg-white rounded-2xl transition-all shadow-md hover:shadow-xl border border-white/20 group"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-gray-900 mb-1">Projects</span>
              <span className="text-xs text-gray-600">Track development projects</span>
              <ChevronRight className="w-5 h-5 text-purple-400 mt-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
        */}

        {/* Quick Links - Moved to Bottom */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mt-6 sm:mt-8">
          <h3 className="font-bold text-gray-900 mb-4">Quick Links</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            <button 
              onClick={() => navigate('/crm/calendar')} 
              className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group border border-gray-200"
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                Calendar
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400" />
            </button>
            <button 
              onClick={() => navigate('/crm/analytics')} 
              className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group border border-gray-200"
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                Analytics
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
            </button>
            <button 
              onClick={() => navigate('/crm/khata')} 
              className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group border border-gray-200"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-400 group-hover:text-purple-500" />
                Khata Book
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-400" />
            </button>
            <button 
              onClick={() => navigate('/crm/rented-properties')} 
              className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group border border-gray-200"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                Rented List
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
            </button>
            <button 
              onClick={() => navigate('/crm/leads')} 
              className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group border border-gray-200"
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-400 group-hover:text-amber-500" />
                Leads
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-amber-400" />
            </button>
            <button 
              onClick={() => navigate('/crm/tenants')} 
              className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group border border-gray-200"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                Tenants
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
            </button>
            <button 
              onClick={() => navigate('/crm/owners')} 
              className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group border border-gray-200"
            >
              <span className="flex items-center gap-2">
                <Home className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                Owners
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
            </button>
            <button 
              onClick={() => navigate('/crm/buyers')} 
              className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group border border-gray-200"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
                Buyers
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400" />
            </button>
            <button 
              onClick={() => navigate('/crm/hierarchy')} 
              className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group border border-gray-200"
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                Hierarchy
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
            </button>
            <button 
              onClick={() => navigate('/crm/b2b-leads')} 
              className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group border border-gray-200"
            >
              <span className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                B2B Leads
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
            </button>
            <button 
              onClick={() => navigate('/crm/properties')} 
              className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group border border-gray-200"
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                Properties
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
            </button>
            {/* AI Calling - DISABLED */}
            {/*
            <button 
              onClick={() => navigate('/crm/ai-calling')} 
              className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group border border-green-200 bg-green-50"
            >
              <span className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-green-500 group-hover:text-green-600" />
                AI Calling
              </span>
              <ChevronRight className="w-4 h-4 text-green-300 group-hover:text-green-500" />
            </button>
            */}
          </div>
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}
