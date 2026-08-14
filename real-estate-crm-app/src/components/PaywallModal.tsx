import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { openCheckout } from '../lib/razorpay';
import { trackEvent } from '../lib/analytics';
import { isNativeApp } from '../lib/platform';
import { clearAuth } from '../utils/authStorage';

/** Support contact. The link is hidden entirely when this is not configured. */
const SUPPORT_WHATSAPP = import.meta.env.VITE_SUPPORT_WHATSAPP || '';

const DATA_SAFETY_COPY =
  'Your data is safe. After trial expiry, you have a 7-day grace period. After that, ' +
  'your account is read-only for 30 days. Data is never deleted without explicit request.';

const PAYWALL_WHITELIST = ['/profile', '/crm/settings/billing', '/legal', '/grievance', '/integrations/ai-employee'];

const TIERS = [
  {
    id: 'solo',
    name: 'Solo',
    monthly: 999,
    features: ['1 member', 'Unlimited properties', 'Full CRM + Khata', 'GST invoicing', 'Free onboarding'],
    cta: 'Start Solo',
    popular: false,
  },
  {
    id: 'team',
    name: 'Team',
    monthly: 1999,
    features: ['Up to 3 members', 'Everything in Solo', 'Multi-agent hierarchy', 'Shared Khata', 'Member reports'],
    cta: 'Start Team',
    popular: true,
  },
  {
    id: 'teamplus',
    name: 'Team+',
    monthly: 4999,
    features: ['Up to 10 members', 'Everything in Team', 'Dedicated CSM', 'Priority support', 'Custom onboarding'],
    cta: 'Start Team+',
    popular: false,
  },
];

interface PaywallModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

/**
 * Trial-expired notice for the mobile builds.
 *
 * Presents no commerce whatsoever: no prices, no plan cards, no checkout, and
 * deliberately no link or button pointing at the web checkout. App Store
 * guideline 3.1.1 treats an in-app purchase path as requiring IAP, and the
 * 3.1.3(b) multiplatform exception this app relies on holds only while no
 * commerce is presented in the app at all. Apple's anti-steering rules still
 * apply on the India storefront, so even a plain URL is a risk.
 *
 * Includes a sign-out because the paywall is otherwise inescapable on mobile:
 * `shouldShow` is derived from trial state rather than local state, so
 * dismissing it simply re-opens it. An app the reviewer cannot get out of
 * reads as broken, which is its own rejection under guideline 2.1.
 */
function NativeTrialEndedNotice({ onClose }: { onClose?: () => void }) {
  const handleSignOut = () => {
    clearAuth();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 my-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Your trial has ended</h2>
        <p className="text-gray-600 mb-4">
          RealEstateFlow is read-only until your account has an active plan. Plans are
          managed from your account on a web browser.
        </p>
        <p className="text-sm text-gray-500 mb-6">{DATA_SAFETY_COPY}</p>

        <button
          onClick={handleSignOut}
          className="w-full py-3 min-h-[44px] rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function PaywallModal({ forceOpen, onClose }: PaywallModalProps) {
  const { isTrialExpired, isPaying, subscription, refetch } = useSubscription();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [includeAI, setIncludeAI] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const isWhitelisted = PAYWALL_WHITELIST.includes(window.location.pathname);
  const shouldShow = forceOpen || (isTrialExpired && !isPaying && subscription?.gracePeriodActive !== true && !isWhitelisted);

  useEffect(() => {
    if (shouldShow) {
      trackEvent('trial_paywall_shown', {
        plan: subscription?.plan,
        forced: Boolean(forceOpen),
      });
    }
  }, [shouldShow, forceOpen, subscription?.plan]);

  if (!shouldShow) return null;

  if (isNativeApp()) return <NativeTrialEndedNotice onClose={onClose} />;

  const getPrice = (monthly: number) => {
    if (billingCycle === 'annual') return Math.round(monthly * 0.8);
    return monthly;
  };

  const handleCheckout = async (tierId: string) => {
    setCheckoutLoading(tierId);
    trackEvent('trial_paywall_clicked', {
      tier: tierId,
      billingCycle,
      includeAI,
    });
    try {
      const planSuffix = billingCycle === 'annual' ? '_annual' : '_monthly';
      await openCheckout({
        planId: `plan_${tierId}${planSuffix}`,
        name: 'User',
        email: '',
        onSuccess: () => {
          refetch();
          onClose?.();
        },
        onFailure: () => {
          setCheckoutLoading(null);
        },
        onDismiss: () => {
          setCheckoutLoading(null);
        },
      });
    } catch {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-8 my-8">
        {onClose && (
          <button onClick={onClose} className="absolute right-4 top-4 p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your trial has ended — pick a plan to continue</h2>
          <p className="text-gray-600">All plans include 30-day money-back guarantee. GST invoices included.</p>
        </div>

        {/* AI Employee toggle */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAI}
              onChange={(e) => setIncludeAI(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">Add AI Employee — ₹7,999/mo</span>
          </label>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly' ? 'bg-blue-600 text-white' : 'text-gray-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'annual' ? 'bg-blue-600 text-white' : 'text-gray-600'
              }`}
            >
              Annual <span className="text-green-500 text-xs">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-2xl p-6 ${
                tier.popular ? 'border-2 border-blue-600 relative' : 'border border-gray-200'
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-4 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-bold mb-1">{tier.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-blue-600">₹{getPrice(tier.monthly)}</span>
                <span className="text-gray-400 text-sm">/mo</span>
              </div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                {tier.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(tier.id)}
                disabled={checkoutLoading !== null}
                className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${
                  tier.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                {checkoutLoading === tier.id ? 'Loading...' : tier.cta}
              </button>
            </div>
          ))}
        </div>

        {includeAI && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
            AI Employee (₹7,999/mo) includes concierge setup within 24 hours. After payment, you'll be redirected to configure WhatsApp integration.
          </div>
        )}

        {/* FAQ */}
        <div className="border-t pt-4">
          <button
            onClick={() => setFaqOpen(!faqOpen)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            {faqOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            What happens to my data?
          </button>
          {faqOpen && (
            <p className="mt-2 text-sm text-gray-600">
              {DATA_SAFETY_COPY}
              {SUPPORT_WHATSAPP && (
                <>
                  {' '}Need help?{' '}
                  <a
                    href={`https://wa.me/${SUPPORT_WHATSAPP}`}
                    className="text-blue-600 hover:underline"
                  >
                    WhatsApp us
                  </a>
                  .
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
