import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building2, Mail, Phone, MapPin, Save, ArrowLeft, LogOut, Shield, Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { normalizeWhitespace } from '../utils/validation';
import { clearAuthSilently, getUserProfile, setUserProfile } from '../utils/authStorage';
import { redirectToLogout, callMe } from '../utils/cognitoAuth';
import { getAgencyMembershipDescription } from '../utils/rbac';
import { startEmailLink, startPhoneLink, verifyPhoneLink } from '../services/contactLinkApi';

interface ProfileData {
  displayName: string;
  email: string;
  companyName: string;
  phone: string;
  address: string;
  city: string;
  role: string;
}

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<ProfileData>({
    displayName: '',
    email: '',
    companyName: '',
    phone: '',
    address: '',
    city: '',
    role: 'Admin',
  });

  // Contact linking state
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [showPhoneOtp, setShowPhoneOtp] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [linkMessage, setLinkMessage] = useState('');
  const [linkError, setLinkError] = useState('');
  const [pendingEmail, setPendingEmail] = useState<string | undefined>();
  const [pendingPhone, setPendingPhone] = useState<string | undefined>();
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      const profile = getUserProfile();
      if (!profile) {
        setError('Profile not found. Please log in again.');
        return;
      }

      setFormData({
        displayName: profile.displayName || '',
        email: profile.email || '',
        companyName: profile.agency?.agencyName || '',
        phone: profile.phoneNumber || '',
        address: profile.agency?.address || '',
        city: profile.agency?.city || '',
        role: profile.role === 'ADMIN' ? 'Admin' : 'Member',
      });
      setPendingEmail(profile.pendingEmail);
      setPendingPhone(profile.pendingPhoneNumber);
      setEmailVerified(profile.emailVerified ?? !!profile.email);
      setPhoneVerified(profile.phoneVerified ?? !!profile.phoneNumber);
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const cleanedDisplayName = normalizeWhitespace(formData.displayName);
    const cleanedCompanyName = normalizeWhitespace(formData.companyName);
    const cleanedAddress = normalizeWhitespace(formData.address);
    const cleanedCity = normalizeWhitespace(formData.city);

    if (!cleanedCompanyName) {
      setError('Company name is required');
      return;
    }

    setSaving(true);

    try {
      const authApiUrl = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3002';
      const idToken = localStorage.getItem('auth_id_token');
      
      if (!idToken) {
        setError('Authentication token not found. Please log in again.');
        return;
      }

      const profile = getUserProfile();
      const isAdmin = profile?.role === 'ADMIN';

      // Update user profile fields (displayName only)
      const userProfileChanged = cleanedDisplayName !== (profile?.displayName || '');

      if (userProfileChanged) {
        const profileResponse = await fetch(`${authApiUrl}/auth/profile`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            displayName: cleanedDisplayName,
          }),
        });

        if (!profileResponse.ok) {
          const errorData = await profileResponse.json().catch(() => ({ error: 'Failed to update profile' }));
          throw new Error(errorData.error || 'Failed to update profile');
        }
      }

      // Update agency fields (admin-only)
      const agencyChanged = 
        cleanedCompanyName !== (profile?.agency?.agencyName || '') ||
        cleanedAddress !== (profile?.agency?.address || '') ||
        cleanedCity !== (profile?.agency?.city || '');

      if (isAdmin && agencyChanged) {
        const agencyResponse = await fetch(`${authApiUrl}/auth/agency`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            agencyName: cleanedCompanyName,
            address: cleanedAddress,
            city: cleanedCity,
          }),
        });

        if (!agencyResponse.ok) {
          const errorData = await agencyResponse.json().catch(() => ({ error: 'Failed to update agency' }));
          throw new Error(errorData.error || 'Failed to update agency configuration');
        }
      }

      // Refresh profile from /auth/me
      const meResponse = await fetch(`${authApiUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (meResponse.ok) {
        const meData = await meResponse.json();
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
          emailVerified: meData.user.emailVerified,
          phoneVerified: meData.user.phoneVerified,
          pendingEmail: meData.user.pendingEmail,
          pendingPhoneNumber: meData.user.pendingPhoneNumber,
          agency: meData.agency,
        });
      }

      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const refreshProfile = async () => {
    const idToken = localStorage.getItem('auth_id_token');
    if (!idToken) return;
    try {
      const meData = await callMe(idToken);
      if (meData?.user) {
        const u = meData.user;
        setUserProfile({
          userId: u.userId, cognitoSub: u.cognitoSub, email: u.email,
          phoneNumber: u.phoneNumber, role: u.role, tenantId: u.tenantId,
          displayName: u.displayName, status: u.status, createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt, emailVerified: u.emailVerified,
          phoneVerified: u.phoneVerified, pendingEmail: u.pendingEmail,
          pendingPhoneNumber: u.pendingPhoneNumber, agency: meData.agency,
        });
        setFormData(prev => ({ ...prev, email: u.email || '', phone: u.phoneNumber || '' }));
        setPendingEmail(u.pendingEmail);
        setPendingPhone(u.pendingPhoneNumber);
        setEmailVerified(u.emailVerified ?? !!u.email);
        setPhoneVerified(u.phoneVerified ?? !!u.phoneNumber);
      }
    } catch { /* ignore */ }
  };

  const handleAddEmail = async () => {
    if (!newEmail.trim()) return;
    setLinkingLoading(true); setLinkError(''); setLinkMessage('');
    try {
      const res = await startEmailLink(newEmail.trim());
      setLinkMessage(res.message || 'Pending email saved.');
      setShowAddEmail(false); setNewEmail('');
      await refreshProfile();
    } catch (err: any) {
      setLinkError(err.message || 'Failed to add email');
    } finally { setLinkingLoading(false); }
  };

  const handleAddPhone = async () => {
    if (!newPhone.trim()) return;
    setLinkingLoading(true); setLinkError(''); setLinkMessage('');
    try {
      const res = await startPhoneLink(newPhone.trim());
      setLinkMessage(res.message || 'OTP sent.');
      setShowAddPhone(false);
      setShowPhoneOtp(true);
      await refreshProfile();
    } catch (err: any) {
      setLinkError(err.message || 'Failed to add phone');
    } finally { setLinkingLoading(false); }
  };

  const handleVerifyPhone = async () => {
    if (!phoneOtp.trim() || !pendingPhone) return;
    setLinkingLoading(true); setLinkError(''); setLinkMessage('');
    try {
      const res = await verifyPhoneLink(pendingPhone, phoneOtp.trim());
      setLinkMessage(res.message || 'Phone verified!');
      setShowPhoneOtp(false); setPhoneOtp(''); setNewPhone('');
      await refreshProfile();
    } catch (err: any) {
      setLinkError(err.message || 'Phone verification failed');
    } finally { setLinkingLoading(false); }
  };

  const handleLogout = () => {
    clearAuthSilently();
    redirectToLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => navigate('/crm')}
                className="p-1.5 sm:p-2 text-slate-600 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-50 flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-1.5 sm:p-2 rounded-lg flex-shrink-0">
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate">Profile Settings</h1>
                <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">Manage your account information</p>
              </div>
            </div>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium flex-shrink-0"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12 text-center">
            <div className="bg-white w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg">
              <User className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">{formData.displayName || 'Admin User'}</h2>
            <div className="flex items-center justify-center gap-2 text-indigo-100 mb-2">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
              <p className="text-sm sm:text-base font-medium">{getAgencyMembershipDescription()}</p>
            </div>
            {formData.companyName && (
              <p className="text-xs sm:text-sm text-indigo-200">{formData.companyName}</p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8">
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

            {linkMessage && (
              <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 text-blue-700 px-4 py-3 rounded-r-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm font-medium">{linkMessage}</p>
              </div>
            )}

            {linkError && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm font-medium">{linkError}</p>
              </div>
            )}

            <div className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none bg-slate-50 focus:bg-white"
                      placeholder="Enter display name"
                      maxLength={60}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      Email Address
                      {formData.email && emailVerified && <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" />Verified</span>}
                      {pendingEmail && <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />Pending</span>}
                    </label>
                    {formData.email ? (
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input type="email" value={formData.email} className="pl-10 w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-100 text-slate-600 cursor-not-allowed" disabled readOnly />
                      </div>
                    ) : !showAddEmail ? (
                      <div>
                        <button type="button" onClick={() => { setShowAddEmail(true); setLinkError(''); setLinkMessage(''); }} className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-colors w-full">
                          <Plus className="w-4 h-4" /> Add Email Address
                        </button>
                        {pendingEmail && <p className="mt-2 text-xs text-amber-600">Pending: {pendingEmail} — log in with Google using this email to verify.</p>}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Enter email address" className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" autoFocus />
                        <button type="button" onClick={handleAddEmail} disabled={linkingLoading} className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm">{linkingLoading ? '...' : 'Save'}</button>
                        <button type="button" onClick={() => { setShowAddEmail(false); setNewEmail(''); }} className="px-3 py-3 text-slate-500 hover:text-slate-700">Cancel</button>
                      </div>
                    )}
                    {formData.email && <p className="mt-2 text-xs text-slate-500">Email is managed by your sign-in identity.</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      Phone Number
                      {formData.phone && phoneVerified && <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" />Verified</span>}
                      {pendingPhone && <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />Pending</span>}
                    </label>
                    {formData.phone ? (
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input type="tel" value={formData.phone} className="pl-10 w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-100 text-slate-600 cursor-not-allowed" disabled readOnly />
                      </div>
                    ) : showPhoneOtp ? (
                      <div>
                        <p className="text-sm text-slate-600 mb-2">Enter the OTP sent to <strong>{pendingPhone}</strong></p>
                        <div className="flex gap-2">
                          <input type="text" value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-center tracking-widest font-mono text-lg" maxLength={6} autoFocus />
                          <button type="button" onClick={handleVerifyPhone} disabled={linkingLoading || phoneOtp.length !== 6} className="px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium text-sm">Verify</button>
                          <button type="button" onClick={() => { setShowPhoneOtp(false); setPhoneOtp(''); }} className="px-3 py-3 text-slate-500 hover:text-slate-700">Cancel</button>
                        </div>
                      </div>
                    ) : !showAddPhone ? (
                      <div>
                        <button type="button" onClick={() => { setShowAddPhone(true); setLinkError(''); setLinkMessage(''); }} className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-colors w-full">
                          <Plus className="w-4 h-4" /> Add Phone Number
                        </button>
                        {pendingPhone && <p className="mt-2 text-xs text-amber-600">Pending: {pendingPhone} — verify with OTP to complete linking.</p>}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+91 98765 43210" className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" autoFocus />
                        <button type="button" onClick={handleAddPhone} disabled={linkingLoading} className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm">{linkingLoading ? '...' : 'Send OTP'}</button>
                        <button type="button" onClick={() => { setShowAddPhone(false); setNewPhone(''); }} className="px-3 py-3 text-slate-500 hover:text-slate-700">Cancel</button>
                      </div>
                    )}
                    {formData.phone && <p className="mt-2 text-xs text-slate-500">Phone is managed by your sign-in identity.</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Role
                    </label>
                    <input
                      type="text"
                      value={formData.role}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-100 text-slate-600 cursor-not-allowed"
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* Company Information */}
              <div className="pt-6 border-t border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  Company Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Company Name
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        className="pl-10 w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none bg-slate-50 focus:bg-white"
                        placeholder="Happy Properties"
                        maxLength={120}
                        required
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Address
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        rows={3}
                        className="pl-10 w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none bg-slate-50 focus:bg-white resize-none"
                        placeholder="Enter company address"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none bg-slate-50 focus:bg-white"
                      placeholder="Mumbai"
                      maxLength={60}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}
