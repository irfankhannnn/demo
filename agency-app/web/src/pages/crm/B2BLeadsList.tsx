import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Search,
  Phone,
  Mail,
  Calendar,
  ArrowLeft,
  Clock,
  RefreshCw,
  Loader2,
  Building2,
  MessageSquare,
  User,
  Send,
  CalendarPlus,
} from 'lucide-react';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import Toast from '../../components/Toast';
import { CRMMeeting } from '../../types/crm';
import ScheduleMeetingModal from '../../components/ScheduleMeetingModal';

interface B2BLead {
  leadId: string;
  tenantId: string;
  name: string;
  role: string;
  mobile: string;
  email?: string;
  availableDate?: string;
  availableTime?: string;
  pagePath: string;
  status: 'new' | 'contacted' | 'scheduled' | 'converted' | 'closed';
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  submittedAt: string;
  updatedAt: string;
  history?: Array<{
    timestamp: string;
    action: string;
    details: string;
    updatedBy: string;
  }>;
}

export default function B2BLeadsList() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<B2BLead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<B2BLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<B2BLead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
  };
  const [updating, setUpdating] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const [leadMeetings, setLeadMeetings] = useState<CRMMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchQuery, statusFilter, priorityFilter]);

  useEffect(() => {
    if (!isDetailOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDetailOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDetailOpen]);

  useEffect(() => {
    const loadMeetings = async () => {
      if (!selectedLead || !isDetailOpen) {
        setLeadMeetings([]);
        return;
      }
      try {
        setMeetingsLoading(true);
        const meetings = await api.getMeetingsByEntity('b2b_lead', selectedLead.leadId);
        setLeadMeetings(Array.isArray(meetings) ? meetings : []);
      } catch (e) {
        console.error('Failed to load lead meetings', e);
        setLeadMeetings([]);
      } finally {
        setMeetingsLoading(false);
      }
    };

    loadMeetings();
  }, [selectedLead?.leadId, isDetailOpen]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const data = await api.getB2BLeads();
      setLeads(data);
    } catch (error) {
      console.error('Error fetching B2B leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.name.toLowerCase().includes(query) ||
          lead.role.toLowerCase().includes(query) ||
          lead.mobile.includes(query) ||
          lead.email?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.priority === priorityFilter);
    }

    filtered.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    setFilteredLeads(filtered);
  };

  const handleLeadClick = (lead: B2BLead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedLead) return;
    
    try {
      setUpdating(true);
      const updatedLead = await api.updateB2BLead(selectedLead.leadId, { status });
      setLeads(leads.map((l) => (l.leadId === selectedLead.leadId ? updatedLead : l)));
      setSelectedLead(updatedLead);
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePriority = async (priority: string) => {
    if (!selectedLead) return;
    
    try {
      setUpdating(true);
      const updatedLead = await api.updateB2BLead(selectedLead.leadId, { priority });
      setLeads(leads.map((l) => (l.leadId === selectedLead.leadId ? updatedLead : l)));
      setSelectedLead(updatedLead);
    } catch (error) {
      console.error('Error updating priority:', error);
      showToast('Failed to update priority', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedLead || !newNote.trim()) return;
    
    try {
      setUpdating(true);
      const updatedLead = await api.addB2BLeadNote(selectedLead.leadId, newNote);
      setLeads(leads.map((l) => (l.leadId === selectedLead.leadId ? updatedLead : l)));
      setSelectedLead(updatedLead);
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
      showToast('Failed to add note', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-700';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-700';
      case 'scheduled':
        return 'bg-purple-100 text-purple-700';
      case 'converted':
        return 'bg-green-100 text-green-700';
      case 'closed':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700';
      case 'medium':
        return 'bg-orange-100 text-orange-700';
      case 'low':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getMetrics = () => {
    return {
      total: leads.length,
      new: leads.filter((l) => l.status === 'new').length,
      contacted: leads.filter((l) => l.status === 'contacted').length,
      scheduled: leads.filter((l) => l.status === 'scheduled').length,
      converted: leads.filter((l) => l.status === 'converted').length,
    };
  };

  const metrics = getMetrics();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <LoadingSpinner message="Loading B2B leads..." />
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="glass-premium border-b border-white/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm')}
                className="p-1.5 sm:p-2 hover:bg-white/60 rounded-xl transition-all duration-200 flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-slate-500" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                  <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">B2B Leads</h1>
                  <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Partnership & corporate leads</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={fetchLeads}
                className="p-2 sm:p-2.5 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white transition-all shadow-sm"
               aria-label="Refresh data">
                <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.total}</p>
                <p className="text-xs text-gray-500">Total Leads</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-lg shadow-sky-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-sky-600">{metrics.new}</p>
                <p className="text-xs text-gray-500">New</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{metrics.contacted}</p>
                <p className="text-xs text-gray-500">Contacted</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-purple-600">{metrics.scheduled}</p>
                <p className="text-xs text-gray-500">Scheduled</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-emerald-600">{metrics.converted}</p>
                <p className="text-xs text-gray-500">Converted</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Table */}
        <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-xl overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200/50">
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name, role, mobile, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="scheduled">Scheduled</option>
                <option value="converted">Converted</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-4 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              >
                <option value="all">All Priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50/90 to-white/90 backdrop-blur-xl border-b border-gray-200/50">
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name & Role</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Available</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50">
                {filteredLeads.map((lead, index) => (
                  <tr
                    key={lead.leadId}
                    onClick={() => handleLeadClick(lead)}
                    className={`group cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-indigo-50/80 ${index % 2 === 0 ? 'bg-white/40' : 'bg-gray-50/30'}`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                          <Briefcase className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{lead.name}</div>
                          <div className="text-sm text-gray-500">{lead.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {lead.mobile}
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4" />
                            {lead.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {lead.availableDate || lead.availableTime ? (
                        <div className="text-sm">
                          {lead.availableDate && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="w-4 h-4" />
                              {new Date(lead.availableDate).toLocaleDateString()}
                            </div>
                          )}
                          {lead.availableTime && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Clock className="w-4 h-4" />
                              {lead.availableTime}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not specified</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(lead.priority)}`}>
                        {lead.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(lead.submittedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLeads.length === 0 && (
            <div className="p-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No leads found</p>
            </div>
          )}
        </div>
      </main>

      {isDetailOpen && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedLead.name}</h2>
                  <p className="text-gray-600">{selectedLead.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScheduleMeeting(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    Schedule Meeting
                  </button>
                  <button
                    onClick={() => setIsDetailOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{selectedLead.mobile}</span>
                  </div>
                  {selectedLead.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span>{selectedLead.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span>Meeting History</span>
                </h3>
                {meetingsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading meetings...
                  </div>
                ) : leadMeetings.length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 rounded-lg">
                    No meetings scheduled yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leadMeetings.map((m) => (
                      <div key={m.meetingId} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-gray-900">{m.title}</div>
                            <div className="text-sm text-gray-600 mt-1 flex items-center gap-3 flex-wrap">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {m.meetingDate}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {m.meetingTime}
                              </span>
                              {m.location ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-gray-500">•</span>
                                  {m.location}
                                </span>
                              ) : null}
                            </div>
                            {m.notes ? (
                              <div className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{m.notes}</div>
                            ) : null}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            m.status === 'scheduled'
                              ? 'bg-purple-100 text-purple-700'
                              : m.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : m.status === 'cancelled'
                                  ? 'bg-gray-100 text-gray-700'
                                  : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {m.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(selectedLead.availableDate || selectedLead.availableTime) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Availability</h3>
                  <div className="space-y-2">
                    {selectedLead.availableDate && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(selectedLead.availableDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {selectedLead.availableTime && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{selectedLead.availableTime}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Status</h3>
                <div className="flex gap-2 flex-wrap">
                  {['new', 'contacted', 'scheduled', 'converted', 'closed'].map((status) => (
                    <button
                      key={status}
                      onClick={() => handleUpdateStatus(status)}
                      disabled={updating}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        selectedLead.status === status
                          ? getStatusColor(status)
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Priority</h3>
                <div className="flex gap-2 flex-wrap">
                  {['low', 'medium', 'high'].map((priority) => (
                    <button
                      key={priority}
                      onClick={() => handleUpdatePriority(priority)}
                      disabled={updating}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        selectedLead.priority === priority
                          ? getPriorityColor(priority)
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary-600" />
                  <span>Discussion Notes & Activity</span>
                </h3>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] items-start">
                  <div className="space-y-3">
                    {selectedLead.notes && (
                      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap border border-dashed border-gray-200">
                        <div className="font-semibold mb-1 text-gray-800">Summary Notes</div>
                        {selectedLead.notes}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">Add internal note</p>
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Log a call, meeting, or update for this lead..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      />
                      <button
                        onClick={handleAddNote}
                        disabled={updating || !newNote.trim()}
                        className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 disabled:bg-blue-100 disabled:text-blue-700 disabled:border disabled:border-blue-200 disabled:shadow-none disabled:cursor-not-allowed text-sm font-semibold transition-colors"
                      >
                        {updating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span>{updating ? 'Saving...' : 'Add Note'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 md:p-4 max-h-72 overflow-y-auto border border-gray-100">
                    {selectedLead.history && selectedLead.history.length > 0 ? (
                      <div className="space-y-3">
                        {selectedLead.history.map((entry, index) => (
                          <div key={index} className="flex gap-3 text-xs md:text-sm">
                            <div className="mt-1">
                              <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                                <User className="w-3.5 h-3.5 text-primary-600" />
                              </div>
                            </div>
                            <div className="flex-1 bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-100">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-medium text-gray-900 text-xs md:text-sm truncate">
                                  {entry.updatedBy || 'Admin'}
                                </span>
                                <span className="text-[10px] md:text-xs text-gray-500 whitespace-nowrap">
                                  {new Date(entry.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-[11px] md:text-xs font-semibold text-primary-700 mb-0.5">
                                {entry.action}
                              </div>
                              <div className="text-[11px] md:text-xs text-gray-700 whitespace-pre-wrap">
                                {entry.details}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center py-6 text-xs text-gray-500">
                        <MessageSquare className="w-6 h-6 text-gray-300 mb-2" />
                        <p>No activity logged yet.</p>
                        <p className="mt-1">Use notes to start building a history of conversations for this lead.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                <div>Submitted: {new Date(selectedLead.submittedAt).toLocaleString()}</div>
                <div>Last Updated: {new Date(selectedLead.updatedAt).toLocaleString()}</div>
                <div>Source: {selectedLead.pagePath}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedLead && (
        <ScheduleMeetingModal
          isOpen={showScheduleMeeting}
          onClose={() => setShowScheduleMeeting(false)}
          onSuccess={(meeting) => {
            setShowScheduleMeeting(false);
            if (meeting) {
              setLeadMeetings((prev) => {
                const exists = prev.some((m) => m.meetingId === meeting.meetingId);
                const next = exists ? prev : [meeting, ...prev];
                return [...next].sort((a, b) => {
                  const dateCompare = (a.meetingDate || '').localeCompare(b.meetingDate || '');
                  if (dateCompare !== 0) return dateCompare;
                  return (a.meetingTime || '').localeCompare(b.meetingTime || '');
                });
              });
            }
            if (selectedLead.status !== 'scheduled') {
              const updatedLead = { ...selectedLead, status: 'scheduled' as const };
              setSelectedLead(updatedLead);
              setLeads((prev) => prev.map((l) => (l.leadId === updatedLead.leadId ? updatedLead : l)));
            }
          }}
          entityType="b2b_lead"
          entityId={selectedLead.leadId}
          entityName={selectedLead.name}
          entityPhone={selectedLead.mobile}
          entityEmail={selectedLead.email}
        />
      )}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
