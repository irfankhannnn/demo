import { useState } from 'react';
import { Bot, X } from 'lucide-react';

interface AiEmployeeTrialBannerProps {
  isPurchased: boolean;
  onUpgradeClick?: () => void;
}

export const AiEmployeeTrialBanner: React.FC<AiEmployeeTrialBannerProps> = ({
  isPurchased,
  onUpgradeClick,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (isPurchased || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-brand to-purple-600 text-white rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Bot className="h-6 w-6 flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold text-sm">AI Employee is available for your plan</p>
          <p className="text-xs text-blue-100 mt-0.5">
            Automatically qualify leads, route to the right person, and send follow-ups — powered by AI
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onUpgradeClick}
          className="bg-white text-brand px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors whitespace-nowrap"
        >
          Upgrade Now
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/70 hover:text-white transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default AiEmployeeTrialBanner;
