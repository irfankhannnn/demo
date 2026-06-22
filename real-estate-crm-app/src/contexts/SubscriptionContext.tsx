import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getIdToken } from '../utils/authStorage';

const API_URL = import.meta.env.VITE_API_URL as string;

interface SubscriptionStatus {
  plan: string;
  trialDaysLeft: number;
  trialEndsAt: string | null;
  isPaying: boolean;
  isTrialing: boolean;
  isTrialExpired: boolean;
  gracePeriodActive: boolean;
  paymentStatus: string;
}

interface SubscriptionContextValue {
  subscription: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  isPaying: boolean;
  isTrialing: boolean;
  trialDaysLeft: number;
  isTrialExpired: boolean;
  gracePeriodActive: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  loading: true,
  error: null,
  refetch: () => {},
  isPaying: false,
  isTrialing: false,
  trialDaysLeft: 0,
  isTrialExpired: false,
  gracePeriodActive: false,
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrialStatus = useCallback(async () => {
    try {
      const idToken = getIdToken();
      if (!idToken || !API_URL) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/subscriptions/trial-status`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        console.warn(`[SubscriptionContext] Failed to fetch trial status: ${res.status}`);
        if (res.status === 401) {
          setSubscription(null); // Clear on auth failure
          setError('Your session has expired. Please log in again.');
        } else {
          setError(`Failed to load subscription (${res.status})`);
        }
        return;
      }

      const data = await res.json();
      setSubscription(data);
      setError(null);
    } catch (err) {
      console.error('[SubscriptionContext] Fetch error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrialStatus();
    const interval = setInterval(fetchTrialStatus, 60 * 1000); // Reduced from 5 min to 1 min
    return () => clearInterval(interval);
  }, [fetchTrialStatus]);

  const value: SubscriptionContextValue = {
    subscription,
    loading,
    error,
    refetch: fetchTrialStatus,
    isPaying: subscription?.isPaying ?? false,
    isTrialing: subscription?.isTrialing ?? false,
    trialDaysLeft: subscription?.trialDaysLeft ?? 0,
    isTrialExpired: subscription?.isTrialExpired ?? false,
    gracePeriodActive: subscription?.gracePeriodActive ?? false,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext() {
  return useContext(SubscriptionContext);
}

export default SubscriptionContext;
