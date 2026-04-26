import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

  // Conversion modal state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [matchingContacts, setMatchingContacts] = useState<CRMContact[]>([]);
  const [converting, setConverting] = useState(false);

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
        setMatchingContacts([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showConvertModal, showOutcomeModal]);

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
      onUpdate();
    } catch (e) {
      console.error('Failed to save meeting outcome', e);
      alert('Failed to save meeting summary');
    } finally {
      setUpdatingMeeting(false);
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

      await api.updateLead(leadId!, payload);
      onUpdate();
    } catch (error) {
      console.error('Error saving lead:', error);
      alert('Failed to save lead');
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
    setShowConvertModal(true);
    try {
      const contacts = await api.getMatchingContactsForLead(leadId);
      setMatchingContacts(contacts);
    } catch (error) {
      console.error('Error fetching matching contacts:', error);
      setMatchingContacts([]);
    }
  };

  const handleConvert = async (existingContactId?: string) => {
    if (!leadId) return;

    if (lead.leadType === 'buyer' || lead.leadType === 'tenant') {
      setShowConvertModal(false);
      setMatchingContacts([]);
      onClose();
      navigate(`/crm/leads/${leadId}?convert=1`);
      return;
    }

    try {
      setConverting(true);
      const options = existingContactId ? { existingContactId } : {};
      await api.convertLead(leadId, options);
      setShowConvertModal(false);
      setMatchingContacts([]);
      alert('Lead converted successfully');
      loadLead();
      onUpdate();
    } catch (error) {
      console.error('Error converting lead:', error);
      alert('Failed to convert lead');
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
                    <p className="text-xs sm:text-sm text-gray-500 capitalize">{lead.leadType} Lead</p>
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
                        Converted to {lead.convertedTo?.role} on {new Date(lead.convertedAt!).toLocaleDateString()}
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
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 active:scale-95"
                  >
                    <UserPlus className="h-5 w-5" />
                    <span>Convert Lead</span>
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
                          buyerRequirement: { ...lead.buyerRequirement, propertyType: e.target.value, propertySubType: '' }
                        })}
                        disabled={isConverted}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                      >
                        <option value="">Select type</option>
                        <option value="residential">Residential</option>
                        <option value="commercial">Commercial</option>
                        <option value="land">Land/Plot</option>
                      </select>
                    </div>
                    {lead.buyerRequirement?.propertyType && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {lead.buyerRequirement.propertyType === 'residential' && 'Residential Type'}
                          {lead.buyerRequirement.propertyType === 'commercial' && 'Commercial Type'}
                          {lead.buyerRequirement.propertyType === 'land' && 'Land Type'}
                        </label>
                        <select
                          value={lead.buyerRequirement?.propertySubType || ''}
                          onChange={(e) => setLead({
                            ...lead,
                            buyerRequirement: { ...lead.buyerRequirement, propertySubType: e.target.value }
                          })}
                          disabled={isConverted}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                        >
                          <option value="">Select subtype</option>
                          {lead.buyerRequirement.propertyType === 'residential' && (
                            <>
                              <option value="apartment">Apartment</option>
                              <option value="house">Independent House</option>
                              <option value="villa">Villa</option>
                              <option value="penthouse">Penthouse</option>
                              <option value="studio">Studio Apartment</option>
                            </>
                          )}
                          {lead.buyerRequirement.propertyType === 'commercial' && (
                            <>
                              <option value="office">Office Space</option>
                              <option value="shop">Shop/Showroom</option>
                              <option value="warehouse">Warehouse</option>
                              <option value="coworking">Co-working Space</option>
                              <option value="restaurant">Restaurant Space</option>
                            </>
                          )}
                          {lead.buyerRequirement.propertyType === 'land' && (
                            <>
                              <option value="residential-plot">Residential Plot</option>
                              <option value="commercial-plot">Commercial Plot</option>
                              <option value="agricultural">Agricultural Land</option>
                              <option value="industrial">Industrial Plot</option>
                            </>
                          )}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {lead.buyerRequirement?.propertyType === 'residential' ? 'BHK' : 
                         lead.buyerRequirement?.propertyType === 'commercial' ? 'Size Category' :
                         lead.buyerRequirement?.propertyType === 'land' ? 'Plot Size Category' : 'BHK'}
                      </label>
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
                        {(!lead.buyerRequirement?.propertyType || lead.buyerRequirement?.propertyType === 'residential') && (
                          <>
                            <option value="1">1 BHK</option>
                            <option value="2">2 BHK</option>
                            <option value="3">3 BHK</option>
                            <option value="4">4 BHK</option>
                            <option value="5">5+ BHK</option>
                          </>
                        )}
                        {lead.buyerRequirement?.propertyType === 'commercial' && (
                          <>
                            <option value="1">Small (&lt; 500 sqft)</option>
                            <option value="2">Medium (500-1500 sqft)</option>
                            <option value="3">Large (1500-3000 sqft)</option>
                            <option value="4">Very Large (&gt; 3000 sqft)</option>
                          </>
                        )}
                        {lead.buyerRequirement?.propertyType === 'land' && (
                          <>
                            <option value="1">Small (&lt; 1000 sqft)</option>
                            <option value="2">Medium (1000-2500 sqft)</option>
                            <option value="3">Large (2500-5000 sqft)</option>
                            <option value="4">Very Large (&gt; 5000 sqft)</option>
                          </>
                        )}
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

      {/* Conversion Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="w-full max-w-md max-h-[80vh] overflow-hidden rounded-2xl border border-white/30 bg-white/70 shadow-2xl backdrop-blur-xl">
            <div className="p-5 overflow-y-auto max-h-[80vh]">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Convert Lead</h3>
              <p className="text-sm text-gray-500 mb-4">
                Converting <strong>{lead.name}</strong> to a{' '}
                <strong>{lead.leadType}</strong> contact.
              </p>

              {matchingContacts.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Found {matchingContacts.length} matching contact(s):
                  </p>
                  <div className="space-y-2">
                    {matchingContacts.map((contact) => (
                      <button
                        key={contact.contactId}
                        onClick={() => handleConvert(contact.contactId)}
                        disabled={converting}
                        className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        <div className="font-medium">{contact.name}</div>
                        <div className="text-sm text-gray-500">{contact.phone}</div>
                        <div className="text-xs text-indigo-600 mt-1">
                          Click to link to this contact
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="my-4 border-t border-gray-200"></div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => handleConvert()}
                  disabled={converting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {converting ? 'Converting...' : 'Create New Contact'}
                </button>
                <button
                  onClick={() => {
                    setShowConvertModal(false);
                    setMatchingContacts([]);
                  }}
                  disabled={converting}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </>
  );
}
