import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { GoogleMapsProvider } from './contexts/GoogleMapsContext';
import { isAuthenticated as checkAuth, getIdToken, setUserProfile, getUserProfile, isProfileFresh, clearAuth, hasOnboardingSession, setTokens } from './utils/authStorage';
import { callMe, refreshTokens } from './utils/cognitoAuth';
import { identifyUser } from './lib/analytics';
import { registerDeepLinkHandler, registerResumeHandler } from './lib/nativeAuth';

// === [LAUNCH COMPONENT IMPORTS] ===
// PR-A
import DemoBanner from './components/DemoBanner';
// PR-J
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { CreditsProvider } from './contexts/CreditsContext';
import TrialCountdownBanner from './components/TrialCountdownBanner';
import PaywallModal from './components/PaywallModal';
import BuyCreditsModal, { InsufficientCreditsListener } from './components/BuyCreditsModal';
// PR-C
import CookieConsentBanner from './components/CookieConsentBanner';
// PR-K
import NpsModal from './components/NpsModal';
import NpsEmailLanding from './pages/public/NpsEmailLanding';
import LegalDocument from './pages/public/LegalDocument';
// === [/LAUNCH COMPONENT IMPORTS] ===

function SignupRedirect() {
  const location = useLocation();
  return <Navigate to={`/phone-login${location.search}`} replace />;
}

/**
 * Routes native deep links into the app.
 *
 * On native, OAuth completes in a separate system browser and the OS hands the
 * result back as `in.realestateflow.app://auth/callback?code=...`. This turns
 * that into an in-app navigation so AuthCallback — the same component the web
 * flow uses — does the code exchange. Renders nothing, and is inert on web.
 *
 * Must live inside <Router> because it needs useNavigate.
 */
function NativeDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => registerDeepLinkHandler((path) => navigate(path, { replace: true })), [navigate]);

  return null;
}

// Pages
import AdminLogin from './pages/AdminLogin';
import PhoneLogin from './pages/PhoneLogin';
import AuthCallback from './pages/AuthCallback';
import Profile from './pages/Profile';

// Onboarding Pages
import RoleSelection from './pages/RoleSelection';
import AcceptInvite from './pages/AcceptInvite';
import RegisterAdmin from './pages/RegisterAdmin';
import ConnectWhatsApp from './pages/onboarding/ConnectWhatsApp';

// Member Pages
import Invites from './pages/member/Invites';
import NoAccess from './pages/member/NoAccess';

// Admin Pages
import InviteManagement from './pages/admin/InviteManagement';
import MemberManagement from './pages/admin/MemberManagement';
import TeamAnalytics from './pages/admin/TeamAnalytics';

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
import BillingSettings from './pages/crm/BillingSettings';
import ContactList from './pages/crm/ContactList';
import ContactDetails from './pages/crm/ContactDetails';

// PR-F
import AIEmployeeStatus from './pages/crm/AIEmployeeStatus';
import AiEmployeePage from './pages/crm/AiEmployee';
import WhatsAppInbox from './pages/crm/WhatsAppInbox';
import AiIntegrations from './pages/crm/AiIntegrations';
import CallRecordings from './pages/crm/CallRecordings';



const ProtectedRoute = ({ children, authState }: { children: JSX.Element; authState: 'loading' | 'authenticated' | 'unauthenticated' }) => {
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

function App() {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [showPaywall, setShowPaywall] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  useEffect(() => {
    async function initAuth() {
      const onboardingActive = hasOnboardingSession();

      // Check if we have a fresh cached profile (< 60s old)
      const cachedProfile = getUserProfile();
      const profileIsFresh = isProfileFresh(60);

      // If profile is fresh, skip /auth/me and set authenticated immediately
      if (cachedProfile && profileIsFresh) {
        setAuthState('authenticated');
        return;
      }

      // Check if we have an ID token
      const idToken = getIdToken();
      // If no ID token, unauthenticated (refresh token lives in httpOnly cookie)
      if (!idToken) {
        setAuthState('unauthenticated');
        return;
      }

      // If token exists but is expired, attempt refresh via httpOnly cookie
      if (!checkAuth() && !onboardingActive) {
        try {
          const newTokens = await refreshTokens();
          setTokens(newTokens);
        } catch (refreshErr) {
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
          const meResult = await callMe(currentIdToken);
          const meData = meResult.data || meResult;
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
          // Attempt to refresh token if /auth/me fails (likely due to expired token)
          if (!onboardingActive) {
            try {
              const newTokens = await refreshTokens();
              setTokens(newTokens);
              const meResult = await callMe(newTokens.idToken);
              const meData = meResult.data || meResult;
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
              // Token refresh failed
            }
          }

          if (onboardingActive) {
            setAuthState('authenticated');
            return;
          }

          if (!cachedProfile) {
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

  // Proactive token refresh: heartbeat every 30 minutes PLUS threshold-based
  // refresh when expiry < 15 minutes. The heartbeat keeps the httpOnly
  // refresh cookie alive on the auth microservice.
  useEffect(() => {
    if (authState !== 'authenticated') return;

    const REFRESH_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
    const CHECK_INTERVAL_MS = 5 * 60 * 1000;      // 5 minutes

    let lastRefresh = Date.now();
    let isRefreshing = false;

    const doRefresh = async (reason: string) => {
      // Prevent concurrent refresh attempts from multiple intervals/timeouts.
      if (isRefreshing) return;
      isRefreshing = true;
      try {
        const newTokens = await refreshTokens();
        setTokens(newTokens);
        lastRefresh = Date.now();
      } catch (err) {
        console.error(`Token refresh failed (${reason}):`, err);
        window.dispatchEvent(new Event('auth-changed'));
      } finally {
        isRefreshing = false;
      }
    };

    const checkAndRefresh = async () => {
      try {
        const expiryStr = localStorage.getItem('auth_token_expiry');
        if (!expiryStr) {
          await doRefresh('missing expiry');
          return;
        }

        const expiry = Number(expiryStr);
        const timeUntilExpiry = expiry - Date.now();

        const timeSinceLastRefresh = Date.now() - lastRefresh;
        const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000;
        if (timeUntilExpiry < REFRESH_THRESHOLD_MS || timeSinceLastRefresh >= HEARTBEAT_INTERVAL_MS) {
          await doRefresh(timeUntilExpiry < REFRESH_THRESHOLD_MS ? 'near expiry' : 'heartbeat');
        }
      } catch (err) {
        console.error('Token refresh check failed:', err);
      }
    };

    const intervalId = setInterval(checkAndRefresh, CHECK_INTERVAL_MS);
    // Defer initial check to avoid blocking app load
    const timeoutId = setTimeout(() => {
      checkAndRefresh().catch(err => console.error('Initial token refresh failed:', err));
    }, 1000);

    // The interval above is a JS timer, and mobile operating systems suspend
    // timers for backgrounded apps. An app resumed after more than an hour would
    // otherwise hold an expired token and fail its first API call before this
    // ever ticked. Re-check the moment we come back to the foreground.
    const unregisterResume = registerResumeHandler(() => {
      checkAndRefresh().catch(err => console.error('Resume token refresh failed:', err));
    });

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      unregisterResume();
    };
  }, [authState]);

  return (
    <Router>
      <NativeDeepLinks />
      <GoogleMapsProvider>
        <SubscriptionProvider>
          <CreditsProvider>
          {/* PR-A: Demo banner */}
          <DemoBanner />
          {/* PR-J: Trial countdown + paywall */}
          <TrialCountdownBanner onUpgradeClick={() => setShowPaywall(true)} />
          <PaywallModal forceOpen={showPaywall} onClose={() => setShowPaywall(false)} />
          <BuyCreditsModal forceOpen={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
          <InsufficientCreditsListener onTrigger={() => setShowBuyCredits(true)} />
          {/* PR-K: NPS */}
          <NpsModal />
          <CookieConsentBanner />

          <Routes>
            {/* Public routes */}
            <Route path="/grievance" element={<Grievance />} />
            <Route path="/nps" element={<NpsEmailLanding />} />
            {/* Public legal routes. CookieConsentBanner and Grievance already
                linked here, but the routes did not exist, so both links fell
                through the catch-all. An unreachable privacy policy is a
                straightforward store rejection. */}
            <Route path="/legal/privacy" element={<LegalDocument kind="privacy" />} />
            <Route path="/legal/terms" element={<LegalDocument kind="terms" />} />
            <Route path="/legal/cookies" element={<LegalDocument kind="cookies" />} />
            <Route path="/legal/refund" element={<LegalDocument kind="refund" />} />
            {/* === [/LAUNCH PUBLIC ROUTES] === */}
            <Route path="/login" element={<AdminLogin />} />
            <Route path="/signup" element={<SignupRedirect />} />
            <Route path="/phone-login" element={<PhoneLogin />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Onboarding Routes (authenticated but not registered) */}
            <Route path="/onboarding/role-selection" element={<ProtectedRoute authState={authState}><RoleSelection /></ProtectedRoute>} />
            <Route path="/onboarding/register-admin" element={<ProtectedRoute authState={authState}><RegisterAdmin /></ProtectedRoute>} />
            <Route path="/onboarding/connect-whatsapp" element={<ProtectedRoute authState={authState}><ConnectWhatsApp /></ProtectedRoute>} />
            <Route path="/onboarding/accept-invite" element={<ProtectedRoute authState={authState}><AcceptInvite /></ProtectedRoute>} />

            {/* Member Routes (post-auth but pre-registration) */}
            <Route path="/member/invites" element={<ProtectedRoute authState={authState}><Invites /></ProtectedRoute>} />
            <Route path="/member/no-access" element={<NoAccess />} />

            {/* Protected Routes */}
            <Route path="/" element={<ProtectedRoute authState={authState}><Navigate to="/crm" replace /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute authState={authState}><Navigate to="/crm" replace /></ProtectedRoute>} />
            <Route path="/admin/dashboard" element={<ProtectedRoute authState={authState}><CRMDashboard /></ProtectedRoute>} />
            <Route path="/rental-list" element={<ProtectedRoute authState={authState}><Navigate to="/crm/properties" replace /></ProtectedRoute>} />
            <Route path="/building/:id" element={<ProtectedRoute authState={authState}><Navigate to="/crm/properties" replace /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute authState={authState}><Profile /></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/admin/grievances" element={<ProtectedRoute authState={authState}><GrievanceList /></ProtectedRoute>} />
            <Route path="/admin/invites" element={<ProtectedRoute authState={authState}><InviteManagement /></ProtectedRoute>} />
            <Route path="/admin/members" element={<ProtectedRoute authState={authState}><MemberManagement /></ProtectedRoute>} />
            <Route path="/admin/team-analytics" element={<ProtectedRoute authState={authState}><TeamAnalytics /></ProtectedRoute>} />

            {/* CRM Routes */}
            <Route path="/crm" element={<ProtectedRoute authState={authState}><CRMDashboard /></ProtectedRoute>} />
            <Route path="/crm/tenants" element={<ProtectedRoute authState={authState}><TenantList /></ProtectedRoute>} />
            <Route path="/crm/tenants/:id" element={<ProtectedRoute authState={authState}><TenantDetails /></ProtectedRoute>} />
            <Route path="/crm/tenants/new" element={<ProtectedRoute authState={authState}><TenantDetails /></ProtectedRoute>} />
            {/* Redirect old customer routes to tenant routes */}
            <Route path="/crm/customers" element={<Navigate to="/crm/tenants" replace />} />
            <Route path="/crm/customers/:id" element={<Navigate to="/crm/tenants" replace />} />
            <Route path="/crm/customers/new" element={<Navigate to="/crm/tenants/new" replace />} />
            <Route path="/crm/owners" element={<ProtectedRoute authState={authState}><OwnerList /></ProtectedRoute>} />
            <Route path="/crm/owners/:id" element={<ProtectedRoute authState={authState}><OwnerDetails /></ProtectedRoute>} />
            <Route path="/crm/owners/new" element={<ProtectedRoute authState={authState}><OwnerDetails /></ProtectedRoute>} />
            <Route path="/crm/properties" element={<ProtectedRoute authState={authState}><PropertyList /></ProtectedRoute>} />
            <Route path="/crm/properties/:id" element={<ProtectedRoute authState={authState}><PropertyDetails /></ProtectedRoute>} />
            <Route path="/crm/properties/new" element={<ProtectedRoute authState={authState}><PropertyDetails /></ProtectedRoute>} />
            <Route path="/crm/hierarchy" element={<ProtectedRoute authState={authState}><Hierarchy /></ProtectedRoute>} />
            <Route path="/crm/rented-properties" element={<ProtectedRoute authState={authState}><RentedProperties /></ProtectedRoute>} />
            <Route path="/crm/b2b-leads" element={<ProtectedRoute authState={authState}><B2BLeadsList /></ProtectedRoute>} />
            <Route path="/crm/analytics" element={<ProtectedRoute authState={authState}><BusinessAnalytics /></ProtectedRoute>} />
            <Route path="/crm/calendar" element={<ProtectedRoute authState={authState}><Calendar /></ProtectedRoute>} />
            <Route path="/crm/khata" element={<ProtectedRoute authState={authState}><KhataBook /></ProtectedRoute>} />
            <Route path="/crm/khata/new" element={<ProtectedRoute authState={authState}><KhataEntryForm /></ProtectedRoute>} />
            <Route path="/crm/khata/:entryId" element={<ProtectedRoute authState={authState}><KhataEntryForm /></ProtectedRoute>} />
            <Route path="/crm/khata/:entryId/edit" element={<ProtectedRoute authState={authState}><KhataEntryForm /></ProtectedRoute>} />
            <Route path="/crm/khata/settlement" element={<ProtectedRoute authState={authState}><KhataSettlement /></ProtectedRoute>} />
            
            {/* AI Integrations */}
            <Route path="/crm/ai-integrations" element={<ProtectedRoute authState={authState}><AiIntegrations /></ProtectedRoute>} />

            {/* Buyer Routes */}
            <Route path="/crm/buyers" element={<ProtectedRoute authState={authState}><BuyerList /></ProtectedRoute>} />
            <Route path="/crm/buyers/new" element={<ProtectedRoute authState={authState}><BuyerDetails /></ProtectedRoute>} />
            <Route path="/crm/buyers/:id" element={<ProtectedRoute authState={authState}><BuyerDetails /></ProtectedRoute>} />

            <Route path="/crm/contacts" element={<ProtectedRoute authState={authState}><ContactList /></ProtectedRoute>} />
            <Route path="/crm/contacts/new" element={<ProtectedRoute authState={authState}><ContactDetails /></ProtectedRoute>} />
            <Route path="/crm/contacts/:id" element={<ProtectedRoute authState={authState}><ContactDetails /></ProtectedRoute>} />

            {/* Lead Routes */}
            <Route path="/crm/settings/billing" element={<ProtectedRoute authState={authState}><BillingSettings /></ProtectedRoute>} />
            <Route path="/crm/leads" element={<ProtectedRoute authState={authState}><LeadList /></ProtectedRoute>} />
            <Route path="/crm/leads/new" element={<ProtectedRoute authState={authState}><LeadDetails /></ProtectedRoute>} />
            <Route path="/crm/leads/:id" element={<ProtectedRoute authState={authState}><LeadDetails /></ProtectedRoute>} />

            <Route path="/integrations/ai-employee" element={<ProtectedRoute authState={authState}><AIEmployeeStatus /></ProtectedRoute>} />
            <Route path="/crm/ai-employee" element={<ProtectedRoute authState={authState}><AiEmployeePage /></ProtectedRoute>} />
            <Route path="/crm/whatsapp-inbox" element={<ProtectedRoute authState={authState}><WhatsAppInbox /></ProtectedRoute>} />

            {/* Call Intelligence */}
            <Route path="/crm/call-recordings" element={<ProtectedRoute authState={authState}><CallRecordings /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/crm" replace />} />
          </Routes>
          </CreditsProvider>
        </SubscriptionProvider>
      </GoogleMapsProvider>
    </Router>
  );
}

export default App;







