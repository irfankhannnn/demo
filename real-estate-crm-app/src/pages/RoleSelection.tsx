import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIdToken } from '../utils/authStorage';

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL as string;

export default function RoleSelection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAdminSelection = async () => {
    setLoading(true);
    setError('');
    
    try {
      const idToken = getIdToken();
      if (!idToken) {
        throw new Error('Not authenticated. Please log in again.');
      }

      console.log('[ONBOARDING] User selected ADMIN role');
      
      // For now, we'll navigate to a form to collect agency name
      // In the next step, we'll create the RegisterAdmin component
      navigate('/onboarding/register-admin', { replace: true });
    } catch (err) {
      console.error('[ONBOARDING] Admin selection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to continue as admin');
      setLoading(false);
    }
  };

  const handleMemberSelection = async () => {
    setLoading(true);
    setError('');
    
    try {
      const idToken = getIdToken();
      if (!idToken) {
        throw new Error('Not authenticated. Please log in again.');
      }

      console.log('[ONBOARDING] User selected MEMBER role, checking for invites...');

      // Check if user has any pending invites
      const response = await fetch(`${AUTH_API_URL}/auth/check-invite`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to check invitations');
      }

      const data = await response.json();
      console.log('[ONBOARDING] Invite check result:', data);

      if (data.inviteFound && data.invites && data.invites.length > 0) {
        console.log('[ONBOARDING] Invites found, navigating to accept-invite page');
        navigate('/onboarding/accept-invite', { 
          replace: true,
          state: { invites: data.invites }
        });
      } else {
        console.log('[ONBOARDING] No invites found');
        setError('You have not been invited to any team. Please ask your team admin to invite you.');
        setLoading(false);
      }
    } catch (err) {
      console.error('[ONBOARDING] Member selection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to check invitations');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-10 border border-slate-100">
        <div className="text-center mb-8">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome! 👋</h1>
          <p className="text-slate-600">Choose how you'd like to get started</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Admin Option */}
          <button
            onClick={handleAdminSelection}
            disabled={loading}
            className="group relative p-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border-2 border-indigo-200 hover:border-indigo-400 transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="text-center">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Continue as Admin</h3>
              <p className="text-sm text-slate-600">
                Create your own agency and manage your team
              </p>
            </div>
          </button>

          {/* Member Option */}
          <button
            onClick={handleMemberSelection}
            disabled={loading}
            className="group relative p-8 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-200 hover:border-emerald-400 transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="text-center">
              <div className="bg-gradient-to-br from-emerald-600 to-teal-600 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Continue as Member</h3>
              <p className="text-sm text-slate-600">
                Join your team with an invitation
              </p>
            </div>
          </button>
        </div>

        {loading && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center text-indigo-600">
              <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-medium">Processing...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
