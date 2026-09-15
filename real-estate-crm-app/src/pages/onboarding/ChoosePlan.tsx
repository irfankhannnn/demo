import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info } from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';
import { trackEvent } from '../../lib/analytics';
import { PLAN_TIERS, PlanTierId, SIGNUP_PLAN_KEY, isPlanTierId, planPrice } from '../../lib/plans';

const TRIAL_DAYS = 14;

function initialPlan(): PlanTierId {
  const stored = sessionStorage.getItem(SIGNUP_PLAN_KEY);
  if (isPlanTierId(stored)) return stored;
  return PLAN_TIERS.find((t) => t.popular)?.id ?? 'solo';
}

export default function ChoosePlan() {
  const navigate = useNavigate();
  const { refetch } = useSubscription();
  const [selected, setSelected] = useState<PlanTierId>(initialPlan);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [buyNoticeFor, setBuyNoticeFor] = useState<PlanTierId | null>(null);
  const [starting, setStarting] = useState(false);

  const selectedTier = PLAN_TIERS.find((t) => t.id === selected)!;

  const handleBuy = (tierId: PlanTierId) => {
    setSelected(tierId);
    setBuyNoticeFor(tierId);
    trackEvent('onboarding_plan_buy_clicked', { tier: tierId, billingCycle });
  };

  const handleStartTrial = async () => {
    setStarting(true);
    trackEvent('onboarding_trial_started', { plan_intent: selected, billingCycle });
    // trial-status creates the trial on first call for a new tenant.
    await refetch();
    sessionStorage.removeItem(SIGNUP_PLAN_KEY);
    navigate('/admin/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100 flex items-center justify-center p-4">
      <div className="relative glass-premium rounded-3xl w-full max-w-5xl p-6 sm:p-10 shadow-2xl shadow-black/5">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2">Step 3 of 3</p>
          <h1 className="text-[26px] font-bold text-slate-900 mb-1.5 tracking-tight">Choose your plan</h1>
          <p className="text-slate-500 text-[15px]">
            Every plan starts with a {TRIAL_DAYS}-day free trial. No card needed to start.
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-slate-100 rounded-full p-1">
            {(['monthly', 'annual'] as const).map((cycle) => (
              <button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  billingCycle === cycle ? 'bg-indigo-600 text-white shadow' : 'text-slate-600'
                }`}
              >
                {cycle === 'monthly' ? 'Monthly' : 'Annual'}
                {cycle === 'annual' && <span className="ml-1 text-xs text-emerald-500">Save 20%</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-6">
          {PLAN_TIERS.map((tier) => {
            const isSelected = tier.id === selected;
            return (
              <div
                key={tier.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(tier.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(tier.id)}
                className={`relative rounded-2xl p-6 text-left cursor-pointer transition-all bg-white ${
                  isSelected
                    ? 'border-2 border-indigo-600 shadow-lg shadow-indigo-500/10'
                    : 'border border-slate-200 hover:border-indigo-300'
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-4 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                    Most popular
                  </span>
                )}
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold text-slate-900">{tier.name}</h3>
                  {isSelected && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600">
                      <Check className="h-4 w-4 text-white" />
                    </span>
                  )}
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-indigo-600">₹{planPrice(tier.monthly, billingCycle)}</span>
                  <span className="text-slate-400 text-sm">/mo</span>
                </div>
                <ul className="space-y-2 text-sm text-slate-600 mb-6">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="h-4 w-4 flex-shrink-0 text-emerald-500 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBuy(tier.id);
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Buy {tier.name}
                </button>
              </div>
            );
          })}
        </div>

        {buyNoticeFor && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p>
              Online payment is coming soon. Start your free trial on the{' '}
              <strong>{PLAN_TIERS.find((t) => t.id === buyNoticeFor)?.name}</strong> plan now, and upgrade anytime from
              Settings → Billing.
            </p>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleStartTrial}
            disabled={starting}
            className="w-full sm:w-auto sm:min-w-[320px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-8 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg"
          >
            {starting ? 'Starting your trial…' : `Start ${TRIAL_DAYS}-day free trial on ${selectedTier.name}`}
          </button>
          <p className="text-xs text-slate-500">Skip payment for now. You won't be charged during the trial.</p>
        </div>
      </div>
    </div>
  );
}
