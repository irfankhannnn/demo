import { useState, useEffect, useCallback } from 'react';
import { Users } from 'lucide-react';
import { getIdToken } from '../utils/authStorage';
import { getTenantHeaders } from '../config/tenant';

const API_URL = import.meta.env.VITE_API_URL as string;

interface SeatCounterProps {
  onUpgradeClick?: () => void;
}

interface SubscriptionData {
  plan: string;
  seatsPaid: number;
  seatsUsed: number;
}

export default function SeatCounter({ onUpgradeClick }: SeatCounterProps) {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    try {
      const idToken = getIdToken();
      if (!idToken) return;

      const res = await fetch(`${API_URL}/subscriptions/current`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...getTenantHeaders(),
        },
      });
      if (res.ok) {
        const sub = await res.json();
        setData({ plan: sub.plan, seatsPaid: sub.seatsPaid, seatsUsed: sub.seatsUsed });
      }
    } catch {
      // silent fail — non-critical UI element
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchSubscription, 2 * 60 * 1000);
    
    // Also refresh on focus
    const handleFocus = () => fetchSubscription();
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchSubscription]);

  if (loading || !data) return null;

  const { seatsUsed, seatsPaid, plan } = data;
  const pct = seatsPaid > 0 ? Math.round((seatsUsed / seatsPaid) * 100) : 0;
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
  const atOrNearCap = seatsUsed >= seatsPaid - 1;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">
      <Users className="h-4 w-4 text-gray-500" />
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-700">
          {seatsUsed} / {seatsPaid} seats
        </span>
        <div className="h-2 w-24 rounded-full bg-gray-200">
          <div
            className={`h-2 rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
      {atOrNearCap && onUpgradeClick && (
        <button
          onClick={onUpgradeClick}
          className="ml-2 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {plan === 'solo' ? 'Upgrade →' : 'Add seats →'}
        </button>
      )}
    </div>
  );
}
