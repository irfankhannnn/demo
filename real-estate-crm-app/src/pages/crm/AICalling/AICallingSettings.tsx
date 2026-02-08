import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle2,
  Phone,
  MessageSquare,
  Clock,
  Volume2,
  Loader2,
} from 'lucide-react';
import { aiCallingApi } from '../../../services/aiCallingApi';
import type { AgentConfig, SaveAgentConfigRequest } from '../../../types/aiCalling';

export default function AICallingSettings() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [agencyName, setAgencyName] = useState('');
  const [exotelNumber, setExotelNumber] = useState('');
  const [greeting, setGreeting] = useState('');
  const [fallbackMessage, setFallbackMessage] = useState('');
  const [maxCallDuration, setMaxCallDuration] = useState(600);
  const [enableRecording, setEnableRecording] = useState(true);
  const [escalationPhone, setEscalationPhone] = useState('');
  const [agentVoice, setAgentVoice] = useState('default');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const configData = await aiCallingApi.getAgentConfig();
      setConfig(configData);
      
      if (configData.configured) {
        setAgencyName(configData.agencyName || '');
        setExotelNumber(configData.exotelNumber || '');
        setGreeting(configData.greeting || '');
        setFallbackMessage(configData.fallbackMessage || '');
        setMaxCallDuration(configData.maxCallDuration || 600);
        setEnableRecording(configData.enableRecording !== false);
        setEscalationPhone(configData.escalationPhone || '');
        setAgentVoice(configData.agentVoice || 'default');
      }
    } catch (err) {
      console.error('Error loading config:', err);
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      if (!agencyName || !exotelNumber) {
        setError('Agency name and Exotel number are required');
        setSaving(false);
        return;
      }

      const saveData: SaveAgentConfigRequest = {
        agencyName,
        exotelNumber,
        greeting: greeting || `Hello, this is ${agencyName}. How can I help you with your property search today?`,
        fallbackMessage: fallbackMessage || "I'm sorry, I didn't understand that. Could you please repeat?",
        maxCallDuration,
        enableRecording,
        escalationPhone,
        agentVoice,
      };

      await aiCallingApi.saveAgentConfig(saveData);
      setSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving config:', err);
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600 animate-pulse">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/ai-calling')}
                className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-white/50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">AI Agent Settings</h1>
                <p className="text-xs sm:text-sm text-gray-500">Configure your AI calling agent</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-green-800 font-medium">Settings saved successfully!</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Agency Info Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-600" />
            Agency Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agency Name *
              </label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="e.g., Cloudberry Real Estate"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">This will be used in the AI agent's introduction</p>
            </div>
          </div>
        </div>

        {/* Exotel Configuration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-gray-600" />
            Exotel Configuration
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exotel Virtual Number *
              </label>
              <input
                type="tel"
                value={exotelNumber}
                onChange={(e) => setExotelNumber(e.target.value)}
                placeholder="e.g., 91XXXXXXXXXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Your Exotel virtual number for outbound calls</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Escalation Phone (for human handoff)
              </label>
              <input
                type="tel"
                value={escalationPhone}
                onChange={(e) => setEscalationPhone(e.target.value)}
                placeholder="e.g., 91XXXXXXXXXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Number to transfer calls when customer requests human agent</p>
            </div>
          </div>
        </div>

        {/* Voice & Messages */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-gray-600" />
            Voice & Messages
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI Voice
              </label>
              <select
                value={agentVoice}
                onChange={(e) => setAgentVoice(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="default">Default (Professional Female)</option>
                <option value="male_professional">Professional Male</option>
                <option value="female_friendly">Friendly Female</option>
                <option value="male_friendly">Friendly Male</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Greeting Message
              </label>
              <textarea
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder={`Hello, this is ${agencyName || 'our agency'}. How can I help you with your property search today?`}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">First message the AI agent speaks when call connects</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fallback Message
              </label>
              <textarea
                value={fallbackMessage}
                onChange={(e) => setFallbackMessage(e.target.value)}
                placeholder="I'm sorry, I didn't understand that. Could you please repeat?"
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Message when AI doesn't understand the customer</p>
            </div>
          </div>
        </div>

        {/* Call Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-600" />
            Call Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Call Duration (seconds)
              </label>
              <input
                type="number"
                value={maxCallDuration}
                onChange={(e) => setMaxCallDuration(parseInt(e.target.value, 10) || 600)}
                min={60}
                max={1800}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Call will automatically end after this duration (60-1800 seconds)</p>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Enable Call Recording</p>
                <p className="text-sm text-gray-500">Record all calls for quality and training</p>
              </div>
              <button
                onClick={() => setEnableRecording(!enableRecording)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  enableRecording ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enableRecording ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Save Button (Mobile) */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 md:hidden"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Settings
            </>
          )}
        </button>
      </main>
    </div>
  );
}
