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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 border border-gray-100">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Phone Login</h1>
          <p className="text-gray-600">
            {step === 'phone' && 'Enter your mobile number to get started'}
            {step === 'otp' && 'Enter the OTP sent to your phone'}
            {step === 'details' && 'Complete your profile'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Step 1: Phone Number */}
        {step === 'phone' && (
          <div className="space-y-6">
            <PhoneInput value={phoneNumber} onChange={setPhoneNumber} error={error ? ' ' : ''} disabled={loading} />

            <button
              onClick={handleSendOTP}
              disabled={loading || phoneNumber.length !== 10}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
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
          <div className="space-y-6">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600">
                OTP sent to <span className="font-semibold">+91 {phoneNumber}</span>
              </p>
            </div>

            <OTPInput value={otp} onChange={setOTP} error={error ? ' ' : ''} disabled={loading} />

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <div className="text-center">
              {resendTimer > 0 ? (
                <p className="text-sm text-gray-500">Resend OTP in {resendTimer}s</p>
              ) : (
                <button onClick={handleResendOTP} disabled={loading} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Resend OTP
                </button>
              )}
            </div>

            <button onClick={() => setStep('phone')} className="w-full text-gray-600 hover:text-gray-800 text-sm font-medium flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Change Phone Number
            </button>
          </div>
        )}

        {/* Step 3: Uninvited/Not Onboarded Message */}
        {step === 'uninvited' && (
          <div className="space-y-6">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 mb-1">Not Onboarded</h3>
                <p className="text-sm text-amber-700">
                  You are not registered in the system for <span className="font-semibold">+91 {phoneNumber}</span>.
                </p>
                <p className="mt-2 text-sm text-amber-700">
                  Please contact your administrator to get onboarded before you can access the CRM.
                </p>
              </div>
            </div>
            
            <div className="text-center">
              <button 
                onClick={() => setStep('phone')}
                className="w-full text-gray-600 hover:text-gray-800 py-3 text-sm font-medium flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Try Different Phone Number
              </button>
            </div>
          </div>
        )}

        {/* Step 4: User Details (for invited members only) */}
        {step === 'details' && (
          <div className="space-y-6">
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <p className="text-sm text-indigo-700">
                You have been invited to join. Please complete your profile below.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
              />
            </div>

            <button
              onClick={handleOnboard}
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Complete Registration'}
            </button>
          </div>
        )}

        {/* Back to Login */}
        <div className="mt-8 text-center">
          <Link to="/login" className="text-sm text-gray-600 hover:text-indigo-600 font-medium flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Login Options
          </Link>
        </div>
      </div>
    </div>
  );
}
