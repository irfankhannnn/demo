import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Mail, ArrowLeft, Trash2, CheckCircle, XCircle, Clock, Shield, Pencil } from 'lucide-react';
import { getIdToken } from '../../utils/authStorage';

interface Invite {
  inviteCode: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
  expiresAt?: string;
  acceptedAt?: string;
}

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL as string;

export default function InviteManagement() {
  const navigate = useNavigate();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [editingInviteCode, setEditingInviteCode] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    try {
      setLoading(true);
      const idToken = getIdToken();
      if (!idToken) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${AUTH_API_URL}/invites`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load invites');
      }

      const data = await response.json();
      const mappedInvites: Invite[] = (data.invites || []).map((inv: any) => ({
        inviteCode: inv.inviteCode,
        email: inv.inviteeEmail,
        status: inv.status,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
      }));
      setInvites(mappedInvites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (invite: Invite) => {
    setError('');
    setSuccess('');
    setEditingInviteCode(invite.inviteCode);
    setEditingEmail(invite.email);
  };

  const cancelEdit = () => {
    setEditingInviteCode(null);
    setEditingEmail('');
    setSavingEdit(false);
  };

  const saveEdit = async () => {
    if (!editingInviteCode) return;
    setError('');
    setSuccess('');

    if (!editingEmail.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setSavingEdit(true);
      const idToken = getIdToken();
      if (!idToken) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${AUTH_API_URL}/invites/${editingInviteCode}/email`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: editingEmail.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update invite email' }));
        throw new Error(errorData.message || errorData.error || 'Failed to update invite email');
      }

      setSuccess('Invite email updated successfully!');
      cancelEdit();
      await loadInvites();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update invite email');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newInviteEmail.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setCreating(true);
      const idToken = getIdToken();
      if (!idToken) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${AUTH_API_URL}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: newInviteEmail.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create invite' }));
        throw new Error(errorData.error || 'Failed to create invite');
      }

      setSuccess('Invite created successfully!');
      setNewInviteEmail('');
      setShowCreateForm(false);
      await loadInvites();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeInvite = async (inviteCode: string) => {
    if (!confirm('Are you sure you want to revoke this invite?')) {
      return;
    }

    try {
      const idToken = getIdToken();
      if (!idToken) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${AUTH_API_URL}/invites/${inviteCode}/revoke`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to revoke invite');
      }

      setSuccess('Invite revoked successfully!');
      await loadInvites();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite');
    }
  };

  const getStatusBadge = (status: Invite['status']) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      ACCEPTED: 'bg-green-100 text-green-800 border-green-300',
      REVOKED: 'bg-red-100 text-red-800 border-red-300',
      EXPIRED: 'bg-gray-100 text-gray-800 border-gray-300',
    };

    const icons = {
      PENDING: Clock,
      ACCEPTED: CheckCircle,
      REVOKED: XCircle,
      EXPIRED: XCircle,
    };

    const Icon = icons[status];

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invites...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
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
                <UserPlus className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Team Invites</h1>
                <p className="text-sm text-slate-500">Invite members to join your agency</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl font-medium"
            >
              <UserPlus className="h-5 w-5" />
              New Invite
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Success/Error Messages */}
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

        {/* Create Invite Form */}
        {showCreateForm && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              Create New Invite
            </h2>
            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newInviteEmail}
                  onChange={(e) => setNewInviteEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="member@example.com"
                  required
                  disabled={creating}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Role
                </label>
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  <span className="text-slate-700 font-medium">Member</span>
                  <span className="text-xs text-slate-500 ml-auto">(Create, Read, Update only)</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Send Invite'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewInviteEmail('');
                    setError('');
                  }}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Invites List */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">All Invites ({invites.length})</h2>
          </div>

          {invites.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-2">No invites yet</p>
              <p className="text-sm text-slate-400">Create your first invite to add team members</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {invites.map((invite) => (
                <div key={invite.inviteCode} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Mail className="w-5 h-5 text-slate-400" />
                        {invite.status === 'PENDING' && editingInviteCode === invite.inviteCode ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="email"
                              value={editingEmail}
                              onChange={(e) => setEditingEmail(e.target.value)}
                              className="w-full max-w-md px-3 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                              placeholder="member@example.com"
                              disabled={savingEdit}
                            />
                          </div>
                        ) : (
                          <span className="font-medium text-slate-900">{invite.email}</span>
                        )}
                        {getStatusBadge(invite.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 ml-8">
                        <span>Role: <span className="font-medium text-slate-700">Member</span></span>
                        <span>Created: {new Date(invite.createdAt).toLocaleDateString()}</span>
                        {invite.acceptedAt && (
                          <span>Accepted: {new Date(invite.acceptedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    {invite.status === 'PENDING' && (
                      <div className="flex items-center gap-2">
                        {editingInviteCode === invite.inviteCode ? (
                          <>
                            <button
                              onClick={saveEdit}
                              disabled={savingEdit}
                              className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingEdit ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={savingEdit}
                              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEdit(invite)}
                            className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => handleRevokeInvite(invite.inviteCode)}
                          disabled={savingEdit && editingInviteCode === invite.inviteCode}
                          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4" />
                          Revoke
                        </button>
                      </div>
                    )}
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
