import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
} from 'lucide-react';
import { api } from '../../services/api';
import SpeechToTextButton from '../../components/SpeechToTextButton';
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
  const [properties, setProperties] = useState<any[]>([]);
  const [newMeeting, setNewMeeting] = useState({
    meetingDate: '',
    meetingTime: '',
    title: '',
    location: '',
    notes: '',
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
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
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/tenants')}
                className="p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30 flex-shrink-0">
                  <Key className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                    {isNew ? 'New Tenant' : customer.name || 'Tenant Details'}
                  </h1>
                  {!isNew && customer.phone && (
                    <p className="text-xs sm:text-sm text-gray-500">{customer.phone}</p>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl hover:from-teal-600 hover:to-emerald-700 transition-all shadow-lg shadow-teal-500/30 disabled:opacity-50 font-medium"
            >
              <Save className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base">{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-xl p-4 sm:p-6 space-y-6 mb-4">
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
                    <p className="text-xs text-gray-500">Property ID</p>
                    <p className="font-medium text-gray-900">{customer.currentRental.propertyId}</p>
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
                </div>
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
                      <p className="font-medium">{rental.propertyId}</p>
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
                            ? 'bg-green-100 text-green-800'
                            : property.status === 'rented'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {property.status}
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
