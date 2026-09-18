import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { MarketplaceListing } from '@/types/api';
import { cn } from '@/lib/cn';
import { ListingCard } from './ListingCard';
import { ListingCardSkeleton } from '../ui/Skeleton';

export function ListingGrid({ items, loading, skeletons = 6, showWhy, className }: { items: MarketplaceListing[]; loading?: boolean; skeletons?: number; showWhy?: boolean; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {items.map((l, i) => (
        <ListingCard key={`${l.agencySlug}/${l.propertyId}`} listing={l} index={i} showWhy={showWhy} />
      ))}
      {loading && Array.from({ length: skeletons }).map((_, i) => <ListingCardSkeleton key={`sk-${i}`} />)}
    </div>
  );
}

/** Horizontal scroll rail with a heading and optional "see all" link. */
export function ListingRail({
  title,
  eyebrow,
  items,
  loading,
  seeAll,
  empty,
}: {
  title: ReactNode;
  eyebrow?: string;
  items: MarketplaceListing[];
  loading?: boolean;
  seeAll?: { to: string; label: string };
  empty?: ReactNode;
}) {
  if (!loading && items.length === 0 && !empty) return null;
  return (
    <section className="py-8 sm:py-10">
      <div className="container-x mb-4 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-marigold-deep">{eyebrow}</p>}
          <h2 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">{title}</h2>
        </div>
        {seeAll && (
          <Link to={seeAll.to} className="hidden shrink-0 items-center gap-1 text-sm font-bold text-ink hover:text-marigold-deep sm:inline-flex">
            {seeAll.label} <ArrowRight size={16} aria-hidden />
          </Link>
        )}
      </div>
      {!loading && items.length === 0 ? (
        <div className="container-x">{empty}</div>
      ) : (
        <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8">
          {items.map((l, i) => (
            <div key={`${l.agencySlug}/${l.propertyId}`} className="snap-start">
              <ListingCard listing={l} index={i} compact />
            </div>
          ))}
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <div key={`sk-${i}`} className="w-[264px] shrink-0 sm:w-[288px]">
              <ListingCardSkeleton />
            </div>
          ))}
        </div>
      )}
      {seeAll && (
        <div className="container-x mt-3 sm:hidden">
          <Link to={seeAll.to} className="inline-flex items-center gap-1 text-sm font-bold text-ink">
            {seeAll.label} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
