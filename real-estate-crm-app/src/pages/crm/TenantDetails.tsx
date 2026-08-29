import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  Key,
  ArrowLeft,
  Save,
  Phone,
  Mail,
  MapPin,
  User,
  Plus,
  Calendar,
  Building2,
  AlertCircle,
  FileText,
  Shield,
  RotateCcw,
  LogOut,
  CheckCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import SpeechToTextButton from '../../components/SpeechToTextButton';
import ContactActivityTimeline from '../../components/ContactActivityTimeline';
import { useFlashToast } from '../../hooks/useFlashToast';
import { CRMCustomer, CRMCustomerNote, CRMMeeting } from '../../types/crm';

export default function TenantDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const [customer, setCustomer] = useState<Partial<CRMCustomer>>({
    name: '',
    phone: '',
    email: '',
    address: '',
    status: 'active',
  });
  const [notes, setNotes] = useState<CRMCustomerNote[]>([]);
  const [meetings, setMeetings] = useState<CRMMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [draftActivityNote, setDraftActivityNote] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [showRenewLease, setShowRenewLease] = useState(false);
  const [renewLeaseData, setRenewLeaseData] = useState({
    leaseEndDate: '',
    newMonthlyRent: '',
  });
  const [properties, setProperties] = useState<any[]>([]);
  const [newMeeting, setNewMeeting] = useState({
    meetingDate: '',
    meetingTime: '',
    title: '',
    location: '',
    notes: '',
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
  };
  useFlashToast(showToast);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    
    if (id) {
      loadCustomer();
      loadAssociatedProperties();
    }
  }, [id, isNew]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const [customerData, notesData, meetingsData] = await Promise.all([
        api.getCustomer(id!),
        api.getCustomerNotes(id!),
        api.getMeetingsByEntity('customer', id!),
      ]);
      
      setCustomer(customerData);
      setNotes(notesData);
      setMeetings(meetingsData);
    } catch (error) {
      console.error('Error loading customer:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLookup = async (phone: string) => {
    if (!phone || phone.length < 10) return;

    try {
      setLookingUp(true);
      const result = await api.getCustomerByPhone(phone);
      // API returns { found: boolean, customer: object | null }
      if (result?.found && result?.customer) {
        const tenantName = result.customer.name || result.customer.phone || 'Unnamed';
        setConfirmDialog({
          isOpen: true,
          title: 'Tenant Already Exists',
          message: `A tenant with this phone number already exists: "${tenantName}".\n\nDo you want to load their information instead of creating a new tenant?`,
          onConfirm: () => {
            setCustomer(result.customer);
            setConfirmDialog(null);
          },
        });
      }
    } catch (error) {
      console.error('Error looking up phone:', error);
    } finally {
      setLookingUp(false);
    }
  };

  const handleSave = async () => {
    if (!customer.name || !customer.phone) {
      setToast({ message: 'Name and phone are required', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      if (isNew) {
        const created = await api.createCustomer(customer as any);
        if (draftActivityNote.trim()) {
          try {
            await api.createCustomerNote(created.customerId, { content: draftActivityNote });
          } catch (e) {
            console.error('Error adding initial tenant note:', e);
          }
        }
        navigate(`/crm/tenants/${created.customerId}`, { replace: true });
      } else {
        await api.updateCustomer(id!, customer as any);
        await loadCustomer();
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      setToast({ message: 'Failed to save tenant', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !id) return;

    try {
      const note = await api.createCustomerNote(id, { content: newNote });
      setNotes([note, ...notes]);
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleScheduleMeeting = async () => {
    if (!id || !newMeeting.meetingDate || !newMeeting.meetingTime || !newMeeting.title) {
      setToast({ message: 'Meeting date, time, and title are required', type: 'error' });
      return;
    }

    try {
      const meeting = await api.createMeeting({
        title: newMeeting.title,
        meetingDate: newMeeting.meetingDate,
        meetingTime: newMeeting.meetingTime,
        relatedEntityType: 'customer',
        relatedEntityId: id,
        location: newMeeting.location,
        notes: newMeeting.notes,
      });
      setMeetings([meeting, ...meetings]);
      setNewMeeting({ meetingDate: '', meetingTime: '', title: '', location: '', notes: '' });
      setShowMeetingForm(false);
    } catch (error) {
      console.error('Error scheduling meeting:', error);
      setToast({ message: 'Failed to schedule meeting', type: 'error' });
    }
  };

  const handleRenewLease = async () => {
    if (!id || !customer.currentRental) return;
    if (!renewLeaseData.leaseEndDate) {
      setToast({ message: 'New lease end date is required', type: 'error' });
      return;
    }
    try {
      setLoading(true);
      const updatedRental = {
        ...customer.currentRental,
        leaseEndDate: renewLeaseData.leaseEndDate,
        monthlyRent: renewLeaseData.newMonthlyRent
          ? Number(renewLeaseData.newMonthlyRent)
          : customer.currentRental.monthlyRent,
      };
      await api.updateCustomer(id, { currentRental: updatedRental } as any);
      setCustomer((prev) => ({ ...prev, currentRental: updatedRental }));
      setShowRenewLease(false);
      setRenewLeaseData({ leaseEndDate: '', newMonthlyRent: '' });
      setToast({ message: 'Lease renewed successfully', type: 'success' });
    } catch (error) {
      console.error('Error renewing lease:', error);
      setToast({ message: 'Failed to renew lease', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVacate = async () => {
    if (!id || !customer.currentRental) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Vacate',
      message: `Mark this tenant as vacated from the current property? This will archive the current rental to history and set the tenant status to "Vacated".`,
      onConfirm: async () => {
        try {
          setLoading(true);
          const historyEntry = {
            propertyId: customer.currentRental!.propertyId,
            leaseStartDate: customer.currentRental!.leaseStartDate,
            leaseEndDate: new Date().toISOString().split('T')[0],
            monthlyRent: customer.currentRental!.monthlyRent,
            securityDeposit: customer.currentRental!.securityDeposit,
            notes: 'Vacated',
          };
          const updatedHistory = [...(customer.rentalHistory || []), historyEntry];
          await api.updateCustomer(id, {
            status: 'vacated',
            currentRental: null,
            rentalHistory: updatedHistory,
          } as any);
          setCustomer((prev) => ({
            ...prev,
            status: 'vacated',
            currentRental: null,
            rentalHistory: updatedHistory,
          }));
          setConfirmDialog(null);
          setToast({ message: 'Tenant marked as vacated', type: 'success' });
        } catch (error) {
          console.error('Error vacating tenant:', error);
          setToast({ message: 'Failed to vacate tenant', type: 'error' });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleUpdateMeetingStatus = async (meetingId: string, status: string) => {
    try {
      await api.updateMeeting(meetingId, { status });
      await loadCustomer();
    } catch (error) {
      console.error('Error updating meeting:', error);
    }
  };

  const loadAssociatedProperties = async () => {
    if (!id) return;
    try {
      const allProperties = await api.getCRMProperties();
      const filtered = (allProperties || []).filter((p: any) => p.tenantCustomerId === id);
      setProperties(filtered);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <LoadingSpinner message="Loading tenant..." />
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50">
      <header className="glass-premium border-b border-white/30 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/tenants')}
                className="p-1.5 sm:p-2 hover:bg-white/60 rounded-xl transition-all duration-200 flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-slate-500" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/25 flex-shrink-0 animate-gentlePulse">
                  <Key className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight truncate">
                    {isNew ? 'New Tenant' : customer.name || 'Tenant Details'}
                  </h1>
                  {!isNew && customer.phone && (
                    <p className="text-xs sm:text-sm text-slate-400 font-semibold">{customer.phone}</p>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl hover:from-teal-600 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/30 disabled:opacity-50 btn-press font-semibold"
            >
              <Save className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base">{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="glass-premium rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 space-y-6 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <User className="h-5 w-5 mr-2 text-teal-600" />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customer.name || ''}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className="w-full px-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  value={customer.phone || ''}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  onBlur={(e) => isNew && handlePhoneLookup(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
                  placeholder="Phone number"
                />
                {lookingUp && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin h-4 w-4 border-2 border-teal-600 border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  value={customer.email || ''}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Email address"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={customer.status || 'active'}
                onChange={(e) => setCustomer({ ...customer, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="vacated">Vacated</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                value={customer.address || ''}
                onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="Current address"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <div className="flex gap-2">
                <textarea
                  value={(customer as any).notes || ''}
                  onChange={(e) => setCustomer({ ...customer, notes: e.target.value } as any)}
                  rows={3}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="General notes about this tenant..."
                />
                <SpeechToTextButton
                  onText={(text) =>
                    setCustomer((prev) => ({
                      ...(prev as any),
                      notes: `${(((prev as any).notes || '') as string).trim()}${(((prev as any).notes || '') as string).trim() ? ' ' : ''}${text}`,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* KYC Documents Section */}
        <div className="glass-premium rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 space-y-6 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-teal-600" />
            KYC Documents
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Number</label>
              <input
                type="text"
                value={(customer as any).aadharNumber || ''}
                onChange={(e) => setCustomer({ ...customer, aadharNumber: e.target.value } as any)}
                className="w-full px-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
                placeholder="XXXX XXXX XXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Police Verification</label>
              {(customer as any).policeVerificationUrl ? (
                <a
                  href={(customer as any).policeVerificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-teal-700 hover:underline"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  View Document
                </a>
              ) : (
                <p className="text-sm text-gray-400">No document uploaded</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Photo</label>
              {(customer as any).photoUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={(customer as any).photoUrl}
                    alt="Tenant"
                    className="h-16 w-16 rounded-lg object-cover border border-gray-200"
                  />
                  <a
                    href={(customer as any).photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-teal-700 hover:underline"
                  >
                    View Full Image
                  </a>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No photo uploaded</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Document</label>
              {(customer as any).aadharDocUrl ? (
                <a
                  href={(customer as any).aadharDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-teal-700 hover:underline"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  View Aadhar
                </a>
              ) : (
                <p className="text-sm text-gray-400">No aadhar document uploaded</p>
              )}
            </div>
          </div>
        </div>

        {/* Current Rental Section */}
        {!isNew && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Key className="h-5 w-5 mr-2 text-teal-600" />
              Current Rental
            </h3>
            {customer.currentRental ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-teal-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">Property</p>
                    {(() => {
                      const p = properties.find((prop: any) => prop.propertyId === customer.currentRental?.propertyId);
                      return p ? (
                        <Link
                          to={`/crm/properties/${p.propertyId}`}
                          className="font-medium text-teal-700 hover:underline"
                        >
                          {p.title} — {p.area}
                        </Link>
                      ) : (
                        <Link
                          to={`/crm/properties/${customer.currentRental!.propertyId}`}
                          className="font-medium text-teal-700 hover:underline"
                        >
                          {customer.currentRental!.propertyId}
                        </Link>
                      );
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Monthly Rent</p>
                    <p className="font-medium text-gray-900">₹{customer.currentRental.monthlyRent?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Lease Start</p>
                    <p className="font-medium text-gray-900">{customer.currentRental.leaseStartDate ? new Date(customer.currentRental.leaseStartDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Lease End</p>
                    <p className="font-medium text-gray-900">{customer.currentRental.leaseEndDate ? new Date(customer.currentRental.leaseEndDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Security Deposit</p>
                    <p className="font-medium text-gray-900">₹{customer.currentRental.securityDeposit?.toLocaleString()}</p>
                  </div>
                  {typeof customer.currentRental.brokeragePaid === 'number' && customer.currentRental.brokeragePaid > 0 && (
                    <div className="bg-green-100 rounded-lg p-2">
                      <p className="text-xs text-green-700 font-medium">Brokerage</p>
                      <p className="font-semibold text-green-800">₹{customer.currentRental.brokeragePaid.toLocaleString()}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={() => {
                      setRenewLeaseData({
                        leaseEndDate: customer.currentRental?.leaseEndDate || '',
                        newMonthlyRent: customer.currentRental?.monthlyRent?.toString() || '',
                      });
                      setShowRenewLease(true);
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 text-sm"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Renew Lease</span>
                  </button>
                  <button
                    onClick={handleVacate}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-sm"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Mark Vacated</span>
                  </button>
                </div>
                {showRenewLease && (
                  <div className="mt-3 p-4 bg-white border border-teal-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-teal-800 mb-3">Renew Lease</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Lease End Date</label>
                        <input
                          type="date"
                          value={renewLeaseData.leaseEndDate}
                          onChange={(e) => setRenewLeaseData({ ...renewLeaseData, leaseEndDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Monthly Rent (₹)</label>
                        <input
                          type="number"
                          value={renewLeaseData.newMonthlyRent}
                          onChange={(e) => setRenewLeaseData({ ...renewLeaseData, newMonthlyRent: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          placeholder="Leave blank to keep current"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleRenewLease}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
                      >
                        Save Renewal
                      </button>
                      <button
                        onClick={() => setShowRenewLease(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No active rental</p>
                <p className="text-xs text-gray-400 mt-1">Rental details are recorded during lead conversion</p>
              </div>
            )}
          </div>
        )}

        {/* Rental History Section */}
        {!isNew && customer.rentalHistory && customer.rentalHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-teal-600" />
              Rental History
            </h3>
            <div className="space-y-3">
              {customer.rentalHistory.map((rental: any, index: number) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Property</p>
                      {(() => {
                        const p = properties.find((prop: any) => prop.propertyId === rental.propertyId);
                        return p ? (
                          <Link
                            to={`/crm/properties/${p.propertyId}`}
                            className="font-medium text-teal-700 hover:underline"
                          >
                            {p.title}
                          </Link>
                        ) : (
                          <Link
                            to={`/crm/properties/${rental.propertyId}`}
                            className="font-medium text-teal-700 hover:underline"
                          >
                            {rental.propertyId}
                          </Link>
                        );
                      })()}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Rent</p>
                      <p className="font-medium">₹{rental.monthlyRent?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Period</p>
                      <p className="font-medium">{rental.leaseStartDate ? new Date(rental.leaseStartDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'N/A'} - {rental.leaseEndDate ? new Date(rental.leaseEndDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Deposit</p>
                      <p className="font-medium">₹{rental.securityDeposit?.toLocaleString()}</p>
                    </div>
                    {typeof rental.brokeragePaid === 'number' && rental.brokeragePaid > 0 && (
                      <div className="bg-green-50 rounded p-2">
                        <p className="text-xs text-green-600 font-medium">Brokerage</p>
                        <p className="font-semibold text-green-700">₹{rental.brokeragePaid.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isNew && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-teal-600" />
              Tenant Properties
            </h3>
            {properties.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No properties linked to this tenant</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {properties.map((property) => (
                  <div
                    key={property.propertyId}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/crm/properties/${property.propertyId}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900">{property.title}</h4>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          property.status === 'available'
                            ? 'bg-emerald-100 text-emerald-800'
                            : property.status === 'for-sale'
                              ? 'bg-blue-100 text-blue-800'
                              : property.status === 'for-rent'
                                ? 'bg-yellow-100 text-yellow-800'
                                : property.status === 'rented'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : property.status === 'sold'
                                    ? 'bg-red-100 text-red-800'
                                    : property.status === 'on-hold'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {property.status === 'for-sale' ? 'For Sale' :
                         property.status === 'for-rent' ? 'For Rent' :
                         property.status === 'on-hold' ? 'On Hold' :
                         property.status === 'out-of-stock' ? 'Out of Stock' :
                         property.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{property.area}, {property.city}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{property.bhk} BHK • {property.propertyType}</span>
                      <span className="font-semibold text-teal-600">₹{property.rentAmount?.toLocaleString()}/mo</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Meetings</h3>
            {!isNew && (
              <button
                onClick={() => setShowMeetingForm(!showMeetingForm)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Schedule Meeting</span>
              </button>
            )}
          </div>

          <div>
            {showMeetingForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={newMeeting.meetingDate}
                      onChange={(e) => setNewMeeting({ ...newMeeting, meetingDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input
                      type="time"
                      value={newMeeting.meetingTime}
                      onChange={(e) => setNewMeeting({ ...newMeeting, meetingTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={newMeeting.location}
                      onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Meeting location"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title/Purpose</label>
                    <input
                      type="text"
                      value={newMeeting.title}
                      onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Meeting title"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={newMeeting.notes}
                      onChange={(e) => setNewMeeting({ ...newMeeting, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Additional notes"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleScheduleMeeting}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                  >
                    Schedule
                  </button>
                  <button
                    onClick={() => setShowMeetingForm(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {isNew ? (
              <p className="text-gray-500 text-center py-8">Save the tenant first to schedule meetings</p>
            ) : meetings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No meetings scheduled</p>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <div key={meeting.meetingId} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-start space-x-2">
                        <Calendar className="h-5 w-5 text-teal-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-900">{meeting.title}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(`${meeting.meetingDate} ${meeting.meetingTime}`).toLocaleString()}
                          </p>
                          {meeting.location && (
                            <p className="text-sm text-gray-500 flex items-center mt-1">
                              <MapPin className="h-3 w-3 mr-1" />
                              {meeting.location}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        meeting.status === 'completed' ? 'bg-green-100 text-green-800' :
                        meeting.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {meeting.status}
                      </span>
                    </div>
                    {meeting.status === 'scheduled' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleUpdateMeetingStatus(meeting.meetingId, 'completed')}
                          className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100"
                        >
                          Mark Complete
                        </button>
                        <button
                          onClick={() => handleUpdateMeetingStatus(meeting.meetingId, 'cancelled')}
                          className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Add Note</label>
            <div className="flex gap-2">
              <textarea
                value={isNew ? draftActivityNote : newNote}
                onChange={(e) => (isNew ? setDraftActivityNote(e.target.value) : setNewNote(e.target.value))}
                placeholder={isNew ? 'Add a note (will be saved after creating tenant)...' : 'Add a note...'}
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <SpeechToTextButton
                onText={(text) =>
                  (isNew ? setDraftActivityNote : setNewNote)((prev) => `${prev.trim()}${prev.trim() ? ' ' : ''}${text}`)
                }
              />
              {!isNew && (
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
                 aria-label="Add">
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {isNew ? (
            <p className="text-gray-500 text-center py-8">Save the tenant to see note history</p>
          ) : notes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No notes yet</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.noteId} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{note.content}</p>
                  <div className="text-xs text-gray-500 mt-2">
                    {note.createdBy} • {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Activity History */}
          {!isNew && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-teal-600" />
                Activity History
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Leases, rent changes, meetings, notes, and property links — full tenant timeline.
              </p>
              <ContactActivityTimeline entityType="customer" entityId={id} />
            </div>
          )}
        </div>
      </main>
    </div>
    {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)}
      />
    )}
    {confirmDialog && (
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Load"
        cancelLabel="Cancel"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(null)}
      />
    )}
  </>
);

}
