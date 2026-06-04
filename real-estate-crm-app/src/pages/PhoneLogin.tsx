/**
 * Phone-based authentication page
 * Step 1: Enter phone number
 * Step 2: Enter OTP
 * Step 3: User details (if invited member)
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Smartphone, Shield, AlertCircle } from 'lucide-react';
import PhoneInput from '../components/PhoneInput';
import OTPInput from '../components/OTPInput';
import { getAccessToken, getIdToken, setOnboardingSession, setTokens, setUserProfile } from '../utils/authStorage';

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL as string;

type Step = 'phone' | 'otp' | 'details' | 'uninvited';

export default function PhoneLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOTP] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [session, setSession] = useState('');
  const [hasPendingInvite, setHasPendingInvite] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const handleSendOTP = async () => {
    if (phoneNumber.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${AUTH_API_URL}/auth/phone/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: `+91${phoneNumber}` }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send OTP');
      }

      // Store session for confirm step
      setSession(data.session);
      setStep('otp');
      setResendTimer(60);
      
      // Start resend timer
      const interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${AUTH_API_URL}/auth/phone/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: `+91${phoneNumber}`,
          otp,
          session,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check for NOT_ONBOARDED error - user is not pre-onboarded and has no invite
        if (data.code === 'NOT_ONBOARDED') {
          setStep('uninvited');
          return;
        }
        throw new Error(data.message || 'Invalid OTP. Please try again.');
      }

      const needsOnboarding = data.needsOnboarding === true;

      if (needsOnboarding) {
        setOnboardingSession(true, false);
      }

      // Store tokens immediately
      console.log('[PhoneLogin] Storing tokens:', {
        hasIdToken: !!data.tokens.idToken,
        hasAccessToken: !!data.tokens.accessToken,
        hasRefreshToken: !!data.tokens.refreshToken,
      });
      setTokens({
        idToken: data.tokens.idToken,
        accessToken: data.tokens.accessToken,
        refreshToken: data.tokens.refreshToken,
        expiresIn: 3600,
      });
      
      // Verify tokens are stored
      setTimeout(() => {
        const stored = getAccessToken();
        console.log('[PhoneLogin] Token storage check - accessToken exists:', !!stored);
      }, 100);

      // Check if user needs onboarding
      if (needsOnboarding) {
        console.log('[PhoneLogin] New user - checking invite status');
        
        // Store whether user has pending invites
        const hasInvite = data.hasPendingInvite === true;
        setHasPendingInvite(hasInvite);
        console.log(`[PhoneLogin] Has pending invite: ${hasInvite}, invite count: ${data.pendingInvitesCount || 0}`);
        
        if (hasInvite) {
          // Invited user - show onboarding form
          setStep('details');
        } else {
          // Not invited - show uninvited message
          setStep('uninvited');
        }
        return;
      }

      // Existing user - store profile and navigate
      if (data.existingUser) {
        console.log('[PhoneLogin] Existing user - navigating to dashboard');
        setOnboardingSession(false);
        setUserProfile({
          userId: data.user.userId,
          cognitoSub: data.user.sub,
          email: data.user.email || '',
          phoneNumber: data.user.phoneNumber,
          displayName: data.user.displayName,
          role: data.user.role,
          tenantId: data.user.tenantId,
          agency: data.agency
            ? { agencyName: data.agency.agencyName || '', status: data.agency.status || 'ACTIVE' }
            : null,
          status: data.user.status,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        });
        navigate('/crm');
      }
    } catch (err) {
      setOnboardingSession(false);
      setError(err instanceof Error ? err.message : 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboard = async () => {
    if (!displayName) {
      setError('Please enter your name');
      return;
    }

    // Only members with invites can reach this step
    // Admin self-registration is blocked - admins are auto-onboarded when pre-registered
    if (!hasPendingInvite) {
      setError('You must have an invitation to register. Please contact your administrator.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const idToken = getIdToken();
      const accessToken = getAccessToken();
      console.log('[PhoneLogin] Onboard - idToken exists:', !!idToken, 'accessToken exists:', !!accessToken);
      if (!idToken || !accessToken) {
        console.log('[PhoneLogin] Onboard - Missing tokens');
        throw new Error('Authentication tokens not found. Please try again.');
      }

      const response = await fetch(`${AUTH_API_URL}/auth/phone/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,         // ID Token for API Gateway authorizer
          'X-Access-Token': accessToken,                   // Access Token for backend cognito.getUser()
        },
        body: JSON.stringify({
          displayName,
          role: 'MEMBER', // Always MEMBER - admin self-registration is blocked
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to complete registration');
      }

      console.log('[PhoneLogin] Onboarding complete');
      setOnboardingSession(false);

      // Store user profile
      setUserProfile({
        userId: data.user.userId,
        cognitoSub: data.user.sub,
        email: data.user.email || '',
        phoneNumber: data.user.phoneNumber,
        displayName: data.user.displayName,
        role: data.user.role,
        tenantId: data.user.tenantId,
        agency: data.agency
          ? { agencyName: data.agency.agencyName || '', status: data.agency.status || 'ACTIVE' }
          : null,
        status: data.user.status,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });

      navigate('/crm');
    } catch (err) {
      // Try to parse error response
      try {
        if (err instanceof Error && err.message.includes('fetch')) {
          const errorMatch = err.message.match(/"message":"([^"]+)"/); 
          const codeMatch = err.message.match(/"code":"([^"]+)"/); 
          
          if (codeMatch && codeMatch[1] === 'NOT_INVITED') {
            // Handle specific invitation error
            console.log('[PhoneLogin] Member not invited error');
            setError('You do not have a valid invitation. Please register as an Admin or contact your administrator.');
            setStep('uninvited');
          } else if (errorMatch) {
            // Other API error with message
            setError(errorMatch[1]);
          } else {
            // Fallback
            setError(err.message);
          }
        } else {
          // Generic error
          setError(err instanceof Error ? err.message : 'Failed to complete registration');
        }
      } catch (parseErr) {
        // Last resort fallback
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOTP('');
    setError('');
    await handleSendOTP();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/60 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute top-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full bg-indigo-200/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-purple-200/15 blur-[120px] pointer-events-none" />

      <div className="relative glass-premium rounded-3xl w-full max-w-md p-8 animate-scaleIn shadow-2xl shadow-black/5">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 w-[60px] h-[60px] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/25 animate-float">
            <Smartphone className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-[26px] font-bold text-slate-900 mb-1.5 tracking-tight">Phone Login</h1>
          <p className="text-slate-500 text-[15px] leading-relaxed">
            {step === 'phone' && 'Enter your mobile number to get started'}
            {step === 'otp' && 'Enter the OTP sent to your phone'}
            {step === 'details' && 'Complete your profile'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50/80 border border-rose-200/60 rounded-2xl flex items-start gap-3 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700 font-medium">{error}</p>
          </div>
        )}

        {/* Step 1: Phone Number */}
        {step === 'phone' && (
          <div className="space-y-5 animate-fadeInUp">
            <PhoneInput value={phoneNumber} onChange={setPhoneNumber} error={error ? ' ' : ''} disabled={loading} />

            <button
              onClick={handleSendOTP}
              disabled={loading || phoneNumber.length !== 10}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-2xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed btn-press flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending OTP...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Send OTP
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: OTP Verification */}
        {step === 'otp' && (
          <div className="space-y-5 animate-fadeInUp">
            <div className="text-center">
              <p className="text-sm text-slate-500 font-medium">
                OTP sent to <span className="font-bold text-slate-700">+91 {phoneNumber}</span>
              </p>
            </div>

            <OTPInput value={otp} onChange={setOTP} error={error ? ' ' : ''} disabled={loading} />

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-2xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed btn-press"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <div className="text-center">
              {resendTimer > 0 ? (
                <p className="text-sm text-slate-400 font-medium">Resend OTP in {resendTimer}s</p>
              ) : (
                <button
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold transition-colors duration-200"
                >
                  Resend OTP
                </button>
              )}
            </div>

            <button
              onClick={() => setStep('phone')}
              className="w-full text-slate-500 hover:text-slate-800 text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-200 py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Change Phone Number
            </button>
          </div>
        )}

        {/* Step 3: Uninvited/Not Onboarded Message */}
        {step === 'uninvited' && (
          <div className="space-y-5 animate-fadeInUp">
            <div className="p-5 bg-amber-50/70 border border-amber-200/50 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-800 mb-1">Not Onboarded</h3>
                <p className="text-sm text-amber-700 leading-relaxed">
                  You are not registered in the system for <span className="font-bold">+91 {phoneNumber}</span>.
                </p>
                <p className="mt-2 text-sm text-amber-700 leading-relaxed">
                  Please contact your administrator to get onboarded before you can access the CRM.
                </p>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => setStep('phone')}
                className="w-full text-slate-500 hover:text-slate-800 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                Try Different Phone Number
              </button>
            </div>
          </div>
        )}

        {/* Step 4: User Details (for invited members only) */}
        {step === 'details' && (
          <div className="space-y-5 animate-fadeInUp">
            <div className="p-4 bg-indigo-50/60 border border-indigo-200/40 rounded-2xl">
              <p className="text-sm text-indigo-700 font-medium">
                You have been invited to join. Please complete your profile below.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name *</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.10)] focus:outline-none transition-all duration-200 bg-white/80 text-slate-800 placeholder:text-slate-400 font-medium"
              />
            </div>

            <button
              onClick={handleOnboard}
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-2xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed btn-press"
            >
              {loading ? 'Creating Account...' : 'Complete Registration'}
            </button>
          </div>
        )}

        {/* Back to Login */}
        <div className="mt-8 text-center">
          <Link
            to="/login"
            className="text-sm text-slate-500 hover:text-indigo-600 font-semibold flex items-center justify-center gap-2 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login Options
          </Link>
        </div>
      </div>
    </div>
  );
}
