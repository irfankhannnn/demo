import { useState, useEffect } from 'react';
import { api } from '../services/api';

type AiPersonality = 'professional' | 'friendly' | 'direct';

interface AiEmployeeConfig {
  aiEmployeeEnabled: boolean;
  followupAgentMode: 'draft' | 'autosend';
  followupAgentAutoSendChannels: string[];
  aiPersonality: AiPersonality;
  autoReply: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  timezone: string;
  whitelistedPhones?: string[];
  blacklistedPhones?: string[];
}

const PERSONALITY_OPTIONS: { id: AiPersonality; label: string; description: string }[] = [
  {
    id: 'professional',
    label: 'Professional',
    description: 'Polished, formal tone suited for corporate clients',
  },
  {
    id: 'friendly',
    label: 'Friendly',
    description: 'Warm, approachable tone that builds rapport',
  },
  {
    id: 'direct',
    label: 'Direct',
    description: 'Brief, to-the-point responses for busy leads',
  },
];

export const AiEmployeeSettings: React.FC = () => {
  const [config, setConfig] = useState<AiEmployeeConfig>({
    aiEmployeeEnabled: false,
    followupAgentMode: 'draft',
    followupAgentAutoSendChannels: ['whatsapp'],
    aiPersonality: 'professional',
    autoReply: false,
    businessHoursStart: '09:00',
    businessHoursEnd: '19:00',
    timezone: 'Asia/Kolkata',
    whitelistedPhones: [],
    blacklistedPhones: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getAiEmployeeConfig()
      .then((data) =>
        setConfig({
          aiEmployeeEnabled: data.aiEmployeeEnabled ?? false,
          followupAgentMode: data.followupAgentMode || 'draft',
          followupAgentAutoSendChannels: data.followupAgentAutoSendChannels || ['whatsapp'],
          aiPersonality: data.aiPersonality || 'professional',
          autoReply: data.autoReply ?? false,
          businessHoursStart: data.businessHoursStart || '09:00',
          businessHoursEnd: data.businessHoursEnd || '19:00',
          timezone: data.timezone || 'Asia/Kolkata',
          whitelistedPhones: data.whitelistedPhones || [],
          blacklistedPhones: data.blacklistedPhones || [],
        })
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    if (config.businessHoursStart && config.businessHoursEnd && config.businessHoursStart >= config.businessHoursEnd) {
      setError('Business hours start must be before end time');
      setSaving(false);
      return;
    }

    try {
      await api.updateAiEmployeeConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (ch: string) => {
    setConfig((prev) => ({
      ...prev,
      followupAgentAutoSendChannels: prev.followupAgentAutoSendChannels.includes(ch)
        ? prev.followupAgentAutoSendChannels.filter((c) => c !== ch)
        : [...prev.followupAgentAutoSendChannels, ch],
    }));
  };

  const validatePhone = (phone: string) => {
    const normalized = phone.replace(/\s/g, '');
    if (!/^\+?[1-9]\d{9,15}$/.test(normalized)) {
      setPhoneError('Invalid phone number format');
      return null;
    }
    // Strip leading + to match backend normalization (digits only)
    return normalized.replace(/^\+/, '');
  };

  const addWhitelistedPhone = () => {
    const normalized = validatePhone(newPhone);
    if (!normalized) return;
    setConfig((prev) => ({
      ...prev,
      whitelistedPhones: [...(prev.whitelistedPhones || []), normalized],
    }));
    setNewPhone('');
    setPhoneError(null);
  };

  const removeWhitelistedPhone = (phone: string) => {
    setConfig((prev) => ({
      ...prev,
      whitelistedPhones: (prev.whitelistedPhones || []).filter((p) => p !== phone),
    }));
  };

  const addBlacklistedPhone = () => {
    const normalized = validatePhone(newPhone);
    if (!normalized) return;
    setConfig((prev) => ({
      ...prev,
      blacklistedPhones: [...(prev.blacklistedPhones || []), normalized],
    }));
    setNewPhone('');
    setPhoneError(null);
  };

  const removeBlacklistedPhone = (phone: string) => {
    setConfig((prev) => ({
      ...prev,
      blacklistedPhones: (prev.blacklistedPhones || []).filter((p) => p !== phone),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">AI Employee Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Configure your AI Employee agents</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Master toggle */}
      <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
        <div>
          <p className="font-medium text-slate-900">Enable AI Employee</p>
          <p className="text-sm text-slate-500 mt-0.5">
            Allow AI agents to qualify leads, route them, and send follow-ups
          </p>
        </div>
        <button
          onClick={() =>
            setConfig((prev) => ({ ...prev, aiEmployeeEnabled: !prev.aiEmployeeEnabled }))
          }
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
            config.aiEmployeeEnabled ? 'bg-[#2563EB]' : 'bg-slate-200'
          }`}
          role="switch"
          aria-checked={config.aiEmployeeEnabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              config.aiEmployeeEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* AI Personality */}
      <div className="space-y-3">
        <label className="block font-medium text-slate-900 text-sm">AI Personality</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PERSONALITY_OPTIONS.map((p) => (
            <button
              key={p.id}
              onClick={() => setConfig((prev) => ({ ...prev, aiPersonality: p.id }))}
              className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                config.aiPersonality === p.id
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
              }`}
            >
              <span className="block font-medium">{p.label}</span>
              <span className={`block text-xs mt-1 ${config.aiPersonality === p.id ? 'text-blue-100' : 'text-slate-500'}`}>
                {p.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Auto-reply */}
      <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
        <div>
          <p className="font-medium text-slate-900">Auto-reply</p>
          <p className="text-sm text-slate-500 mt-0.5">
            AI replies instantly to incoming messages outside business hours
          </p>
        </div>
        <button
          onClick={() => setConfig((prev) => ({ ...prev, autoReply: !prev.autoReply }))}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
            config.autoReply ? 'bg-[#2563EB]' : 'bg-slate-200'
          }`}
          role="switch"
          aria-checked={config.autoReply}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              config.autoReply ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Business hours */}
      <div className="space-y-3">
        <label className="block font-medium text-slate-900 text-sm">Business Hours (optional)</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Start</label>
            <input
              type="time"
              value={config.businessHoursStart}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, businessHoursStart: e.target.value }))
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">End</label>
            <input
              type="time"
              value={config.businessHoursEnd}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, businessHoursEnd: e.target.value }))
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Timezone</label>
          <select
            value={config.timezone}
            onChange={(e) => setConfig((prev) => ({ ...prev, timezone: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2563EB] focus:outline-none bg-white"
          >
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">
          Used by auto-reply to decide when to respond immediately vs. send an away message.
        </p>
      </div>

      {/* Follow-up mode */}
      <div className="space-y-2">
        <label className="block font-medium text-slate-900 text-sm">Follow-up Agent Mode</label>
        <div className="flex gap-3">
          {(['draft', 'autosend'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setConfig((prev) => ({ ...prev, followupAgentMode: mode }))}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                config.followupAgentMode === mode
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
              }`}
            >
              {mode === 'draft' ? 'Draft Mode' : 'Auto-Send'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {config.followupAgentMode === 'draft'
            ? 'AI drafts follow-up messages for your review before sending'
            : 'AI automatically sends follow-up messages (use with caution)'}
        </p>
      </div>

      {/* Auto-send channels — only shown in autosend mode */}
      {config.followupAgentMode === 'autosend' && (
        <div className="space-y-2">
          <label className="block font-medium text-slate-900 text-sm">Auto-send Channels</label>
          <div className="flex gap-3">
            {['whatsapp', 'email'].map((ch) => (
              <button
                key={ch}
                onClick={() => toggleChannel(ch)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  config.followupAgentAutoSendChannels.includes(ch)
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-green-400'
                }`}
              >
                {ch === 'whatsapp' ? 'WhatsApp' : 'Email'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Whitelisted phones */}
      <div className="space-y-3">
        <label className="block font-medium text-slate-900 text-sm">Whitelisted Phone Numbers</label>
        <p className="text-xs text-slate-500">AI will respond to messages from these numbers only</p>
        <div className="flex gap-2">
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => {
              setNewPhone(e.target.value);
              setPhoneError(null);
            }}
            placeholder="+91 98765 43210"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
          />
          <button
            onClick={addWhitelistedPhone}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            Add
          </button>
        </div>
        {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
        <div className="flex flex-wrap gap-2">
          {(config.whitelistedPhones || []).map((phone) => (
            <div key={phone} className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="text-sm text-green-900">{phone}</span>
              <button
                onClick={() => removeWhitelistedPhone(phone)}
                className="text-green-600 hover:text-green-800 font-medium"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Blacklisted phones */}
      <div className="space-y-3">
        <label className="block font-medium text-slate-900 text-sm">Blacklisted Phone Numbers</label>
        <p className="text-xs text-slate-500">AI will ignore messages from these numbers</p>
        <div className="flex gap-2">
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => {
              setNewPhone(e.target.value);
              setPhoneError(null);
            }}
            placeholder="+91 98765 43210"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
          />
          <button
            onClick={addBlacklistedPhone}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(config.blacklistedPhones || []).map((phone) => (
            <div key={phone} className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="text-sm text-red-900">{phone}</span>
              <button
                onClick={() => removeBlacklistedPhone(phone)}
                className="text-red-600 hover:text-red-800 font-medium"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 px-4 bg-[#2563EB] text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
};

export default AiEmployeeSettings;
