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
  /** AI follow-up calls (followup-agent-service), CONTRACTS.md section 6. */
  followupCallsEnabled: boolean;
  followupCallOnNewInstagramLead: boolean;
  followupMaxAttempts: number;
  followupRetryGapMinutes: number;
  followupPostVisitDelayMinutes: number;
  followupEscalationUserIds: string[];
}

/** Team member as returned by GET /api/crm/leads/agents. */
interface FollowupContact {
  userId: string;
  username: string;
  label?: string;
  role?: string;
}

type FollowupNumberKey = 'followupMaxAttempts' | 'followupRetryGapMinutes' | 'followupPostVisitDelayMinutes';

const FOLLOWUP_NUMBER_FIELDS: { key: FollowupNumberKey; label: string; min: number; max: number; hint: string }[] = [
  { key: 'followupMaxAttempts', label: 'Max call attempts', min: 1, max: 5, hint: 'Dials per follow-up before escalating to a human' },
  { key: 'followupRetryGapMinutes', label: 'Retry gap (minutes)', min: 10, max: 240, hint: 'Wait between attempts when the lead does not pick up' },
  { key: 'followupPostVisitDelayMinutes', label: 'Post-visit call delay (minutes)', min: 0, max: 1440, hint: 'How long after a completed site visit the feedback call is placed' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-brand' : 'bg-slate-200'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
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
    followupCallsEnabled: true,
    followupCallOnNewInstagramLead: false,
    followupMaxAttempts: 2,
    followupRetryGapMinutes: 45,
    followupPostVisitDelayMinutes: 120,
    followupEscalationUserIds: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  // null = members list not available on this deployment -> comma-separated fallback
  const [teamMembers, setTeamMembers] = useState<FollowupContact[] | null>(null);
  const [escalationInput, setEscalationInput] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .getAiEmployeeConfig()
      .then((data) => {
        const escalationIds: string[] = Array.isArray(data.followupEscalationUserIds)
          ? data.followupEscalationUserIds.map(String)
          : [];
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
          // Contract default: on when the AI employee is on.
          followupCallsEnabled: data.followupCallsEnabled ?? (data.aiEmployeeEnabled ?? false),
          followupCallOnNewInstagramLead: data.followupCallOnNewInstagramLead ?? false,
          followupMaxAttempts: Number(data.followupMaxAttempts ?? 2),
          followupRetryGapMinutes: Number(data.followupRetryGapMinutes ?? 45),
          followupPostVisitDelayMinutes: Number(data.followupPostVisitDelayMinutes ?? 120),
          followupEscalationUserIds: escalationIds,
        });
        setEscalationInput(escalationIds.join(', '));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Team members for the escalation picker. If the agents route is not
  // available, the picker falls back to a comma-separated list of user ids.
  useEffect(() => {
    api
      .getLeadAgents()
      .then((list) => setTeamMembers(Array.isArray(list) ? list : []))
      .catch(() => setTeamMembers(null));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    if (config.businessHoursStart && config.businessHoursEnd && config.businessHoursStart >= config.businessHoursEnd) {
      setError('Business hours start must be before end time');
      setSaving(false);
      return;
    }

    const outOfRange = FOLLOWUP_NUMBER_FIELDS.find(
      (f) => !Number.isInteger(config[f.key]) || config[f.key] < f.min || config[f.key] > f.max,
    );
    if (outOfRange) {
      setError(`${outOfRange.label} must be a whole number between ${outOfRange.min} and ${outOfRange.max}`);
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

  const toggleEscalationUser = (userId: string) => {
    setConfig((prev) => ({
      ...prev,
      followupEscalationUserIds: prev.followupEscalationUserIds.includes(userId)
        ? prev.followupEscalationUserIds.filter((u) => u !== userId)
        : [...prev.followupEscalationUserIds, userId],
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
            config.aiEmployeeEnabled ? 'bg-brand' : 'bg-slate-200'
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
                  ? 'bg-brand text-white border-brand'
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
            config.autoReply ? 'bg-brand' : 'bg-slate-200'
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
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
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
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Timezone</label>
          <select
            value={config.timezone}
            onChange={(e) => setConfig((prev) => ({ ...prev, timezone: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none bg-white"
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
                  ? 'bg-brand text-white border-brand'
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

      {/* AI follow-up calls (followup-agent-service) */}
      <div className="space-y-4 border border-slate-200 rounded-lg p-4">
        <div>
          <h3 className="font-medium text-slate-900 text-sm">AI Follow-up Calls</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            The voice agent calls leads to confirm site visits and collect post-visit feedback, inside the business hours above.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Enable follow-up calls</p>
            <p className="text-xs text-slate-500 mt-0.5">Allow the AI agent to place outbound follow-up calls</p>
          </div>
          <Toggle
            checked={config.followupCallsEnabled}
            onChange={() => setConfig((prev) => ({ ...prev, followupCallsEnabled: !prev.followupCallsEnabled }))}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Call every new Instagram lead</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Schedule a confirmation call as soon as an Instagram lead with a phone number arrives
            </p>
          </div>
          <Toggle
            checked={config.followupCallOnNewInstagramLead}
            onChange={() =>
              setConfig((prev) => ({ ...prev, followupCallOnNewInstagramLead: !prev.followupCallOnNewInstagramLead }))
            }
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FOLLOWUP_NUMBER_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-slate-500 mb-1">
                {f.label} ({f.min}-{f.max})
              </label>
              <input
                type="number"
                min={f.min}
                max={f.max}
                step={1}
                value={Number.isNaN(config[f.key]) ? '' : config[f.key]}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, [f.key]: e.target.value === '' ? NaN : Number(e.target.value) }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">{f.hint}</p>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Escalation contacts</label>
          <p className="text-[11px] text-slate-400 mb-2">
            Notified (in-app, email, WhatsApp) when the agent cannot reach a lead or a call needs a human. The lead's
            assignee is always included.
          </p>
          {teamMembers && teamMembers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {teamMembers.map((m) => {
                const selected = config.followupEscalationUserIds.includes(m.userId);
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => toggleEscalationUser(m.userId)}
                    aria-pressed={selected}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      selected
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    {m.label || m.username}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              type="text"
              value={escalationInput}
              onChange={(e) => {
                const raw = e.target.value;
                setEscalationInput(raw);
                setConfig((prev) => ({
                  ...prev,
                  followupEscalationUserIds: raw
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }));
              }}
              placeholder="User ids, comma-separated"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
            />
          )}
        </div>
      </div>

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
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
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
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
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
        className="w-full py-2.5 px-4 bg-brand text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
};

export default AiEmployeeSettings;
