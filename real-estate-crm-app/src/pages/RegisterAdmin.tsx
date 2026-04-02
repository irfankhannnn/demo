import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIdToken } from '../utils/authStorage';
import { callMe } from '../utils/cognitoAuth';
import { setUserProfile } from '../utils/authStorage';

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL as string;

export default function RegisterAdmin() {
  const [formData, setFormData] = useState({
    agencyName: '',
    displayName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const idToken = getIdToken();
      if (!idToken) {
        throw new Error('Not authenticated. Please log in again.');
      }

      console.log('[REGISTER_ADMIN] Submitting registration:', formData);

      const response = await fetch(`${AUTH_API_URL}/auth/register-admin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to register admin');
      }

      const data = await response.json();
      console.log('[REGISTER_ADMIN] Registration successful:', data);

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

      console.log('[REGISTER_ADMIN] Navigating to /admin/dashboard');
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      console.error('[REGISTER_ADMIN] Error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 border border-slate-100">
        <div className="text-center mb-8">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Your Agency</h1>
          <p className="text-slate-600">Set up your real estate agency and start managing your team</p>
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="agencyName" className="block text-sm font-semibold text-slate-700 mb-2">
              Agency Name
            </label>
            <input
              type="text"
              id="agencyName"
              required
              value={formData.agencyName}
              onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
              placeholder="Enter your agency name"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="displayName" className="block text-sm font-semibold text-slate-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              id="displayName"
              required
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
              placeholder="Enter your full name"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Agency...
              </span>
            ) : (
              'Create Agency'
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
