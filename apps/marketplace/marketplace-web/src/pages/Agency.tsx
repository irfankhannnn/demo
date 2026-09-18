/**
 * /agency/:slug — agency header + its listings.
 *
 * The contract has no per-agency listings route, so we call GET /listings
 * for each city from /cities (capped) and filter by agencySlug client-side.
 * React Query caches each city page for 5 minutes so navigating back is free.
 */
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { BadgeCheck, Building2, Mail, MapPin, Phone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCity } from '@/contexts/CityContext';
import { maskPhone } from '@/lib/format';
import { usePageMeta } from '@/lib/seo';
import { errorMessage, isApiError } from '@/services/api';
import { marketplace, qk } from '@/services/marketplace';
import { ListingGrid } from '@/components/listing/ListingGrid';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

const MAX_CITIES = 6;
const PER_CITY = 50;

export default function Agency() {
  const { slug = '' } = useParams();
  const { cities } = useCity();
  const { isAuthed, openModal } = useAuth();

  const agencyQ = useQuery({
    queryKey: qk.agency(slug),
    queryFn: () => marketplace.agency(slug),
    enabled: !!slug,
    retry: (n, e) => !(isApiError(e) && e.isNotFound) && n < 2,
    staleTime: 10 * 60 * 1000,
  });
  const agency = agencyQ.data?.agency;

  const cityNames = useMemo(() => [...cities].sort((a, b) => b.total - a.total).slice(0, MAX_CITIES).map((c) => c.name), [cities]);

  const listingQueries = useQueries({
    queries: cityNames.map((city) => ({
      queryKey: ['agencyCityListings', city],
      queryFn: () => marketplace.listings({ city, sort: 'newest', limit: PER_CITY }),
      enabled: !!agency,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const listings = useMemo(
    () => listingQueries.flatMap((q) => q.data?.items ?? []).filter((l) => l.agencySlug === slug),
    [listingQueries, slug],
  );
  const listingsLoading = listingQueries.some((q) => q.isLoading);

  usePageMeta({ title: agency ? `${agency.name} — partner agency` : 'Agency', description: agency?.about ?? undefined });

  if (agencyQ.isError && isApiError(agencyQ.error) && agencyQ.error.isNotFound) {
    return (
      <div className="container-x py-16">
        <EmptyState icon={<Building2 size={26} aria-hidden />} title="This agency is not on the marketplace" body="They may have paused their listings. Try a search instead." />
      </div>
    );
  }
  if (agencyQ.isError) {
    return (
      <div className="container-x py-16">
        <ErrorState body={errorMessage(agencyQ.error)} onRetry={() => void agencyQ.refetch()} />
      </div>
    );
  }

  const color = agency?.brandPrimaryColor || '#FF7A1A';

  return (
    <div className="container-x py-6 sm:py-10">
      <header className="flex flex-col gap-5 rounded-[24px] border border-line bg-paper-2/50 p-5 sm:flex-row sm:items-center sm:p-8">
        {agency ? (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl text-paper shadow-card" style={{ background: color }} aria-hidden>
            <Building2 size={30} />
          </span>
        ) : (
          <Skeleton className="h-16 w-16 rounded-3xl" />
        )}
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-tulsi-deep">
            <BadgeCheck size={14} aria-hidden /> Verified partner agency
          </p>
          {agency ? <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">{agency.name}</h1> : <Skeleton className="mt-2 h-8 w-64" />}
          {agency?.about && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/80">{agency.about}</p>}
          {agency && (
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink/80">
              {agency.publicAddress && (
                <li className="inline-flex items-center gap-1.5">
                  <MapPin size={14} className="text-marigold" aria-hidden /> {agency.publicAddress}
                </li>
              )}
              {agency.publicPhone && (
                <li className="inline-flex items-center gap-1.5">
                  <Phone size={14} className="text-marigold" aria-hidden />
                  {isAuthed ? (
                    <a href={`tel:${agency.publicPhone}`} className="font-bold hover:text-marigold-deep tabular">{agency.publicPhone}</a>
                  ) : (
                    <button type="button" className="font-bold tabular" onClick={() => openModal({ reason: 'Login to see the agency phone number' })}>
                      {maskPhone(agency.publicPhone)} <span className="text-xs text-marigold-deep underline">login to reveal</span>
                    </button>
                  )}
                </li>
              )}
              {agency.publicEmail && (
                <li className="inline-flex items-center gap-1.5">
                  <Mail size={14} className="text-marigold" aria-hidden />
                  <a href={`mailto:${agency.publicEmail}`} className="hover:text-marigold-deep">{agency.publicEmail}</a>
                </li>
              )}
            </ul>
          )}
        </div>
      </header>

      <section className="mt-8" aria-labelledby="agency-listings">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="agency-listings" className="font-display text-lg font-extrabold sm:text-xl">
            Homes listed by {agency?.name ?? 'this agency'}
          </h2>
          {!listingsLoading && <span className="text-xs text-dust-dim tabular">{listings.length} shown</span>}
        </div>
        <p className="mb-4 text-xs text-dust-dim">Showing the newest homes across {cityNames.length || 'the top'} cities. For older listings, search by city with the agency name in your query.</p>
        <ListingGrid items={listings} loading={listingsLoading && listings.length === 0} skeletons={3} />
        {!listingsLoading && listings.length === 0 && <EmptyState title="No live listings right now" body="This agency has nothing published at the moment — check back soon." icon={<Building2 size={26} aria-hidden />} />}
      </section>
    </div>
  );
}
