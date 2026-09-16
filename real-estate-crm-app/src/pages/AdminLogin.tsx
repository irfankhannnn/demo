import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, Smartphone } from 'lucide-react';
import { redirectToLogin } from '../utils/cognitoAuth';
import { isAuthenticated } from '../utils/authStorage';
import { goToReturnPath, rememberReturnPath, sanitizeReturnPath } from '../utils/returnPath';

export default function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // e.g. /login?next=https://app.realestateflow.in/insta/accounts from the Instagram console
  const next = new URLSearchParams(location.search).get('next');

  // Check auth state in useEffect to prevent infinite redirect loop
  useEffect(() => {
    if (isAuthenticated()) {
      const returnTo = sanitizeReturnPath(next);
      if (returnTo) goToReturnPath(returnTo, navigate);
      else navigate('/crm', { replace: true });
    }
  }, [navigate, next]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      rememberReturnPath(next);
      await redirectToLogin();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[AdminLogin] Google redirect failed', err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-200/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-200/20 blur-[100px] pointer-events-none" />

      <div className="relative glass-premium rounded-3xl w-full max-w-md p-10 animate-scaleIn">
        {/* Logo/Icon */}
        <div className="text-center mb-8">
          <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 w-[72px] h-[72px] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/25 animate-float">
            <Lock className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-[28px] font-bold text-slate-900 mb-1.5 tracking-tight">Welcome back</h1>
          <p className="text-slate-500 text-[15px]">Sign in to access your CRM dashboard</p>
        </div>

        <div className="space-y-4">
          {/* Google Sign-In */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-2xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed btn-press flex items-center justify-center gap-3"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Redirecting...
              </span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Premium Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200/80" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-4 bg-white/80 text-slate-400 font-semibold uppercase tracking-wider">or</span>
            </div>
          </div>

          {/* Phone Sign-In */}
          <button
            onClick={() => {
              rememberReturnPath(next);
              navigate('/phone-login');
            }}
            disabled={loading}
            className="w-full bg-white/80 border-2 border-indigo-100 text-indigo-600 py-3.5 rounded-2xl font-semibold hover:bg-indigo-50/80 hover:border-indigo-200 transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed btn-press flex items-center justify-center gap-3"
          >
            <Smartphone className="w-5 h-5" />
            Continue with Phone
          </button>

          <div className="text-center pt-1">
            <p className="text-[11px] text-slate-400 font-medium tracking-wide">
              By signing in, you agree to our terms of service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
