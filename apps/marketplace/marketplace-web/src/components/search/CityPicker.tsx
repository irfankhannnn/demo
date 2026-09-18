import { useMemo, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { useCity } from '@/contexts/CityContext';
import { cn } from '@/lib/cn';
import { Sheet } from '../ui/Sheet';
import { Input } from '../ui/Input';
import { Skeleton } from '../ui/Skeleton';

export function CityPicker({ open, onClose, onPick, title = 'Kaunsa city?' }: { open: boolean; onClose: () => void; onPick?: (name: string) => void; title?: string }) {
  const { cities, citiesLoading, city, setCity } = useCity();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = [...cities].sort((a, b) => b.total - a.total);
    return needle ? list.filter((c) => c.name.toLowerCase().includes(needle)) : list;
  }, [cities, q]);

  return (
    <Sheet open={open} onClose={onClose} title={title} description="Only cities with live partner listings show up here." size="sm">
      {cities.length > 6 && <Input leftIcon={<Search size={16} />} placeholder="Search city" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />}
      <ul className="mt-3 grid grid-cols-2 gap-2" role="listbox" aria-label="Cities">
        {citiesLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        {!citiesLoading && filtered.length === 0 && <li className="col-span-2 py-6 text-center text-sm text-dust-dim">No city matches that.</li>}
        {filtered.map((c) => {
          const active = c.name === city;
          return (
            <li key={c.cityKey}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setCity(c.name);
                  onPick?.(c.name);
                  onClose();
                }}
                className={cn(
                  'flex w-full flex-col items-start rounded-2xl border px-4 py-3 text-left transition-colors',
                  active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink/50',
                )}
              >
                <span className="flex items-center gap-1.5 font-display text-sm font-extrabold">
                  <MapPin size={14} className={active ? 'text-marigold' : 'text-marigold'} aria-hidden />
                  {c.name}
                </span>
                <span className={cn('mt-1 text-xs tabular', active ? 'text-dust' : 'text-dust-dim')}>
                  {c.total} homes · {c.sale} buy · {c.rent} rent
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
