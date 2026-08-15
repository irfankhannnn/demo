import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  MessageSquare,
  Building2,
  Users,
  Briefcase,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import Toast from '../../components/Toast';
import { CRMMeeting, CRMCustomerNote, CRMOwnerNote, CRMEnquiryNote, CRMLeadNote } from '../../types/crm';
import MeetingHistoryModal from '../../components/MeetingHistoryModal';
import MeetingRescheduleModal from '../../components/MeetingRescheduleModal';

interface MeetingMetrics {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  rescheduled: number;
  upcoming: number;
  today: number;
  thisWeek: number;
  byEntityType: {
    customer: number;
    owner: number;
    enquiry: number;
    b2b_lead: number;
    property: number;
    lead: number;
  };
}

interface MeetingDetailPopupProps {
  meeting: CRMMeeting;
  onClose: () => void;
  onUpdate: () => void;
  notes: (CRMCustomerNote | CRMOwnerNote | CRMEnquiryNote | CRMLeadNote)[];
  loadingNotes: boolean;
  onShowHistory: (meetingId: string) => void;
  onReschedule: (meeting: CRMMeeting) => void;
  onMarkStatus: (meetingId: string, status: 'completed' | 'cancelled') => void;
}

function MeetingDetailPopup({ meeting, onClose, onUpdate, notes, loadingNotes, onShowHistory, onReschedule, onMarkStatus }: MeetingDetailPopupProps) {
  const [updating, setUpdating] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      setUpdating(true);
      await api.updateMeeting(meeting.meetingId, { status: newStatus });
      setShowStatusMenu(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating meeting status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'rescheduled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'customer': return <Users className="w-4 h-4" />;
      case 'owner': return <User className="w-4 h-4" />;
      case 'enquiry': return <MessageSquare className="w-4 h-4" />;
      case 'b2b_lead': return <Briefcase className="w-4 h-4" />;
      case 'property': return <Building2 className="w-4 h-4" />;
      case 'lead': return <User className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{meeting.title}</h2>
              <div className="flex items-center gap-2 mt-2 text-blue-100">
                <CalendarIcon className="w-4 h-4" />
                <span>{formatDate(meeting.meetingDate)}</span>
                <span className="mx-1">•</span>
                <Clock className="w-4 h-4" />
                <span>{formatTime(meeting.meetingTime)}</span>
                {meeting.duration && (
                  <span className="text-blue-200">({meeting.duration} min)</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Status & Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                disabled={updating}
                className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(meeting.status)} hover:opacity-80 transition-opacity flex items-center gap-2`}
              >
                {meeting.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                {meeting.status === 'cancelled' && <XCircle className="w-4 h-4" />}
                {meeting.status === 'scheduled' && <Clock className="w-4 h-4" />}
                {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                <ChevronRight className="w-4 h-4" />
              </button>
              
              {showStatusMenu && (
                <div className="absolute top-full left-0 mt-2 bg-white border rounded-lg shadow-lg z-10 py-1 min-w-[150px]">
                  {['scheduled', 'completed', 'cancelled', 'rescheduled'].map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm capitalize"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onShowHistory(meeting.meetingId)}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                History
              </button>
              <button
                type="button"
                onClick={() => onReschedule(meeting)}
                className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Reschedule
              </button>
              {meeting.status === 'scheduled' && (
                <>
                  <button
                    type="button"
                    onClick={() => onMarkStatus(meeting.meetingId, 'completed')}
                    className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarkStatus(meeting.meetingId, 'cancelled')}
                    className="px-3 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Meeting Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Contact Info */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                {getEntityIcon(meeting.relatedEntityType)}
                {meeting.relatedEntityType === 'customer' ? 'Tenant' : 
                 meeting.relatedEntityType === 'lead' ? 'Lead' :
                 meeting.relatedEntityType.charAt(0).toUpperCase() + meeting.relatedEntityType.slice(1).replace('_', ' ')} Details
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>{meeting.attendeeName || meeting.relatedEntityName || 'N/A'}</span>
                </div>
                {(meeting.attendeePhone || meeting.relatedEntityPhone) && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${meeting.attendeePhone || meeting.relatedEntityPhone}`} className="hover:text-blue-600">
                      {meeting.attendeePhone || meeting.relatedEntityPhone}
                    </a>
                  </div>
                )}
                {meeting.attendeeEmail && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${meeting.attendeeEmail}`} className="hover:text-blue-600">
                      {meeting.attendeeEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Location & Details */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Meeting Details</h3>
              <div className="space-y-2">
                {meeting.location && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{meeting.location}</span>
                  </div>
                )}
                {meeting.description && (
                  <p className="text-gray-600 text-sm mt-2">{meeting.description}</p>
                )}
                {meeting.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-500 font-medium">Notes:</p>
                    <p className="text-gray-700 text-sm mt-1">{meeting.notes}</p>
                  </div>
                )}
                {meeting.outcome && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-500 font-medium">Outcome:</p>
                    <p className="text-gray-700 text-sm mt-1">{meeting.outcome}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat/Notes History */}
          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Discussion History
            </h3>
            
            {loadingNotes ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No discussion history available</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {notes.map((note, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">
                        {new Date(note.createdAt).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-gray-400">{note.createdBy}</span>
                    </div>
                    <p className="text-gray-700 text-sm">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<CRMMeeting[]>([]);
  const [metrics, setMetrics] = useState<MeetingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // View state
  const [currentDate, setCurrentDate] = useState(new Date());
  /**
   * Agenda ("list") is the default on phones.
   *
   * The week grid is min-w-[1100px] and the day grid min-w-[900px]; on a 390px
   * screen those are horizontal-scroll strips where most of the day is off
   * screen. The list view is already a proper responsive agenda, so mobile
   * simply starts there. All four modes stay selectable — this changes the
   * starting point, not the capability.
   */
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'list'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
      ? 'list'
      : 'month'
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Popup state
  const [selectedMeeting, setSelectedMeeting] = useState<CRMMeeting | null>(null);
  const [meetingNotes, setMeetingNotes] = useState<(CRMCustomerNote | CRMOwnerNote | CRMEnquiryNote | CRMLeadNote)[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [historyMeetingId, setHistoryMeetingId] = useState<string | null>(null);
  const [rescheduleMeeting, setRescheduleMeeting] = useState<CRMMeeting | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [meetingsData, metricsData] = await Promise.all([
        api.getMeetings(),
        api.getMeetingMetrics(),
      ]);
      
      setMeetings(meetingsData || []);
      setMetrics(metricsData);
    } catch (err) {
      console.error('Error loading calendar data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadMeetingNotes = async (meeting: CRMMeeting) => {
    try {
      setLoadingNotes(true);
      let notes: (CRMCustomerNote | CRMOwnerNote | CRMEnquiryNote | CRMLeadNote)[] = [];
      
      switch (meeting.relatedEntityType) {
        case 'customer':
          notes = await api.getCustomerNotes(meeting.relatedEntityId);
          break;
        case 'owner':
          notes = await api.getOwnerNotes(meeting.relatedEntityId);
          break;
        case 'enquiry':
          notes = await api.getEnquiryNotes(meeting.relatedEntityId);
          break;
        case 'lead':
          notes = await api.getLeadNotes(meeting.relatedEntityId);
          break;
        default:
          notes = [];
      }
      
      setMeetingNotes(notes || []);
    } catch (err) {
      console.error('Error loading notes:', err);
      setMeetingNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleMeetingClick = (meeting: CRMMeeting) => {
    setSelectedMeeting(meeting);
    loadMeetingNotes(meeting);
  };

  const handleClosePopup = () => {
    setSelectedMeeting(null);
    setMeetingNotes([]);
  };

  const handleMarkStatus = async (meetingId: string, status: 'completed' | 'cancelled') => {
    try {
      const updated = await api.updateMeeting(meetingId, { status });
      setSelectedMeeting(updated as CRMMeeting);
      await loadData();
    } catch (e) {
      console.error('Failed to update meeting status', e);
      showToast('Failed to update meeting status', 'error');
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getMeetingsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return meetings.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      return m.meetingDate === dateStr;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      case 'rescheduled': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const startOfWeek = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  };

  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const prevWeek = () => {
    setCurrentDate((d) => addDays(d, -7));
  };

  const nextWeek = () => {
    setCurrentDate((d) => addDays(d, 7));
  };

  const prevDay = () => {
    setCurrentDate((d) => addDays(d, -1));
  };

  const nextDay = () => {
    setCurrentDate((d) => addDays(d, 1));
  };

  const formatDayHeader = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatWeekRange = (date: Date) => {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    const startLabel = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const endLabel = end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startLabel} - ${endLabel}`;
  };

  const parseTimeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10));
    return (h || 0) * 60 + (m || 0);
  };

  const formatMinutesToTimeLabel = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''} ${ampm}`;
  };

  const START_MINUTES = 8 * 60;
  const END_MINUTES = 20 * 60;
  const SLOT_MINUTES = 60;

  const timeSlots = Array.from({ length: Math.floor((END_MINUTES - START_MINUTES) / SLOT_MINUTES) + 1 })
    .map((_, i) => START_MINUTES + i * SLOT_MINUTES);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const filteredMeetings = meetings.filter(m => 
    statusFilter === 'all' || m.status === statusFilter
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <LoadingSpinner message="Loading calendar..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm')}
                className="p-1.5 sm:p-2 hover:bg-white/60 rounded-xl transition-all duration-200 flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                  <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">Calendar</h1>
                  <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Meeting schedule</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* View Mode Toggle */}
              <div className="hidden sm:flex bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl p-1 shadow-sm">
                {(['month', 'week', 'day', 'list'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      viewMode === mode
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                    }`}
                  >
                    {mode === 'day' ? 'Day' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
              
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="hidden sm:block px-3 py-2 bg-white/80 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              >
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rescheduled">Rescheduled</option>
              </select>
              
              <button
                onClick={loadData}
                className="p-2 sm:p-2.5 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white transition-all shadow-sm"
                title="Refresh"
               aria-label="Refresh data">
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {error && (
          <div className="mb-4 sm:mb-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Day View - Time Grid */}
        {viewMode === 'day' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <button onClick={prevDay} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Previous day">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={nextDay} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Next day">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">{currentDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
                <button
                  onClick={goToToday}
                  className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                >
                  Today
                </button>
              </div>
              <div className="w-[84px]" />
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid" style={{ gridTemplateColumns: '120px 1fr' }}>
                  <div className="bg-gray-50 border-r border-b p-3 text-xs font-medium text-gray-500">Time</div>
                  <div className="bg-gray-50 border-b p-3 text-xs font-medium text-gray-500">{formatDayHeader(currentDate)}</div>

                  {timeSlots.map((slotStartMinutes) => {
                    const dayMeetings = getMeetingsForDate(currentDate);
                    const meetingsInSlot = dayMeetings
                      .filter((m) => {
                        const start = parseTimeToMinutes(m.meetingTime);
                        return start >= slotStartMinutes && start < slotStartMinutes + SLOT_MINUTES;
                      })
                      .sort((a, b) => parseTimeToMinutes(a.meetingTime) - parseTimeToMinutes(b.meetingTime));

                    return (
                      <div key={`slot-${slotStartMinutes}`} className="contents">
                        <div className="border-r border-b p-3 text-xs text-gray-500 bg-white">
                          {formatMinutesToTimeLabel(slotStartMinutes)}
                        </div>
                        <div className="border-b p-2 min-h-[72px] bg-white">
                          <div className="space-y-2">
                            {meetingsInSlot.map((meeting) => (
                              <button
                                key={meeting.meetingId}
                                onClick={() => handleMeetingClick(meeting)}
                                className={`w-full text-left text-xs p-2 rounded text-white ${getStatusColor(meeting.status)}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-medium truncate">{meeting.meetingTime.slice(0, 5)} {meeting.title}</div>
                                  {meeting.duration && (
                                    <div className="text-[10px] opacity-90 whitespace-nowrap">{meeting.duration}m</div>
                                  )}
                                </div>
                                <div className="truncate opacity-90">{meeting.attendeeName || meeting.relatedEntityName}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="text-2xl font-bold text-gray-900">{metrics.today}</div>
              <div className="text-sm text-gray-500">Today</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="text-2xl font-bold text-blue-600">{metrics.upcoming}</div>
              <div className="text-sm text-gray-500">Upcoming</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="text-2xl font-bold text-green-600">{metrics.completed}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="text-2xl font-bold text-yellow-600">{metrics.thisWeek}</div>
              <div className="text-sm text-gray-500">This Week</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="text-2xl font-bold text-red-600">{metrics.cancelled}</div>
              <div className="text-sm text-gray-500">Cancelled</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="text-2xl font-bold text-gray-600">{metrics.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
          </div>
        )}

        {/* Calendar View */}
        {viewMode === 'month' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {/* Month Navigation */}
            <div className="flex items-center justify-between p-4 border-b">
              <button
                onClick={prevMonth}
                className="p-2 hover:bg-gray-100 rounded-lg"
               aria-label="Previous">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">{formatMonthYear(currentDate)}</h2>
                <button
                  onClick={goToToday}
                  className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                >
                  Today
                </button>
              </div>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg"
               aria-label="Next">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 border-b">
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {getDaysInMonth(currentDate).map((date, index) => {
                const dayMeetings = date ? getMeetingsForDate(date) : [];
                
                return (
                  <div
                    key={index}
                    onClick={() => {
                      if (!date) return;
                      setCurrentDate(date);
                      setViewMode('day');
                    }}
                    role={date ? 'button' : undefined}
                    tabIndex={date ? 0 : -1}
                    onKeyDown={(e) => {
                      if (!date) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCurrentDate(date);
                        setViewMode('day');
                      }
                    }}
                    className={`min-h-[100px] p-2 border-b border-r ${
                      date && isToday(date) ? 'bg-blue-50' : ''
                    } ${!date ? 'bg-gray-50' : ''}`}
                  >
                    {date && (
                      <>
                        <div className={`text-sm font-medium mb-1 ${
                          isToday(date) ? 'text-blue-600' : 'text-gray-700'
                        }`}>
                          {date.getDate()}
                        </div>
                        <div className="space-y-1">
                          {dayMeetings.slice(0, 3).map((meeting) => (
                            <button
                              key={meeting.meetingId}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMeetingClick(meeting);
                              }}
                              className={`w-full text-left text-xs p-1 rounded text-white truncate ${getStatusColor(meeting.status)}`}
                            >
                              {meeting.meetingTime.slice(0, 5)} {meeting.title}
                            </button>
                          ))}
                          {dayMeetings.length > 3 && (
                            <div className="text-xs text-gray-500 text-center">
                              +{dayMeetings.length - 3} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">All Meetings</h2>
            </div>
            
            {filteredMeetings.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">No meetings found</p>
                <p className="text-sm">Schedule a meeting from a lead or customer page</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredMeetings.map((meeting) => (
                  <button
                    key={meeting.meetingId}
                    onClick={() => handleMeetingClick(meeting)}
                    className="w-full p-4 hover:bg-gray-50 text-left flex items-center gap-4"
                  >
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(meeting.status)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{meeting.title}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {new Date(meeting.meetingDate).toLocaleDateString('en-IN')}
                        <Clock className="w-4 h-4 ml-2" />
                        {meeting.meetingTime}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700">
                        {meeting.attendeeName || meeting.relatedEntityName}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {meeting.relatedEntityType.replace('_', ' ')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Week View - Time Grid */}
        {viewMode === 'week' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <button onClick={prevWeek} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Previous week">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={nextWeek} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Next week">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">Week: {formatWeekRange(currentDate)}</h2>
                <button
                  onClick={goToToday}
                  className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                >
                  Today
                </button>
              </div>
              <div className="w-[84px]" />
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[1100px]">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: '120px repeat(7, minmax(140px, 1fr))',
                  }}
                >
                  <div className="bg-gray-50 border-r border-b p-3 text-xs font-medium text-gray-500">Time</div>

                  {Array.from({ length: 7 }).map((_, index) => {
                    const date = addDays(startOfWeek(currentDate), index);
                    return (
                      <div
                        key={`hdr-${index}`}
                        className={`bg-gray-50 border-b p-3 text-xs font-medium text-gray-500 ${isToday(date) ? 'bg-blue-50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{formatDayHeader(date)}</span>
                          {isToday(date) && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white">Today</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {timeSlots.map((slotStartMinutes) => {
                    return (
                      <div key={`slot-${slotStartMinutes}`} className="contents">
                        <div className="border-r border-b p-3 text-xs text-gray-500 bg-white">
                          {formatMinutesToTimeLabel(slotStartMinutes)}
                        </div>
                        {Array.from({ length: 7 }).map((_, index) => {
                          const date = addDays(startOfWeek(currentDate), index);
                          const dayMeetings = getMeetingsForDate(date);
                          const meetingsInSlot = dayMeetings
                            .filter((m) => {
                              const start = parseTimeToMinutes(m.meetingTime);
                              return start >= slotStartMinutes && start < slotStartMinutes + SLOT_MINUTES;
                            })
                            .sort((a, b) => parseTimeToMinutes(a.meetingTime) - parseTimeToMinutes(b.meetingTime));

                          return (
                            <div key={`cell-${slotStartMinutes}-${index}`} className="border-b border-r p-2 min-h-[72px] bg-white">
                              <div className="space-y-2">
                                {meetingsInSlot.map((meeting) => (
                                  <button
                                    key={meeting.meetingId}
                                    onClick={() => handleMeetingClick(meeting)}
                                    className={`w-full text-left text-xs p-2 rounded text-white ${getStatusColor(meeting.status)}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="font-medium truncate">{meeting.meetingTime.slice(0, 5)} {meeting.title}</div>
                                      {meeting.duration && (
                                        <div className="text-[10px] opacity-90 whitespace-nowrap">{meeting.duration}m</div>
                                      )}
                                    </div>
                                    <div className="truncate opacity-90">{meeting.attendeeName || meeting.relatedEntityName}</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Meeting Detail Popup */}
      {selectedMeeting && (
        <MeetingDetailPopup
          meeting={selectedMeeting}
          onClose={handleClosePopup}
          onUpdate={() => {
            loadData();
            loadMeetingNotes(selectedMeeting);
          }}
          notes={meetingNotes}
          loadingNotes={loadingNotes}
          onShowHistory={(meetingId) => setHistoryMeetingId(meetingId)}
          onReschedule={(m) => setRescheduleMeeting(m)}
          onMarkStatus={handleMarkStatus}
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
        onSuccess={(updated) => {
          setSelectedMeeting(updated);
          loadData();
        }}
      />
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
