import { X } from 'lucide-react';

interface UpgradeOption {
  planId: string;
  label: string;
  price: number;
}

interface SeatUpgradeModalProps {
  open: boolean;
  options: UpgradeOption[] | null;
  tier?: string;
  onClose: () => void;
}

export default function SeatUpgradeModal({ open, options, tier, onClose }: SeatUpgradeModalProps) {
  if (!open) return null;

  const isSolo = tier === 'solo';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isSolo ? 'Seat Limit Reached' : 'Team Seats Full'}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {isSolo
              ? "You've reached your 1-seat Solo limit. Upgrade to Team for 3 seats — ₹1,999/month."
              : "You've reached your Team seat limit. Add seats at ₹500/month (prorated)."}
          </p>
        </div>

        {options && options.length > 0 ? (
          <div className="space-y-3">
            {options.map((opt) => (
              <a
                key={opt.planId}
                href="/billing"
                className="block w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                {opt.label}
              </a>
            ))}
          </div>
        ) : (
          <a
            href="/billing"
            className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {isSolo ? 'Upgrade to Team' : 'Add 1 seat'}
          </a>
        )}

        <a
          href="/billing"
          className="mt-3 block text-center text-xs text-gray-500 hover:text-gray-700"
        >
          Manage billing →
        </a>
      </div>
    </div>
  );
}
