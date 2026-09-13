import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Users, Bot, TrendingDown } from 'lucide-react';
import { getIdToken, getUserProfile } from '../../utils/authStorage';
import { getTenantHeaders } from '../../config/tenant';
import { api } from '../../services/api';
import { useSubscription } from '../../hooks/useSubscription';
import PaywallModal from '../../components/PaywallModal';
import CreditBalanceCard from '../../components/CreditBalanceCard';
import BuyCreditsModal from '../../components/BuyCreditsModal';
import AgentActivityLog from '../../components/AgentActivityLog';
import { isNativeApp } from '../../lib/platform';
import { CRM_API_URL } from '../../config/apiConfig';

const API_URL = CRM_API_URL;

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
  const isNative = isNativeApp();
  const [aiStatus, setAiStatus] = useState<{ status: string; monthlyCost?: number } | null>(null);
  const [creditUsageData, setCreditUsageData] = useState<{ date: string; credits: number }[]>([]);

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
    // Generate mock credit usage data for last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        credits: Math.floor(Math.random() * 100) + 20,
      };
    });
    setCreditUsageData(last7Days);
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
            {/* No top-up entry point on mobile — credit packs are consumable
                digital goods under App Store guideline 3.1.1. The card still
                shows the balance, which is account status rather than commerce. */}
            <CreditBalanceCard
              onBuyCredits={isNative ? undefined : () => setShowBuyCredits(true)}
            />
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

              {isAdmin && !isNative && (
                <button
                  onClick={() => setShowPaywall(true)}
                  className="mt-6 w-full sm:w-auto min-h-[44px] bg-brand text-white font-medium px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {isPaying ? 'Change plan' : 'Upgrade plan'}
                </button>
              )}

              {/* Plain text, no link and no button. Apple's anti-steering rules
                  apply on the India storefront, so pointing at the web checkout
                  is itself a risk under guideline 3.1.3. */}
              {isAdmin && isNative && (
                <p className="mt-6 text-sm text-slate-500">
                  Plans are managed from your account on a web browser.
                </p>
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
                    aiStatus?.status === 'live' ? 'bg-brand' : 'bg-slate-100'
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

        {/* Payment History */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment History</h2>
          <p className="text-sm text-slate-500 mb-4">View your past payments and download invoices.</p>
          <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4">
            Payment history will be available here once you make your first payment.
          </div>
        </div>

        {/* Seat Management */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Manage Seats</h2>
          <p className="text-sm text-slate-500 mb-4">Add or remove team members from your plan.</p>
          <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4">
            Seat management will be available once you have an active subscription.
          </div>
        </div>

        {/* Credit Usage Analytics */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Credit Usage (Last 7 Days)</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-2 h-40 bg-slate-50 rounded-lg p-4">
              {creditUsageData.map((day, idx) => {
                const maxCredits = Math.max(...creditUsageData.map(d => d.credits), 100);
                const height = (day.credits / maxCredits) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-brand rounded-t" style={{ height: `${height}%`, minHeight: '4px' }} title={`${day.credits} credits`} />
                    <span className="text-xs text-slate-500 text-center">{day.date}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-500 text-xs">Total (7 days)</p>
                <p className="text-lg font-semibold text-slate-900">{creditUsageData.reduce((sum, d) => sum + d.credits, 0)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-500 text-xs">Daily Average</p>
                <p className="text-lg font-semibold text-slate-900">{Math.round(creditUsageData.reduce((sum, d) => sum + d.credits, 0) / creditUsageData.length)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-500 text-xs">Peak Day</p>
                <p className="text-lg font-semibold text-slate-900">{Math.max(...creditUsageData.map(d => d.credits))}</p>
              </div>
            </div>
          </div>
        </div>
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
