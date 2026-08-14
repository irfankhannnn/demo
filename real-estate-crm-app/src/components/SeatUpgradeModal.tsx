import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isNativeApp } from '../lib/platform';

/** The real billing route. Previously these links pointed at /billing, which
 *  does not exist and fell through the catch-all to /crm. */
const BILLING_ROUTE = '/crm/settings/billing';

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
  const native = isNativeApp();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 pr-8">
          <h2 className="text-lg font-semibold text-gray-900">
            {isSolo ? 'Seat Limit Reached' : 'Team Seats Full'}
          </h2>
          {/* Mobile builds state the limit without pricing it. Naming a price
              and offering a way to pay is the commerce that App Store guideline
              3.1.1 requires to go through IAP, and that the 3.1.3(b)
              multiplatform exception this app relies on forbids presenting. */}
          <p className="mt-1 text-sm text-gray-600">
            {native
              ? isSolo
                ? "You've reached your 1-seat Solo limit. Seats are managed from your account on a web browser."
                : "You've reached your Team seat limit. Seats are managed from your account on a web browser."
              : isSolo
                ? "You've reached your 1-seat Solo limit. Upgrade to Team for 3 seats — ₹1,999/month."
                : "You've reached your Team seat limit. Add seats at ₹500/month (prorated)."}
          </p>
        </div>

        {native ? (
          <button
            onClick={onClose}
            className="block w-full min-h-[44px] rounded-lg bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Got it
          </button>
        ) : (
          <>
            {options && options.length > 0 ? (
              <div className="space-y-3">
                {options.map((opt) => (
                  <Link
                    key={opt.planId}
                    to={BILLING_ROUTE}
                    onClick={onClose}
                    className="block w-full min-h-[44px] rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                to={BILLING_ROUTE}
                onClick={onClose}
                className="block w-full min-h-[44px] rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                {isSolo ? 'Upgrade to Team' : 'Add 1 seat'}
              </Link>
            )}

            <Link
              to={BILLING_ROUTE}
              onClick={onClose}
              className="mt-3 block text-center text-xs text-gray-500 hover:text-gray-700"
            >
              Manage billing →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
