import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface AiEmployeeConfig {
  aiEmployeeEnabled: boolean;
  followupAgentMode: 'draft' | 'autosend';
  followupAgentAutoSendChannels: string[];
}

export const AiEmployeeSettings: React.FC = () => {
  const [config, setConfig] = useState<AiEmployeeConfig>({
    aiEmployeeEnabled: false,
    followupAgentMode: 'draft',
    followupAgentAutoSendChannels: ['whatsapp'],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getAiEmployeeConfig()
      .then(data =>
        setConfig({
          aiEmployeeEnabled: data.aiEmployeeEnabled ?? false,
          followupAgentMode: data.followupAgentMode || 'draft',
          followupAgentAutoSendChannels: data.followupAgentAutoSendChannels || ['whatsapp'],
        })
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
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
    setConfig(prev => ({
      ...prev,
      followupAgentAutoSendChannels: prev.followupAgentAutoSendChannels.includes(ch)
        ? prev.followupAgentAutoSendChannels.filter(c => c !== ch)
        : [...prev.followupAgentAutoSendChannels, ch],
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
            setConfig(prev => ({ ...prev, aiEmployeeEnabled: !prev.aiEmployeeEnabled }))
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

      {/* Follow-up mode */}
      <div className="space-y-2">
        <label className="block font-medium text-slate-900 text-sm">Follow-up Agent Mode</label>
        <div className="flex gap-3">
          {(['draft', 'autosend'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setConfig(prev => ({ ...prev, followupAgentMode: mode }))}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                config.followupAgentMode === mode
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
              }`}
            >
              {mode === 'draft' ? '📝 Draft Mode' : '🚀 Auto-Send'}
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
            {['whatsapp', 'email'].map(ch => (
              <button
                key={ch}
                onClick={() => toggleChannel(ch)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  config.followupAgentAutoSendChannels.includes(ch)
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-green-400'
                }`}
              >
                {ch === 'whatsapp' ? '📱 WhatsApp' : '📧 Email'}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 px-4 bg-[#2563EB] text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Settings'}
      </button>
    </div>
  );
};

export default AiEmployeeSettings;
