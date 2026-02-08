import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  PhoneCall,
  ArrowLeft,
  Search,
  User,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { api } from '../../../services/api';
import { aiCallingApi } from '../../../services/aiCallingApi';
import type { LeadForCall, CallPurpose, StartCallResponse } from '../../../types/aiCalling';

const callPurposes: { value: CallPurpose; label: string; description: string }[] = [
  { value: 'lead_followup', label: 'Lead Follow-up', description: 'General follow-up with a lead' },
  { value: 'property_inquiry', label: 'Property Inquiry', description: 'Answer property questions' },
  { value: 'site_visit_scheduling', label: 'Site Visit', description: 'Schedule a property visit' },
  { value: 'general_faq', label: 'General FAQ', description: 'Answer common questions' },
];

export default function StartCallModal() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadForCall[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadForCall | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [callPurpose, setCallPurpose] = useState<CallPurpose>('lead_followup');
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [callResult, setCallResult] = useState<StartCallResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      // Get leads from CRM API
      const leadsData = await api.getLeads();
      
      // Filter to active leads with phone numbers
      const activeLeads = (leadsData || [])
        .filter((lead: { phone?: string; status?: string }) => lead.phone && lead.status !== 'converted' && lead.status !== 'lost')
        .map((lead: { leadId: string; name: string; phone: string; email?: string; status: string; leadType: string; budget?: number; propertyType?: string; preferredLocations?: string[] }) => ({
          leadId: lead.leadId,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          status: lead.status,
          leadType: lead.leadType,
          budget: lead.budget,
          propertyType: lead.propertyType,
          preferredLocations: lead.preferredLocations,
        }));
      
      setLeads(activeLeads);
    } catch (err) {
      console.error('Error loading leads:', err);
      setError('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(query) ||
      lead.phone?.includes(query) ||
      lead.email?.toLowerCase().includes(query)
    );
  });

  const handleStartCall = async () => {
    try {
      setCalling(true);
      setError(null);

      const phone = useManualEntry ? manualPhone : selectedLead?.phone;
      const name = useManualEntry ? manualName : selectedLead?.name;
      const leadId = useManualEntry ? undefined : selectedLead?.leadId;

      if (!phone) {
        setError('Phone number is required');
        setCalling(false);
        return;
      }

      const result = await aiCallingApi.startCall({
        leadId,
        leadName: name,
        leadPhone: phone,
        callPurpose,
      });

      setCallResult(result);

      // Navigate to call status page after short delay
      setTimeout(() => {
        navigate(`/crm/ai-calling/calls/${result.callSessionId}`);
      }, 2000);
    } catch (err) {
      console.error('Error starting call:', err);
      setError(err instanceof Error ? err.message : 'Failed to start call');
      setCalling(false);
    }
  };

  const canStartCall = useManualEntry
    ? manualPhone.length >= 10
    : selectedLead !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => navigate('/crm/ai-calling')}
              className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-white/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Start AI Call</h1>
              <p className="text-xs sm:text-sm text-gray-500">Select a lead or enter phone number</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Call Result */}
        {callResult && (
          <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-xl text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-green-800">Call Initiated!</h2>
            <p className="text-green-700 mt-1">
              The AI agent is now calling {selectedLead?.name || manualName || manualPhone}
            </p>
            <p className="text-sm text-green-600 mt-2">
              Redirecting to call status...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800">Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Toggle */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setUseManualEntry(false)}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              !useManualEntry
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Select from Leads
          </button>
          <button
            onClick={() => setUseManualEntry(true)}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              useManualEntry
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Enter Manually
          </button>
        </div>

        {/* Lead Selection */}
        {!useManualEntry && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search leads by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-gray-500 mt-2">Loading leads...</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-8 text-center">
                <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No leads found</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {filteredLeads.map((lead) => (
                  <button
                    key={lead.leadId}
                    onClick={() => setSelectedLead(lead)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedLead?.leadId === lead.leadId ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{lead.name}</p>
                        <p className="text-sm text-gray-500">{lead.phone}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full capitalize">
                          {lead.leadType}
                        </span>
                        {lead.propertyType && (
                          <p className="text-xs text-gray-500 mt-1">{lead.propertyType}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manual Entry */}
        {useManualEntry && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
                <input
                  type="text"
                  placeholder="Customer name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Call Purpose */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Call Purpose</h3>
          <div className="grid grid-cols-2 gap-3">
            {callPurposes.map((purpose) => (
              <button
                key={purpose.value}
                onClick={() => setCallPurpose(purpose.value)}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  callPurpose === purpose.value
                    ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-900">{purpose.label}</p>
                <p className="text-xs text-gray-500 mt-1">{purpose.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Lead Summary */}
        {selectedLead && !useManualEntry && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-600 font-medium">Selected Lead</p>
                <p className="text-lg font-bold text-indigo-900">{selectedLead.name}</p>
                <p className="text-indigo-700">{selectedLead.phone}</p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Start Call Button */}
        <button
          onClick={handleStartCall}
          disabled={!canStartCall || calling || !!callResult}
          className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-colors ${
            canStartCall && !calling && !callResult
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {calling ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Initiating Call...
            </>
          ) : callResult ? (
            <>
              <CheckCircle2 className="w-6 h-6" />
              Call Started
            </>
          ) : (
            <>
              <PhoneCall className="w-6 h-6" />
              Start AI Call
            </>
          )}
        </button>
      </main>
    </div>
  );
}
