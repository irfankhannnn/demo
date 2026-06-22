import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Users, Bot } from 'lucide-react';
import { getIdToken, getUserProfile } from '../../utils/authStorage';
import { getTenantHeaders } from '../../config/tenant';
import { api } from '../../services/api';
import { useSubscription } from '../../hooks/useSubscription';
import PaywallModal from '../../components/PaywallModal';
import CreditBalanceCard from '../../components/CreditBalanceCard';
import BuyCreditsModal from '../../components/BuyCreditsModal';
import AgentActivityLog from '../../components/AgentActivityLog';

const API_URL = import.meta.env.VITE_API_URL as string;

interface SubscriptionDetails {
  plan: string;
  paymentStatus: string;
  seatsPaid: number;
  seatsUsed: number;
  trialEndsAt?: string;
  nextBillingDate?: string;
  isPaying?: boolean;
  gracePeriodActive?: boolean;
}

export default function BillingSettings() {
  const profile = getUserProfile();
  const isAdmin = profile?.role === 'ADMIN';
  const { trialDaysLeft, isTrialing, isPaying } = useSubscription();

  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ status: string; monthlyCost?: number } | null>(null);

  const loadSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const idToken = getIdToken();
      if (!idToken) {
        setError('Not authenticated');
        return;
      }

      const [res, aiStatusData] = await Promise.all([
        fetch(`${API_URL}/subscriptions/current`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
            ...getTenantHeaders(),
          },
        }),
        api.getAiEmployeeProvisioningStatus().catch((err) => {
          console.warn('[BillingSettings] AI status fetch failed:', err);
          return null;
        }),
      ]);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error('Your session has expired. Please log in again.');
        } else if (res.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        } else {
          throw new Error(err.message || err.error || 'Failed to load subscription');
        }
      }

      setSubscription(await res.json());
      setAiStatus(aiStatusData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const planLabel = (plan?: string) => {
    const labels: Record<string, string> = {
      solo: 'Solo',
      team: 'Team',
      teamplus: 'Team+',
      free: 'Free Trial',
    };
    return labels[plan || ''] || plan || '—';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to="/crm"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CRM
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Billing & Plan</h1>
        <p className="text-slate-600 mb-8">View your current plan, seats, and trial status.</p>

        {loading && (
          <div className="text-center py-12 text-slate-500">Loading subscription...</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {subscription && !loading && (
          <div className="space-y-6">
            <CreditBalanceCard onBuyCredits={() => setShowBuyCredits(true)} />
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                    <CreditCard className="h-4 w-4" />
                    Current Plan
                  </div>
                  <p className="text-2xl font-semibold text-slate-900">{planLabel(subscription.plan)}</p>
                  <p className="text-sm text-slate-500 mt-1 capitalize">
                    Status: {subscription.paymentStatus?.replace('_', ' ') || '—'}
                  </p>
                </div>
                {isTrialing && !isPaying && (
                  <span className="bg-amber-100 text-amber-800 text-xs font-medium px-3 py-1 rounded-full">
                    {trialDaysLeft} days left in trial
                  </span>
                )}
              </div>

              <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500">Trial ends</dt>
                  <dd className="font-medium text-slate-900">{formatDate(subscription.trialEndsAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Next billing date</dt>
                  <dd className="font-medium text-slate-900">{formatDate(subscription.nextBillingDate)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    Seats used
                  </dt>
                  <dd className="font-medium text-slate-900">
                    {subscription.seatsUsed ?? 0} / {subscription.seatsPaid ?? 0}
                  </dd>
                </div>
              </dl>

              {isAdmin && (
                <button
                  onClick={() => setShowPaywall(true)}
                  className="mt-6 w-full sm:w-auto bg-[#2563EB] text-white font-medium px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {isPaying ? 'Change plan' : 'Upgrade plan'}
                </button>
              )}

              {!isAdmin && (
                <p className="mt-6 text-sm text-slate-500">
                  Contact your admin to change the plan or upgrade.
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                    aiStatus?.status === 'live' ? 'bg-[#2563EB]' : 'bg-slate-100'
                  }`}>
                    <Bot className={`h-6 w-6 ${aiStatus?.status === 'live' ? 'text-white' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <div className="text-slate-500 text-sm mb-1">AI Employee</div>
                    <p className="text-lg font-semibold text-slate-900">
                      {aiStatus?.status === 'live' ? 'Live' : aiStatus?.status === 'suspended' ? 'Suspended' : 'Not provisioned'}
                    </p>
                    {aiStatus?.monthlyCost !== undefined && (
                      <p className="text-sm text-slate-500 mt-1">
                        ₹{aiStatus.monthlyCost.toLocaleString('en-IN')}/month
                      </p>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                  aiStatus?.status === 'live'
                    ? 'bg-green-100 text-green-700'
                    : aiStatus?.status === 'suspended'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {aiStatus?.status === 'live' ? 'Active' : aiStatus?.status === 'suspended' ? 'Suspended' : 'Pending'}
                </span>
              </div>
              {aiStatus?.status === 'live' && (
                <p className="mt-4 text-sm text-slate-500">
                  Your AI Employee is active and using credits from your balance. Manage settings from the AI Employee page.
                </p>
              )}
              {aiStatus?.status !== 'live' && (
                <p className="mt-4 text-sm text-slate-500">
                  Activate AI Employee to automate lead qualification, routing, and follow-ups.
                </p>
              )}
            </div>

            <AgentActivityLog />
          </div>
        )}
      </div>

      <PaywallModal
        forceOpen={showPaywall}
        onClose={() => {
          setShowPaywall(false);
          loadSubscription();
        }}
      />
      <BuyCreditsModal forceOpen={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
    </div>
  );
}
