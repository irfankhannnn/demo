import { Link } from 'react-router-dom';
import { BedDouble, MapPin, Ruler, Sofa } from 'lucide-react';
import { motion } from 'framer-motion';
import { listingPath } from '@/config/env';
import { formatArea, formatBhk, formatRelativeTime, formatRupees, titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { MarketplaceListing } from '@/types/api';
import { ListingImage } from './ListingImage';
import { MatchBadge } from './MatchBadge';
import { SaveButton } from './SaveButton';

export function ListingCard({ listing, index = 0, showWhy, compact }: { listing: MarketplaceListing; index?: number; showWhy?: boolean; compact?: boolean }) {
  const l = listing;
  const to = listingPath(l.agencySlug, l.propertyId);
  const facts = [formatBhk(l.bhk), formatArea(l.carpetArea ?? l.builtUpArea), l.furnishing ? titleCase(l.furnishing) : null].filter(Boolean) as string[];

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.04, ease: 'easeOut' }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-card border border-line bg-paper shadow-card transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover',
        compact && 'w-[264px] shrink-0 sm:w-[288px]',
      )}
    >
      <Link to={to} className="absolute inset-0 z-[1] rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marigold focus-visible:ring-inset" aria-label={l.title}>
        <span className="sr-only">{l.title}</span>
      </Link>

      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <CardImage listing={l} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink/55 to-transparent" aria-hidden />
        <div className="absolute left-3 top-3 z-[2] flex gap-2">
          <MatchBadge score={l.matchScore} />
          {!l.matchScore && <span className="rounded-pill bg-paper/90 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-ink backdrop-blur">{l.pricing.mode === 'rent' ? 'Rent' : 'Buy'}</span>}
        </div>
        <SaveButton slug={l.agencySlug} propertyId={l.propertyId} size="sm" className="absolute right-3 top-3 z-[2]" />
        <p className="absolute bottom-3 left-3 z-[2] font-display text-lg font-extrabold tracking-tight text-paper drop-shadow tabular">{formatRupees(l.pricing.amount, l.pricing.mode)}</p>
        {l.imageCount > 1 && <span className="absolute bottom-3 right-3 z-[2] rounded-pill bg-ink/50 px-2 py-0.5 text-[11px] font-bold text-paper backdrop-blur">{l.imageCount} photos</span>}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-sans text-[15px] font-extrabold leading-snug text-ink group-hover:text-marigold-deep">{l.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-[13px] text-dust-dim">
          <MapPin size={13} className="shrink-0 text-marigold" aria-hidden />
          <span className="truncate">{[l.locality, l.city].filter(Boolean).join(', ')}</span>
        </p>

        {facts.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] font-semibold text-ink/80">
            {facts.map((f, i) => (
              <li key={f} className="inline-flex items-center gap-1">
                {i === 0 && l.bhk ? <BedDouble size={13} aria-hidden /> : i === 0 ? <Ruler size={13} aria-hidden /> : f.includes('sq ft') ? <Ruler size={13} aria-hidden /> : <Sofa size={13} aria-hidden />}
                {f}
              </li>
            ))}
          </ul>
        )}

        {showWhy && l.why && (
          <p className="mt-3 rounded-xl border-l-2 border-gulal bg-gulal-soft/60 px-3 py-2 text-[13px] leading-snug text-ink/85">
            <span className="font-extrabold text-gulal-deep">Why: </span>
            {l.why}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3 text-[12px] text-dust-dim">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.agency.brandPrimaryColor || '#FF7A1A' }} aria-hidden />
            <span className="truncate font-semibold text-ink/70">{l.agency.name}</span>
          </span>
          <time dateTime={l.listedAt} className="shrink-0">
            {formatRelativeTime(l.listedAt)}
          </time>
        </div>
      </div>
    </motion.article>
  );
}

function CardImage({ listing: l }: { listing: MarketplaceListing }) {
  return (
    <ListingImage
      slug={l.agencySlug}
      propertyId={l.propertyId}
      index={0}
      imageCount={l.imageCount}
      alt={l.title}
      className="h-full w-full"
      imgClassName="transition-transform duration-500 group-hover:scale-[1.04]"
      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
    />
  );
}
