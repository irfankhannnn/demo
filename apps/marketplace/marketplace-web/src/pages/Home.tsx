import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, ListChecks, MessageSquareText, Sparkles } from 'lucide-react';
import { useCity } from '@/contexts/CityContext';
import { usePageMeta } from '@/lib/seo';
import { marketplace, qk } from '@/services/marketplace';
import { AiSearchBox } from '@/components/search/AiSearchBox';
import { ListingRail } from '@/components/listing/ListingGrid';
import { EmptyState } from '@/components/ui/States';

const STEPS = [
  {
    icon: MessageSquareText,
    title: 'You describe',
    body: 'Type it like you would say it to a friend — budget, area, BHK, "near metro", "pet-friendly". Hinglish chalega.',
  },
  {
    icon: ListChecks,
    title: 'We understand',
    body: 'A language model turns that into a structured search: city, budget range, bedrooms, locality, must-haves. You can see and edit each one.',
  },
  {
    icon: Sparkles,
    title: 'Ranked matches, with a reason',
    body: 'Every listing from partner agencies is scored against your intent. Each result shows a match % and a plain-English "why".',
  },
];

export default function Home() {
  const { city } = useCity();
  usePageMeta({ description: 'Describe your dream ghar in plain words. We read your intent and match it against every listing from partner brokers.' });

  const newest = useQuery({
    queryKey: qk.listings({ city, sort: 'newest', limit: 8 }),
    queryFn: () => marketplace.listings({ city, sort: 'newest', limit: 8 }),
    enabled: !!city,
    staleTime: 60_000,
  });

  const agencies = useMemo(() => {
    const seen = new Map<string, { name: string; slug: string; color: string | null; count: number }>();
    for (const l of newest.data?.items ?? []) {
      const a = seen.get(l.agencySlug);
      if (a) a.count += 1;
      else seen.set(l.agencySlug, { name: l.agency.name, slug: l.agency.slug, color: l.agency.brandPrimaryColor, count: 1 });
    }
    return [...seen.values()];
  }, [newest.data]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-marigold/20 blur-3xl" />
          <div className="absolute -right-16 top-40 h-64 w-64 rounded-full bg-gulal/15 blur-3xl" />
        </div>
        <div className="container-x pb-10 pt-12 sm:pb-16 sm:pt-20">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-marigold-deep">Property search, bina 40 tabs</p>
          <h1 className="mt-3 max-w-3xl font-display text-[34px] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Describe your dream <span className="gt">ghar</span>. We&apos;ll find it.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink/75 sm:text-lg">
            Type it like you&apos;d say it — &ldquo;2 BHK Andheri, under 80 lakh, near metro&rdquo;. We read your intent and match it against every listing from partner brokers.
          </p>
          <AiSearchBox className="mt-8 max-w-3xl" autoFocus />
        </div>
      </section>

      {/* How matching works */}
      <section className="container-x py-8 sm:py-12" aria-labelledby="how">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-marigold-deep">How matching works</p>
        <h2 id="how" className="mt-1 font-display text-xl font-extrabold sm:text-2xl">
          Not magic. Three plain steps.
        </h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-card border border-line bg-paper-2/50 p-5">
              <span className="absolute right-4 top-4 font-display text-3xl font-extrabold text-ink/10">0{i + 1}</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-marigold">
                <s.icon size={20} aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-[15px] font-extrabold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/75">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* New in city */}
      <ListingRail
        eyebrow="Fresh listings"
        title={city ? `New in ${city}` : 'New listings'}
        items={newest.data?.items ?? []}
        loading={newest.isLoading}
        seeAll={city ? { to: `/search?city=${encodeURIComponent(city)}&sort=newest`, label: `All homes in ${city}` } : undefined}
        empty={
          <EmptyState
            title={city ? `Nothing listed in ${city} yet` : 'Pick a city to see listings'}
            body="Partner agencies add homes daily. Try another city from the switcher above."
            icon={<Building2 size={26} aria-hidden />}
          />
        }
      />

      {/* Partner agencies */}
      {agencies.length > 0 && (
        <section className="container-x py-8 sm:py-10" aria-labelledby="partners">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-marigold-deep">Partner agencies</p>
          <h2 id="partners" className="mt-1 font-display text-xl font-extrabold sm:text-2xl">
            Real brokers, verified listings
          </h2>
          <div className="no-scrollbar mt-5 flex gap-3 overflow-x-auto pb-1 sm:flex-wrap">
            {agencies.map((a) => (
              <Link
                key={a.slug}
                to={`/agency/${encodeURIComponent(a.slug)}`}
                className="flex shrink-0 items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 transition-colors hover:border-ink/50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl text-paper" style={{ background: a.color || '#FF7A1A' }} aria-hidden>
                  <Building2 size={16} />
                </span>
                <span>
                  <span className="block text-sm font-extrabold text-ink">{a.name}</span>
                  <span className="block text-xs text-dust-dim">{a.count} new this week</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Broker CTA */}
      <section className="container-x pb-4 pt-8">
        <div className="relative overflow-hidden rounded-[24px] bg-ink px-6 py-8 text-paper sm:px-10 sm:py-12">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-marigold/30 blur-3xl" aria-hidden />
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-marigold">For brokers</p>
          <h2 className="mt-2 max-w-xl font-display text-2xl font-extrabold sm:text-3xl">Your listings, in front of buyers who already said what they want.</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-dust">Publish from the RealEstateFlow CRM. Enquiries land in your inbox with the buyer&apos;s name and number, and every site visit request syncs to your calendar.</p>
          <a href="https://realestateflow.in" rel="noreferrer" className="mt-6 inline-flex h-11 items-center rounded-xl bg-marigold px-5 text-sm font-extrabold text-ink hover:bg-marigold-hover">
            List with RealEstateFlow
          </a>
        </div>
      </section>
    </>
  );
}
