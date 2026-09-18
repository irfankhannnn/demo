import { Link } from 'react-router-dom';
import { Heart, MapPin, Trash2 } from 'lucide-react';
import { useSaved } from '@/hooks/useSaved';
import { listingPath } from '@/config/env';
import { formatRelativeTime, formatRupees } from '@/lib/format';
import { errorMessage } from '@/services/api';
import { ListingImage } from '@/components/listing/ListingImage';
import { LinkButton } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ListingCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { MePageHeader, RequireLogin } from './RequireLogin';

export default function Saved() {
  return (
    <RequireLogin title="Saved homes" reason="Login to see the homes you shortlisted.">
      <SavedInner />
    </RequireLogin>
  );
}

function SavedInner() {
  const { items, query, toggle } = useSaved();
  return (
    <div className="container-x py-6 sm:py-10">
      <MePageHeader eyebrow="Your shortlist" title="Saved homes" count={query.isSuccess ? items.length : undefined} />
      {query.isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      )}
      {query.isError && <ErrorState body={errorMessage(query.error)} onRetry={() => void query.refetch()} />}
      {query.isSuccess && items.length === 0 && (
        <EmptyState
          icon={<Heart size={26} aria-hidden />}
          title="Nothing saved yet"
          body="Tap the heart on any home to keep it here. Shortlist bana lo, phir compare karo."
          action={<LinkButton to="/search">Start a search</LinkButton>}
        />
      )}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((s) => {
          const to = listingPath(s.agencySlug, s.propertyId);
          return (
            <li key={s.propertyId} className="group relative overflow-hidden rounded-card border border-line bg-paper shadow-card transition-shadow hover:shadow-card-hover">
              <Link to={to} className="absolute inset-0 z-[1] rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marigold" aria-label={s.snapshot.title || 'Saved home'} />
              <ListingImage slug={s.agencySlug} propertyId={s.propertyId} imageCount={s.snapshot.imageCount} alt={s.snapshot.title} className="aspect-[4/3] w-full" imgClassName="transition-transform duration-500 group-hover:scale-[1.04]" />
              <IconButton label="Remove from saved" size="sm" className="absolute right-3 top-3 z-[2]" onClick={() => void toggle(s.agencySlug, s.propertyId)}>
                <Trash2 size={15} aria-hidden />
              </IconButton>
              <div className="p-4">
                <p className="font-display text-lg font-extrabold tabular">{formatRupees(s.snapshot.price, s.snapshot.mode)}</p>
                <h3 className="mt-1 line-clamp-2 text-[15px] font-extrabold leading-snug">{s.snapshot.title || 'Listing'}</h3>
                <p className="mt-1 flex items-center gap-1 text-[13px] text-dust-dim">
                  <MapPin size={13} className="text-marigold" aria-hidden />
                  {[s.snapshot.locality, s.snapshot.city].filter(Boolean).join(', ')}
                </p>
                <p className="mt-2 text-xs text-dust-dim">Saved {formatRelativeTime(s.savedAt)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
