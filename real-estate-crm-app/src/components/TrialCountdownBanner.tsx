import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

interface TrialCountdownBannerProps {
  onUpgradeClick?: () => void;
}

export default function TrialCountdownBanner({ onUpgradeClick }: TrialCountdownBannerProps) {
  const { isPaying, isTrialing, trialDaysLeft, loading } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (loading || dismissed || isPaying || !isTrialing || trialDaysLeft > 7) return null;

  const isUrgent = trialDaysLeft <= 3;
  const bgColor = isUrgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
  const textColor = isUrgent ? 'text-red-800' : 'text-amber-800';
  const iconColor = isUrgent ? 'text-red-500' : 'text-amber-500';

  return (
    <div className={`border-b ${bgColor} px-4 py-3`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${iconColor} shrink-0`} />
          <span className={`text-sm font-medium ${textColor}`}>
            {isUrgent
              ? `⚠️ ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left — Upgrade for ₹999/month`
              : `Your trial ends in ${trialDaysLeft} days — upgrade to keep your data.`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onUpgradeClick}
            className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
              isUrgent
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-amber-600 text-white hover:bg-amber-700'
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
