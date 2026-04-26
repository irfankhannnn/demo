import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  MessageSquare,
  Search,
  Phone,
  Mail,
  User,
  Calendar,
  Filter,
  ArrowLeft,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Home,
  FileText,
  Mic,
  MicOff,
  Save,
  UserPlus,
  Building,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Plus,
  CalendarPlus,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMEnquiryNote, CRMMeeting } from '../../types/crm';
import ScheduleMeetingModal from '../../components/ScheduleMeetingModal';
import MeetingHistoryModal from '../../components/MeetingHistoryModal';
import MeetingRescheduleModal from '../../components/MeetingRescheduleModal';

interface Enquiry {
  enquiryId: string;
  tenantId: string;
  formType: 'contact' | 'consultation';
  name: string;
  email?: string;
  phone: string;
  message?: string;
  userType?: string;
  propertyType?: string;
  wantPropertyManagement?: boolean;
  status: 'new' | 'contacted' | 'meeting_scheduled' | 'converted' | 'closed';
  notes?: string;
  assignedTo?: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  convertedTo?: 'owner' | 'tenant';
  convertedId?: string;
  convertedAt?: string;
  closedAt?: string;
  closeReason?: string;
}

interface EnquiryMetrics {
  total: number;
  new: number;
  contacted: number;
  meeting_scheduled: number;
  converted: number;
  closed: number;
  byFormType: {
    contact: number;
    consultation: number;
  };
}

export default function EnquiryList() {
  const navigate = useNavigate();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState<Enquiry[]>([]);
  const [metrics, setMetrics] = useState<EnquiryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formTypeFilter, setFormTypeFilter] = useState<string>('all');
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [enquiryNotes, setEnquiryNotes] = useState<CRMEnquiryNote[]>([]);
  const [enquiryMeetings, setEnquiryMeetings] = useState<CRMMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [newDiscussionNote, setNewDiscussionNote] = useState('');
  const [editingDiscussionNoteId, setEditingDiscussionNoteId] = useState<string | null>(null);
  const [editingDiscussionContent, setEditingDiscussionContent] = useState('');
  const [discussionActionLoading, setDiscussionActionLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);
  const [showAddEnquiryModal, setShowAddEnquiryModal] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [converting, setConverting] = useState(false);
  const [creatingEnquiry, setCreatingEnquiry] = useState(false);
  const [historyMeetingId, setHistoryMeetingId] = useState<string | null>(null);
  const [rescheduleMeeting, setRescheduleMeeting] = useState<CRMMeeting | null>(null);
  const [newEnquiryData, setNewEnquiryData] = useState<{
    formType: string;
    name: string;
    phone: string;
    email: string;
    message: string;
    notes: string;
  }>({
    formType: 'contact',
    name: '',
    phone: '',
    email: '',
    message: '',
    notes: '',
  });
  const [updateStatusData, setUpdateStatusData] = useState<{
    status: 'new' | 'contacted' | 'meeting_scheduled';
    contactNotes: string;
  }>({ status: 'new', contactNotes: '' });
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const recognitionRef = useRef<any>(null);

  const updateMeetingInState = (updated: CRMMeeting) => {
    setEnquiryMeetings((prev) => prev.map((m) => (m.meetingId === updated.meetingId ? updated : m)));
  };

  const handleMeetingStatusChange = async (meetingId: string, status: 'completed' | 'cancelled') => {
    try {
      const updated = await api.updateMeeting(meetingId, { status });
      updateMeetingInState(updated as CRMMeeting);
    } catch (e) {
      console.error('Failed to update meeting status', e);
      alert('Failed to update meeting status');
    }
  };

  const getMeetingStatusPill = (status?: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-purple-100 text-purple-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700';
      case 'rescheduled':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [enquiries, searchQuery, statusFilter, formTypeFilter]);

  useEffect(() => {
    const isAnyModalOpen =
      showAddEnquiryModal ||
      showUpdateStatusModal ||
      showCloseModal ||
      showConvertModal ||
      isDetailOpen;

    if (!isAnyModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      if (showAddEnquiryModal) {
        setShowAddEnquiryModal(false);
        return;
      }
      if (showUpdateStatusModal) {
        setShowUpdateStatusModal(false);
        return;
      }
      if (showCloseModal) {
        setShowCloseModal(false);
        return;
      }
      if (showConvertModal) {
        setShowConvertModal(false);
        return;
      }
      if (isDetailOpen) {
        setIsDetailOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isDetailOpen,
    showAddEnquiryModal,
    showUpdateStatusModal,
    showCloseModal,
    showConvertModal,
  ]);

  // Load discussion notes when an enquiry is selected/opened
  useEffect(() => {
    const loadNotes = async () => {
      if (!selectedEnquiry) {
        setEnquiryNotes([]);
        setEditingDiscussionNoteId(null);
        setEditingDiscussionContent('');
        return;
      }
      try {
        const notes = await api.getEnquiryNotes(selectedEnquiry.enquiryId);
        setEnquiryNotes(notes);
      } catch (e) {
        console.error('Failed to load enquiry notes', e);
      }
    };
    loadNotes();
  }, [selectedEnquiry?.enquiryId]);

  // Load meeting history when an enquiry is selected/opened
  useEffect(() => {
    const loadMeetings = async () => {
      if (!selectedEnquiry) {
        setEnquiryMeetings([]);
        return;
      }

      try {
        setMeetingsLoading(true);
        const meetings = await api.getMeetingsByEntity('enquiry', selectedEnquiry.enquiryId);
        setEnquiryMeetings(Array.isArray(meetings) ? meetings : []);
      } catch (e) {
        console.error('Failed to load enquiry meetings', e);
        setEnquiryMeetings([]);
      } finally {
        setMeetingsLoading(false);
      }
    };

    loadMeetings();
  }, [selectedEnquiry?.enquiryId]);

  const startEditDiscussionNote = (note: CRMEnquiryNote) => {
    setEditingDiscussionNoteId(note.noteId);
    setEditingDiscussionContent(note.content);
  };

  const cancelEditDiscussionNote = () => {
    setEditingDiscussionNoteId(null);
    setEditingDiscussionContent('');
  };

  const saveEditDiscussionNote = async () => {
    if (!selectedEnquiry || !editingDiscussionNoteId) return;
    try {
      setDiscussionActionLoading(true);
      await api.updateEnquiryNote(selectedEnquiry.enquiryId, editingDiscussionNoteId, {
        content: editingDiscussionContent,
      });
      cancelEditDiscussionNote();
      const notes = await api.getEnquiryNotes(selectedEnquiry.enquiryId);
      setEnquiryNotes(notes);
    } catch (error) {
      console.error('Failed to update discussion note', error);
      alert('Failed to update note');
    } finally {
      setDiscussionActionLoading(false);
    }
  };

  const deleteDiscussionNote = async (noteId: string) => {
    if (!selectedEnquiry) return;
    if (!window.confirm('Delete this note?')) return;
    try {
      setDiscussionActionLoading(true);
      await api.deleteEnquiryNote(selectedEnquiry.enquiryId, noteId);
      if (editingDiscussionNoteId === noteId) {
        cancelEditDiscussionNote();
      }
      const notes = await api.getEnquiryNotes(selectedEnquiry.enquiryId);
      setEnquiryNotes(notes);
    } catch (error) {
      console.error('Failed to delete discussion note', error);
      alert('Failed to delete note');
    } finally {
      setDiscussionActionLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [enquiriesData, metricsData] = await Promise.all([
        api.getEnquiries(),
        api.getEnquiryMetrics(),
      ]);

      // Guard against duplicates/invalid entries coming from API (prevents blank rows and duplicate React keys)
      const uniqueById = new Map<string, Enquiry>();
      (Array.isArray(enquiriesData) ? enquiriesData : []).forEach((e: Enquiry) => {
        if (!e || !e.enquiryId) return;
        uniqueById.set(e.enquiryId, e);
      });
      setEnquiries(Array.from(uniqueById.values()));
      setMetrics(metricsData);
    } catch (error) {
      console.error('Error loading enquiries:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...enquiries];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.phone.includes(query) ||
          e.email?.toLowerCase().includes(query) ||
          e.message?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }

    // Form type filter
    if (formTypeFilter !== 'all') {
      filtered = filtered.filter((e) => e.formType === formTypeFilter);
    }

    // Sort by created date (most recent first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredEnquiries(filtered);
  };

  const handleStatusChange = async (enquiryId: string, newStatus: string, contactNotes?: string) => {
    try {
      setUpdating(true);
      
      // Build update data
      const updateData: { status: string; notes?: string } = { status: newStatus };
      
      // If changing to contacted and there are contact notes, append them
      if (newStatus === 'contacted' && contactNotes && contactNotes.trim()) {
        const timestamp = new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const existingNotes = selectedEnquiry?.notes || '';
        const contactNote = `[${timestamp}] Status changed to Contacted\n${contactNotes.trim()}`;
        updateData.notes = existingNotes ? `${existingNotes}\n\n${contactNote}` : contactNote;
      }
      
      await api.updateEnquiry(enquiryId, updateData);
      
      // Update local state
      setEnquiries((prev) =>
        prev.map((e) =>
          e.enquiryId === enquiryId 
            ? { ...e, status: newStatus as Enquiry['status'], notes: updateData.notes || e.notes } 
            : e
        )
      );
      
      if (selectedEnquiry?.enquiryId === enquiryId) {
        setSelectedEnquiry({ 
          ...selectedEnquiry, 
          status: newStatus as Enquiry['status'],
          notes: updateData.notes || selectedEnquiry.notes,
        });
      }
      
      // Refresh metrics
      const metricsData = await api.getEnquiryMetrics();
      setMetrics(metricsData);
      
      // Close the modal
      setShowUpdateStatusModal(false);
      setUpdateStatusData({ status: 'new', contactNotes: '' });
    } catch (error) {
      console.error('Error updating enquiry:', error);
      alert('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  // Open update status modal
  const openUpdateStatusModal = () => {
    if (selectedEnquiry) {
      setUpdateStatusData({
        status: selectedEnquiry.status === 'contacted' ? 'contacted' : 'new',
        contactNotes: '',
      });
      setShowUpdateStatusModal(true);
    }
  };

  // Handle update status submit
  const handleUpdateStatusSubmit = () => {
    if (!selectedEnquiry) return;
    handleStatusChange(selectedEnquiry.enquiryId, updateStatusData.status, updateStatusData.contactNotes);
  };

  const handleCreateEnquiry = async () => {
    try {
      if (!newEnquiryData.name.trim() || !newEnquiryData.phone.trim()) {
        alert('Name and phone are required');
        return;
      }

      setCreatingEnquiry(true);
      await api.createEnquiry({
        formType: newEnquiryData.formType,
        name: newEnquiryData.name.trim(),
        phone: newEnquiryData.phone.trim(),
        email: newEnquiryData.email.trim() || undefined,
        message: newEnquiryData.message.trim() || undefined,
        notes: newEnquiryData.notes.trim() || undefined,
        source: 'crm_manual',
        status: 'new',
      });

      setShowAddEnquiryModal(false);
      setNewEnquiryData({
        formType: 'contact',
        name: '',
        phone: '',
        email: '',
        message: '',
        notes: '',
      });

      await loadData();
    } catch (error) {
      console.error('Error creating enquiry:', error);
      alert('Failed to create enquiry');
    } finally {
      setCreatingEnquiry(false);
    }
  };


  // Voice recording functions
  const startVoiceRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice recording is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-IN';
    
    recognitionRef.current.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript && selectedEnquiry) {
        void (async () => {
          try {
            const note = await api.createEnquiryNote(selectedEnquiry.enquiryId, {
              content: transcript.trim(),
              createdBy: 'Admin (Voice)',
            });
            setEnquiryNotes((prev) => (prev.some((p) => p.noteId === note.noteId) ? prev : [...prev, note]));
          } catch (error) {
            console.error('Failed to add voice transcript to internal notes', error);
            alert('Failed to save voice note');
          }
        })();
      }
    };
    
    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };
    
    recognitionRef.current.onend = () => {
      setIsRecording(false);
    };
    
    recognitionRef.current.start();
    setIsRecording(true);
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  // Add a new discussion note (timeline)
  const handleAddDiscussionNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry || !newDiscussionNote.trim()) return;
    try {
      await api.createEnquiryNote(selectedEnquiry.enquiryId, {
        content: newDiscussionNote.trim(),
        createdBy: 'Admin',
      });
      setNewDiscussionNote('');
      const notes = await api.getEnquiryNotes(selectedEnquiry.enquiryId);
      setEnquiryNotes(notes);
    } catch (error) {
      console.error('Failed to add discussion note', error);
      alert('Failed to add note');
    }
  };

  // Convert enquiry
  const handleConvert = async (convertTo: 'owner' | 'tenant') => {
    if (!selectedEnquiry) return;
    
    try {
      setConverting(true);
      const result = await api.convertEnquiry(selectedEnquiry.enquiryId, convertTo);
      
      // Update local state
      setEnquiries((prev) =>
        prev.map((e) =>
          e.enquiryId === selectedEnquiry.enquiryId
            ? { ...e, status: 'converted', convertedTo: convertTo, convertedId: result.createdRecord?.ownerId || result.createdRecord?.customerId }
            : e
        )
      );
      
      setSelectedEnquiry({
        ...selectedEnquiry,
        status: 'converted',
        convertedTo: convertTo,
      });
      
      // Refresh metrics
      const metricsData = await api.getEnquiryMetrics();
      setMetrics(metricsData);
      
      setShowConvertModal(false);
      alert(`Successfully converted to ${convertTo}! You can find them in the ${convertTo === 'owner' ? 'Owners' : 'Tenants'} section.`);
    } catch (error) {
      console.error('Error converting enquiry:', error);
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already converted') || msg.includes('already exists')) {
          alert(error.message);
        } else {
          alert('Failed to convert enquiry');
        }
      } else {
        alert('Failed to convert enquiry');
      }
    } finally {
      setConverting(false);
    }
  };

  // Close enquiry
  const handleClose = async () => {
    if (!selectedEnquiry) return;
    
    try {
      setUpdating(true);
      await api.closeEnquiry(selectedEnquiry.enquiryId, closeReason);
      
      // Update local state
      setEnquiries((prev) =>
        prev.map((e) =>
          e.enquiryId === selectedEnquiry.enquiryId
            ? { ...e, status: 'closed' }
            : e
        )
      );
      
      setSelectedEnquiry({ ...selectedEnquiry, status: 'closed' });
      
      // Refresh metrics
      const metricsData = await api.getEnquiryMetrics();
      setMetrics(metricsData);
      
      setShowCloseModal(false);
      setCloseReason('');
    } catch (error) {
      console.error('Error closing enquiry:', error);
      alert('Failed to close enquiry');
    } finally {
      setUpdating(false);
    }
  };

  // Reopen enquiry
  const handleReopen = async () => {
    if (!selectedEnquiry) return;
    
    try {
      setUpdating(true);
      await api.reopenEnquiry(selectedEnquiry.enquiryId);
      
      // Update local state
      setEnquiries((prev) =>
        prev.map((e) =>
          e.enquiryId === selectedEnquiry.enquiryId
            ? { ...e, status: 'new' }
            : e
        )
      );
      
      setSelectedEnquiry({ ...selectedEnquiry, status: 'new' });
      
      // Refresh metrics
      const metricsData = await api.getEnquiryMetrics();
      setMetrics(metricsData);
    } catch (error) {
      console.error('Error reopening enquiry:', error);
      alert('Failed to reopen enquiry');
    } finally {
      setUpdating(false);
    }
  };

  // Handle meeting scheduled success
  const handleMeetingScheduled = async (meeting?: CRMMeeting) => {
    if (!selectedEnquiry) return;
    
    try {
      // Update enquiry status to meeting_scheduled
      await api.updateEnquiry(selectedEnquiry.enquiryId, { status: 'meeting_scheduled' });

      // Auto-log to enquiry discussion notes (audit trail)
      try {
        const stamp = new Date().toLocaleString('en-IN');
        const summary = meeting
          ? `[${stamp}] Meeting scheduled: ${meeting.meetingDate} ${meeting.meetingTime} • ${meeting.title}${meeting.location ? ` • ${meeting.location}` : ''}${meeting.notes ? `\nNotes: ${meeting.notes}` : ''}`
          : `[${stamp}] Meeting scheduled`;
        await api.createEnquiryNote(selectedEnquiry.enquiryId, { content: summary });
        const notes = await api.getEnquiryNotes(selectedEnquiry.enquiryId);
        setEnquiryNotes(notes);
      } catch (e) {
        console.error('Failed to auto-log meeting in enquiry notes', e);
      }
      
      // Update local state
      setEnquiries((prev) =>
        prev.map((e) =>
          e.enquiryId === selectedEnquiry.enquiryId
            ? { ...e, status: 'meeting_scheduled' }
            : e
        )
      );
      
      setSelectedEnquiry({ ...selectedEnquiry, status: 'meeting_scheduled' });

      if (meeting) {
        setEnquiryMeetings((prev) => {
          const exists = prev.some((m) => m.meetingId === meeting.meetingId);
          const next = exists ? prev : [meeting, ...prev];
          return [...next].sort((a, b) => {
            const dateCompare = (b.meetingDate || '').localeCompare(a.meetingDate || '');
            if (dateCompare !== 0) return dateCompare;
            return (b.meetingTime || '').localeCompare(a.meetingTime || '');
          });
        });
      }
      
      // Refresh metrics
      const metricsData = await api.getEnquiryMetrics();
      setMetrics(metricsData);
    } catch (error) {
      console.error('Error updating enquiry status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'meeting_scheduled':
        return 'bg-purple-100 text-purple-800';
      case 'converted':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <Clock className="w-4 h-4" />;
      case 'contacted':
        return <Phone className="w-4 h-4" />;
      case 'meeting_scheduled':
        return <Calendar className="w-4 h-4" />;
      case 'converted':
        return <CheckCircle className="w-4 h-4" />;
      case 'closed':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <LoadingSpinner message="Loading enquiries..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm')}
                className="p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">Enquiries</h1>
                  <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                    Contact form and consultation submissions
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={loadData}
                className="p-2 sm:p-2.5 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white transition-all shadow-sm"
               aria-label="Refresh data">
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setShowAddEnquiryModal(true)}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 font-medium"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline text-sm sm:text-base">Create</span>
                <span className="sm:hidden text-sm">New</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                  <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.total}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
              </div>
            </div>
            <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-blue-600">{metrics.new}</p>
                  <p className="text-xs text-gray-500">New</p>
                </div>
              </div>
            </div>
            <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                  <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-amber-600">{metrics.contacted}</p>
                  <p className="text-xs text-gray-500">Contacted</p>
                </div>
              </div>
            </div>
            <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600">{metrics.converted}</p>
                  <p className="text-xs text-gray-500">Converted</p>
                </div>
              </div>
            </div>
            <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center shadow-lg shadow-gray-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                  <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-gray-600">{metrics.closed}</p>
                  <p className="text-xs text-gray-500">Closed</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-xl p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm sm:text-base bg-white/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white/80 border border-gray-200 rounded-xl px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="converted">Converted</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Form Type Filter */}
            <div className="flex-shrink-0">
              <select
                value={formTypeFilter}
                onChange={(e) => setFormTypeFilter(e.target.value)}
                className="bg-white/80 border border-gray-200 rounded-xl px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
              >
                <option value="all">All Types</option>
                <option value="contact">Contact Form</option>
                <option value="consultation">Consultation</option>
              </select>
            </div>
          </div>
        </div>

        {/* Enquiries List */}
        <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-xl overflow-hidden">
          {filteredEnquiries.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No enquiries found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredEnquiries
                .filter((enquiry) => enquiry && enquiry.enquiryId)
                .map((enquiry, idx) => (
                  <div
                    key={`enquiry-${enquiry.enquiryId}-${idx}`}
                    className="p-3 sm:p-4 hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100"
                    onClick={() => {
                      setSelectedEnquiry(enquiry);
                      setIsDetailOpen(true);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                          <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                            {enquiry.name || 'Unnamed'}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              enquiry.status
                            )}`}
                          >
                            {getStatusIcon(enquiry.status)}
                            {enquiry.status}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {enquiry.formType === 'contact' ? (
                              <FileText className="w-3 h-3" />
                            ) : (
                              <Home className="w-3 h-3" />
                            )}
                            {enquiry.formType}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {enquiry.phone}
                          </span>
                          {enquiry.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              {enquiry.email}
                            </span>
                          )}
                          {enquiry.userType && (
                            <span className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {enquiry.userType}
                            </span>
                          )}
                        </div>
                        {enquiry.message && (
                          <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                            {enquiry.message}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 sm:gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(enquiry.createdAt)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEnquiry(enquiry);
                            setIsDetailOpen(true);
                          }}
                          className="p-1.5 sm:p-2 hover:bg-primary-50 rounded-lg transition-colors active:scale-95"
                        >
                          <Eye className="w-4 h-4 text-primary-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </main>

      {/* Detail Slide-over */}
      {isDetailOpen && selectedEnquiry && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsDetailOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-xl">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Enquiry Details</h2>
                  <button
                    onClick={() => setIsDetailOpen(false)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <XCircle className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Contact Info */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Contact Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <span className="font-medium">{selectedEnquiry.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <a href={`tel:${selectedEnquiry.phone}`} className="text-primary-600 hover:underline">
                        {selectedEnquiry.phone}
                      </a>
                    </div>
                    {selectedEnquiry.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <a href={`mailto:${selectedEnquiry.email}`} className="text-primary-600 hover:underline">
                          {selectedEnquiry.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Details */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Enquiry Details</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Form Type</span>
                      <span className="font-medium capitalize">{selectedEnquiry.formType}</span>
                    </div>
                    {selectedEnquiry.userType && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">User Type</span>
                        <span className="font-medium capitalize">{selectedEnquiry.userType}</span>
                      </div>
                    )}
                    {selectedEnquiry.propertyType && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Property Interest</span>
                        <span className="font-medium capitalize">{selectedEnquiry.propertyType}</span>
                      </div>
                    )}
                    {selectedEnquiry.wantPropertyManagement && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Property Management</span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                          <CheckCircle className="w-4 h-4" />
                          Interested
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Source</span>
                      <span className="font-medium">{selectedEnquiry.source}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Received</span>
                      <span className="font-medium">{formatDate(selectedEnquiry.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Message */}
                {selectedEnquiry.message && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Message</h3>
                    <div className="bg-gray-50 rounded-lg p-4 text-gray-700">
                      {selectedEnquiry.message}
                    </div>
                  </div>
                )}

                {/* Status Display & Update Button */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Lead Status</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const status = selectedEnquiry.status || 'new';
                        return (
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(
                              status
                            )}`}
                          >
                            {getStatusIcon(status)}
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        );
                      })()}
                    </div>
                    {/* Only show Update button for non-converted and non-closed leads */}
                    {selectedEnquiry.status !== 'converted' && selectedEnquiry.status !== 'closed' && (
                      <button
                        onClick={openUpdateStatusModal}
                        disabled={updating}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Update Status
                      </button>
                    )}
                  </div>
                </div>

                {/* Convert / Close / Reopen Actions */}
                {selectedEnquiry.status !== 'converted' && selectedEnquiry.status !== 'closed' && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Lead Actions</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setShowScheduleMeeting(true)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                      >
                        <CalendarPlus className="w-5 h-5" />
                        Schedule
                      </button>
                      <button
                        onClick={() => setShowConvertModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <UserPlus className="w-5 h-5" />
                        Convert
                      </button>
                      <button
                        onClick={() => setShowCloseModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <XCircle className="w-5 h-5" />
                        Close
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Reopen button for closed leads */}
                {selectedEnquiry.status === 'closed' && (
                  <div className="mb-6">
                    <button
                      onClick={handleReopen}
                      disabled={updating}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      {updating ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                      Reopen Lead
                    </button>
                  </div>
                )}

                {/* Meeting History */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Meeting History</h3>
                  {meetingsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading meetings...
                    </div>
                  ) : enquiryMeetings.length === 0 ? (
                    <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 rounded-lg">
                      No meetings scheduled yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {enquiryMeetings.map((m) => (
                        <div key={m.meetingId} className="border border-gray-200 rounded-lg p-4 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-gray-900">{m.title || 'Meeting'}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                {m.meetingDate} {m.meetingTime}
                                {m.duration ? ` • ${m.duration}m` : ''}
                                {m.location ? ` • ${m.location}` : ''}
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getMeetingStatusPill(m.status)}`}>
                              {m.status}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setHistoryMeetingId(m.meetingId)}
                              className="px-2 py-1 text-[11px] rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                              History
                            </button>
                            {m.status === 'scheduled' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setRescheduleMeeting(m)}
                                  className="px-2 py-1 text-[11px] rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                >
                                  Reschedule
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMeetingStatusChange(m.meetingId, 'completed')}
                                  className="px-2 py-1 text-[11px] rounded-md bg-green-50 text-green-700 hover:bg-green-100"
                                >
                                  Complete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMeetingStatusChange(m.meetingId, 'cancelled')}
                                  className="px-2 py-1 text-[11px] rounded-md bg-gray-50 text-gray-700 hover:bg-gray-100"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                          {(m.notes || m.outcome) && (
                            <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
                              {m.outcome && (
                                <div className="mb-2">
                                  <span className="font-medium">Outcome:</span> {m.outcome}
                                </div>
                              )}
                              {m.notes && <div>{m.notes}</div>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Discussion Notes Timeline */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-500">Discussion Notes</h3>
                    <button
                      onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isRecording
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <MicOff className="w-4 h-4" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" />
                          Voice Note
                        </>
                      )}
                    </button>
                  </div>
                  {isRecording && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Recording... Speak clearly and it will be transcribed.
                    </div>
                  )}
                  <form onSubmit={handleAddDiscussionNote} className="mb-4">
                    <textarea
                      value={newDiscussionNote}
                      onChange={(e) => setNewDiscussionNote(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-2"
                      placeholder="Add a timeline note for this enquiry..."
                    />
                    <button
                      type="submit"
                      disabled={!newDiscussionNote.trim()}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Add Note
                    </button>
                  </form>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {enquiryNotes.length === 0 ? (
                      <div className="text-center py-6 text-sm text-gray-500">No notes yet</div>
                    ) : (
                      enquiryNotes.map((n) => (
                        <div key={`discussion-${n.noteId}-${n.createdAt}`} className="border-l-2 border-primary-500 pl-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs text-gray-600">{n.createdBy}</div>
                            <div className="flex items-center gap-2">
                              <div className="text-[11px] text-gray-500">{new Date(n.createdAt).toLocaleDateString('en-IN')}</div>
                              {n.noteId !== 'PROFILE_NOTES' && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={discussionActionLoading}
                                    onClick={() => startEditDiscussionNote(n)}
                                    className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-50"
                                    aria-label="Edit note"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={discussionActionLoading}
                                    onClick={() => deleteDiscussionNote(n.noteId)}
                                    className="p-1 rounded hover:bg-gray-100 text-red-600 disabled:opacity-50"
                                    aria-label="Delete note"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {editingDiscussionNoteId === n.noteId ? (
                            <div>
                              <textarea
                                value={editingDiscussionContent}
                                onChange={(e) => setEditingDiscussionContent(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  type="button"
                                  disabled={discussionActionLoading || !editingDiscussionContent.trim()}
                                  onClick={saveEditDiscussionNote}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                                >
                                  <Check className="w-4 h-4" />
                                  Save
                                </button>
                                <button
                                  type="button"
                                  disabled={discussionActionLoading}
                                  onClick={cancelEditDiscussionNote}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                >
                                  <X className="w-4 h-4" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-700 whitespace-pre-wrap">{n.content}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Show conversion info if converted */}
                {selectedEnquiry.status === 'converted' && selectedEnquiry.convertedTo && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">
                        Converted to {selectedEnquiry.convertedTo === 'owner' ? 'Owner' : 'Tenant'}
                      </span>
                    </div>
                    {selectedEnquiry.convertedAt && (
                      <p className="text-sm text-green-600 mt-1">
                        on {formatDate(selectedEnquiry.convertedAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t bg-gray-50">
                <div className="flex gap-3">
                  <a
                    href={`tel:${selectedEnquiry.phone}`}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors border-2 border-indigo-600"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </a>
                  {selectedEnquiry.email && (
                    <a
                      href={`mailto:${selectedEnquiry.email}`}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Email
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convert Modal */}
      {showConvertModal && selectedEnquiry && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConvertModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Convert Lead</h3>
              <button onClick={() => setShowConvertModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Convert <span className="font-medium">{selectedEnquiry.name}</span> to:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleConvert('owner')}
                disabled={converting}
                className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <Building className="w-10 h-10 text-green-600" />
                <span className="font-medium text-gray-900">Owner</span>
                <span className="text-xs text-gray-500 text-center">Property owner who wants to list</span>
              </button>
              <button
                onClick={() => handleConvert('tenant')}
                disabled={converting}
                className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                <User className="w-10 h-10 text-blue-600" />
                <span className="font-medium text-gray-900">Tenant</span>
                <span className="text-xs text-gray-500 text-center">Looking to rent a property</span>
              </button>
            </div>
            {converting && (
              <div className="mt-4 flex items-center justify-center gap-2 text-gray-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                Converting...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close Modal */}
      {showCloseModal && selectedEnquiry && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCloseModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Close Lead</h3>
              <button onClick={() => setShowCloseModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to close this lead? You can optionally provide a reason.
            </p>
            <textarea
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder="Reason for closing (optional)..."
              rows={3}
              className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Close Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showUpdateStatusModal && selectedEnquiry && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowUpdateStatusModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Update Lead Status</h3>
              <button onClick={() => setShowUpdateStatusModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setUpdateStatusData({ ...updateStatusData, status: 'new' })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      updateStatusData.status === 'new'
                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
                    }`}
                  >
                    <Clock className="w-4 h-4 inline mr-1" />
                    New
                  </button>
                  <button
                    onClick={() => setUpdateStatusData({ ...updateStatusData, status: 'contacted' })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      updateStatusData.status === 'contacted'
                        ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-500'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
                    }`}
                  >
                    <Phone className="w-4 h-4 inline mr-1" />
                    Contacted
                  </button>
                  <button
                    onClick={() => setUpdateStatusData({ ...updateStatusData, status: 'meeting_scheduled' })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      updateStatusData.status === 'meeting_scheduled'
                        ? 'bg-purple-100 text-purple-800 border-2 border-purple-500'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
                    }`}
                  >
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Meeting
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Note: "Converted" status is set automatically when you convert the lead to Owner/Tenant.
                </p>
              </div>

              {/* Contact Notes - Show only when status is 'contacted' */}
              {updateStatusData.status === 'contacted' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Notes
                  </label>
                  <textarea
                    value={updateStatusData.contactNotes}
                    onChange={(e) => setUpdateStatusData({ ...updateStatusData, contactNotes: e.target.value })}
                    placeholder="What was discussed? Any follow-up needed?"
                    rows={4}
                    className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    These notes will be added to the internal notes with timestamp.
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowUpdateStatusModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatusSubmit}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Enquiry Modal */}
      {showAddEnquiryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddEnquiryModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Add Enquiry</h3>
              <button onClick={() => setShowAddEnquiryModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Form Type</label>
                  <input
                    list="formTypeOptions"
                    value={newEnquiryData.formType}
                    onChange={(e) =>
                      setNewEnquiryData({
                        ...newEnquiryData,
                        formType: e.target.value,
                      })
                    }
                    placeholder="Select or type form type"
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <datalist id="formTypeOptions">
                    <option value="Contact" />
                    <option value="Consultation" />
                    <option value="Instagram" />
                    <option value="Website" />
                    <option value="Facebook" />
                  </datalist>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      value={newEnquiryData.name}
                      onChange={(e) => setNewEnquiryData({ ...newEnquiryData, name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                    <input
                      type="tel"
                      value={newEnquiryData.phone}
                      onChange={(e) => setNewEnquiryData({ ...newEnquiryData, phone: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="+91..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={newEnquiryData.email}
                    onChange={(e) => setNewEnquiryData({ ...newEnquiryData, email: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message / Requirement</label>
                  <textarea
                    value={newEnquiryData.message}
                    onChange={(e) => setNewEnquiryData({ ...newEnquiryData, message: e.target.value })}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="What is the enquiry about?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Internal Notes</label>
                  <textarea
                    value={newEnquiryData.notes}
                    onChange={(e) => setNewEnquiryData({ ...newEnquiryData, notes: e.target.value })}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="Any notes for internal use"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowAddEnquiryModal(false)}
                disabled={creatingEnquiry}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEnquiry}
                disabled={creatingEnquiry || !newEnquiryData.name.trim() || !newEnquiryData.phone.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingEnquiry ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {selectedEnquiry && (
        <ScheduleMeetingModal
          isOpen={showScheduleMeeting}
          onClose={() => setShowScheduleMeeting(false)}
          onSuccess={(meeting) => {
            setShowScheduleMeeting(false);
            if (!selectedEnquiry) return;
            handleMeetingScheduled(meeting);
          }}
          entityType="enquiry"
          entityId={selectedEnquiry.enquiryId}
          entityName={selectedEnquiry.name}
          entityPhone={selectedEnquiry.phone}
          entityEmail={selectedEnquiry.email}
        />
      )}

      <MeetingHistoryModal
        isOpen={!!historyMeetingId}
        meetingId={historyMeetingId}
        onClose={() => setHistoryMeetingId(null)}
      />

      <MeetingRescheduleModal
        isOpen={!!rescheduleMeeting}
        meeting={rescheduleMeeting}
        onClose={() => setRescheduleMeeting(null)}
        onSuccess={(updated) => updateMeetingInState(updated)}
      />
    </div>
  );
}
