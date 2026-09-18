import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getIdToken } from '../utils/authStorage';
import { callMe } from '../utils/cognitoAuth';
import { setUserProfile } from '../utils/authStorage';
import { AUTH_API_URL } from '../config/apiConfig';


interface Invite {
  inviteCode: string;
  tenantId: string;
  agencyName: string;
  inviteeEmail: string;
  expiresAt: string;
  createdAt: string;
}

export default function AcceptInvite() {
  const location = useLocation();
  const navigate = useNavigate();
  const invites = (location.state?.invites || []) as Invite[];
  
  const [selectedInvite, setSelectedInvite] = useState<Invite | null>(invites[0] || null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInvite) {
      setError('Please select an invitation');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const idToken = getIdToken();
      if (!idToken) {
        throw new Error('Not authenticated. Please log in again.');
      }

      console.log('[ACCEPT_INVITE] Accepting invite:', selectedInvite.inviteCode);

      const response = await fetch(`${AUTH_API_URL}/auth/accept-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteCode: selectedInvite.inviteCode,
          displayName: displayName || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to accept invitation');
      }

      const data = await response.json();
      console.log('[ACCEPT_INVITE] Invitation accepted:', data);

      // Fetch full profile
      const meResult = await callMe(idToken);
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

      console.log('[ACCEPT_INVITE] Navigating to /crm');
      navigate('/crm', { replace: true });
    } catch (err) {
      console.error('[ACCEPT_INVITE] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      setLoading(false);
    }
  };

  if (invites.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 border border-slate-100 text-center">
          <div className="bg-red-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">No Invitations Found</h1>
          <p className="text-slate-600 mb-6">You don't have any pending team invitations.</p>
          <button
            onClick={() => navigate('/onboarding/role-selection', { replace: true })}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all"
          >
            Back to Role Selection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 border border-slate-100">
        <div className="text-center mb-8">
          <div className="bg-gradient-to-br from-emerald-600 to-teal-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Accept Team Invitation</h1>
          <p className="text-slate-600">Join your team and start collaborating</p>
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

        <form onSubmit={handleAcceptInvite} className="space-y-6">
          {invites.length > 1 ? (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Select Team to Join
              </label>
              <div className="space-y-2">
                {invites.map((invite) => (
                  <label
                    key={invite.inviteCode}
                    className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedInvite?.inviteCode === invite.inviteCode
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="invite"
                      checked={selectedInvite?.inviteCode === invite.inviteCode}
                      onChange={() => setSelectedInvite(invite)}
                      className="sr-only"
                      disabled={loading}
                    />
                    <div className="flex items-center">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{invite.agencyName}</p>
                        <p className="text-sm text-slate-600 mt-1">{invite.inviteeEmail}</p>
                      </div>
                      {selectedInvite?.inviteCode === invite.inviteCode && (
                        <svg className="w-6 h-6 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="font-semibold text-slate-900 mb-1">{selectedInvite?.agencyName}</p>
              <p className="text-sm text-slate-600">{selectedInvite?.inviteeEmail}</p>
            </div>
          )}

          <div>
            <label htmlFor="displayName" className="block text-sm font-semibold text-slate-700 mb-2">
              Your Name (Optional)
            </label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
              placeholder="Enter your full name"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Accepting Invitation...
              </span>
            ) : (
              'Accept Invitation'
            )}
          </button>
        </form>

        <button
          onClick={() => navigate('/onboarding/role-selection', { replace: true })}
          disabled={loading}
          className="w-full mt-4 text-slate-600 hover:text-slate-900 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          ← Back to role selection
        </button>
      </div>
    </div>
  );
}
