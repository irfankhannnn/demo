import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building2, Mail, Phone, MapPin, Save, ArrowLeft, LogOut } from 'lucide-react';
import { api } from '../services/api';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { isValidEmail, isValidIndianMobile, normalizeEmail, normalizeIndianPhone, normalizeWhitespace } from '../utils/validation';

interface ProfileData {
  username: string;
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
    username: '',
    email: '',
    companyName: '',
    phone: '',
    address: '',
    city: '',
    role: 'Admin',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      // TODO: Implement API call to fetch profile
      // const data = await api.getProfile();
      // For now, load from localStorage or use defaults
      const storedProfile = localStorage.getItem('user_profile');
      if (storedProfile) {
        setFormData(JSON.parse(storedProfile));
      }
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneBlur = () => {
    const normalized = formData.phone ? normalizeIndianPhone(formData.phone) : '';
    if (normalized) {
      setFormData((prev) => ({ ...prev, phone: normalized }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const cleanedEmail = normalizeEmail(formData.email);
    const cleanedPhone = formData.phone ? normalizeIndianPhone(formData.phone) : '';
    const cleanedCompanyName = normalizeWhitespace(formData.companyName);
    const cleanedAddress = normalizeWhitespace(formData.address);
    const cleanedCity = normalizeWhitespace(formData.city);

    if (!cleanedCompanyName) {
      setError('Company name is required');
      return;
    }

    if (!isValidEmail(cleanedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (formData.phone && !isValidIndianMobile(formData.phone)) {
      setError('Please enter a valid Indian mobile number (10 digits)');
      return;
    }

    setSaving(true);

    try {
      // TODO: Implement API call to update profile
      // await api.updateProfile(formData);
      localStorage.setItem('user_profile', JSON.stringify({
        ...formData,
        email: cleanedEmail,
        phone: cleanedPhone || formData.phone,
        companyName: cleanedCompanyName,
        address: cleanedAddress,
        city: cleanedCity,
      }));
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    api.clearToken();
    localStorage.removeItem('user_profile');
    navigate('/login');
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
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">{formData.username || 'Admin User'}</h2>
            <p className="text-sm sm:text-base text-indigo-100">{formData.role}</p>
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
                      Username
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none bg-slate-50 focus:bg-white"
                      placeholder="Enter username"
                      maxLength={60}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="pl-10 w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none bg-slate-50 focus:bg-white"
                        placeholder="admin@example.com"
                        autoComplete="email"
                        inputMode="email"
                        maxLength={254}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        onBlur={handlePhoneBlur}
                        className="pl-10 w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none bg-slate-50 focus:bg-white"
                        placeholder="+91 98765 43210"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={16}
                        pattern="^(?:\\+?91[ -]?)?[6-9][0-9]{9}$"
                      />
                    </div>
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
