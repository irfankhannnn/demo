import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bot } from 'lucide-react';
import { AiEmployeeSettings } from '../../components/AiEmployeeSettings';
import { AgentActivityLog } from '../../components/AgentActivityLog';
import { AiEmployeeTrialBanner } from '../../components/AiEmployeeTrialBanner';
import { api } from '../../services/api';

type Tab = 'settings' | 'activity';

const TABS: { id: Tab; label: string }[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'activity', label: 'Activity Log' },
];

export default function AiEmployeePage() {
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [isPurchased, setIsPurchased] = useState(false);

  useEffect(() => {
    api
      .getAiEmployeeConfig()
      .then(data => setIsPurchased(data.aiEmployeeEnabled === true))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          to="/crm"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CRM
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Bot className="h-6 w-6 text-[#2563EB]" />
          <h1 className="text-2xl font-bold text-slate-900">AI Employee</h1>
        </div>
        <p className="text-slate-500 mb-6">Manage your AI-powered CRM automation</p>

        <AiEmployeeTrialBanner
          isPurchased={isPurchased}
          onUpgradeClick={() => (window.location.href = '/crm/settings/billing')}
        />

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'settings' && <AiEmployeeSettings />}
        {activeTab === 'activity' && <AgentActivityLog />}
      </div>
    </div>
  );
}
