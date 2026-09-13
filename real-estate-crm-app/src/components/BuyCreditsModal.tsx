import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getIdToken, getUserProfile } from '../utils/authStorage';
import { getTenantHeaders } from '../config/tenant';
import { openCheckout } from '../lib/razorpay';
import { useCredits } from '../hooks/useCredits';
import { isNativeApp } from '../lib/platform';
import { CRM_API_URL } from '../config/apiConfig';

const API_URL = CRM_API_URL;

interface BuyCreditsModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const PACK_OPTIONS = [
  { id: 'pack_500', label: '500 credits', price: '₹499' },
  { id: 'pack_2000', label: '2,000 credits', price: '₹1,799' },
  { id: 'pack_5000', label: '5,000 credits', price: '₹3,999' },
];

export default function BuyCreditsModal({ forceOpen, onClose }: BuyCreditsModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { refetch } = useCredits();
  const profile = getUserProfile();

  const isOpen = forceOpen ?? open;

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const handlePurchase = async (packId: string) => {
    setLoading(packId);
    setError('');
    try {
      const idToken = getIdToken();
      const res = await fetch(`${API_URL}/subscriptions/credits/purchase`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
          ...getTenantHeaders(),
        },
        body: JSON.stringify({ packId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 402) {
          throw new Error('Insufficient credits to process this request');
        }
        throw new Error(err.error || `Failed to create order (${res.status})`);
      }

      const data = await res.json();
      if (!data.orderId || !data.amount) {
        throw new Error('Invalid response from server');
      }

      const { orderId, amount } = data;

      await openCheckout({
        orderId,
        amount,
        name: profile?.displayName || 'User',
        email: profile?.email || '',
        phone: profile?.phoneNumber,
        onSuccess: () => {
          refetch();
          handleClose();
        },
        onFailure: (err) => setError(err?.error?.description || 'Payment failed'),
        onDismiss: () => setLoading(null),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setLoading(null);
    }
  };

  if (!isOpen) return null;

  // Mobile builds sell nothing. Credit packs are consumable digital goods, the
  // clearest possible case of App Store guideline 3.1.1 requiring IAP, so the
  // native path states the balance problem and names no packs and no prices.
  if (isNativeApp()) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Out of credits</h2>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-slate-600 mb-6">
            You have no credits left, so new records and AI features are paused.
            Credits are topped up from your account on a web browser.
          </p>
          <button
            onClick={handleClose}
            className="w-full min-h-[44px] rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Buy Credits</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <p className="text-sm text-slate-600 mb-4">
          Top up your credit balance to continue creating records and using AI features.
        </p>

        <div className="space-y-3">
          {PACK_OPTIONS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => handlePurchase(pack.id)}
              disabled={!!loading}
              className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3 hover:border-brand hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <span className="font-medium text-slate-900">{pack.label}</span>
              <span className="text-brand font-semibold">
                {loading === pack.id ? 'Loading...' : pack.price}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Global event listener — mount once in App.tsx via InsufficientCreditsListener
export function InsufficientCreditsListener({ onTrigger }: { onTrigger: () => void }) {
  useEffect(() => {
    const handler = () => onTrigger();
    window.addEventListener('insufficient-credits', handler);
    return () => window.removeEventListener('insufficient-credits', handler);
  }, [onTrigger]);
  return null;
}
