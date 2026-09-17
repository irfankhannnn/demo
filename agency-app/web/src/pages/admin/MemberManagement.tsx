import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Users, User, Mail, Phone, Plus, CheckCircle, Clock } from 'lucide-react';
import { getIdToken, getUserProfile } from '../../utils/authStorage';
import { adminStartEmailLink, adminStartPhoneLink } from '../../services/contactLinkApi';
import SeatCounter from '../../components/SeatCounter';
import { AUTH_API_URL } from '../../config/apiConfig';

type Role = 'ADMIN' | 'MEMBER';
type Status = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

interface Member {
  userId: string;
  cognitoSub: string;
  email?: string;
  phoneNumber?: string;
  displayName: string;
  role: Role;
  status: Status;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  pendingEmail?: string;
  pendingPhoneNumber?: string;
}


export default function MemberManagement() {
  const navigate = useNavigate();
  const profile = getUserProfile();
  const isAdmin = profile?.role === 'ADMIN';

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [addingEmailFor, setAddingEmailFor] = useState<string | null>(null);
  const [addingPhoneFor, setAddingPhoneFor] = useState<string | null>(null);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  const sortedMembers = useMemo(() => {
    const copy = [...members];
    copy.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'ADMIN' ? -1 : 1;
      return (a.email || '').localeCompare(b.email || '');
    });
    return copy;
  }, [members]);

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const idToken = getIdToken();
      if (!idToken) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${AUTH_API_URL}/users`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Failed to load members' }));
        throw new Error(err.message || err.error || 'Failed to load members');
      }

      const data = await response.json();
      setMembers((data.users || []) as Member[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/member/no-access', { replace: true });
      return;
    }

    loadMembers();
  }, [isAdmin, loadMembers, navigate]);

  const handleDelete = async (member: Member) => {
    setError('');
    setSuccess('');

    if (member.role !== 'MEMBER') {
      setError('Only members can be deleted');
      return;
    }

    const confirmed = confirm(`Delete member ${member.email || member.phoneNumber || member.displayName}?`);
    if (!confirmed) return;

    try {
      setDeletingUserId(member.userId);

      const idToken = getIdToken();
      if (!idToken) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${AUTH_API_URL}/users/${member.userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Failed to delete member' }));
        throw new Error(err.message || err.error || 'Failed to delete member');
      }

      setSuccess('Member deleted successfully');
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete member');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleAdminAddEmail = async (userId: string) => {
    if (!newEmailInput.trim()) return;
    setLinkLoading(true); setError(''); setSuccess('');
    try {
      await adminStartEmailLink(userId, newEmailInput.trim());
      setSuccess('Pending email saved. User must log in with Google using that email to verify.');
      setAddingEmailFor(null); setNewEmailInput('');
      await loadMembers();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to add email');
    } finally { setLinkLoading(false); }
  };

  const handleAdminAddPhone = async (userId: string) => {
    if (!newPhoneInput.trim()) return;
    setLinkLoading(true); setError(''); setSuccess('');
    try {
      await adminStartPhoneLink(userId, newPhoneInput.trim());
      setSuccess('OTP sent to the phone number. User must verify it to complete linking.');
      setAddingPhoneFor(null); setNewPhoneInput('');
      await loadMembers();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to add phone');
    } finally { setLinkLoading(false); }
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/crm')}
                className="p-2 text-slate-600 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-50"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Members</h1>
                <p className="text-sm text-slate-500">Manage your agency team</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/admin/invites"
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Team Invites
              </Link>
              <button
                onClick={loadMembers}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-medium"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* PR-H: Seat counter */}
        <div className="mb-4">
          <SeatCounter />
        </div>
        {success && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-700 px-4 py-3 rounded-r-lg">
            <p className="text-sm font-medium">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">All Members ({sortedMembers.length})</h2>
          </div>

          {sortedMembers.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No members found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {sortedMembers.map((m) => (
                <div key={m.cognitoSub} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="font-medium text-slate-900">{m.displayName}</span>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                            m.role === 'ADMIN'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {m.role}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                            m.status === 'ACTIVE'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                        {m.email ? (
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4 text-blue-500" />
                            <span className="font-medium text-slate-700">{m.email}</span>
                            {m.emailVerified && <CheckCircle className="w-3 h-3 text-green-500" />}
                          </span>
                        ) : addingEmailFor === m.userId ? (
                          <span className="flex items-center gap-1">
                            <input type="email" value={newEmailInput} onChange={(e) => setNewEmailInput(e.target.value)} placeholder="Email" className="px-2 py-1 border rounded-lg text-xs w-48" autoFocus />
                            <button onClick={() => handleAdminAddEmail(m.userId)} disabled={linkLoading} className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 disabled:opacity-50">{linkLoading ? '...' : 'Save'}</button>
                            <button onClick={() => { setAddingEmailFor(null); setNewEmailInput(''); }} className="px-2 py-1 text-slate-400 text-xs">Cancel</button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4 text-slate-300" />
                            {m.pendingEmail ? (
                              <span className="flex items-center gap-1 text-amber-600"><Clock className="w-3 h-3" />{m.pendingEmail}</span>
                            ) : (
                              <button onClick={() => { setAddingEmailFor(m.userId); setNewEmailInput(''); setError(''); }} className="text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus className="w-3 h-3" />Add email</button>
                            )}
                          </span>
                        )}
                        {m.phoneNumber ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4 text-purple-500" />
                            <span className="font-medium text-slate-700">{m.phoneNumber}</span>
                            {m.phoneVerified && <CheckCircle className="w-3 h-3 text-green-500" />}
                          </span>
                        ) : addingPhoneFor === m.userId ? (
                          <span className="flex items-center gap-1">
                            <input type="tel" value={newPhoneInput} onChange={(e) => setNewPhoneInput(e.target.value)} placeholder="Phone" className="px-2 py-1 border rounded-lg text-xs w-48" autoFocus />
                            <button onClick={() => handleAdminAddPhone(m.userId)} disabled={linkLoading} className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 disabled:opacity-50">{linkLoading ? '...' : 'Send OTP'}</button>
                            <button onClick={() => { setAddingPhoneFor(null); setNewPhoneInput(''); }} className="px-2 py-1 text-slate-400 text-xs">Cancel</button>
                          </span>
                        ) : !m.phoneNumber && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4 text-slate-300" />
                            {m.pendingPhoneNumber ? (
                              <span className="flex items-center gap-1 text-amber-600"><Clock className="w-3 h-3" />{m.pendingPhoneNumber}</span>
                            ) : (
                              <button onClick={() => { setAddingPhoneFor(m.userId); setNewPhoneInput(''); setError(''); }} className="text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus className="w-3 h-3" />Add phone</button>
                            )}
                          </span>
                        )}
                        <span>Last login: {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleDelete(m)}
                        disabled={m.role !== 'MEMBER' || deletingUserId === m.userId}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        title={m.role !== 'MEMBER' ? 'Admins cannot be deleted' : 'Delete member'}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingUserId === m.userId ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
