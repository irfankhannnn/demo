import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getIdToken } from '../utils/authStorage';
import { getTenantHeaders } from '../config/tenant';

const API_URL = import.meta.env.VITE_API_URL as string;

interface CreditsState {
  balance: number;
  monthlyAllotment: number;
  costs: Record<string, number>;
  packs: Record<string, unknown>;
  loading: boolean;
  error: string | null;
  percentUsed: number;
  refetch: () => void;
}

const CreditsContext = createContext<CreditsState>({
  balance: 0,
  monthlyAllotment: 1000,
  costs: {},
  packs: {},
  loading: true,
  error: null,
  percentUsed: 0,
  refetch: () => {},
});

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState(0);
  const [monthlyAllotment, setMonthlyAllotment] = useState(1000);
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [packs, setPacks] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      const idToken = getIdToken();
      if (!idToken || !API_URL) return;

      const res = await fetch(`${API_URL}/subscriptions/credits`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...getTenantHeaders(),
        },
      });

      if (!res.ok) {
        console.warn(`[CreditsContext] Failed to fetch credits: ${res.status}`);
        if (res.status === 401) {
          setError('Your session has expired. Please log in again.');
        } else {
          setError(`Failed to load credits (${res.status})`);
        }
        return;
      }

      const data = await res.json();
      setBalance(data.balance ?? 0);
      setMonthlyAllotment(data.monthlyAllotment ?? data.freeTier?.monthlyFreeCredits ?? 1000);
      setCosts(data.costs ?? {});
      setPacks(data.packs ?? {});
      setError(null);
    } catch (err) {
      console.error('[CreditsContext] Fetch error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
    const interval = setInterval(fetchCredits, 60 * 1000); // Reduced from 5 min to 1 min
    return () => clearInterval(interval);
  }, [fetchCredits]);

  const percentUsed = monthlyAllotment > 0
    ? Math.min(100, ((monthlyAllotment - balance) / monthlyAllotment) * 100)
    : 0;

  return (
    <CreditsContext.Provider value={{
      balance,
      monthlyAllotment,
      costs,
      packs,
      loading,
      error,
      percentUsed,
      refetch: fetchCredits,
    }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCreditsContext() {
  return useContext(CreditsContext);
}
