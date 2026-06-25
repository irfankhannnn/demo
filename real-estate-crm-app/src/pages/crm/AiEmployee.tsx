import { useState, useEffect, useMemo } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  MessageSquare,
  Zap,
  Power,
  RefreshCw,
  Smartphone,
  CreditCard,
  Settings,
  BarChart3,
  Send,
  ChevronRight,
} from 'lucide-react';
import { AiEmployeeSettings } from '../../components/AiEmployeeSettings';
import { AgentActivityLog } from '../../components/AgentActivityLog';
import { AiEmployeeTrialBanner } from '../../components/AiEmployeeTrialBanner';
import { api } from '../../services/api';
import { getUserProfile } from '../../utils/authStorage';
import type { AgentLogItem } from '../../components/AgentActivityLog';

type Tab = 'dashboard' | 'activity' | 'settings';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'activity', label: 'Activity Log', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const ADMIN_ROLES = ['ADMIN', 'FOUNDER', 'OWNER'];

interface DashboardStats {
  messagesProcessed: number;
  leadsCreated: number;
  creditsUsed: number;
}

export default function AiEmployeePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isPurchased, setIsPurchased] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    messagesProcessed: 0,
    leadsCreated: 0,
    creditsUsed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const profile = getUserProfile();
  const isAdmin = profile?.role ? ADMIN_ROLES.includes(profile.role) : false;

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [statusData, configData, activityData] = await Promise.all([
        api.getAiEmployeeProvisioningStatus().catch(() => ({ status: 'not_purchased' })),
        api.getAiEmployeeConfig().catch(() => ({ aiEmployeeEnabled: false })),
        api.getAgentActivity({ limit: 100 }).catch(() => ({ activities: [] })),
      ]);

      setIsPurchased(statusData?.status === 'live');
      setAiEnabled(!!configData?.aiEmployeeEnabled);

      const connectedPhone = configData?.connectedWhatsAppPhone;
      if (connectedPhone) {
        try {
          const status = await api.getWhatsAppConnectionStatus(connectedPhone);
          setWhatsappConnected(status.connected);
        } catch {
          setWhatsappConnected(false);
        }
      } else {
        setWhatsappConnected(false);
      }

      const activities: AgentLogItem[] =
        activityData?.activities || activityData?.items || [];
      const today = new Date().toISOString().slice(0, 10);
      const todays = activities.filter((a) =>
        (a.createdAt || '').slice(0, 10) === today
      );

      setStats({
        messagesProcessed: todays.filter((a) =>
          ['whatsapp_message', 'message_processed', 'incoming_message'].some((k) =>
            (a.action || '').toLowerCase().includes(k.replace('_', ' '))
          )
        ).length,
        leadsCreated: todays.filter((a) =>
          ['lead_created', 'create_lead', 'qualifier'].some((k) =>
            (a.action || '').toLowerCase().includes(k.replace('_', ' '))
          )
        ).length,
        creditsUsed: todays.reduce((sum, a) => sum + (a.creditsCharged || 0), 0),
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAi = async () => {
    setToggling(true);
    try {
      const next = !aiEnabled;
      await api.updateAiEmployeeConfig({ aiEmployeeEnabled: next });
      setAiEnabled(next);
    } catch (err) {
      console.error('Failed to toggle AI Employee', err);
    } finally {
      setToggling(false);
    }
  };

  const handleTestMessage = async () => {
    setSendingTest(true);
    try {
      await api.sendTestAiMessage?.();
    } catch {
      // Optional endpoint; ignore if absent
    } finally {
      setSendingTest(false);
    }
  };

  const statusCard = useMemo(
    () => (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                aiEnabled ? 'bg-[#2563EB]' : 'bg-slate-200'
              }`}
            >
              <Bot className={`h-7 w-7 ${aiEnabled ? 'text-white' : 'text-slate-500'}`} />
            </div>
            <div>
              <p className="text-sm text-slate-500">AI Employee</p>
              <p className={`text-xl font-bold ${aiEnabled ? 'text-[#2563EB]' : 'text-slate-700'}`}>
                {aiEnabled ? 'Enabled' : 'Disabled'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {isPurchased ? 'Subscription active' : 'Not provisioned'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleAi}
            disabled={toggling || !isPurchased}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
              aiEnabled ? 'bg-[#2563EB]' : 'bg-slate-300'
            } disabled:opacity-50`}
            role="switch"
            aria-checked={aiEnabled}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                aiEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    ),
    [aiEnabled, toggling, isPurchased]
  );

  const whatsappCard = useMemo(
    () => (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                whatsappConnected ? 'bg-green-100' : 'bg-slate-100'
              }`}
            >
              <Smartphone
                className={`h-7 w-7 ${whatsappConnected ? 'text-green-600' : 'text-slate-500'}`}
              />
            </div>
            <div>
              <p className="text-sm text-slate-500">WhatsApp</p>
              <p className={`text-xl font-bold ${whatsappConnected ? 'text-green-600' : 'text-slate-700'}`}>
                {whatsappConnected ? 'Connected' : 'Not connected'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {whatsappConnected
                  ? 'AI can receive and reply to messages'
                  : 'Connect WhatsApp to activate AI inbox'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/crm/whatsapp-inbox')}
            className="flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:text-blue-700"
          >
            Inbox
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    ),
    [whatsappConnected, navigate]
  );

  if (!isAdmin) {
    return <Navigate to="/crm" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
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
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-[#2563EB] text-[#2563EB]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12 text-slate-500">Loading dashboard...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {statusCard}
                  {whatsappCard}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-[#2563EB]" />
                      <h3 className="font-semibold text-slate-900">Today's Stats</h3>
                    </div>
                    <span className="text-xs text-slate-400">{new Date().toDateString()}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-sm text-slate-500">Messages processed</p>
                      <p className="text-2xl font-bold text-slate-900">{stats.messagesProcessed}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-sm text-slate-500">Leads created</p>
                      <p className="text-2xl font-bold text-slate-900">{stats.leadsCreated}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-sm text-slate-500">Credits used</p>
                      <p className="text-2xl font-bold text-slate-900">{stats.creditsUsed}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Power className="h-5 w-5 text-[#2563EB]" />
                    Quick Actions
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleToggleAi}
                      disabled={toggling || !isPurchased}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                        aiEnabled
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          : 'bg-[#2563EB] text-white hover:bg-blue-700'
                      } disabled:opacity-50`}
                    >
                      <Power className="h-4 w-4" />
                      {aiEnabled ? 'Disable AI Employee' : 'Enable AI Employee'}
                    </button>
                    <button
                      onClick={handleTestMessage}
                      disabled={sendingTest || !aiEnabled}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <Send className="h-4 w-4" />
                      {sendingTest ? 'Sending...' : 'Send Test Message'}
                    </button>
                    <button
                      onClick={loadDashboard}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            <AgentActivityLog
              showFilters
              showConversationLinks
              showSummary
              onJumpToInbox={(phone) => navigate(`/crm/whatsapp-inbox?phone=${encodeURIComponent(phone)}`)}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <AiEmployeeSettings />

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#2563EB]" />
                Billing & Credits
              </h3>
              <p className="text-sm text-slate-500 mb-3">
                AI Employee usage consumes credits from your monthly balance. You can add more
                credits from the Billing page.
              </p>
              <button
                onClick={() => navigate('/crm/settings/billing')}
                className="text-sm font-medium text-[#2563EB] hover:text-blue-700"
              >
                Go to Billing →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
