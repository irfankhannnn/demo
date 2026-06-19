import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Target,
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
  X,
  UserPlus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { api } from '../../services/api';
import Toast from '../../components/Toast';
import SpeechToTextButton from '../../components/SpeechToTextButton';
import ScheduleMeetingModal from '../../components/ScheduleMeetingModal';
import MeetingRescheduleModal from '../../components/MeetingRescheduleModal';
import { CRMLead, CRMLeadNote, LeadType, LeadStatus, LeadPriority, CRMContact, CRMMeeting } from '../../types/crm';

interface LeadDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

export default function LeadDrawer({ leadId, onClose, onUpdate }: LeadDrawerProps) {
  const navigate = useNavigate();
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
    sellerProperty: { timelineUnit: 'months' },
    tenantRequirement: {},
    ownerProperty: {},
  });
  const [notes, setNotes] = useState<CRMLeadNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState('');

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [customSource, setCustomSource] = useState('');
  const SOURCE_OPTIONS = ['Website', 'Referral', 'Walk-in', 'Google Ads', 'Social Media', 'Property Portal', 'Broker Network', 'Other'];
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<CRMMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const [rescheduleMeeting, setRescheduleMeeting] = useState<CRMMeeting | null>(null);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeMeeting, setOutcomeMeeting] = useState<CRMMeeting | null>(null);
  const [outcomeText, setOutcomeText] = useState('');
  const [updatingMeeting, setUpdatingMeeting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
  };

  // Conversion state
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!showOutcomeModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        setShowOutcomeModal(false);
        setOutcomeMeeting(null);
        setOutcomeText('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showOutcomeModal]);

  useEffect(() => {
    if (leadId) {
      loadLead();
    }
  }, [leadId]);

  useEffect(() => {
    if (leadId) {
      loadMeetings();
    }
  }, [leadId]);

  const loadLead = async () => {
    if (!leadId) return;

    try {
      setLoading(true);
      const [leadData, notesData] = await Promise.all([
        api.getLead(leadId),
        api.getLeadNotes(leadId),
      ]);
      setLead(leadData);
      setNotes(notesData);
    } catch (error) {
      console.error('Error loading lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMeetings = async () => {
    if (!leadId) return;

    try {
      setLoadingMeetings(true);
      const data = await api.getMeetingsByEntity('lead', leadId);
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
      onUpdate();
    } catch (e) {
      console.error('Failed to update meeting status', e);
      showToast('Failed to update meeting', 'error');
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
      onUpdate();
    } catch (e) {
      console.error('Failed to save meeting outcome', e);
      showToast('Failed to save meeting summary', 'error');
    } finally {
      setUpdatingMeeting(false);
    }
  };

  const handleSave = async () => {
    if (!lead.name || !lead.leadType) {
      showToast('Name and lead type are required', 'error');
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
        lostReason: lead.status === 'lost' ? lead.lostReason : null,
        lostAt: lead.status === 'lost' ? (lead.lostAt || new Date().toISOString()) : null,
        buyerRequirement: lead.buyerRequirement || undefined,
        sellerProperty: lead.sellerProperty || undefined,
        tenantRequirement: lead.tenantRequirement || undefined,
        ownerProperty: lead.ownerProperty || undefined,
        notes: lead.notes,
      };

      await api.updateLead(leadId!, payload);
      onUpdate();
    } catch (error) {
      console.error('Error saving lead:', error);
      showToast('Failed to save lead', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !leadId) return;

    try {
      const note = await api.createLeadNote(leadId, { content: newNote });
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
    if (!leadId || !editingNoteContent.trim()) return;
    try {
      const updated = await api.updateLeadNote(leadId, noteId, { content: editingNoteContent });
      setNotes(prev => prev.map(n => n.noteId === noteId ? (updated || n) : n));
      setEditingNoteId(null);
      setEditingNoteContent('');
    } catch (e) {
      console.error('Error updating note:', e);
    }
  };

  const handleNoteDelete = async (noteId: string) => {
    if (!leadId) return;
    setDeletingNoteId(noteId);
    try {
      await api.deleteLeadNote(leadId, noteId);
      setNotes(prev => prev.filter(n => n.noteId !== noteId));
    } catch (e) {
      console.error('Error deleting note:', e);
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleConvertClick = async () => {
    if (!leadId) return;

    // For buyer and tenant leads, navigate to the detailed conversion page
    if (lead.leadType === 'buyer' || lead.leadType === 'tenant') {
      onClose();
      navigate(`/crm/leads/${leadId}?convert=1`);
      return;
    }

    // For seller and owner leads, convert directly with automatic phone matching
    if (!lead.phone || lead.phone.trim() === '') {
      showToast('Phone number is required to convert lead', 'error');
      return;
    }

    try {
      setConverting(true);
      // API will automatically find/create contact by phone number
      await api.convertLead(leadId, {});
      showToast('Lead converted successfully', 'success');
      loadLead();
      onUpdate();
    } catch (error) {
      console.error('Error converting lead:', error);
      const errorMessage = (error as any)?.message || 'Failed to convert lead';
      showToast(errorMessage, 'error');
    } finally {
      setConverting(false);
    }
  };

  const isConverted = !!lead.convertedAt;

  if (!leadId) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-1/2 bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b z-10">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
                <Target className="h-6 w-6 sm:h-8 sm:w-8 text-amber-600 flex-shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                    {lead.name || 'Lead Details'}
                  </h1>
                  {lead.leadType && (
                    <p className="text-xs sm:text-sm text-slate-400 font-semibold capitalize">{lead.leadType} Lead</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {!isConverted && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 active:scale-95 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>{saving ? 'Saving...' : 'Save'}</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
            </div>
          ) : (
            <>
              {/* Converted Banner */}
              {isConverted && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <div>
                      <p className="font-medium text-green-800">Lead Converted</p>
                      <p className="text-sm text-green-600">
                        Converted to{' '}
                        {lead.convertedTo?.contactId ? (
                          <Link
                            to={`/crm/${lead.convertedTo.role === 'buyer' ? 'buyers' : lead.convertedTo.role === 'tenant' || lead.convertedTo.role === 'customer' ? 'tenants' : 'owners'}/${lead.convertedTo.contactId}`}
                            className="underline font-medium hover:text-green-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {lead.convertedTo.role}
                          </Link>
                        ) : (
                          lead.convertedTo?.role
                        )}{' '}
                        on {new Date(lead.convertedAt!).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Convert Button */}
              {!isConverted && (
                <div className="mb-4">
                  <button
                    onClick={handleConvertClick}
                    disabled={converting}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 active:scale-95 disabled:opacity-50"
                  >
                    <UserPlus className="h-5 w-5" />
                    <span>{converting ? 'Converting...' : 'Convert Lead'}</span>
                  </button>
                </div>
              )}

              {/* Basic Info */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 border">
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
                    <select
                      value={lead.source && SOURCE_OPTIONS.includes(lead.source) ? lead.source : lead.source ? 'Other' : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Other') {
                          setLead({ ...lead, source: customSource || '' });
                        } else {
                          setLead({ ...lead, source: val });
                        }
                      }}
                      disabled={isConverted}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                    >
                      <option value="">Select source</option>
                      {SOURCE_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {(lead.source && !SOURCE_OPTIONS.includes(lead.source)) || (!lead.source && customSource) ? (
                      <input
                        type="text"
                        value={customSource}
                        onChange={(e) => {
                          setCustomSource(e.target.value);
                          setLead({ ...lead, source: e.target.value });
                        }}
                        disabled={isConverted}
                        className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                        placeholder="Enter custom source"
                      />
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lead Type</label>
                    <select
                      value={lead.leadType || 'buyer'}
                      onChange={(e) => {
                        const newType = e.target.value as LeadType;
                        if (leadId) {
                          const confirmChange = window.confirm(
                            'Changing the lead type will reset any type-specific requirements (like budget or property preferences) for this lead. Do you want to proceed?'
                          );
                          if (!confirmChange) return;
                        }
                        setLead({
                          ...lead,
                          leadType: newType,
                          buyerRequirement: null,
                          sellerProperty: null,
                          tenantRequirement: null,
                          ownerProperty: null,
                        });
                      }}
                      disabled={isConverted}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                    >
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                      <option value="tenant">Tenant</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={lead.status || 'new'}
                      onChange={(e) => {
                        const newStatus = e.target.value as LeadStatus;
                        const updates: any = { status: newStatus };
                        if (newStatus === 'lost') {
                          updates.lostAt = new Date().toISOString();
                          updates.lostReason = 'Price too high'; // default option
                        } else {
                          updates.lostAt = null;
                          updates.lostReason = null;
                        }
                        setLead({ ...lead, ...updates });
                      }}
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
                  {lead.status === 'lost' && (
                    <div>
                      <label className="block text-sm font-medium text-red-700 mb-1">Reason for Loss</label>
                      <select
                        value={['Price too high', 'Found another property', 'Not interested anymore', 'Couldn\'t reach'].includes(lead.lostReason || '') ? lead.lostReason || '' : lead.lostReason ? 'Other' : 'Price too high'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Other') {
                            setLead({ ...lead, lostReason: '' });
                          } else {
                            setLead({ ...lead, lostReason: val });
                          }
                        }}
                        disabled={isConverted}
                        className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 disabled:bg-gray-100"
                      >
                        <option value="Price too high">Price too high</option>
                        <option value="Found another property">Found another property</option>
                        <option value="Not interested anymore">Not interested anymore</option>
                        <option value="Couldn't reach">Couldn't reach</option>
                        <option value="Other">Other</option>
                      </select>
                      {!['Price too high', 'Found another property', 'Not interested anymore', 'Couldn\'t reach'].includes(lead.lostReason || '') ? (
                        <input
                          type="text"
                          value={lead.lostReason || ''}
                          onChange={(e) => setLead({ ...lead, lostReason: e.target.value })}
                          disabled={isConverted}
                          className="mt-2 w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 disabled:bg-gray-100"
                          placeholder="Enter custom reason"
                        />
                      ) : null}
                    </div>
                  )}
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
                <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <ShoppingCart className="h-5 w-5 mr-2 text-orange-600" />
                      Buyer Requirements
                    </h3>
                    <button
                      onClick={() => setShowScheduleMeeting(true)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                      disabled={!leadId}
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Schedule Meeting</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Requirements</label>
                      <div className="flex gap-2">
                        <textarea
                          value={lead.buyerRequirement?.requirement || ''}
                          onChange={(e) => setLead({
                            ...lead,
                            buyerRequirement: { ...lead.buyerRequirement, requirement: e.target.value }
                          })}
                          disabled={isConverted}
                          rows={2}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                          placeholder="What are they looking for?"
                        />
                        <SpeechToTextButton
                          disabled={isConverted}
                          onText={(text) => setLead((prev) => ({
                            ...prev,
                            buyerRequirement: {
                              ...prev.buyerRequirement,
                              requirement: `${(prev.buyerRequirement?.requirement || '').trim()}${(prev.buyerRequirement?.requirement || '').trim() ? ' ' : ''}${text}`
                            }
                          }))}
                        />
                      </div>
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
                <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Tag className="h-5 w-5 mr-2 text-purple-600" />
                      Property for Sale
                    </h3>
                    <button
                      onClick={() => setShowScheduleMeeting(true)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                      disabled={!leadId}
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Schedule Meeting</span>
                    </button>
                  </div>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">BHK</label>
                      <select
                        value={lead.sellerProperty?.bhk || ''}
                        onChange={(e) => setLead({
                          ...lead,
                          sellerProperty: { ...lead.sellerProperty, bhk: Number(e.target.value) }
                        })}
                        disabled={isConverted}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                      >
                        <option value="">Select BHK</option>
                        <option value="1">1 BHK</option>
                        <option value="2">2 BHK</option>
                        <option value="3">3 BHK</option>
                        <option value="4">4 BHK</option>
                        <option value="5">5+ BHK</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Building Name</label>
                      <input
                        type="text"
                        value={lead.sellerProperty?.buildingName || ''}
                        onChange={(e) => setLead({
                          ...lead,
                          sellerProperty: { ...lead.sellerProperty, buildingName: e.target.value }
                        })}
                        disabled={isConverted}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                        placeholder="e.g. Sea Breeze"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Flat No.</label>
                        <input
                          type="text"
                          value={lead.sellerProperty?.flatNumber || ''}
                          onChange={(e) => setLead({
                            ...lead,
                            sellerProperty: { ...lead.sellerProperty, flatNumber: e.target.value }
                          })}
                          disabled={isConverted}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                          placeholder="e.g. 401"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                        <input
                          type="text"
                          value={lead.sellerProperty?.floor || ''}
                          onChange={(e) => setLead({
                            ...lead,
                            sellerProperty: { ...lead.sellerProperty, floor: e.target.value }
                          })}
                          disabled={isConverted}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                          placeholder="e.g. 4th"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Furnishing</label>
                      <select
                        value={lead.sellerProperty?.furnishing || ''}
                        onChange={(e) => setLead({
                          ...lead,
                          sellerProperty: { ...lead.sellerProperty, furnishing: e.target.value }
                        })}
                        disabled={isConverted}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                      >
                        <option value="">Select furnishing</option>
                        <option value="furnished">Furnished</option>
                        <option value="semi-furnished">Semi-furnished</option>
                        <option value="unfurnished">Unfurnished</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Carpet Area (sq ft)</label>
                      <input
                        type="number"
                        value={lead.sellerProperty?.carpetArea || ''}
                        onChange={(e) => setLead({
                          ...lead,
                          sellerProperty: { ...lead.sellerProperty, carpetArea: Number(e.target.value) }
                        })}
                        disabled={isConverted}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                        placeholder="e.g. 1200"
                      />
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={lead.sellerProperty?.city || ''}
                        onChange={(e) => setLead({
                          ...lead,
                          sellerProperty: { ...lead.sellerProperty, city: e.target.value }
                        })}
                        disabled={isConverted}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                        placeholder="e.g. Mumbai"
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
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={lead.sellerProperty?.timelineValue || ''}
                          onChange={(e) => setLead({
                            ...lead,
                            sellerProperty: { 
                              ...lead.sellerProperty, 
                              timelineValue: Number(e.target.value),
                              timeline: e.target.value && lead.sellerProperty?.timelineUnit 
                                ? `${e.target.value} ${lead.sellerProperty.timelineUnit}` 
                                : ''
                            }
                          })}
                          disabled={isConverted}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                          placeholder="Enter number"
                        />
                        <select
                          value={lead.sellerProperty?.timelineUnit || 'months'}
                          onChange={(e) => setLead({
                            ...lead,
                            sellerProperty: { 
                              ...lead.sellerProperty, 
                              timelineUnit: e.target.value as 'days' | 'months',
                              timeline: lead.sellerProperty?.timelineValue 
                                ? `${lead.sellerProperty.timelineValue} ${e.target.value}` 
                                : ''
                            }
                          })}
                          disabled={isConverted}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                        >
                          <option value="days">Days</option>
                          <option value="months">Months</option>
                        </select>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Address</label>
                      <textarea
                        value={lead.sellerProperty?.address || ''}
                        onChange={(e) => setLead({
                          ...lead,
                          sellerProperty: { ...lead.sellerProperty, address: e.target.value }
                        })}
                        disabled={isConverted}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                        placeholder="Street address, landmark, pin code..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {lead.leadType === 'tenant' && (
                <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Key className="h-5 w-5 mr-2 text-teal-600" />
                      Rental Requirements
                    </h3>
                    <button
                      onClick={() => setShowScheduleMeeting(true)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                      disabled={!leadId}
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Schedule Meeting</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Requirement</label>
                      <div className="flex gap-2">
                        <textarea
                          value={lead.tenantRequirement?.requirement || ''}
                          onChange={(e) => setLead({
                            ...lead,
                            tenantRequirement: { ...lead.tenantRequirement, requirement: e.target.value }
                          })}
                          disabled={isConverted}
                          rows={2}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                          placeholder="What type of rental are they looking for?"
                        />
                        <SpeechToTextButton
                          disabled={isConverted}
                          onText={(text) => setLead((prev) => ({
                            ...prev,
                            tenantRequirement: {
                              ...prev.tenantRequirement,
                              requirement: `${(prev.tenantRequirement?.requirement || '').trim()}${(prev.tenantRequirement?.requirement || '').trim() ? ' ' : ''}${text}`
                            }
                          }))}
                        />
                      </div>
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
                <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 border">
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">BHK</label>
                      <select
                        value={lead.ownerProperty?.bhk || ''}
                        onChange={(e) => setLead({
                          ...lead,
                          ownerProperty: { ...lead.ownerProperty, bhk: Number(e.target.value) }
                        })}
                        disabled={isConverted}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                      >
                        <option value="">Select BHK</option>
                        <option value="1">1 BHK</option>
                        <option value="2">2 BHK</option>
                        <option value="3">3 BHK</option>
                        <option value="4">4 BHK</option>
                        <option value="5">5+ BHK</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Building Name</label>
                      <input
                        type="text"
                        value={lead.ownerProperty?.buildingName || ''}
                        onChange={(e) => setLead({
                          ...lead,
                          ownerProperty: { ...lead.ownerProperty, buildingName: e.target.value }
                        })}
                        disabled={isConverted}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                        placeholder="e.g. Sea Breeze"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Flat No.</label>
                        <input
                          type="text"
                          value={lead.ownerProperty?.flatNumber || ''}
                          onChange={(e) => setLead({
                            ...lead,
                            ownerProperty: { ...lead.ownerProperty, flatNumber: e.target.value }
                          })}
                          disabled={isConverted}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                          placeholder="e.g. 401"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                        <input
                          type="text"
                          value={lead.ownerProperty?.floor || ''}
                          onChange={(e) => setLead({
                            ...lead,
                            ownerProperty: { ...lead.ownerProperty, floor: e.target.value }
                          })}
                          disabled={isConverted}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                          placeholder="e.g. 4th"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Furnishing</label>
                      <select
                        value={lead.ownerProperty?.furnishing || ''}
                        onChange={(e) => setLead({
                          ...lead,
                          ownerProperty: { ...lead.ownerProperty, furnishing: e.target.value }
                        })}
                        disabled={isConverted}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                      >
                        <option value="">Select furnishing</option>
                        <option value="furnished">Furnished</option>
                        <option value="semi-furnished">Semi-furnished</option>
                        <option value="unfurnished">Unfurnished</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Carpet Area (sq ft)</label>
                      <input
                        type="number"
                        value={lead.ownerProperty?.carpetArea || ''}
                        onChange={(e) => setLead({
                          ...lead,
                          ownerProperty: { ...lead.ownerProperty, carpetArea: Number(e.target.value) }
                        })}
                        disabled={isConverted}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                        placeholder="e.g. 1200"
                      />
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={lead.ownerProperty?.city || ''}
                        onChange={(e) => setLead({
                          ...lead,
                          ownerProperty: { ...lead.ownerProperty, city: e.target.value }
                        })}
                        disabled={isConverted}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                        placeholder="e.g. Mumbai"
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Security Deposit</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="number"
                          value={lead.ownerProperty?.securityDeposit || ''}
                          onChange={(e) => setLead({
                            ...lead,
                            ownerProperty: { ...lead.ownerProperty, securityDeposit: Number(e.target.value) }
                          })}
                          disabled={isConverted}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                          placeholder="Security deposit"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Address</label>
                      <textarea
                        value={lead.ownerProperty?.address || ''}
                        onChange={(e) => setLead({
                          ...lead,
                          ownerProperty: { ...lead.ownerProperty, address: e.target.value }
                        })}
                        disabled={isConverted}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                        placeholder="Street address, landmark, pin code..."
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 border">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                    Meetings
                  </h3>
                  <button
                    onClick={() => setShowScheduleMeeting(true)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    disabled={loadingMeetings || !leadId}
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
                              {m.status === 'scheduled' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setRescheduleMeeting(m)}
                                    className="px-3 py-1.5 text-xs bg-white border rounded hover:bg-gray-100"
                                    disabled={updatingMeeting}
                                  >
                                    Reschedule
                                  </button>
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

              {/* Notes Section */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6 border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-amber-600" />
                  Personal Notes About Client
                </h3>

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
                      onText={(text) => setLead((prev) => ({
                        ...prev,
                        notes: `${(prev.notes || '').trim()}${(prev.notes || '').trim() ? ' ' : ''}${text}`,
                      }))}
                    />
                  </div>
                </div>

                {!isConverted && (
                  <div className="mb-4 pt-4 border-t">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discussion and Notes</label>
                    <div className="flex gap-2">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a note about an interaction..."
                        rows={2}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      />
                      <SpeechToTextButton
                        onText={(text) => setNewNote((prev) => `${prev.trim()}${prev.trim() ? ' ' : ''}${text}`)}
                      />
                      <button
                        onClick={handleAddNote}
                        disabled={!newNote.trim()}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
                       aria-label="Add">
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                )}

                {notes.length > 0 && (
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700">Discussion History</h4>
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
            </>
          )}
        </div>
      </div>

      {leadId && showScheduleMeeting && (
        <ScheduleMeetingModal
          isOpen={showScheduleMeeting}
          onClose={() => setShowScheduleMeeting(false)}
          onSuccess={async () => {
            await loadMeetings();
            onUpdate();
          }}
          entityType="lead"
          entityId={leadId}
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
          onUpdate();
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
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
