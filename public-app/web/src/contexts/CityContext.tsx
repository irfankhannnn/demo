/**
 * Selected city — remembered in localStorage, fed by GET /cities.
 * The home hero and the header city switcher both read/write this.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { marketplace, qk } from '@/services/marketplace';
import type { City } from '@/types/api';

const KEY = 'mp.city';

interface CityContextValue {
  cities: City[];
  citiesLoading: boolean;
  city: string;
  setCity: (name: string) => void;
}

const CityContext = createContext<CityContextValue | null>(null);

export function CityProvider({ children }: { children: ReactNode }) {
  const [city, setCityState] = useState<string>(() => {
    try {
      return localStorage.getItem(KEY) ?? '';
    } catch {
      return '';
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: qk.cities,
    queryFn: () => marketplace.cities(),
    staleTime: 5 * 60 * 1000,
  });

  const cities = useMemo(() => data?.cities ?? [], [data]);

  // Default to the busiest city once the list arrives.
  useEffect(() => {
    if (!city && cities.length) {
      const top = [...cities].sort((a, b) => b.total - a.total)[0];
      setCityState(top.name);
    }
  }, [cities, city]);

  const setCity = useCallback((name: string) => {
    setCityState(name);
    try {
      localStorage.setItem(KEY, name);
    } catch {
      /* private mode */
    }
  }, []);

  const value = useMemo(() => ({ cities, citiesLoading: isLoading, city, setCity }), [cities, isLoading, city, setCity]);
  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity(): CityContextValue {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error('useCity must be used inside <CityProvider>');
  return ctx;
}
