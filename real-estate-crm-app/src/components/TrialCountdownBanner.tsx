import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

interface TrialCountdownBannerProps {
  onUpgradeClick?: () => void;
}

export default function TrialCountdownBanner({ onUpgradeClick }: TrialCountdownBannerProps) {
  const { isPaying, isTrialing, trialDaysLeft, isTrialExpired, gracePeriodActive, loading, subscription } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Reset dismissed state when trial expires
  useEffect(() => {
    if (isTrialExpired && !gracePeriodActive) {
      setDismissed(false);
    }
  }, [isTrialExpired, gracePeriodActive]);

  if (loading || dismissed || isPaying) return null;

  const showExpired = isTrialExpired && !gracePeriodActive;
  const showTrialing = isTrialing && !isTrialExpired;

  if (!showExpired && !showTrialing) return null;

  // Calculate actual days left from trialEndsAt
  const actualDaysLeft = subscription?.trialEndsAt
    ? Math.ceil((new Date(subscription.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : trialDaysLeft;

  // Only surface the banner in the final week of trial (or when expired)
  if (showTrialing && !showExpired && actualDaysLeft > 7) return null;

  const isUrgent = showExpired || actualDaysLeft <= 3;
  const bgColor = isUrgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
  const textColor = isUrgent ? 'text-red-800' : 'text-amber-800';
  const iconColor = isUrgent ? 'text-red-500' : 'text-amber-500';

  const message = showExpired
    ? 'Your trial has expired — upgrade now to keep your data.'
    : isUrgent
      ? `⚠️ ${actualDaysLeft} day${actualDaysLeft !== 1 ? 's' : ''} left — Upgrade for ₹999/month`
      : `${actualDaysLeft} day${actualDaysLeft !== 1 ? 's' : ''} left in trial — Upgrade`;

  return (
    <div className={`border-b ${bgColor} px-4 py-3`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${iconColor} shrink-0`} />
          <span className={`text-sm font-medium ${textColor}`}>
            {message}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onUpgradeClick}
            className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
              isUrgent
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-[#2563EB] text-white hover:bg-blue-700'
            }`}
          >
            Upgrade now →
          </button>
          <button
            onClick={() => setDismissed(true)}
            className={`text-xs ${textColor} opacity-60 hover:opacity-100`}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
