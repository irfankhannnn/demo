import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
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
  Calendar,
  Building2,
  X,
  Pencil,
  Trash2,
  Search,
  MessageSquare,
} from 'lucide-react';
import { api } from '../../services/api';
import Toast from '../../components/Toast';
import SpeechToTextButton from '../../components/SpeechToTextButton';
import ScheduleMeetingModal from '../../components/ScheduleMeetingModal';
import MeetingRescheduleModal from '../../components/MeetingRescheduleModal';
import ContactActivityTimeline from '../../components/ContactActivityTimeline';
import LeadActivityHistory from '../../components/LeadActivityHistory';
import { CRMLead, CRMLeadNote, LeadType, LeadStatus, LeadPriority, CRMMeeting } from '../../types/crm';
import { LEAD_SOURCE_OPTIONS, isKnownLeadSource } from '../../utils/leadConstants';
import { buildLeadSavePayload } from '../../utils/leadSavePayload';
import { canManageLeads } from '../../utils/rbac';
import { isLeadConverted, getConvertedEntityPath } from '../../utils/leadConversion';
import LeadPropertyFields from '../../components/LeadPropertyFields';
import BuyerRequirementFields from '../../components/BuyerRequirementFields';

export default function LeadDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  // Get initial data from navigation state (e.g., when converting from enquiry)
  const initialData = location.state?.initialData;

  const [lead, setLead] = useState<Partial<CRMLead>>({
    leadType: initialData?.leadType || 'buyer',
    name: initialData?.name || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    source: initialData?.source || '',
    status: 'new',
    priority: 'medium',
    notes: initialData?.notes || '',
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
  const [customSource, setCustomSource] = useState('');

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<any | null>(null);
  const [ownerProperties, setOwnerProperties] = useState<any[]>([]);
  const [ownerPropertiesLoading, setOwnerPropertiesLoading] = useState(false);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerSearchResults, setOwnerSearchResults] = useState<any[]>([]);
  const [ownerSearchLoading, setOwnerSearchLoading] = useState(false);
  const [ownerLookupPhone, setOwnerLookupPhone] = useState('');
  const [ownerLookupError, setOwnerLookupError] = useState<string | null>(null);
  const [buyerDirectSearchQuery, setBuyerDirectSearchQuery] = useState('');
  const [tenantDirectSearchQuery, setTenantDirectSearchQuery] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
  };
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
    brokeragePaid: '',
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
    }
  }, [id, isNew]);

  const loadMeetings = async (archivedMeetings?: CRMMeeting[]) => {
    if (!id || isNew) return;
    if (archivedMeetings) {
      setMeetings(archivedMeetings);
      return;
    }
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
    } catch (e) {
      console.error('Failed to save meeting outcome', e);
      showToast('Failed to save meeting summary', 'error');
    } finally {
      setUpdatingMeeting(false);
    }
  };

  useEffect(() => {
    if (isNew || !id || loading || !lead.name) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('convert') === '1') {
      if (!lead.phone) {
        showToast('Please add a phone number to the lead before converting.', 'error');
        // Clean up URL to avoid repeating toast on reload
        navigate(`/crm/leads/${id}`, { replace: true });
      } else {
        setShowConvertModal(true);
      }
    }
  }, [id, isNew, loading, lead, navigate]);

  useEffect(() => {
    if (!showConvertModal) return;

    // Load correct properties for this lead type when modal opens
    loadProperties(lead.leadType);

    if (lead.leadType !== 'tenant') return;

    // Reset owner + property selection when opening the tenant conversion modal
    setTenantDirectSearchQuery('');
    setOwnerLookupPhone(lead.phone || '');
    setOwnerLookupError(null);
    setSelectedOwner(null);
    setOwnerProperties([]);
    setSelectedPropertyId('');
    setLeaseDetails({
      leaseStartDate: '',
      leaseEndDate: '',
      monthlyRent: '',
      securityDeposit: '',
      brokeragePaid: '',
    });
  }, [showConvertModal, lead.leadType]);

  useEffect(() => {
    if (!showConvertModal) return;
    if (lead.leadType !== 'buyer') return;
    setBuyerDirectSearchQuery('');
    setSelectedOwner(null);
    setOwnerProperties([]);
    setSelectedPropertyId('');
    setPurchaseDetails({
      saleAmount: '',
      purchaseDate: '',
      registrationDate: '',
      registrationNumber: '',
      stampDutyPaid: '',
      brokeragePaid: '',
    });
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

  const loadProperties = async (type?: string) => {
    try {
      const isTenant = type === 'tenant';
      const [setA, setB] = await Promise.all([
        api.getCRMProperties('available'),
        api.getCRMProperties(isTenant ? 'for-rent' : 'for-sale'),
      ]);

      const mergedMap = new Map<string, any>();
      (setA || []).forEach((p: any) => {
        if (p.propertyId) mergedMap.set(p.propertyId, p);
      });
      (setB || []).forEach((p: any) => {
        if (p.propertyId) mergedMap.set(p.propertyId, p);
      });

      setProperties(Array.from(mergedMap.values()));
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  const handleOwnerSearch = async (query: string) => {
    setOwnerSearchQuery(query);
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setOwnerSearchResults([]);
      return;
    }

    try {
      setOwnerSearchLoading(true);
      const results = await api.searchOwners(cleanQuery);
      setOwnerSearchResults(Array.isArray(results) ? results : []);
    } catch (e) {
      console.error('Owner search failed:', e);
    } finally {
      setOwnerSearchLoading(false);
    }
  };

  const handleSelectOwner = async (owner: any) => {
    setSelectedOwner(owner);
    setOwnerSearchResults([]);
    setOwnerSearchQuery('');
    setOwnerPropertiesLoading(true);
    try {
      const props = await api.getOwnerProperties(owner.ownerId);
      setOwnerProperties(Array.isArray(props) ? props : []);
      setSelectedPropertyId('');
    } catch (e) {
      console.error('Failed to load owner properties:', e);
      showToast('Failed to load properties for this owner', 'error');
    } finally {
      setOwnerPropertiesLoading(false);
    }
  };

  const handleSelectPropertyDirectly = async (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    if (!propertyId) {
      return;
    }

    const prop = properties.find(p => p.propertyId === propertyId);
    if (prop) {
      if (prop.ownerId) {
        const ownerObj = {
          ownerId: prop.ownerId,
          name: prop.ownerName || 'Owner',
          phone: prop.ownerPhone || '',
        };
        setSelectedOwner(ownerObj);
        
        setOwnerPropertiesLoading(true);
        try {
          const props = await api.getOwnerProperties(prop.ownerId);
          setOwnerProperties(Array.isArray(props) ? props : []);
        } catch (e) {
          console.error('Failed to load properties for resolved owner:', e);
        } finally {
          setOwnerPropertiesLoading(false);
        }
      } else {
        setSelectedOwner(null);
        setOwnerProperties([]);
      }
    }
  };

  const clearOwnerSelection = () => {
    setSelectedOwner(null);
    setOwnerProperties([]);
    setSelectedPropertyId('');
    setOwnerLookupError(null);
    setOwnerSearchQuery('');
    setOwnerSearchResults([]);
  };

  const loadLead = async () => {
    try {
      setLoading(true);
      let leadData: Partial<CRMLead> | null = null;
      let notesData: CRMLeadNote[] = [];

      try {
        [leadData, notesData] = await Promise.all([
          api.getLead(id!),
          api.getLeadNotes(id!),
        ]);
      } catch (error) {
        console.warn('Lead not found, trying conversion snapshot:', error);
        const snapshot = await api.getLeadConversionSnapshot(id!);
        leadData = snapshot?.archivedLead || snapshot?.sourceLeadSnapshot?.lead || null;
        if (leadData && snapshot && !leadData.archivedFromSnapshot) {
          const source = snapshot.sourceLeadSnapshot?.lead || {};
          leadData = {
            ...source,
            leadId: snapshot.leadId || source.leadId || id,
            leadType: snapshot.leadType || source.leadType,
            status: 'converted',
            convertedAt: snapshot.convertedAt,
            convertedTo: {
              entityType: snapshot.entityType,
              entityId: snapshot.entityId,
              role: snapshot.role,
            },
            archivedFromSnapshot: true,
            snapshotNotes: snapshot.sourceLeadSnapshot?.notes || [],
            snapshotMeetings: snapshot.sourceLeadSnapshot?.meetings || [],
          };
        }
        notesData = leadData?.snapshotNotes || snapshot?.sourceLeadSnapshot?.notes || [];
        if (!leadData?.name) {
          throw new Error('Lead not found');
        }
      }

      setLead(leadData);
      setNotes(notesData);
      await loadMeetings(
        leadData?.archivedFromSnapshot
          ? (leadData.snapshotMeetings as CRMMeeting[] | undefined)
          : undefined
      );
      if (leadData?.source && !isKnownLeadSource(leadData.source)) {
        setCustomSource(leadData.source);
      } else {
        setCustomSource('');
      }
    } catch (error) {
      console.error('Error loading lead:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      } else {
        showToast('Original lead not found or was not archived', 'error');
        navigate('/crm/leads?view=converted');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!lead.name || !lead.leadType) {
      showToast('Name and lead type are required', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = buildLeadSavePayload(lead);

      if (isNew) {
        const created = await api.createLead(payload);
        if (draftActivityNote.trim()) {
          try {
            await api.createLeadNote(created.leadId, { content: draftActivityNote });
          } catch (e) {
            console.error('Error adding initial lead note:', e);
          }
        }
        navigate('/crm/leads', {
          state: { toast: { message: 'Lead created successfully', type: 'success' } },
        });
      } else {
        await api.updateLead(id!, payload);
        navigate('/crm/leads', {
          state: { toast: { message: 'Lead updated successfully', type: 'success' } },
        });
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      showToast('Failed to save lead', 'error');
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

  const handleConvertClick = () => {
    if (!lead.phone?.trim()) {
      showToast('Please add a phone number to the lead before converting.', 'error');
      return;
    }
    if (lead.leadType === 'buyer' || lead.leadType === 'tenant') {
      setShowConvertModal(true);
      return;
    }
    handleConvert();
  };

  const handleConvert = async () => {
    if (!id) return;
    if (converting) return;

    const navigateFromConversion = (
      entityType?: string,
      entity?: { buyerId?: string; customerId?: string; ownerId?: string },
      contactId?: string | null,
    ) => {
      if (contactId) {
        navigate(`/crm/contacts/${contactId}`);
        return;
      }
      if (entityType === 'buyer' && entity?.buyerId) {
        navigate(`/crm/buyers/${entity.buyerId}`);
      } else if (entityType === 'tenant' && entity?.customerId) {
        navigate(`/crm/tenants/${entity.customerId}`);
      } else if ((entityType === 'owner' || entityType === 'seller') && entity?.ownerId) {
        navigate(`/crm/owners/${entity.ownerId}`);
      } else {
        navigate('/crm/leads');
      }
    };

    const navigateFromConvertedTo = (convertedTo?: { entityType?: string; entityId?: string } | null) => {
      if (!convertedTo?.entityId) {
        navigate('/crm/leads');
        return;
      }
      if (convertedTo.entityType === 'buyer') navigate(`/crm/buyers/${convertedTo.entityId}`);
      else if (convertedTo.entityType === 'tenant') navigate(`/crm/tenants/${convertedTo.entityId}`);
      else if (convertedTo.entityType === 'owner' || convertedTo.entityType === 'seller') {
        navigate(`/crm/owners/${convertedTo.entityId}`);
      } else navigate('/crm/leads');
    };

    try {
      setConverting(true);
      const payload: Record<string, unknown> = {};

      // Buyer conversion — purchase details are optional
      if (lead.leadType === 'buyer') {
        if (selectedPropertyId && !purchaseDetails.saleAmount) {
          showToast('Sale amount is required when linking a property', 'error');
          return;
        }
        if (selectedPropertyId && purchaseDetails.saleAmount) {
          payload.purchaseDetails = {
            propertyId: selectedPropertyId,
            saleAmount: Number(purchaseDetails.saleAmount),
            purchaseDate: purchaseDetails.purchaseDate || new Date().toISOString().split('T')[0],
            registrationDate: purchaseDetails.registrationDate || undefined,
            registrationNumber: purchaseDetails.registrationNumber || undefined,
            stampDutyPaid: purchaseDetails.stampDutyPaid ? Number(purchaseDetails.stampDutyPaid) : undefined,
            brokeragePaid: purchaseDetails.brokeragePaid ? Number(purchaseDetails.brokeragePaid) : undefined,
          };
        }
        if (kycDetails.panNumber || kycDetails.aadharNumber) {
          payload.kycDetails = {
            panNumber: kycDetails.panNumber || undefined,
            aadharNumber: kycDetails.aadharNumber || undefined,
          };
        }
      }
      // Tenant conversion — lease details optional; required only when linking a property
      else if (lead.leadType === 'tenant') {
        if (selectedPropertyId) {
          if (!leaseDetails.monthlyRent || !leaseDetails.leaseStartDate) {
            showToast('Rent and lease start date are required when linking a property', 'error');
            return;
          }
          if (selectedOwner && !ownerProperties.some((p) => p.propertyId === selectedPropertyId)) {
            showToast('Please select a property that belongs to the selected owner', 'error');
            return;
          }
          payload.leaseDetails = {
            propertyId: selectedPropertyId,
            leaseStartDate: leaseDetails.leaseStartDate,
            leaseEndDate: leaseDetails.leaseEndDate || undefined,
            monthlyRent: Number(leaseDetails.monthlyRent),
            securityDeposit: leaseDetails.securityDeposit ? Number(leaseDetails.securityDeposit) : undefined,
            brokeragePaid: leaseDetails.brokeragePaid ? Number(leaseDetails.brokeragePaid) : undefined,
          };
        }
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

      // Notify user about Khata Book brokerage entry
      if (lead.leadType === 'buyer' && purchaseDetails.brokeragePaid) {
        showToast(`Lead converted! Brokerage of ₹${Number(purchaseDetails.brokeragePaid).toLocaleString()} will be added to Khata Book.`, 'success');
      } else if (lead.leadType === 'tenant' && leaseDetails.brokeragePaid) {
        showToast(`Lead converted! Brokerage of ₹${Number(leaseDetails.brokeragePaid).toLocaleString()} will be added to Khata Book.`, 'success');
      } else {
        showToast('Lead converted successfully.', 'success');
      }

      navigateFromConversion(entityType, entity, result?.contactId || null);
      setShowConvertModal(false);
    } catch (error: unknown) {
      console.error('Error converting lead:', error);
      const err = error as Error & { code?: string; convertedTo?: { entityType?: string; entityId?: string } };
      if (err.code === 'ALREADY_CONVERTED' || err.message?.toLowerCase().includes('already converted')) {
        showToast('This lead is already converted.', 'info');
        setShowConvertModal(false);
        navigateFromConvertedTo(err.convertedTo);
        return;
      }
      showToast(err.message || 'Failed to convert lead', 'error');
    } finally {
      setConverting(false);
    }
  };

  // Check if lead is converted
  const isConverted = isLeadConverted(lead);
  const convertedEntityPath = getConvertedEntityPath(lead.convertedTo);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {/* Header */}
      <header className="glass-premium border-b border-white/30 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/leads')}
                className="p-1.5 sm:p-2 hover:bg-white/60 rounded-xl transition-all duration-200 flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-slate-500" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0 animate-gentlePulse">
                  <Target className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight truncate">
                    {isNew ? 'New Lead' : lead.name || 'Lead Details'}
                  </h1>
                  {!isNew && lead.leadType && (
                    <p className="text-xs sm:text-sm text-slate-400 font-semibold capitalize">{lead.leadType} Lead</p>
                  )}
                </div>
              </div>
            </div>
            {!isConverted && (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all duration-300 shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 disabled:opacity-50 btn-press font-semibold"
                >
                  <Save className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm">{saving ? 'Saving...' : 'Save'}</span>
                </button>
                {!isNew && (
                  <button
                    onClick={handleConvertClick}
                    className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 btn-press font-semibold"
                  >
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-sm">
                      {lead.leadType === 'seller' || lead.leadType === 'owner'
                        ? 'Create Listing'
                        : 'Convert'}
                    </span>
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
                <p className="font-medium text-green-800">
                  {lead.archivedFromSnapshot ? 'Original Lead (Read-Only Archive)' : 'Lead Converted'}
                </p>
                <p className="text-sm text-green-600">
                  {lead.archivedFromSnapshot
                    ? 'This is the preserved lead record from before conversion. Fields cannot be edited.'
                    : 'Converted to '}
                  {!lead.archivedFromSnapshot && convertedEntityPath ? (
                    <Link to={convertedEntityPath} className="underline font-medium hover:text-green-800">
                      {lead.convertedTo?.role || lead.convertedTo?.entityType}
                    </Link>
                  ) : !lead.archivedFromSnapshot ? (
                    lead.convertedTo?.role
                  ) : null}
                  {lead.convertedAt && (
                    <>
                      {!lead.archivedFromSnapshot ? ' on ' : ' · Converted on '}
                      {new Date(lead.convertedAt || lead.updatedAt || '').toLocaleDateString()}
                    </>
                  )}
                  {lead.archivedFromSnapshot && convertedEntityPath && (
                    <>
                      {' · '}
                      <Link to={convertedEntityPath} className="underline font-medium hover:text-green-800">
                        View converted {lead.convertedTo?.role || 'profile'}
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Enquiry Conversion Banner */}
        {isNew && initialData?.enquiryId && (
          <div className="mb-4 p-4 bg-white/60 backdrop-blur-xl border border-orange-200/50 rounded-xl shadow-lg">
            <div className="flex items-center">
              <MessageSquare className="h-5 w-5 text-orange-600 mr-2" />
              <div>
                <p className="font-medium text-orange-800">Converting from Enquiry</p>
                <p className="text-sm text-orange-600">
                  Pre-filled data from enquiry. Review and save to create the lead.
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
                disabled={loadingMeetings || isConverted}
              >
                Schedule
              </button>
            </div>

            {loadingMeetings ? (
              <div className="text-sm text-gray-500">Loading meetings...</div>
            ) : meetings.length === 0 ? (
              <div className="text-sm text-gray-500">
                {isConverted ? 'No meetings were recorded on this lead before conversion.' : 'No meetings scheduled for this lead.'}
              </div>
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
        )}

        {/* Lead Type Selection */}
        {!isConverted && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Type</h3>
            <div className="max-w-xs">
              <select
                value={lead.leadType || 'buyer'}
                onChange={(e) => {
                  const newType = e.target.value as LeadType;
                  if (!isNew) {
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
              <select
                value={lead.source && isKnownLeadSource(lead.source) ? lead.source : lead.source ? 'Other' : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'Other') {
                    setLead({ ...lead, source: customSource || '' });
                  } else {
                    setCustomSource('');
                    setLead({ ...lead, source: val });
                  }
                }}
                disabled={isConverted}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
              >
                <option value="">Select source</option>
                {LEAD_SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {(lead.source && !isKnownLeadSource(lead.source)) || (!lead.source && customSource) ? (
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
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ShoppingCart className="h-5 w-5 mr-2 text-orange-600" />
              Buyer Requirements
            </h3>
            <BuyerRequirementFields
              value={lead.buyerRequirement}
              onChange={(buyerRequirement) => setLead({ ...lead, buyerRequirement })}
                  disabled={isConverted}
            />
          </div>
        )}

        {lead.leadType === 'seller' && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Tag className="h-5 w-5 mr-2 text-purple-600" />
              Property for Sale
            </h3>
            <LeadPropertyFields
              variant="seller"
              value={lead.sellerProperty}
              onChange={(sellerProperty) => setLead({ ...lead, sellerProperty })}
                  disabled={isConverted}
              sellerTimelineMode={isNew ? 'text' : 'structured'}
            />
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
            <LeadPropertyFields
              variant="owner"
              value={lead.ownerProperty}
              onChange={(ownerProperty) => setLead({ ...lead, ownerProperty })}
                  disabled={isConverted}
            />
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
                   aria-label="Add">
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
                          {canManageLeads() && (
                          <button
                            onClick={() => handleNoteDelete(note.noteId)}
                            disabled={deletingNoteId === note.noteId}
                            className="p-1 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Unified Activity Timeline */}
          {!isNew && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="h-5 w-5 mr-2 text-purple-600" />
                Unified Activity Timeline
              </h3>
              <ContactActivityTimeline entityType="lead" entityId={id} />
            </div>
          )}

          <LeadActivityHistory history={lead.history} />
        </div>
      </main>

      {/* Convert Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/50 z-50 p-4 flex items-center justify-center">
          <div className="w-full max-w-md max-h-[90vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="shrink-0 border-b px-5 py-4 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Convert {lead.leadType} Lead
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{lead.name} · {lead.phone}</p>
              </div>
              <button
                onClick={() => setShowConvertModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Buyer Conversion Form */}
              {lead.leadType === 'buyer' && (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    You can convert this lead to a Buyer record now. Linking a purchased property is optional — add it later from the Buyer page if needed.
                  </div>
                  {/* Direct Property Search */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-green-600" />
                      <h4 className="text-sm font-semibold text-gray-800">Find Property (optional)</h4>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        <Search className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={buyerDirectSearchQuery}
                        onChange={(e) => {
                          setBuyerDirectSearchQuery(e.target.value);
                          if (e.target.value === '') setSelectedPropertyId('');
                        }}
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 text-sm transition-all"
                        placeholder="Search by property name, area, or city..."
                      />
                    </div>
                    {(() => {
                      const query = buyerDirectSearchQuery.trim().toLowerCase();
                      const filtered = query
                        ? properties.filter((p) =>
                            [p.title, p.area, p.city, p.ownerName]
                              .filter(Boolean)
                              .some((field) => field.toLowerCase().includes(query))
                          )
                        : properties;
                      if (query && filtered.length === 0) {
                        return (
                          <div className="text-center py-6 bg-gray-50 rounded-xl">
                            <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No properties match your search</p>
                            <p className="text-xs text-gray-400 mt-1">Try a different area, city, or owner name</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {filtered.slice(0, 10).map((prop) => (
                            <button
                              key={prop.propertyId}
                              type="button"
                              onClick={() => handleSelectPropertyDirectly(prop.propertyId)}
                              className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-150 flex items-start gap-3 group ${
                                selectedPropertyId === prop.propertyId
                                  ? 'border-green-500 bg-green-50 shadow-sm'
                                  : 'border-transparent bg-gray-50 hover:bg-gray-100 hover:border-gray-200'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                selectedPropertyId === prop.propertyId
                                  ? 'bg-green-600 text-white'
                                  : 'bg-white text-gray-500 group-hover:text-gray-700'
                              }`}>
                                {selectedPropertyId === prop.propertyId ? (
                                  <CheckCircle className="h-4 w-4" />
                                ) : (
                                  <Home className="h-4 w-4" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-gray-900 text-sm truncate">{prop.title}</p>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${
                                    prop.status === 'for-sale'
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}>
                                    {prop.status === 'for-sale' ? 'For Sale' : 'Available'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{prop.area}, {prop.city}</p>
                                {prop.ownerName && (
                                  <p className="text-xs text-gray-400 mt-0.5">Owner: {prop.ownerName}</p>
                                )}
                              </div>
                            </button>
                          ))}
                          {filtered.length > 10 && (
                            <p className="text-xs text-gray-400 text-center py-2">
                              +{filtered.length - 10} more results — refine your search
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {!selectedPropertyId && (
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-gray-100"></div>
                      <span className="flex-shrink mx-3 text-[10px] text-gray-400 font-medium">or search by owner</span>
                      <div className="flex-grow border-t border-gray-100"></div>
                    </div>
                  )}

                  {!selectedPropertyId && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-green-600" />
                        <h4 className="text-sm font-semibold text-gray-800">Search Owner First</h4>
                      </div>

                      {!selectedOwner ? (
                        <div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                              <Search className="h-4 w-4" />
                            </span>
                            <input
                              type="text"
                              value={ownerSearchQuery}
                              onChange={(e) => handleOwnerSearch(e.target.value)}
                              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 text-sm transition-all"
                              placeholder="Type owner's name or phone..."
                            />
                          </div>
                          {ownerSearchLoading && (
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                              <span className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                              Searching...
                            </p>
                          )}
                          {ownerSearchResults.length > 0 && (
                            <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto">
                              {ownerSearchResults.map((owner) => (
                                <button
                                  key={owner.ownerId}
                                  type="button"
                                  onClick={() => handleSelectOwner(owner)}
                                  className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all flex items-center gap-3 group"
                                >
                                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-green-700 font-semibold text-xs">
                                    {owner.name?.charAt(0)?.toUpperCase() || 'O'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 text-sm">{owner.name}</p>
                                    <p className="text-xs text-gray-500">{owner.phone}</p>
                                  </div>
                                  <span className="text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-green-100 transition-colors">
                                    Select
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="p-3.5 bg-green-50 rounded-xl border border-green-100">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                                {selectedOwner.name?.charAt(0)?.toUpperCase() || 'O'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm">{selectedOwner.name}</p>
                                <p className="text-xs text-gray-500">{selectedOwner.phone}</p>
                                <p className="text-xs text-green-700 mt-0.5">
                                  {ownerPropertiesLoading
                                    ? 'Loading...'
                                    : `${ownerProperties.filter((p) => p.status === 'available' || p.status === 'for-sale').length} properties for sale`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={clearOwnerSelection}
                                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-white/60 transition-colors"
                              >
                                Change
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Select a Property</p>
                            {ownerPropertiesLoading ? (
                              <div className="flex items-center gap-2 py-3 text-gray-500">
                                <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm">Loading properties...</span>
                              </div>
                            ) : ownerProperties.filter((p) => p.status === 'available' || p.status === 'for-sale').length === 0 ? (
                              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <p className="text-sm text-amber-800 font-medium">No sale properties found</p>
                                <p className="text-xs text-amber-600 mt-1">This owner has no properties listed for sale or available.</p>
                              </div>
                            ) : (
                              ownerProperties
                                .filter((p) => p.status === 'available' || p.status === 'for-sale')
                                .map((prop) => (
                                  <button
                                    key={prop.propertyId}
                                    type="button"
                                    onClick={() => setSelectedPropertyId(prop.propertyId)}
                                    className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-150 flex items-start gap-3 ${
                                      selectedPropertyId === prop.propertyId
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-transparent bg-gray-50 hover:bg-gray-100 hover:border-gray-200'
                                    }`}
                                  >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                      selectedPropertyId === prop.propertyId
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white text-gray-500'
                                    }`}>
                                      {selectedPropertyId === prop.propertyId ? (
                                        <CheckCircle className="h-4 w-4" />
                                      ) : (
                                        <Home className="h-4 w-4" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900 text-sm">{prop.title}</p>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${
                                          prop.status === 'for-sale'
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'bg-amber-50 text-amber-700'
                                        }`}>
                                          {prop.status === 'for-sale' ? 'For Sale' : 'Available'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-0.5">{prop.area}, {prop.city}</p>
                                    </div>
                                  </button>
                                ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected Property Summary */}
                  {selectedPropertyId && (
                    <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-2.5">
                      <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-green-800 truncate">
                          {properties.find((p) => p.propertyId === selectedPropertyId)?.title}
                        </p>
                        <p className="text-xs text-green-600">
                          {properties.find((p) => p.propertyId === selectedPropertyId)?.area}, {properties.find((p) => p.propertyId === selectedPropertyId)?.city}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedPropertyId(''); setBuyerDirectSearchQuery(''); clearOwnerSelection(); }}
                        className="text-xs font-medium text-green-700 hover:text-green-900 px-2 py-1 rounded-lg hover:bg-green-100 transition-colors shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {/* Purchase Details */}
                  <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <IndianRupee className="h-4 w-4 text-gray-700" />
                      <h4 className="text-sm font-semibold text-gray-800">Purchase Details</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Sale Amount <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">₹</span>
                          <input
                            type="number"
                            value={purchaseDetails.saleAmount}
                            onChange={(e) => setPurchaseDetails({...purchaseDetails, saleAmount: e.target.value})}
                            className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Purchase Date</label>
                        <input
                          type="date"
                          value={purchaseDetails.purchaseDate}
                          onChange={(e) => setPurchaseDetails({...purchaseDetails, purchaseDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Registration Date</label>
                        <input
                          type="date"
                          value={purchaseDetails.registrationDate}
                          onChange={(e) => setPurchaseDetails({...purchaseDetails, registrationDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Registration No.</label>
                        <input
                          type="text"
                          value={purchaseDetails.registrationNumber}
                          onChange={(e) => setPurchaseDetails({...purchaseDetails, registrationNumber: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                          placeholder="REG-2024-001"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Stamp Duty</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">₹</span>
                          <input
                            type="number"
                            value={purchaseDetails.stampDutyPaid}
                            onChange={(e) => setPurchaseDetails({...purchaseDetails, stampDutyPaid: e.target.value})}
                            className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Brokerage</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">₹</span>
                          <input
                            type="number"
                            value={purchaseDetails.brokeragePaid}
                            onChange={(e) => setPurchaseDetails({...purchaseDetails, brokeragePaid: e.target.value})}
                            className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KYC Details */}
                  <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-700" />
                      <h4 className="text-sm font-semibold text-gray-800">KYC Details <span className="text-xs font-normal text-gray-400">(Optional)</span></h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">PAN Number</label>
                        <input
                          type="text"
                          value={kycDetails.panNumber}
                          onChange={(e) => setKycDetails({...kycDetails, panNumber: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm uppercase"
                          placeholder="ABCDE1234F"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Aadhar Number</label>
                        <input
                          type="text"
                          value={kycDetails.aadharNumber}
                          onChange={(e) => setKycDetails({...kycDetails, aadharNumber: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
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
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    You can convert this lead to a Tenant record now. Linking a lease/property is optional — add it later from the Tenant page if needed.
                  </div>
                  {/* Direct Property Search */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-green-600" />
                      <h4 className="text-sm font-semibold text-gray-800">Find Property (optional)</h4>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        <Search className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={tenantDirectSearchQuery}
                        onChange={(e) => {
                          setTenantDirectSearchQuery(e.target.value);
                          if (e.target.value === '') setSelectedPropertyId('');
                        }}
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 text-sm transition-all"
                        placeholder="Search by property name, area, or city..."
                      />
                    </div>
                    {(() => {
                      const query = tenantDirectSearchQuery.trim().toLowerCase();
                      const tenantProperties = properties.filter(
                        (p) => p.status === 'available' || p.status === 'for-rent' || p.status === 'vacant'
                      );
                      const filtered = query
                        ? tenantProperties.filter((p) =>
                            [p.title, p.area, p.city, p.ownerName]
                              .filter(Boolean)
                              .some((field) => field.toLowerCase().includes(query))
                          )
                        : tenantProperties;
                      if (query && filtered.length === 0) {
                        return (
                          <div className="text-center py-6 bg-gray-50 rounded-xl">
                            <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No properties match your search</p>
                            <p className="text-xs text-gray-400 mt-1">Try a different area, city, or owner name</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {filtered.length === 0 ? (
                            <div className="text-center py-6 bg-gray-50 rounded-xl">
                              <Home className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                              <p className="text-sm text-gray-500">No rental properties available</p>
                            </div>
                          ) : (
                            filtered.slice(0, 10).map((prop) => (
                              <button
                                key={prop.propertyId}
                                type="button"
                                onClick={() => handleSelectPropertyDirectly(prop.propertyId)}
                                className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-150 flex items-start gap-3 group ${
                                  selectedPropertyId === prop.propertyId
                                    ? 'border-green-500 bg-green-50 shadow-sm'
                                    : 'border-transparent bg-gray-50 hover:bg-gray-100 hover:border-gray-200'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                  selectedPropertyId === prop.propertyId
                                    ? 'bg-green-600 text-white'
                                    : 'bg-white text-gray-500 group-hover:text-gray-700'
                                }`}>
                                  {selectedPropertyId === prop.propertyId ? (
                                    <CheckCircle className="h-4 w-4" />
                                  ) : (
                                    <Home className="h-4 w-4" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900 text-sm truncate">{prop.title}</p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${
                                      prop.status === 'for-rent'
                                        ? 'bg-purple-50 text-purple-700'
                                        : 'bg-amber-50 text-amber-700'
                                    }`}>
                                      {prop.status === 'for-rent' ? 'For Rent' : prop.status === 'vacant' ? 'Vacant' : 'Available'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">{prop.area}, {prop.city}</p>
                                  {prop.ownerName && (
                                    <p className="text-xs text-gray-400 mt-0.5">Owner: {prop.ownerName}</p>
                                  )}
                                </div>
                              </button>
                            ))
                          )}
                          {filtered.length > 10 && (
                            <p className="text-xs text-gray-400 text-center py-1">
                              +{filtered.length - 10} more results — refine your search
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {!selectedPropertyId && (
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-gray-100"></div>
                      <span className="flex-shrink mx-3 text-[10px] text-gray-400 font-medium">or search by owner</span>
                      <div className="flex-grow border-t border-gray-100"></div>
                    </div>
                  )}

                  {!selectedPropertyId && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-green-600" />
                        <h4 className="text-sm font-semibold text-gray-800">Search Owner First</h4>
                      </div>

                      {!selectedOwner ? (
                        <div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                              <Search className="h-4 w-4" />
                            </span>
                            <input
                              type="text"
                              value={ownerSearchQuery}
                              onChange={(e) => handleOwnerSearch(e.target.value)}
                              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 text-sm transition-all"
                              placeholder="Type owner's name or phone..."
                            />
                          </div>
                          {ownerSearchLoading && (
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                              <span className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                              Searching...
                            </p>
                          )}
                          {ownerSearchResults.length > 0 && (
                            <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto">
                              {ownerSearchResults.map((owner) => (
                                <button
                                  key={owner.ownerId}
                                  type="button"
                                  onClick={() => handleSelectOwner(owner)}
                                  className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all flex items-center gap-3 group"
                                >
                                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-green-700 font-semibold text-xs">
                                    {owner.name?.charAt(0)?.toUpperCase() || 'O'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 text-sm">{owner.name}</p>
                                    <p className="text-xs text-gray-500">{owner.phone}</p>
                                  </div>
                                  <span className="text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-green-100 transition-colors">
                                    Select
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="p-3.5 bg-green-50 rounded-xl border border-green-100">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                                {selectedOwner.name?.charAt(0)?.toUpperCase() || 'O'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm">{selectedOwner.name}</p>
                                <p className="text-xs text-gray-500">{selectedOwner.phone}</p>
                                <p className="text-xs text-green-700 mt-0.5">
                                  {ownerPropertiesLoading
                                    ? 'Loading...'
                                    : `${ownerProperties.filter((p) => p.status === 'available' || p.status === 'for-rent' || p.status === 'vacant').length} rental properties`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={clearOwnerSelection}
                                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-white/60 transition-colors"
                              >
                                Change
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Select a Property</p>
                            {ownerPropertiesLoading ? (
                              <div className="flex items-center gap-2 py-3 text-gray-500">
                                <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm">Loading properties...</span>
                              </div>
                            ) : ownerProperties.filter((p) => p.status === 'available' || p.status === 'for-rent' || p.status === 'vacant').length === 0 ? (
                              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <p className="text-sm text-amber-800 font-medium">No rental properties found</p>
                                <p className="text-xs text-amber-600 mt-1">This owner has no properties available for rent.</p>
                              </div>
                            ) : (
                              ownerProperties
                                .filter((p) => p.status === 'available' || p.status === 'for-rent' || p.status === 'vacant')
                                .map((prop) => (
                                  <button
                                    key={prop.propertyId}
                                    type="button"
                                    onClick={() => setSelectedPropertyId(prop.propertyId)}
                                    className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-150 flex items-start gap-3 ${
                                      selectedPropertyId === prop.propertyId
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-transparent bg-gray-50 hover:bg-gray-100 hover:border-gray-200'
                                    }`}
                                  >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                      selectedPropertyId === prop.propertyId
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white text-gray-500'
                                    }`}>
                                      {selectedPropertyId === prop.propertyId ? (
                                        <CheckCircle className="h-4 w-4" />
                                      ) : (
                                        <Home className="h-4 w-4" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900 text-sm">{prop.title}</p>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${
                                          prop.status === 'for-rent'
                                            ? 'bg-purple-50 text-purple-700'
                                            : 'bg-amber-50 text-amber-700'
                                        }`}>
                                          {prop.status === 'for-rent' ? 'For Rent' : prop.status === 'vacant' ? 'Vacant' : 'Available'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-0.5">{prop.area}, {prop.city}</p>
                                    </div>
                                  </button>
                                ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected Property Summary */}
                  {selectedPropertyId && (
                    <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-2.5">
                      <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-green-800 truncate">
                          {properties.find((p) => p.propertyId === selectedPropertyId)?.title}
                        </p>
                        <p className="text-xs text-green-600">
                          {properties.find((p) => p.propertyId === selectedPropertyId)?.area}, {properties.find((p) => p.propertyId === selectedPropertyId)?.city}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedPropertyId(''); setTenantDirectSearchQuery(''); clearOwnerSelection(); }}
                        className="text-xs font-medium text-green-700 hover:text-green-900 px-2 py-1 rounded-lg hover:bg-green-100 transition-colors shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {/* Lease Details */}
                  <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <IndianRupee className="h-4 w-4 text-gray-700" />
                      <h4 className="text-sm font-semibold text-gray-800">Lease Details</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Monthly Rent <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">₹</span>
                          <input
                            type="number"
                            value={leaseDetails.monthlyRent}
                            onChange={(e) => setLeaseDetails({...leaseDetails, monthlyRent: e.target.value})}
                            className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Security Deposit</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">₹</span>
                          <input
                            type="number"
                            value={leaseDetails.securityDeposit}
                            onChange={(e) => setLeaseDetails({...leaseDetails, securityDeposit: e.target.value})}
                            className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Brokerage</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">₹</span>
                          <input
                            type="number"
                            value={leaseDetails.brokeragePaid}
                            onChange={(e) => setLeaseDetails({...leaseDetails, brokeragePaid: e.target.value})}
                            className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Lease Start <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={leaseDetails.leaseStartDate}
                          onChange={(e) => setLeaseDetails({...leaseDetails, leaseStartDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Lease End</label>
                        <input
                          type="date"
                          value={leaseDetails.leaseEndDate}
                          onChange={(e) => setLeaseDetails({...leaseDetails, leaseEndDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* KYC Details */}
                  <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-700" />
                      <h4 className="text-sm font-semibold text-gray-800">KYC Details <span className="text-xs font-normal text-gray-400">(Optional)</span></h4>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Aadhar Number</label>
                      <input
                        type="text"
                        value={kycDetails.aadharNumber}
                        onChange={(e) => setKycDetails({...kycDetails, aadharNumber: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
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

            <div className="shrink-0 bg-gray-50 border-t px-6 py-4 flex gap-3">
              <button
                onClick={handleConvert}
                disabled={converting}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {converting
                  ? 'Converting...'
                  : lead.leadType === 'buyer' && selectedPropertyId
                    ? 'Complete Purchase'
                    : lead.leadType === 'buyer'
                      ? 'Convert to Buyer'
                      : lead.leadType === 'tenant' && selectedPropertyId
                        ? 'Complete Rental'
                        : lead.leadType === 'tenant'
                          ? 'Convert to Tenant'
                          : lead.leadType === 'seller'
                            ? 'Create Seller + Property Listing'
                            : lead.leadType === 'owner'
                              ? 'Create Owner + Rent Listing'
                              : 'Convert'}
              </button>
              <button
                onClick={() => setShowConvertModal(false)}
                disabled={converting}
                className="px-5 py-2.5 bg-white text-gray-700 rounded-xl font-medium border border-gray-200 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 transition-colors"
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
