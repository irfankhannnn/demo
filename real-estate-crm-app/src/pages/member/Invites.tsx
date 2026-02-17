import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Building2, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { callCheckInvite, callAcceptInvite, callMe } from '../../utils/cognitoAuth';
import { getIdToken, setUserProfile } from '../../utils/authStorage';

interface Invite {
  inviteCode: string;
  tenantId: string;
  agencyName: string;
  inviteeEmail: string;
  expiresAt: string;
  createdAt: string;
}

export default function Invites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchInvites();
  }, []);

  async function fetchInvites() {
    try {
      const idToken = getIdToken();
      if (!idToken) {
        navigate('/login', { replace: true });
        return;
      }

      const result = await callCheckInvite(idToken);
      const data = result.data || result;

      if (data.invites && data.invites.length > 0) {
        setInvites(data.invites);
      } else {
        navigate('/member/no-access', { replace: true });
      }
    } catch (err) {
      console.error('Failed to fetch invites:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(inviteCode: string) {
    try {
      setAccepting(inviteCode);
      setError('');

      const idToken = getIdToken();
      if (!idToken) {
        navigate('/login', { replace: true });
        return;
      }

      await callAcceptInvite(idToken, inviteCode);

      // Fetch and store user profile after accepting invite
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

      navigate('/crm', { replace: true });
    } catch (err) {
      console.error('Failed to accept invite:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setAccepting(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading invites...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-10 border border-slate-100">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Pending Invites</h1>
          <p className="text-slate-500">You have been invited to join the following agencies.</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg mb-6">
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Invite list */}
        <div className="space-y-4">
          {invites.map((invite) => (
            <div
              key={invite.inviteCode}
              className="border-2 border-slate-200 rounded-2xl p-5 hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 w-10 h-10 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{invite.agencyName}</h3>
                    <p className="text-sm text-slate-500">{invite.inviteeEmail}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                <Clock className="w-3.5 h-3.5" />
                <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
              </div>

              <button
                onClick={() => handleAccept(invite.inviteCode)}
                disabled={accepting === invite.inviteCode}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {accepting === invite.inviteCode ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Accept Invite
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
