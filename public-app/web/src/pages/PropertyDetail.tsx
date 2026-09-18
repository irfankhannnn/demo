import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BedDouble, CalendarDays, Check, Compass, FileText, Hand, Heart, MessageCircle, Ruler, Sofa, Building2, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSaved } from '@/hooks/useSaved';
import { listingDocumentUrl } from '@/config/env';
import { formatArea, formatBhk, formatFullRupees, formatPerSqft, formatRelativeTime, formatRupees, titleCase } from '@/lib/format';
import { usePageMeta } from '@/lib/seo';
import { errorMessage, isApiError } from '@/services/api';
import { marketplace, qk } from '@/services/marketplace';
import { Gallery } from '@/components/listing/Gallery';
import { AgencyCard } from '@/components/listing/AgencyCard';
import { ListingRail } from '@/components/listing/ListingGrid';
import { MatchBadge } from '@/components/listing/MatchBadge';
import { ChatComposerSheet } from '@/components/property/ChatComposerSheet';
import { MapEmbed } from '@/components/property/MapEmbed';
import { ShareButton } from '@/components/property/ShareButton';
import { VisitSheet } from '@/components/property/VisitSheet';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { LineSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { cn } from '@/lib/cn';

export default function PropertyDetail() {
  const { slug = '', propertyId = '' } = useParams();
  const { requireAuth } = useAuth();
  const { isSaved, toggle } = useSaved();
  const toast = useToast();
  const qc = useQueryClient();
  const [chatOpen, setChatOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);

  const q = useQuery({
    queryKey: qk.listing(slug, propertyId),
    queryFn: () => marketplace.listing(slug, propertyId),
    enabled: !!slug && !!propertyId,
    retry: (n, e) => !(isApiError(e) && e.isNotFound) && n < 2,
    staleTime: 60_000,
  });
  const listing = q.data?.listing;

  const similar = useQuery({
    queryKey: qk.similar(slug, propertyId),
    queryFn: () => marketplace.similar(slug, propertyId, 8),
    enabled: !!listing,
    staleTime: 5 * 60 * 1000,
  });

  const agencyQ = useQuery({
    queryKey: qk.agency(slug),
    queryFn: () => marketplace.agency(slug),
    enabled: !!listing,
    staleTime: 10 * 60 * 1000,
  });

  usePageMeta({
    title: listing ? `${listing.title} — ${formatRupees(listing.pricing.amount, listing.pricing.mode)}` : 'Listing',
    description: listing ? `${[formatBhk(listing.bhk), titleCase(listing.propertyType), listing.locality, listing.city].filter(Boolean).join(' · ')}. Listed by ${listing.agency.name}.` : undefined,
  });

  const ping = useMutation({
    mutationFn: async () => {
      const ok = await requireAuth({ reason: `Login so ${listing?.agency.name ?? 'the agency'} knows who is interested` });
      if (!ok) return null;
      return marketplace.ping(slug, propertyId);
    },
    onSuccess: (r) => {
      if (!r) return;
      void qc.invalidateQueries({ queryKey: qk.threads });
      toast.success('Interest sent', `${listing?.agency.name ?? 'The agency'} has your name and number. They usually reply within a day.`);
    },
    onError: (e) => toast.error('Could not send', isApiError(e) && e.status === 429 ? 'You already pinged this home today — chat with them instead.' : errorMessage(e)),
  });

  const openChat = async () => {
    const ok = await requireAuth({ reason: `Login to chat with ${listing?.agency.name ?? 'the agency'}` });
    if (ok) setChatOpen(true);
  };
  const openVisit = async () => {
    const ok = await requireAuth({ reason: 'Login to book a site visit' });
    if (ok) setVisitOpen(true);
  };

  if (q.isError && isApiError(q.error) && q.error.isNotFound) {
    return (
      <div className="container-x py-16">
        <EmptyState
          icon={<Building2 size={26} aria-hidden />}
          title="This listing is no longer available"
          body="It may have been sold, rented out or taken down by the agency. Similar homes are one search away."
          action={
            <Button onClick={() => window.history.length > 1 && window.history.back()} variant="outline">
              Go back
            </Button>
          }
        />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="container-x py-16">
        <ErrorState body={errorMessage(q.error)} onRetry={() => void q.refetch()} />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container-x py-5 sm:py-8">
        <Skeleton className="aspect-[16/10] w-full rounded-card sm:h-[480px] sm:aspect-auto" />
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <LineSkeleton lines={5} />
          </div>
          <Skeleton className="h-64 rounded-card" />
        </div>
      </div>
    );
  }

  const l = listing;
  const saved = isSaved(l.propertyId);
  const price = formatRupees(l.pricing.amount, l.pricing.mode);
  const area = l.carpetArea ?? l.builtUpArea;
  const facts = [
    l.bhk ? { icon: BedDouble, label: formatBhk(l.bhk)! } : null,
    area ? { icon: Ruler, label: `${formatArea(area)} ${l.carpetArea ? 'carpet' : 'built-up'}` } : null,
    l.furnishing ? { icon: Sofa, label: titleCase(l.furnishing) } : null,
    l.facing ? { icon: Compass, label: `${titleCase(l.facing)} facing` } : null,
    l.availableFrom ? { icon: Clock, label: `From ${new Date(l.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` } : null,
  ].filter(Boolean) as { icon: typeof BedDouble; label: string }[];
  const perSqft = l.pricing.mode === 'sale' ? formatPerSqft(l.pricing.amount, area) : null;

  return (
    <div className="container-x py-4 sm:py-8">
      <nav aria-label="Breadcrumb" className="mb-3 hidden text-xs text-dust-dim sm:block">
        <Link to="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span>{' '}
        <Link to={`/search?city=${encodeURIComponent(l.city)}`} className="hover:text-ink">{l.city}</Link>{' '}
        {l.locality && (
          <>
            <span aria-hidden>/</span> <Link to={`/search?city=${encodeURIComponent(l.city)}&locality=${encodeURIComponent(l.locality)}`} className="hover:text-ink">{l.locality}</Link>
          </>
        )}
      </nav>

      <Gallery slug={l.agencySlug} propertyId={l.propertyId} imageCount={l.imageCount} title={l.title} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
        {/* Main column */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={l.pricing.mode === 'rent' ? 'ink' : 'marigold'}>{l.pricing.mode === 'rent' ? 'For rent' : 'For sale'}</Badge>
            {l.propertyType && <Badge tone="dust">{titleCase(l.propertyType)}</Badge>}
            <MatchBadge score={l.matchScore} />
            <span className="ml-auto text-xs text-dust-dim">Updated {formatRelativeTime(l.updatedAt)}</span>
          </div>

          <div className="mt-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-3xl font-extrabold tracking-tight text-ink tabular sm:text-4xl">{price}</p>
              <p className="mt-1 text-xs text-dust-dim tabular">
                {l.pricing.amount != null && formatFullRupees(l.pricing.amount)}
                {perSqft && ` · ${perSqft}`}
                {l.pricing.mode === 'rent' && l.pricing.deposit != null && ` · Deposit ${formatRupees(l.pricing.deposit)}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <ShareButton slug={l.agencySlug} propertyId={l.propertyId} title={l.title} />
              <IconButton label={saved ? 'Remove from saved' : 'Save this home'} aria-pressed={saved} onClick={() => void toggle(l.agencySlug, l.propertyId)}>
                <Heart size={18} className={cn(saved && 'fill-gulal text-gulal')} aria-hidden />
              </IconButton>
            </div>
          </div>

          <h1 className="mt-4 font-display text-xl font-extrabold leading-snug sm:text-2xl">{l.title}</h1>
          <p className="mt-1 text-sm text-dust-dim">
            {[l.buildingName, l.locality, l.city].filter(Boolean).join(' · ')}
          </p>

          {facts.length > 0 && (
            <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {facts.map((f) => (
                <li key={f.label} className="flex items-center gap-2.5 rounded-2xl border border-line bg-paper-2/50 px-3.5 py-3 text-sm font-bold">
                  <f.icon size={18} className="shrink-0 text-marigold" aria-hidden />
                  <span className="truncate">{f.label}</span>
                </li>
              ))}
            </ul>
          )}

          {l.description && (
            <section className="mt-8" aria-labelledby="about">
              <h2 id="about" className="font-display text-base font-extrabold">About this home</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink/85">{l.description}</p>
            </section>
          )}

          {l.amenities.length > 0 && (
            <section className="mt-8" aria-labelledby="amenities">
              <h2 id="amenities" className="font-display text-base font-extrabold">Amenities</h2>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {l.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-sm">
                    <Check size={15} className="shrink-0 text-tulsi" aria-hidden />
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {l.documents.length > 0 && (
            <section className="mt-8" aria-labelledby="docs">
              <h2 id="docs" className="font-display text-base font-extrabold">Documents</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {l.documents.map((d, i) => (
                  <li key={`${d.kind}-${i}`}>
                    <a href={listingDocumentUrl(l.agencySlug, l.propertyId, i)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-paper px-3.5 text-sm font-bold hover:border-ink/50">
                      <FileText size={16} className="text-marigold" aria-hidden />
                      {d.label || titleCase(d.kind)}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-8">
            <MapEmbed lat={l.latitude} lng={l.longitude} label={l.title} />
          </div>
        </div>

        {/* Side column */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-paper p-4 shadow-card sm:p-5">
            <AgencyCard agency={l.agency} phone={agencyQ.data?.agency.publicPhone ?? null} />
            <div className="mt-4 hidden flex-col gap-2 lg:flex">
              <Button size="lg" full onClick={() => void openChat()} leftIcon={<MessageCircle size={18} aria-hidden />}>
                Chat with agency
              </Button>
              <Button size="lg" full variant="ink" onClick={() => void openVisit()} leftIcon={<CalendarDays size={18} aria-hidden />}>
                Book a site visit
              </Button>
              <Button size="md" full variant="outline" onClick={() => ping.mutate()} loading={ping.isPending} leftIcon={<Hand size={16} aria-hidden />}>
                I&apos;m interested
              </Button>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-dust-dim">
              RealEstateFlow does not charge buyers. Never pay a token amount before seeing the property and the papers.
            </p>
          </div>
        </aside>
      </div>

      <ListingRail
        eyebrow="You might also like"
        title="Similar homes"
        items={similar.data?.items ?? []}
        loading={similar.isLoading}
      />

      {/* Sticky mobile CTA bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pt-2 backdrop-blur-md safe-bottom lg:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-extrabold tabular leading-tight">{price}</p>
            <p className="truncate text-[11px] text-dust-dim">{l.agency.name}</p>
          </div>
          <Button size="md" variant="outline" onClick={() => void openVisit()} aria-label="Book a site visit" className="px-3">
            <CalendarDays size={18} aria-hidden />
          </Button>
          <Button size="md" variant="outline" onClick={() => ping.mutate()} loading={ping.isPending} aria-label="I'm interested" className="px-3">
            <Hand size={18} aria-hidden />
          </Button>
          <Button size="md" onClick={() => void openChat()} leftIcon={<MessageCircle size={16} aria-hidden />}>
            Chat
          </Button>
        </div>
      </div>
      <div className="h-20 lg:hidden" aria-hidden />

      <ChatComposerSheet open={chatOpen} onClose={() => setChatOpen(false)} slug={l.agencySlug} propertyId={l.propertyId} agencyName={l.agency.name} title={l.title} />
      <VisitSheet open={visitOpen} onClose={() => setVisitOpen(false)} slug={l.agencySlug} propertyId={l.propertyId} title={l.title} />
    </div>
  );
}
