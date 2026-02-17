import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { exchangeCodeForTokens, callBootstrap, callMe } from '../utils/cognitoAuth';
import { setUserProfile } from '../utils/authStorage';

export default function AuthCallback() {
  const [status, setStatus] = useState('Signing you in...');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasRun.current) {
      return;
    }
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const authError = params.get('error');
    const errorDescription = params.get('error_description');

    if (authError) {
      setError(errorDescription || authError);
      return;
    }

    if (!code) {
      setError('No authorization code received. Please try logging in again.');
      return;
    }

    handleCallback(code);
  }, []);

  const handleCallback = async (code: string) => {
    try {
      setStatus('Exchanging authorization code for tokens...');
      const tokens = await exchangeCodeForTokens(code);
      setStatus('Setting up your session...');
      const bootstrapResult = await callBootstrap(tokens.idToken);
      
      if (bootstrapResult.exists) {
        setStatus('Loading your profile...');
        const meResult = await callMe(tokens.idToken);
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
        navigate(meData.user.role === 'ADMIN' ? '/admin/dashboard' : '/crm', { replace: true });
      } else {
        navigate('/onboarding/role-selection', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 border border-slate-100 text-center">
          <div className="bg-red-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Authentication Error</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 border border-slate-100 text-center">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <svg className="animate-spin h-10 w-10 text-white" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{status}</h1>
        <p className="text-slate-500">Please wait while we set up your session.</p>
      </div>
    </div>
  );
}
