import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { GoogleMapsProvider } from './contexts/GoogleMapsContext';
import { isAuthenticated as checkAuth, getIdToken, setUserProfile, getUserProfile, isProfileFresh } from './utils/authStorage';
import { callMe } from './utils/cognitoAuth';

// Pages
import AdminLogin from './pages/AdminLogin';
import AuthCallback from './pages/AuthCallback';
import Profile from './pages/Profile';

// Onboarding Pages
import RoleSelection from './pages/RoleSelection';
import RegisterAdmin from './pages/RegisterAdmin';
import AcceptInvite from './pages/AcceptInvite';

// Member Pages
import Invites from './pages/member/Invites';
import NoAccess from './pages/member/NoAccess';

// Admin Pages
import InviteManagement from './pages/admin/InviteManagement';

// CRM Pages
import CRMDashboard from './pages/crm/CRMDashboard';
import TenantList from './pages/crm/TenantList';
import TenantDetails from './pages/crm/TenantDetails';
import OwnerList from './pages/crm/OwnerList';
import OwnerDetails from './pages/crm/OwnerDetails';
import PropertyList from './pages/crm/PropertyList';
import PropertyDetails from './pages/crm/PropertyDetails';
import B2BLeadsList from './pages/crm/B2BLeadsList';
import Hierarchy from './pages/crm/Hierarchy';
import BusinessAnalytics from './pages/crm/BusinessAnalytics';
import RentedProperties from './pages/crm/RentedProperties';
import Calendar from './pages/crm/Calendar';
import KhataBook from './pages/crm/KhataBook';
import KhataEntryForm from './pages/crm/KhataEntryForm';
import KhataSettlement from './pages/crm/KhataSettlement';
import BuyerList from './pages/crm/BuyerList';
import BuyerDetails from './pages/crm/BuyerDetails';
import LeadList from './pages/crm/LeadList';
import LeadDetails from './pages/crm/LeadDetails';

// Real Estate Management Pages
import DeveloperList from './pages/crm/DeveloperList';
import DeveloperDetails from './pages/crm/DeveloperDetails';
import RealEstateAreaList from './pages/crm/RealEstateAreaList';
import RealEstateAreaDetails from './pages/crm/RealEstateAreaDetails';
import ProjectList from './pages/crm/ProjectList';
import ProjectDetails from './pages/crm/ProjectDetails';

// AI Calling Module
import {
  AICallingDashboard,
  StartCallModal,
  CallDetails,
  CallHistory,
  KnowledgeManager,
  AICallingSettings,
} from './pages/crm/AICalling';

function App() {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    async function initAuth() {
      if (!checkAuth()) {
        setAuthState('unauthenticated');
        return;
      }

      // Check if we have a fresh cached profile (< 60s old)
      const cachedProfile = getUserProfile();
      const profileIsFresh = isProfileFresh(60);

      // If profile is fresh, skip /auth/me and set authenticated immediately
      if (cachedProfile && profileIsFresh) {
        setAuthState('authenticated');
        return;
      }

      // Profile is stale or missing — refresh via /auth/me
      const idToken = getIdToken();
      if (idToken) {
        try {
          const meResult = await callMe(idToken);
          const meData = meResult.data || meResult;
          setUserProfile({
            cognitoSub: meData.user.cognitoSub,
            email: meData.user.email,
            phoneNumber: meData.user.phoneNumber,
            role: meData.user.role,
            tenantId: meData.user.tenantId,
            displayName: meData.user.displayName,
            status: meData.user.status,
            createdAt: meData.user.createdAt,
            lastLoginAt: meData.user.lastLoginAt,
            agency: meData.agency,
          });
        } catch (err) {
          // Continue with cached profile if /auth/me fails
        }
      }

      setAuthState('authenticated');
    }

    const handleAuthChanged = () => {
      initAuth();
    };

    window.addEventListener('auth-changed', handleAuthChanged);
    initAuth();

    return () => {
      window.removeEventListener('auth-changed', handleAuthChanged);
    };
  }, []);

  const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    if (authState === 'loading') {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-slate-500">Loading...</p>
          </div>
        </div>
      );
    }
    
    return authState === 'authenticated' ? children : <Navigate to="/login" replace />;
  };

  return (
    <GoogleMapsProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          {/* Onboarding Routes (authenticated but not registered) */}
          <Route path="/onboarding/role-selection" element={<RoleSelection />} />
          <Route path="/onboarding/register-admin" element={<RegisterAdmin />} />
          <Route path="/onboarding/accept-invite" element={<AcceptInvite />} />
          
          {/* Member Routes (post-auth but pre-registration) */}
          <Route path="/member/invites" element={<Invites />} />
          <Route path="/member/no-access" element={<NoAccess />} />
          
          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><Navigate to="/crm" replace /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/crm" replace /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><CRMDashboard /></ProtectedRoute>} />
          <Route path="/rental-list" element={<ProtectedRoute><Navigate to="/crm/properties" replace /></ProtectedRoute>} />
          <Route path="/building/:id" element={<ProtectedRoute><Navigate to="/crm/properties" replace /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          
          {/* Admin Routes */}
          <Route path="/admin/invites" element={<ProtectedRoute><InviteManagement /></ProtectedRoute>} />
          
          {/* CRM Routes */}
          <Route path="/crm" element={<ProtectedRoute><CRMDashboard /></ProtectedRoute>} />
          <Route path="/crm/tenants" element={<ProtectedRoute><TenantList /></ProtectedRoute>} />
          <Route path="/crm/tenants/:id" element={<ProtectedRoute><TenantDetails /></ProtectedRoute>} />
          <Route path="/crm/tenants/new" element={<ProtectedRoute><TenantDetails /></ProtectedRoute>} />
          {/* Redirect old customer routes to tenant routes */}
          <Route path="/crm/customers" element={<Navigate to="/crm/tenants" replace />} />
          <Route path="/crm/customers/:id" element={<Navigate to="/crm/tenants" replace />} />
          <Route path="/crm/customers/new" element={<Navigate to="/crm/tenants/new" replace />} />
          <Route path="/crm/owners" element={<ProtectedRoute><OwnerList /></ProtectedRoute>} />
          <Route path="/crm/owners/:id" element={<ProtectedRoute><OwnerDetails /></ProtectedRoute>} />
          <Route path="/crm/owners/new" element={<ProtectedRoute><OwnerDetails /></ProtectedRoute>} />
          <Route path="/crm/properties" element={<ProtectedRoute><PropertyList /></ProtectedRoute>} />
          <Route path="/crm/properties/:id" element={<ProtectedRoute><PropertyDetails /></ProtectedRoute>} />
          <Route path="/crm/properties/new" element={<ProtectedRoute><PropertyDetails /></ProtectedRoute>} />
          <Route path="/crm/hierarchy" element={<ProtectedRoute><Hierarchy /></ProtectedRoute>} />
          <Route path="/crm/rented-properties" element={<ProtectedRoute><RentedProperties /></ProtectedRoute>} />
          <Route path="/crm/b2b-leads" element={<ProtectedRoute><B2BLeadsList /></ProtectedRoute>} />
          <Route path="/crm/analytics" element={<ProtectedRoute><BusinessAnalytics /></ProtectedRoute>} />
          <Route path="/crm/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/crm/khata" element={<ProtectedRoute><KhataBook /></ProtectedRoute>} />
          <Route path="/crm/khata/new" element={<ProtectedRoute><KhataEntryForm /></ProtectedRoute>} />
          <Route path="/crm/khata/:entryId" element={<ProtectedRoute><KhataEntryForm /></ProtectedRoute>} />
          <Route path="/crm/khata/:entryId/edit" element={<ProtectedRoute><KhataEntryForm /></ProtectedRoute>} />
          <Route path="/crm/khata/settlement" element={<ProtectedRoute><KhataSettlement /></ProtectedRoute>} />
          
          {/* Buyer Routes */}
          <Route path="/crm/buyers" element={<ProtectedRoute><BuyerList /></ProtectedRoute>} />
          <Route path="/crm/buyers/new" element={<ProtectedRoute><BuyerDetails /></ProtectedRoute>} />
          <Route path="/crm/buyers/:id" element={<ProtectedRoute><BuyerDetails /></ProtectedRoute>} />
          
          {/* Lead Routes */}
          <Route path="/crm/leads" element={<ProtectedRoute><LeadList /></ProtectedRoute>} />
          <Route path="/crm/leads/new" element={<ProtectedRoute><LeadDetails /></ProtectedRoute>} />
          <Route path="/crm/leads/:id" element={<ProtectedRoute><LeadDetails /></ProtectedRoute>} />
          
          {/* Real Estate Management Routes */}
          <Route path="/crm/developers" element={<ProtectedRoute><DeveloperList /></ProtectedRoute>} />
          <Route path="/crm/developers/new" element={<ProtectedRoute><DeveloperDetails /></ProtectedRoute>} />
          <Route path="/crm/developers/:id" element={<ProtectedRoute><DeveloperDetails /></ProtectedRoute>} />
          <Route path="/crm/real-estate-areas" element={<ProtectedRoute><RealEstateAreaList /></ProtectedRoute>} />
          <Route path="/crm/real-estate-areas/new" element={<ProtectedRoute><RealEstateAreaDetails /></ProtectedRoute>} />
          <Route path="/crm/real-estate-areas/:id" element={<ProtectedRoute><RealEstateAreaDetails /></ProtectedRoute>} />
          <Route path="/crm/projects" element={<ProtectedRoute><ProjectList /></ProtectedRoute>} />
          <Route path="/crm/projects/new" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
          <Route path="/crm/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
          
          {/* AI Calling Routes */}
          <Route path="/crm/ai-calling" element={<ProtectedRoute><AICallingDashboard /></ProtectedRoute>} />
          <Route path="/crm/ai-calling/start" element={<ProtectedRoute><StartCallModal /></ProtectedRoute>} />
          <Route path="/crm/ai-calling/calls/:callSessionId" element={<ProtectedRoute><CallDetails /></ProtectedRoute>} />
          <Route path="/crm/ai-calling/history" element={<ProtectedRoute><CallHistory /></ProtectedRoute>} />
          <Route path="/crm/ai-calling/knowledge" element={<ProtectedRoute><KnowledgeManager /></ProtectedRoute>} />
          <Route path="/crm/ai-calling/settings" element={<ProtectedRoute><AICallingSettings /></ProtectedRoute>} />
        </Routes>
      </Router>
    </GoogleMapsProvider>
  );
}

export default App;
