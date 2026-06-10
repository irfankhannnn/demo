import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { GoogleMapsProvider } from './contexts/GoogleMapsContext';
import { isAuthenticated as checkAuth, getIdToken, setUserProfile, getUserProfile, isProfileFresh, clearAuth, hasOnboardingSession, getRefreshToken, setTokens } from './utils/authStorage';
import { callMe, refreshTokens } from './utils/cognitoAuth';
import { identifyUser } from './lib/analytics';

// === [LAUNCH COMPONENT IMPORTS] ===
// PR-A
import DemoBanner from './components/DemoBanner';
// PR-J
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import TrialCountdownBanner from './components/TrialCountdownBanner';
import PaywallModal from './components/PaywallModal';
// PR-C
import CookieConsentBanner from './components/CookieConsentBanner';
// PR-K
import NpsModal from './components/NpsModal';
import NpsEmailLanding from './pages/public/NpsEmailLanding';
// === [/LAUNCH COMPONENT IMPORTS] ===

// Pages
import AdminLogin from './pages/AdminLogin';
import PhoneLogin from './pages/PhoneLogin';
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
import MemberManagement from './pages/admin/MemberManagement';

// === [LAUNCH COMPONENT IMPORTS] ===
// PR-B
import Grievance from './pages/public/Grievance';
import GrievanceList from './pages/admin/GrievanceList';
// === [/LAUNCH COMPONENT IMPORTS] ===

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

// Real Estate Management Pages - DISABLED
// import DeveloperList from './pages/crm/DeveloperList';
// import DeveloperDetails from './pages/crm/DeveloperDetails';
// import RealEstateAreaList from './pages/crm/RealEstateAreaList';
// import RealEstateAreaDetails from './pages/crm/RealEstateAreaDetails';
// import ProjectList from './pages/crm/ProjectList';
// import ProjectDetails from './pages/crm/ProjectDetails';

// PR-F
import AIEmployeeStatus from './pages/crm/AIEmployeeStatus';

// AI Calling Module - DISABLED
/*
import {
  AICallingDashboard,
  StartCallModal,
  CallDetails,
  CallHistory,
  KnowledgeManager,
  AICallingSettings,
} from './pages/crm/AICalling';
*/

function App() {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    async function initAuth() {
      console.log('[App] initAuth called');
      const onboardingActive = hasOnboardingSession();
      console.log('[App] Onboarding session active:', onboardingActive);

      // Check if we have a fresh cached profile (< 60s old)
      const cachedProfile = getUserProfile();
      const profileIsFresh = isProfileFresh(60);

      // If profile is fresh, skip /auth/me and set authenticated immediately
      if (cachedProfile && profileIsFresh) {
        setAuthState('authenticated');
        return;
      }

      // Check if we have tokens (even if expired)
      const idToken = getIdToken();
      const refreshToken = getRefreshToken();
      console.log('[App] ID token exists:', !!idToken, 'Refresh token exists:', !!refreshToken);

      // If no tokens at all, unauthenticated
      if (!idToken && !refreshToken) {
        console.log('[App] No auth tokens found - setting unauthenticated');
        setAuthState('unauthenticated');
        return;
      }

      // If token exists but is expired, attempt refresh
      if (idToken && !checkAuth() && refreshToken && !onboardingActive) {
        try {
          console.log('[App] Token expired, attempting refresh...');
          const newTokens = await refreshTokens(refreshToken);
          setTokens(newTokens);
          console.log('[App] Token refresh successful');
        } catch (refreshErr) {
          console.log('[App] Token refresh failed:', refreshErr);
          // Refresh failed, clear auth and set unauthenticated
          clearAuth();
          setAuthState('unauthenticated');
          return;
        }
      }

      // Profile is stale or missing — refresh via /auth/me
      const currentIdToken = getIdToken();
      if (currentIdToken) {
        try {
          console.log('[App] Calling /auth/me...');
          const meResult = await callMe(currentIdToken);
          const meData = meResult.data || meResult;
          console.log('[App] /auth/me success');
          setUserProfile({
            userId: meData.user.userId,
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
          setAuthState('authenticated');

          // PR-E: stitch LP anonymous session to CRM user
          identifyUser(meData.user.userId, {
            tenantId: meData.user.tenantId,
            role: meData.user.role,
            plan: meData.agency?.plan || 'free',
            agencyName: meData.agency?.name,
            utm_source: sessionStorage.getItem('utm_source') || undefined,
            utm_campaign: sessionStorage.getItem('utm_campaign') || undefined,
          });
          return;
        } catch (err) {
          console.log('[App] /auth/me failed:', err);
          // Attempt to refresh token if /auth/me fails (likely due to expired token)
          const currentRefreshToken = getRefreshToken();
          if (currentRefreshToken && !onboardingActive) {
            try {
              console.log('[App] Attempting token refresh after /auth/me failure...');
              const newTokens = await refreshTokens(currentRefreshToken);
              setTokens(newTokens);
              console.log('[App] Token refresh successful, retrying /auth/me...');
              const meResult = await callMe(newTokens.idToken);
              const meData = meResult.data || meResult;
              console.log('[App] /auth/me success after refresh');
              setUserProfile({
                userId: meData.user.userId,
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
              setAuthState('authenticated');
              return;
            } catch (refreshErr) {
              console.log('[App] Token refresh failed:', refreshErr);
            }
          }

          if (onboardingActive) {
            console.log('[App] Onboarding active - preserving auth state');
            setAuthState('authenticated');
            return;
          }

          if (!cachedProfile) {
            console.log('[App] No cached profile - clearing auth');
            clearAuth();
            setAuthState('unauthenticated');
            return;
          }
        }
      }

      if (cachedProfile) {
        setAuthState('authenticated');
        return;
      }

      if (onboardingActive) {
        setAuthState('authenticated');
        return;
      }

      clearAuth();
      setAuthState('unauthenticated');
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
        {/* === [LAUNCH LAYOUT COMPONENTS] === */}
        {/* PR-A */}
        <DemoBanner />
        {/* PR-C */}
        <CookieConsentBanner />
        {/* PR-K */}
        <NpsModal />
        {/* PR-J */}
        <SubscriptionProvider>
          <TrialCountdownBanner />
          <PaywallModal />
        <Routes>
          {/* Public Routes */}
          {/* === [LAUNCH PUBLIC ROUTES] === */}
          {/* PR-B */}
          <Route path="/grievance" element={<Grievance />} />
          {/* PR-K */}
          <Route path="/nps" element={<NpsEmailLanding />} />
          {/* === [/LAUNCH PUBLIC ROUTES] === */}
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/phone-login" element={<PhoneLogin />} />
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
          {/* === [LAUNCH PROTECTED ROUTES] === */}
          {/* PR-B */}
          <Route path="/admin/grievances" element={<ProtectedRoute><GrievanceList /></ProtectedRoute>} />
          {/* === [/LAUNCH PROTECTED ROUTES] === */}
          <Route path="/admin/invites" element={<ProtectedRoute><InviteManagement /></ProtectedRoute>} />
          <Route path="/admin/members" element={<ProtectedRoute><MemberManagement /></ProtectedRoute>} />
          
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
          
          {/* Real Estate Management Routes - DISABLED */}
          {/* <Route path="/crm/developers" element={<ProtectedRoute><DeveloperList /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/developers/new" element={<ProtectedRoute><DeveloperDetails /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/developers/:id" element={<ProtectedRoute><DeveloperDetails /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/real-estate-areas" element={<ProtectedRoute><RealEstateAreaList /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/real-estate-areas/new" element={<ProtectedRoute><RealEstateAreaDetails /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/real-estate-areas/:id" element={<ProtectedRoute><RealEstateAreaDetails /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/projects" element={<ProtectedRoute><ProjectList /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/projects/new" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} /> */}
          
          {/* AI Calling Routes - DISABLED */}
          {/* <Route path="/crm/ai-calling" element={<ProtectedRoute><AICallingDashboard /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/ai-calling/start" element={<ProtectedRoute><StartCallModal /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/ai-calling/calls/:callSessionId" element={<ProtectedRoute><CallDetails /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/ai-calling/history" element={<ProtectedRoute><CallHistory /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/ai-calling/knowledge" element={<ProtectedRoute><KnowledgeManager /></ProtectedRoute>} /> */}
          {/* <Route path="/crm/ai-calling/settings" element={<ProtectedRoute><AICallingSettings /></ProtectedRoute>} /> */}
          {/* === [LAUNCH PROTECTED ROUTES] === */}
          {/* PR-F */}
          <Route path="/integrations/ai-employee" element={<ProtectedRoute><AIEmployeeStatus /></ProtectedRoute>} />
          {/* === [/LAUNCH PROTECTED ROUTES] === */}

        </Routes>
      </SubscriptionProvider>
      </Router>
    </GoogleMapsProvider>
  );
}

export default App;
