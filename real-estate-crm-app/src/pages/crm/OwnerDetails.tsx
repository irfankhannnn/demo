import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  Building2,
  ArrowLeft,
  Save,
  Phone,
  Mail,
  MapPin,
  User,
  CreditCard,
  Plus,
  Calendar,
  FileText,
  Trash2,
  AlertCircle,
  DollarSign,
  Home,
  CheckCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import SpeechToTextButton from '../../components/SpeechToTextButton';
import { CRMOwner, CRMOwnerNote, CRMMeeting } from '../../types/crm';
import AddPropertyModal from '../../components/AddPropertyModal';
import DocumentUploadSection from '../../components/DocumentUploadSection';

export default function OwnerDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const [owner, setOwner] = useState<Partial<CRMOwner>>({
    name: '',
    phone: '',
    email: '',
    address: '',
    status: 'active',
    panNumber: '',
    aadharNumber: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    bankDetails: '',
    notes: '',
  });
  const [notes, setNotes] = useState<CRMOwnerNote[]>([]);
  const [meetings, setMeetings] = useState<CRMMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [draftActivityNote, setDraftActivityNote] = useState('');
  const [properties, setProperties] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [showListingModal, setShowListingModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [listingType, setListingType] = useState<'sale' | 'rent'>('sale');
  const [listingPrice, setListingPrice] = useState('');
  const [expectedRent, setExpectedRent] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [newMeeting, setNewMeeting] = useState({
    meetingDate: '',
    meetingTime: '',
    title: '',
    location: '',
    notes: '',
  });

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    
    if (id) {
      loadOwner();
      loadOwnerProperties();
    }
  }, [id, isNew]);

  const loadOwner = async () => {
    try {
      setLoading(true);
      const [ownerData, notesData, meetingsData] = await Promise.all([
        api.getOwnerWithDocuments(id!),
        api.getOwnerNotes(id!),
        api.getMeetingsByEntity('owner', id!),
      ]);
      
      setOwner(ownerData);
      setNotes(notesData);
      setMeetings(meetingsData);
    } catch (error) {
      console.error('Error loading owner:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!owner.name || !owner.phone) {
      alert('Name and phone are required');
      return;
    }

    try {
      setSaving(true);
      if (isNew) {
        const created = await api.createOwner(owner as any);
        if (draftActivityNote.trim()) {
          try {
            await api.createOwnerNote(created.ownerId, { content: draftActivityNote });
          } catch (e) {
            console.error('Error adding initial owner note:', e);
          }
        }
        navigate(`/crm/owners/${created.ownerId}`, { replace: true });
      } else {
        await api.updateOwner(id!, owner as any);
        await loadOwner();
      }
    } catch (error) {
      console.error('Error saving owner:', error);
      alert('Failed to save owner');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !id) return;

    try {
      const note = await api.createOwnerNote(id, { content: newNote });
      setNotes([note, ...notes]);
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleScheduleMeeting = async () => {
    if (!id || !newMeeting.meetingDate || !newMeeting.meetingTime || !newMeeting.title) {
      alert('Meeting date, time, and title are required');
      return;
    }

    try {
      const meeting = await api.createMeeting({
        title: newMeeting.title,
        meetingDate: newMeeting.meetingDate,
        meetingTime: newMeeting.meetingTime,
        relatedEntityType: 'owner',
        relatedEntityId: id,
        location: newMeeting.location,
        notes: newMeeting.notes,
      });
      setMeetings([meeting, ...meetings]);
      setNewMeeting({ meetingDate: '', meetingTime: '', title: '', location: '', notes: '' });
      setShowMeetingForm(false);
    } catch (error) {
      console.error('Error scheduling meeting:', error);
      alert('Failed to schedule meeting');
    }
  };

  const handleUpdateMeetingStatus = async (meetingId: string, status: 'completed' | 'cancelled') => {
    if (!id) return;
    try {
      await api.updateMeeting(meetingId, { status });
      await loadOwner();
    } catch (error) {
      console.error('Error updating meeting:', error);
    }
  };

  const loadOwnerProperties = async () => {
    try {
      const allProperties = await api.getCRMProperties();
      const filtered = allProperties.filter((p: any) => p.ownerId === id);
      setProperties(filtered);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  const handleDocumentUpload = async (docType: string, file: File) => {
    if (!id) return;
    setUploadingDoc(docType);
    
    // Save current scroll position
    const scrollPosition = window.scrollY;
    
    try {
      const files: { photo?: File; pan?: File; aadhar?: File } = {};

      if (docType === 'photo') {
        files.photo = file;
      } else if (docType === 'pan') {
        files.pan = file;
      } else if (docType === 'aadhar') {
        files.aadhar = file;
      }

      await api.uploadOwnerDocuments(id, files);

      // Reload owner data to get updated document URLs
      await loadOwner();
      
      // Restore scroll position after reload
      window.scrollTo(0, scrollPosition);
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploadingDoc(null);
    }
  };

  const handlePropertyAdded = async () => {
    await loadOwnerProperties();
  };

  const handleListForSale = (property: any) => {
    setSelectedProperty(property);
    setListingType('sale');
    setListingPrice(property.saleInfo?.listedPrice?.toString() || '');
    setShowListingModal(true);
  };

  const handleListForRent = (property: any) => {
    setSelectedProperty(property);
    setListingType('rent');
    setExpectedRent(property.rentalInfo?.expectedRent?.toString() || '');
    setSecurityDeposit(property.rentalInfo?.securityDeposit?.toString() || '');
    setShowListingModal(true);
  };

  const handleSubmitListing = async () => {
    if (!selectedProperty) return;

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      if (listingType === 'sale') {
        if (!listingPrice) {
          alert('Please enter listing price');
          return;
        }
        const response = await fetch(`/api/crm/properties/${selectedProperty.propertyId}/list-for-sale`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ listedPrice: Number(listingPrice) })
        });
        if (!response.ok) throw new Error('Failed to list property');
      } else {
        if (!expectedRent || !securityDeposit) {
          alert('Please enter rent and security deposit');
          return;
        }
        const response = await fetch(`/api/crm/properties/${selectedProperty.propertyId}/list-for-rent`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            expectedRent: Number(expectedRent),
            securityDeposit: Number(securityDeposit)
          })
        });
        if (!response.ok) throw new Error('Failed to list property');
      }
      setShowListingModal(false);
      setSelectedProperty(null);
      setListingPrice('');
      setExpectedRent('');
      setSecurityDeposit('');
      await loadOwnerProperties();
    } catch (error) {
      console.error('Error listing property:', error);
      alert('Failed to list property');
    }
  };

  const getPropertyStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      'vacant': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Vacant' },
      'owner-occupied': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Owner Occupied' },
      'for-sale': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'For Sale' },
      'for-rent': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'For Rent' },
      'rented': { bg: 'bg-green-100', text: 'text-green-800', label: 'Rented' },
      'sold': { bg: 'bg-red-100', text: 'text-red-800', label: 'Sold' },
      'under-construction': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Under Construction' },
    };
    const config = statusConfig[status] || statusConfig['vacant'];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <LoadingSpinner message="Loading owner..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/owners')}
                className="p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                  <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                    {isNew ? 'New Owner' : owner.name || 'Owner Details'}
                  </h1>
                  {!isNew && owner.phone && (
                    <p className="text-xs sm:text-sm text-gray-500">{owner.phone}</p>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 font-medium"
            >
              <Save className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base">{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* All Sections in Single Page */}
        {/* Profile Section */}
        <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-xl p-4 sm:p-6 space-y-6 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2 text-blue-600" />
              Basic Information
            </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={owner.name || ''}
                    onChange={(e) => setOwner({ ...owner, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
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
                      value={owner.phone || ''}
                      onChange={(e) => setOwner({ ...owner, phone: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      value={owner.email || ''}
                      onChange={(e) => setOwner({ ...owner, email: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                      placeholder="Email address"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={owner.status || 'active'}
                    onChange={(e) => setOwner({ ...owner, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    value={owner.address || ''}
                    onChange={(e) => setOwner({ ...owner, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Full address"
                  />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
              KYC & Bank Details
            </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={owner.panNumber || ''}
                    onChange={(e) => setOwner({ ...owner, panNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="ABCDE1234F"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Number</label>
                  <input
                    type="text"
                    value={owner.aadharNumber || ''}
                    onChange={(e) => setOwner({ ...owner, aadharNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="1234-5678-9012"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={owner.bankName || ''}
                    onChange={(e) => setOwner({ ...owner, bankName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Bank name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={owner.accountNumber || ''}
                    onChange={(e) => setOwner({ ...owner, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Account number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={owner.ifscCode || ''}
                    onChange={(e) => setOwner({ ...owner, ifscCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="IFSC code"
                  />
              </div>
            </div>
          </div>
        </div>

{/* Documents Section */}
        {!isNew && id && (
          <DocumentUploadSection
            entityId={id}
            entityType="owner"
            documents={{
              photoUrl: owner.photoUrl,
              panDocUrl: owner.panDocUrl,
              aadharDocUrl: owner.aadharDocUrl,
            }}
            onUpload={handleDocumentUpload}
            uploadingDoc={uploadingDoc}
            isNew={isNew}
          />
        )}

        {/* Properties Section */}
        {!isNew && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Building2 className="h-5 w-5 mr-2 text-blue-600" />
                Owner's Properties
              </h3>
              <button
                onClick={() => setShowAddPropertyModal(true)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add Property</span>
              </button>
            </div>
            {properties.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No properties owned yet</p>
                <button
                  onClick={() => setShowAddPropertyModal(true)}
                  className="mt-3 text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add your first property
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {properties.map((property) => (
                  <div key={property.propertyId} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{property.title}</h4>
                          {getPropertyStatusBadge(property.status)}
                        </div>
                        <p className="text-sm text-gray-600">{property.area}, {property.city}</p>
                        <p className="text-xs text-gray-500 mt-1">{property.bhk} BHK • {property.propertyType}</p>
                      </div>
                    </div>
                    
                    {/* Property Actions */}
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                      <button
                        onClick={() => navigate(`/crm/properties/${property.propertyId}`)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        <FileText className="h-3 w-3" />
                        View Details
                      </button>
                      
                      {(property.status === 'vacant' || property.status === 'owner-occupied') && (
                        <>
                          <button
                            onClick={() => handleListForSale(property)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            <DollarSign className="h-3 w-3" />
                            List for Sale
                          </button>
                          <button
                            onClick={() => handleListForRent(property)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                          >
                            <Home className="h-3 w-3" />
                            List for Rent
                          </button>
                        </>
                      )}
                      
                      {property.status === 'for-sale' && property.saleInfo?.listedPrice && (
                        <div className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-900 rounded">
                          <DollarSign className="h-3 w-3" />
                          Listed: ₹{property.saleInfo.listedPrice.toLocaleString()}
                        </div>
                      )}
                      
                      {property.status === 'for-rent' && property.rentalInfo?.expectedRent && (
                        <div className="flex items-center gap-1 px-3 py-1.5 text-xs bg-yellow-50 text-yellow-900 rounded">
                          <Home className="h-3 w-3" />
                          Rent: ₹{property.rentalInfo.expectedRent.toLocaleString()}/mo
                        </div>
                      )}
                      
                      {property.status === 'rented' && property.rentalInfo?.currentTenantId && (
                        <div className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-900 rounded">
                          <CheckCircle className="h-3 w-3" />
                          Rented to: {property.rentalInfo.currentTenantId}
                        </div>
                      )}
                      
                      {property.status === 'sold' && property.saleInfo?.soldPrice && (
                        <div className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-900 rounded">
                          <CheckCircle className="h-3 w-3" />
                          Sold: ₹{property.saleInfo.soldPrice.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Meetings Section */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Meetings</h3>
              {!isNew && (
                <button
                  onClick={() => setShowMeetingForm(!showMeetingForm)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Schedule Meeting</span>
                </button>
              )}
            </div>

            {showMeetingForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={newMeeting.meetingDate}
                      onChange={(e) => setNewMeeting({ ...newMeeting, meetingDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input
                      type="time"
                      value={newMeeting.meetingTime}
                      onChange={(e) => setNewMeeting({ ...newMeeting, meetingTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={newMeeting.location}
                      onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Meeting location"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title/Purpose</label>
                    <input
                      type="text"
                      value={newMeeting.title}
                      onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Meeting title"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={newMeeting.notes}
                      onChange={(e) => setNewMeeting({ ...newMeeting, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Additional notes"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleScheduleMeeting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
              <p className="text-gray-500 text-center py-8">Save the owner first to schedule meetings</p>
            ) : meetings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No meetings scheduled</p>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <div key={meeting.meetingId} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-start space-x-2">
                        <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
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

        {/* Notes Section */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Add Note</label>
            <div className="flex gap-2">
              <textarea
                value={isNew ? draftActivityNote : newNote}
                onChange={(e) => (isNew ? setDraftActivityNote(e.target.value) : setNewNote(e.target.value))}
                placeholder={isNew ? 'Add a note (will be saved after creating owner)...' : 'Add a note...'}
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
                 aria-label="Add">
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

            {isNew ? (
              <p className="text-gray-500 text-center py-8">Save the owner to see note history</p>
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

      {/* Add Property Modal */}
      {!isNew && id && (
        <AddPropertyModal
          isOpen={showAddPropertyModal}
          onClose={() => setShowAddPropertyModal(false)}
          ownerId={id}
          ownerName={owner.name || 'Owner'}
          onPropertyAdded={handlePropertyAdded}
        />
      )}

      {/* Listing Modal */}
      {showListingModal && selectedProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {listingType === 'sale' ? 'List Property for Sale' : 'List Property for Rent'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">{selectedProperty.title}</p>
            
            {listingType === 'sale' ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Listing Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                  <input
                    type="number"
                    value={listingPrice}
                    onChange={(e) => setListingPrice(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter listing price"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Rent (Monthly) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={expectedRent}
                      onChange={(e) => setExpectedRent(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter monthly rent"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Security Deposit <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={securityDeposit}
                      onChange={(e) => setSecurityDeposit(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter security deposit"
                    />
                  </div>
                </div>
              </>
            )}
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSubmitListing}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {listingType === 'sale' ? 'List for Sale' : 'List for Rent'}
              </button>
              <button
                onClick={() => {
                  setShowListingModal(false);
                  setSelectedProperty(null);
                  setListingPrice('');
                  setExpectedRent('');
                  setSecurityDeposit('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
