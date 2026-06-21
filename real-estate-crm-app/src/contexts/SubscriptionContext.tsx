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

      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch {
      // silent — subscription context is optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrialStatus();
    const interval = setInterval(fetchTrialStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrialStatus]);

  const value: SubscriptionContextValue = {
    subscription,
    loading,
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
