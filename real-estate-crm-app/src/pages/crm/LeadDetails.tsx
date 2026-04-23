import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Target,
  ArrowLeft,
  Save,
  Phone,
  Mail,
  User,
  Home,
  ShoppingCart,
  Key,
  Tag,
  Plus,
  Clock,
  CheckCircle,
  IndianRupee,
  MapPin,
  Calendar,
  Building2,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import { api } from '../../services/api';
import SpeechToTextButton from '../../components/SpeechToTextButton';
import ScheduleMeetingModal from '../../components/ScheduleMeetingModal';
import MeetingRescheduleModal from '../../components/MeetingRescheduleModal';
import { CRMLead, CRMLeadNote, LeadType, LeadStatus, LeadPriority, CRMMeeting } from '../../types/crm';

export default function LeadDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const [lead, setLead] = useState<Partial<CRMLead>>({
    leadType: 'buyer',
    name: '',
    phone: '',
    email: '',
    source: '',
    status: 'new',
    priority: 'medium',
    notes: '',
    buyerRequirement: {},
    sellerProperty: {},
    tenantRequirement: {},
    ownerProperty: {},
  });
  const [notes, setNotes] = useState<CRMLeadNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [draftActivityNote, setDraftActivityNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [converting, setConverting] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);

  const [meetings, setMeetings] = useState<CRMMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const [rescheduleMeeting, setRescheduleMeeting] = useState<CRMMeeting | null>(null);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeMeeting, setOutcomeMeeting] = useState<CRMMeeting | null>(null);
  const [outcomeText, setOutcomeText] = useState('');
  const [updatingMeeting, setUpdatingMeeting] = useState(false);

  useEffect(() => {
    if (!showConvertModal && !showOutcomeModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showOutcomeModal) {
        setShowOutcomeModal(false);
        setOutcomeMeeting(null);
        setOutcomeText('');
        return;
      }
      if (showConvertModal) {
        setShowConvertModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showConvertModal, showOutcomeModal]);
  
  // Conversion form state
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [ownerLookupPhone, setOwnerLookupPhone] = useState('');
  const [ownerLookupLoading, setOwnerLookupLoading] = useState(false);
  const [ownerLookupError, setOwnerLookupError] = useState<string | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<any | null>(null);
  const [ownerProperties, setOwnerProperties] = useState<any[]>([]);
  const [ownerPropertiesLoading, setOwnerPropertiesLoading] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState({
    saleAmount: '',
    purchaseDate: '',
    registrationDate: '',
    registrationNumber: '',
    stampDutyPaid: '',
    brokeragePaid: '',
  });
  const [leaseDetails, setLeaseDetails] = useState({
    leaseStartDate: '',
    leaseEndDate: '',
    monthlyRent: '',
    securityDeposit: '',
  });
  const [kycDetails, setKycDetails] = useState({
    panNumber: '',
    aadharNumber: '',
  });

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    
    if (id) {
      loadLead();
      loadProperties();
      loadMeetings();
    }
  }, [id, isNew]);

  const loadMeetings = async () => {
    if (!id || isNew) return;
    try {
      setLoadingMeetings(true);
      const data = await api.getMeetingsByEntity('lead', id);
      setMeetings(Array.isArray(data) ? (data as CRMMeeting[]) : []);
    } catch (e) {
      console.error('Error loading meetings:', e);
      setMeetings([]);
    } finally {
      setLoadingMeetings(false);
    }
  };

  const handleMeetingStatus = async (meetingId: string, status: 'completed' | 'cancelled') => {
    try {
      setUpdatingMeeting(true);
      await api.updateMeeting(meetingId, { status });
      await loadMeetings();
    } catch (e) {
      console.error('Failed to update meeting status', e);
      alert('Failed to update meeting');
    } finally {
      setUpdatingMeeting(false);
    }
  };

  const openOutcome = (meeting: CRMMeeting) => {
    setOutcomeMeeting(meeting);
    setOutcomeText(meeting.outcome || '');
    setShowOutcomeModal(true);
  };

  const saveOutcome = async () => {
    if (!outcomeMeeting) return;
    try {
      setUpdatingMeeting(true);
      await api.updateMeeting(outcomeMeeting.meetingId, {
        status: 'completed',
        outcome: outcomeText,
      });
      setShowOutcomeModal(false);
      setOutcomeMeeting(null);
      setOutcomeText('');
      await loadMeetings();
    } catch (e) {
      console.error('Failed to save meeting outcome', e);
      alert('Failed to save meeting summary');
    } finally {
      setUpdatingMeeting(false);
    }
  };

  useEffect(() => {
    if (isNew || !id) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('convert') === '1') {
      setShowConvertModal(true);
    }
  }, [id, isNew]);

  useEffect(() => {
    if (!showConvertModal) return;
    if (lead.leadType !== 'tenant') return;

    // Reset owner + property selection when opening the tenant conversion modal
    setOwnerLookupPhone(lead.phone || '');
    setOwnerLookupError(null);
    setSelectedOwner(null);
    setOwnerProperties([]);
    setSelectedPropertyId('');
  }, [showConvertModal, lead.leadType]);

  useEffect(() => {
    if (lead.leadType !== 'tenant') return;
    // If an owner is selected, property must belong to that owner's properties
    if (!selectedOwner) return;
    if (!selectedPropertyId) return;
    const stillValid = ownerProperties.some((p) => p.propertyId === selectedPropertyId);
    if (!stillValid) {
      setSelectedPropertyId('');
    }
  }, [lead.leadType, selectedOwner, ownerProperties, selectedPropertyId]);

  useEffect(() => {
    if (lead.leadType !== 'tenant') return;
    if (!selectedPropertyId) return;

    const selected = (selectedOwner ? ownerProperties : properties).find((p) => p.propertyId === selectedPropertyId);
    if (!selected) return;

    setLeaseDetails((prev) => {
      const next = { ...prev };
      if (!next.leaseStartDate) {
        next.leaseStartDate = new Date().toISOString().split('T')[0];
      }
      if (!next.monthlyRent && selected.rentAmount) {
        next.monthlyRent = String(selected.rentAmount);
      }
      return next;
    });
  }, [lead.leadType, selectedPropertyId, properties]);

  const loadProperties = async () => {
    try {
      const allProperties = await api.getCRMProperties();
      setProperties(allProperties || []);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  const lookupOwnerByPhone = async () => {
    try {
      const phone = (ownerLookupPhone || '').trim();
      if (!phone) {
        setOwnerLookupError('Enter owner phone number');
        return;
      }

      setOwnerLookupLoading(true);
      setOwnerLookupError(null);

      const result = await api.getOwnerByPhone(phone);
      const owner = result?.owner || null;

      if (!result?.found || !owner) {
        setSelectedOwner(null);
        setOwnerProperties([]);
        setSelectedPropertyId('');
        setOwnerLookupError('Owner not found for this phone number');
        return;
      }

      setSelectedOwner(owner);
      setOwnerPropertiesLoading(true);
      const props = await api.getOwnerProperties(owner.ownerId);
      setOwnerProperties(Array.isArray(props) ? props : []);
      setSelectedPropertyId('');
    } catch (e) {
      console.error('Owner lookup failed:', e);
      setOwnerLookupError(e instanceof Error ? e.message : 'Failed to lookup owner');
      setSelectedOwner(null);
      setOwnerProperties([]);
      setSelectedPropertyId('');
    } finally {
      setOwnerLookupLoading(false);
      setOwnerPropertiesLoading(false);
    }
  };

  const clearOwnerSelection = () => {
    setSelectedOwner(null);
    setOwnerProperties([]);
    setSelectedPropertyId('');
    setOwnerLookupError(null);
  };

  const loadLead = async () => {
    try {
      setLoading(true);
      const [leadData, notesData] = await Promise.all([
        api.getLead(id!),
        api.getLeadNotes(id!),
      ]);
      setLead(leadData);
      setNotes(notesData);
    } catch (error) {
      console.error('Error loading lead:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!lead.name || !lead.leadType) {
      alert('Name and lead type are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        leadType: lead.leadType as LeadType,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        status: lead.status,
        priority: lead.priority,
        buyerRequirement: lead.buyerRequirement || undefined,
        sellerProperty: lead.sellerProperty || undefined,
        tenantRequirement: lead.tenantRequirement || undefined,
        ownerProperty: lead.ownerProperty || undefined,
        notes: lead.notes,
      };

      if (isNew) {
        const created = await api.createLead(payload);
        if (draftActivityNote.trim()) {
          try {
            await api.createLeadNote(created.leadId, { content: draftActivityNote });
          } catch (e) {
            console.error('Error adding initial lead note:', e);
          }
        }
      } else {
        await api.updateLead(id!, payload);
      }

      navigate('/crm/leads');
    } catch (error) {
      console.error('Error saving lead:', error);
      alert('Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !id) return;

    try {
      const note = await api.createLeadNote(id, { content: newNote });
      setNotes([note, ...notes]);
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleNoteEdit = (note: CRMLeadNote) => {
    setEditingNoteId(note.noteId);
    setEditingNoteContent(note.content);
  };

  const handleNoteEditSave = async (noteId: string) => {
    if (!id || !editingNoteContent.trim()) return;
    try {
      const updated = await api.updateLeadNote(id, noteId, { content: editingNoteContent });
      setNotes(prev => prev.map(n => n.noteId === noteId ? (updated || n) : n));
      setEditingNoteId(null);
      setEditingNoteContent('');
    } catch (e) {
      console.error('Error updating note:', e);
    }
  };

  const handleNoteDelete = async (noteId: string) => {
    if (!id) return;
    setDeletingNoteId(noteId);
    try {
      await api.deleteLeadNote(id, noteId);
      setNotes(prev => prev.filter(n => n.noteId !== noteId));
    } catch (e) {
      console.error('Error deleting note:', e);
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleConvert = async () => {
    if (!id) return;

    try {
      setConverting(true);
      const payload: any = {};

      // Buyer conversion - requires purchase details
      if (lead.leadType === 'buyer') {
        if (!selectedPropertyId || !purchaseDetails.saleAmount) {
          alert('Property and sale amount are required for buyer conversion');
          return;
        }
        payload.purchaseDetails = {
          propertyId: selectedPropertyId,
          saleAmount: Number(purchaseDetails.saleAmount),
          purchaseDate: purchaseDetails.purchaseDate || new Date().toISOString().split('T')[0],
          registrationDate: purchaseDetails.registrationDate || undefined,
          registrationNumber: purchaseDetails.registrationNumber || undefined,
          stampDutyPaid: purchaseDetails.stampDutyPaid ? Number(purchaseDetails.stampDutyPaid) : undefined,
          brokeragePaid: purchaseDetails.brokeragePaid ? Number(purchaseDetails.brokeragePaid) : undefined,
        };
        if (kycDetails.panNumber || kycDetails.aadharNumber) {
          payload.kycDetails = {
            panNumber: kycDetails.panNumber || undefined,
            aadharNumber: kycDetails.aadharNumber || undefined,
          };
        }
      }
      // Tenant conversion - requires lease details
      else if (lead.leadType === 'tenant') {
        if (!selectedOwner) {
          alert('Owner is required for tenant conversion');
          return;
        }
        if (!selectedPropertyId || !leaseDetails.monthlyRent || !leaseDetails.leaseStartDate) {
          alert('Property, rent, and lease start date are required for tenant conversion');
          return;
        }
        if (!ownerProperties.some((p) => p.propertyId === selectedPropertyId)) {
          alert('Please select a property that belongs to the selected owner');
          return;
        }
        payload.leaseDetails = {
          propertyId: selectedPropertyId,
          leaseStartDate: leaseDetails.leaseStartDate,
          leaseEndDate: leaseDetails.leaseEndDate || undefined,
          monthlyRent: Number(leaseDetails.monthlyRent),
          securityDeposit: leaseDetails.securityDeposit ? Number(leaseDetails.securityDeposit) : undefined,
        };
        if (kycDetails.aadharNumber) {
          payload.kycDetails = {
            aadharNumber: kycDetails.aadharNumber,
          };
        }
      }
      // Seller conversion - creates owner + property
      else if (lead.leadType === 'seller') {
        payload.createPropertyListing = true;
      }
      // Owner conversion - simple
      // No extra details needed

      const result = await api.convertLead(id, payload);

      const entityType = result?.entityType;
      const entity = result?.entity;

      if (entityType === 'buyer' && entity?.buyerId) {
        navigate(`/crm/buyers/${entity.buyerId}`);
      } else if (entityType === 'tenant' && entity?.customerId) {
        navigate(`/crm/tenants/${entity.customerId}`);
      } else if (entityType === 'owner' && entity?.ownerId) {
        navigate(`/crm/owners/${entity.ownerId}`);
      } else {
        navigate('/crm/leads');
      }

      setShowConvertModal(false);
    } catch (error) {
      console.error('Error converting lead:', error);
      alert('Failed to convert lead');
    } finally {
      setConverting(false);
    }
  };

  // Check if lead is converted
  const isConverted = !!lead.convertedAt;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/leads')}
                className="p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
                  <Target className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                    {isNew ? 'New Lead' : lead.name || 'Lead Details'}
                  </h1>
                  {!isNew && lead.leadType && (
                    <p className="text-xs sm:text-sm text-gray-500 capitalize">{lead.leadType} Lead</p>
                  )}
                </div>
              </div>
            </div>
            {!isConverted && (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/30 disabled:opacity-50 font-medium"
                >
                  <Save className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm">{saving ? 'Saving...' : 'Save'}</span>
                </button>
                {!isNew && (
                  <button
                    onClick={() => setShowConvertModal(true)}
                    className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg shadow-emerald-500/30 font-medium"
                  >
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-sm">Convert</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Converted Banner */}
        {isConverted && (
          <div className="mb-4 p-4 bg-white/60 backdrop-blur-xl border border-green-200/50 rounded-xl shadow-lg">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <div>
                <p className="font-medium text-green-800">Lead Converted</p>
                <p className="text-sm text-green-600">
                  Converted to {lead.convertedTo?.role} on {new Date(lead.convertedAt!).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {!isNew && id && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                Meetings
              </h3>
              <button
                onClick={() => setShowScheduleMeeting(true)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={loadingMeetings}
              >
                Schedule
              </button>
            </div>

            {loadingMeetings ? (
              <div className="text-sm text-gray-500">Loading meetings...</div>
            ) : meetings.length === 0 ? (
              <div className="text-sm text-gray-500">No meetings scheduled for this lead.</div>
            ) : (
              <div className="space-y-3">
                {meetings
                  .slice()
                  .sort((a, b) => {
                    const dateCompare = (b.meetingDate || '').localeCompare(a.meetingDate || '');
                    if (dateCompare !== 0) return dateCompare;
                    return (b.meetingTime || '').localeCompare(a.meetingTime || '');
                  })
                  .map((m) => (
                    <div key={m.meetingId} className="p-3 border rounded-lg bg-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">{m.title}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {new Date(m.meetingDate).toLocaleDateString()} • {m.meetingTime}
                            {m.duration ? ` • ${m.duration} min` : ''}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 capitalize">Status: {m.status}</div>
                          {m.outcome ? (
                            <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{m.outcome}</div>
                          ) : null}
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => setRescheduleMeeting(m)}
                            className="px-3 py-1.5 text-xs bg-white border rounded hover:bg-gray-100"
                            disabled={updatingMeeting}
                          >
                            Reschedule
                          </button>
                          {m.status === 'scheduled' && (
                            <>
                              <button
                                type="button"
                                onClick={() => openOutcome(m)}
                                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                disabled={updatingMeeting}
                              >
                                Complete + Summary
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMeetingStatus(m.meetingId, 'cancelled')}
                                className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded hover:bg-gray-800"
                                disabled={updatingMeeting}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Lead Type Selection (only for new leads) */}
        {isNew && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Type</h3>
            <div className="max-w-xs">
              <select
                value={lead.leadType || 'buyer'}
                onChange={(e) => setLead({ ...lead, leadType: e.target.value as LeadType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="tenant">Tenant</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <User className="h-5 w-5 mr-2 text-amber-600" />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={lead.name || ''}
                onChange={(e) => setLead({ ...lead, name: e.target.value })}
                disabled={isConverted}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  value={lead.phone || ''}
                  onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                  disabled={isConverted}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
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
                  value={lead.email || ''}
                  onChange={(e) => setLead({ ...lead, email: e.target.value })}
                  disabled={isConverted}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                  placeholder="Email address"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <input
                type="text"
                value={lead.source || ''}
                onChange={(e) => setLead({ ...lead, source: e.target.value })}
                disabled={isConverted}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                placeholder="e.g., Referral, Website, Walk-in"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={lead.status || 'new'}
                onChange={(e) => setLead({ ...lead, status: e.target.value as LeadStatus })}
                disabled={isConverted}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="negotiating">Negotiating</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={lead.priority || 'medium'}
                onChange={(e) => setLead({ ...lead, priority: e.target.value as LeadPriority })}
                disabled={isConverted}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        </div>

        {/* Type-specific fields */}
        {lead.leadType === 'buyer' && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ShoppingCart className="h-5 w-5 mr-2 text-orange-600" />
              Buyer Requirements
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Requirement</label>
                <textarea
                  value={lead.buyerRequirement?.requirement || ''}
                  onChange={(e) => setLead({
                    ...lead,
                    buyerRequirement: { ...lead.buyerRequirement, requirement: e.target.value }
                  })}
                  disabled={isConverted}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                  placeholder="What are they looking for?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    value={lead.buyerRequirement?.budget || ''}
                    onChange={(e) => setLead({
                      ...lead,
                      buyerRequirement: { ...lead.buyerRequirement, budget: Number(e.target.value) }
                    })}
                    disabled={isConverted}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                    placeholder="Budget amount"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Area</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={lead.buyerRequirement?.preferredArea || ''}
                    onChange={(e) => setLead({
                      ...lead,
                      buyerRequirement: { ...lead.buyerRequirement, preferredArea: e.target.value }
                    })}
                    disabled={isConverted}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                    placeholder="Preferred location"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <select
                  value={lead.buyerRequirement?.propertyType || ''}
                  onChange={(e) => setLead({
                    ...lead,
                    buyerRequirement: { ...lead.buyerRequirement, propertyType: e.target.value }
                  })}
                  disabled={isConverted}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                >
                  <option value="">Select type</option>
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="villa">Villa</option>
                  <option value="office">Office</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">BHK</label>
                <select
                  value={lead.buyerRequirement?.bhk || ''}
                  onChange={(e) => setLead({
                    ...lead,
                    buyerRequirement: { ...lead.buyerRequirement, bhk: Number(e.target.value) }
                  })}
                  disabled={isConverted}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                >
                  <option value="">Any</option>
                  <option value="1">1 BHK</option>
                  <option value="2">2 BHK</option>
                  <option value="3">3 BHK</option>
                  <option value="4">4 BHK</option>
                  <option value="5">5+ BHK</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {lead.leadType === 'seller' && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Tag className="h-5 w-5 mr-2 text-purple-600" />
              Property for Sale
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <select
                  value={lead.sellerProperty?.propertyType || ''}
                  onChange={(e) => setLead({
                    ...lead,
                    sellerProperty: { ...lead.sellerProperty, propertyType: e.target.value }
                  })}
                  disabled={isConverted}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                >
                  <option value="">Select type</option>
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="villa">Villa</option>
                  <option value="office">Office</option>
                  <option value="land">Land</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area/Location</label>
                <input
                  type="text"
                  value={lead.sellerProperty?.area || ''}
                  onChange={(e) => setLead({
                    ...lead,
                    sellerProperty: { ...lead.sellerProperty, area: e.target.value }
                  })}
                  disabled={isConverted}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                  placeholder="Property location"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Price</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    value={lead.sellerProperty?.expectedPrice || ''}
                    onChange={(e) => setLead({
                      ...lead,
                      sellerProperty: { ...lead.sellerProperty, expectedPrice: Number(e.target.value) }
                    })}
                    disabled={isConverted}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                    placeholder="Expected price"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timeline</label>
                <input
                  type="text"
                  value={lead.sellerProperty?.timeline || ''}
                  onChange={(e) => setLead({
                    ...lead,
                    sellerProperty: { ...lead.sellerProperty, timeline: e.target.value }
                  })}
                  disabled={isConverted}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                  placeholder="e.g., Within 3 months"
                />
              </div>
            </div>
          </div>
        )}

        {lead.leadType === 'tenant' && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Key className="h-5 w-5 mr-2 text-teal-600" />
              Rental Requirements
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Requirement</label>
                <textarea
                  value={lead.tenantRequirement?.requirement || ''}
                  onChange={(e) => setLead({
                    ...lead,
                    tenantRequirement: { ...lead.tenantRequirement, requirement: e.target.value }
                  })}
                  disabled={isConverted}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                  placeholder="What type of rental are they looking for?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget (Monthly)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    value={lead.tenantRequirement?.budget || ''}
                    onChange={(e) => setLead({
                      ...lead,
                      tenantRequirement: { ...lead.tenantRequirement, budget: Number(e.target.value) }
                    })}
                    disabled={isConverted}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                    placeholder="Monthly budget"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Area</label>
                <input
                  type="text"
                  value={lead.tenantRequirement?.preferredArea || ''}
                  onChange={(e) => setLead({
                    ...lead,
                    tenantRequirement: { ...lead.tenantRequirement, preferredArea: e.target.value }
                  })}
                  disabled={isConverted}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                  placeholder="Preferred location"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Move-in Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={lead.tenantRequirement?.moveInDate || ''}
                    onChange={(e) => setLead({
                      ...lead,
                      tenantRequirement: { ...lead.tenantRequirement, moveInDate: e.target.value }
                    })}
                    disabled={isConverted}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {lead.leadType === 'owner' && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Home className="h-5 w-5 mr-2 text-blue-600" />
              Property for Rent
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <select
                  value={lead.ownerProperty?.propertyType || ''}
                  onChange={(e) => setLead({
                    ...lead,
                    ownerProperty: { ...lead.ownerProperty, propertyType: e.target.value }
                  })}
                  disabled={isConverted}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                >
                  <option value="">Select type</option>
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="villa">Villa</option>
                  <option value="office">Office</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area/Location</label>
                <input
                  type="text"
                  value={lead.ownerProperty?.area || ''}
                  onChange={(e) => setLead({
                    ...lead,
                    ownerProperty: { ...lead.ownerProperty, area: e.target.value }
                  })}
                  disabled={isConverted}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                  placeholder="Property location"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Rent</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    value={lead.ownerProperty?.rentExpected || ''}
                    onChange={(e) => setLead({
                      ...lead,
                      ownerProperty: { ...lead.ownerProperty, rentExpected: Number(e.target.value) }
                    })}
                    disabled={isConverted}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                    placeholder="Expected monthly rent"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-amber-600" />
            Notes & History
          </h3>

          {/* General Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <div className="flex gap-2">
              <textarea
                value={lead.notes || ''}
                onChange={(e) => setLead({ ...lead, notes: e.target.value })}
                disabled={isConverted}
                rows={3}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                placeholder="General notes about this lead..."
              />
              <SpeechToTextButton
                disabled={isConverted}
                onText={(text) =>
                  setLead((prev) => ({
                    ...prev,
                    notes: `${(prev.notes || '').trim()}${(prev.notes || '').trim() ? ' ' : ''}${text}`,
                  }))
                }
              />
            </div>
          </div>

          {/* Add Note (only for existing leads) */}
          {!isConverted && (
            <div className="mb-4 pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-1">Add Activity Note</label>
              <div className="flex gap-2">
                <textarea
                  value={isNew ? draftActivityNote : newNote}
                  onChange={(e) => (isNew ? setDraftActivityNote(e.target.value) : setNewNote(e.target.value))}
                  placeholder={isNew ? 'Add a note (will be saved after creating lead)...' : 'Add a note about an interaction...'}
                  rows={2}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
                <SpeechToTextButton
                  disabled={isConverted}
                  onText={(text) =>
                    (isNew ? setDraftActivityNote : setNewNote)((prev) => `${prev.trim()}${prev.trim() ? ' ' : ''}${text}`)
                  }
                />
                {!isNew && (
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Notes List */}
          {notes.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700">Activity Notes</h4>
              {notes.map((note) => (
                <div key={note.noteId} className="p-3 bg-gray-50 rounded-lg">
                  {editingNoteId === note.noteId ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingNoteContent}
                        onChange={(e) => setEditingNoteContent(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleNoteEditSave(note.noteId)} className="px-3 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700">Save</button>
                        <button onClick={() => { setEditingNoteId(null); setEditingNoteContent(''); }} className="px-3 py-1 border rounded text-xs hover:bg-gray-100">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">{note.createdBy} • {new Date(note.createdAt).toLocaleString()}</span>
                        <div className="flex gap-1">
                          <button onClick={() => handleNoteEdit(note)} className="p-1 text-gray-400 hover:text-amber-600 rounded" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleNoteDelete(note.noteId)}
                            disabled={deletingNoteId === note.noteId}
                            className="p-1 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* History */}
          {lead.history && lead.history.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-3">History</h4>
              <div className="space-y-2">
                {lead.history.map((entry, index) => (
                  <div key={index} className="flex items-start text-sm">
                    <div className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 mr-3 flex-shrink-0"></div>
                    <div>
                      <span className="font-medium">{entry.action}</span>
                      <span className="text-gray-500"> - {entry.details}</span>
                      <div className="text-xs text-gray-400">
                        {entry.updatedBy} • {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Convert Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md max-h-[80vh] overflow-hidden rounded-2xl border border-white/30 bg-white/70 shadow-2xl backdrop-blur-xl">
            <div className="sticky top-0 bg-white/50 backdrop-blur-xl border-b px-5 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Convert {lead.leadType} Lead to {lead.leadType === 'seller' ? 'Owner' : lead.leadType}
              </h3>
              <button
                onClick={() => setShowConvertModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-6 overflow-y-auto max-h-[calc(80vh-64px)]">
              {/* Buyer Conversion Form */}
              {lead.leadType === 'buyer' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Property <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Choose a property...</option>
                      {properties.map((prop) => (
                        <option key={prop.propertyId} value={prop.propertyId}>
                          {prop.title} - {prop.area}, {prop.city}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Purchase Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Sale Amount <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                          <input
                            type="number"
                            value={purchaseDetails.saleAmount}
                            onChange={(e) => setPurchaseDetails({...purchaseDetails, saleAmount: e.target.value})}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            placeholder="Sale amount"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                        <input
                          type="date"
                          value={purchaseDetails.purchaseDate}
                          onChange={(e) => setPurchaseDetails({...purchaseDetails, purchaseDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Registration Date</label>
                        <input
                          type="date"
                          value={purchaseDetails.registrationDate}
                          onChange={(e) => setPurchaseDetails({...purchaseDetails, registrationDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                        <input
                          type="text"
                          value={purchaseDetails.registrationNumber}
                          onChange={(e) => setPurchaseDetails({...purchaseDetails, registrationNumber: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          placeholder="REG-2024-001"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stamp Duty Paid</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                          <input
                            type="number"
                            value={purchaseDetails.stampDutyPaid}
                            onChange={(e) => setPurchaseDetails({...purchaseDetails, stampDutyPaid: e.target.value})}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Brokerage Paid</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                          <input
                            type="number"
                            value={purchaseDetails.brokeragePaid}
                            onChange={(e) => setPurchaseDetails({...purchaseDetails, brokeragePaid: e.target.value})}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-3">KYC Details (Optional)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                        <input
                          type="text"
                          value={kycDetails.panNumber}
                          onChange={(e) => setKycDetails({...kycDetails, panNumber: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          placeholder="ABCDE1234F"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Number</label>
                        <input
                          type="text"
                          value={kycDetails.aadharNumber}
                          onChange={(e) => setKycDetails({...kycDetails, aadharNumber: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          placeholder="1234-5678-9012"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Tenant Conversion Form */}
              {lead.leadType === 'tenant' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Owner (search by phone) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={ownerLookupPhone}
                        onChange={(e) => setOwnerLookupPhone(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="Owner phone number"
                      />
                      <button
                        type="button"
                        onClick={lookupOwnerByPhone}
                        disabled={ownerLookupLoading}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                      >
                        {ownerLookupLoading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                    {ownerLookupError && (
                      <p className="text-sm text-red-600 mt-2">{ownerLookupError}</p>
                    )}
                    {selectedOwner && (
                      <div className="mt-3 p-3 bg-white/60 rounded-xl border border-white/30">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{selectedOwner.name || 'Owner'}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{selectedOwner.phone}</p>
                          </div>
                          <button
                            type="button"
                            onClick={clearOwnerSelection}
                            className="px-3 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                          >
                            Change
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 mt-2">
                          Properties: {ownerPropertiesLoading ? 'Loading…' : ownerProperties.length}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Property <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      disabled={!selectedOwner || ownerPropertiesLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">{!selectedOwner ? 'Select an owner first...' : ownerPropertiesLoading ? 'Loading properties...' : 'Choose a property...'}</option>
                      {ownerProperties
                        .filter(p => p.status === 'available' || p.status === 'for-rent' || p.status === 'vacant')
                        .map((prop) => (
                        <option key={prop.propertyId} value={prop.propertyId}>
                          {prop.title} - {prop.area}, {prop.city}
                        </option>
                      ))}
                    </select>
                    {selectedOwner && !ownerPropertiesLoading && ownerProperties.length === 0 && (
                      <p className="text-sm text-amber-700 mt-2">
                        This owner has no properties yet. Add properties to the owner first.
                      </p>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Lease Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Monthly Rent <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                          <input
                            type="number"
                            value={leaseDetails.monthlyRent}
                            onChange={(e) => setLeaseDetails({...leaseDetails, monthlyRent: e.target.value})}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            placeholder="Monthly rent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Security Deposit</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                          <input
                            type="number"
                            value={leaseDetails.securityDeposit}
                            onChange={(e) => setLeaseDetails({...leaseDetails, securityDeposit: e.target.value})}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Lease Start Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={leaseDetails.leaseStartDate}
                          onChange={(e) => setLeaseDetails({...leaseDetails, leaseStartDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lease End Date</label>
                        <input
                          type="date"
                          value={leaseDetails.leaseEndDate}
                          onChange={(e) => setLeaseDetails({...leaseDetails, leaseEndDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-3">KYC Details (Optional)</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Number</label>
                      <input
                        type="text"
                        value={kycDetails.aadharNumber}
                        onChange={(e) => setKycDetails({...kycDetails, aadharNumber: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="1234-5678-9012"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Seller Conversion Info */}
              {lead.leadType === 'seller' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Building2 className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-2">Seller to Owner Conversion</h4>
                      <p className="text-sm text-blue-700 mb-2">
                        This will create an Owner profile and automatically list their property for sale with the details provided in this lead.
                      </p>
                      {lead.sellerProperty && (
                        <div className="text-sm text-blue-800 mt-3 space-y-1">
                          <p><strong>Property Type:</strong> {lead.sellerProperty.propertyType || 'Not specified'}</p>
                          <p><strong>Location:</strong> {lead.sellerProperty.area || 'Not specified'}</p>
                          <p><strong>Expected Price:</strong> ₹{lead.sellerProperty.expectedPrice?.toLocaleString() || 'Not specified'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Owner Conversion Info */}
              {lead.leadType === 'owner' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Home className="h-5 w-5 text-purple-600 mr-3 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-purple-900 mb-2">Owner Conversion</h4>
                      <p className="text-sm text-purple-700">
                        This will create an Owner profile. You can add properties to this owner later from the Owner Details page.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex gap-3">
              <button
                onClick={handleConvert}
                disabled={converting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {converting ? 'Converting...' : `Convert to ${lead.leadType === 'seller' ? 'Owner' : lead.leadType}`}
              </button>
              <button
                onClick={() => setShowConvertModal(false)}
                disabled={converting}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!isNew && id && (
        <ScheduleMeetingModal
          isOpen={showScheduleMeeting}
          onClose={() => setShowScheduleMeeting(false)}
          onSuccess={async () => {
            await loadMeetings();
          }}
          entityType="lead"
          entityId={id}
          entityName={lead.name || 'Lead'}
          entityPhone={lead.phone || undefined}
          entityEmail={lead.email || undefined}
        />
      )}

      <MeetingRescheduleModal
        isOpen={!!rescheduleMeeting}
        meeting={rescheduleMeeting}
        onClose={() => setRescheduleMeeting(null)}
        onSuccess={async () => {
          setRescheduleMeeting(null);
          await loadMeetings();
        }}
      />

      {showOutcomeModal && outcomeMeeting && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md max-h-[80vh] overflow-hidden rounded-2xl border border-white/30 bg-white/70 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Meeting Summary</h3>
                <p className="text-xs text-gray-500">Save what was discussed</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowOutcomeModal(false);
                  setOutcomeMeeting(null);
                  setOutcomeText('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto max-h-[calc(80vh-64px)]">
              <div className="text-sm text-gray-700 font-medium">{outcomeMeeting.title}</div>
              <textarea
                value={outcomeText}
                onChange={(e) => setOutcomeText(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Summary discussed / next steps..."
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowOutcomeModal(false);
                    setOutcomeMeeting(null);
                    setOutcomeText('');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  disabled={updatingMeeting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveOutcome}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  disabled={updatingMeeting}
                >
                  {updatingMeeting ? 'Saving...' : 'Save & Complete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
