/**
 * Property gallery: hero + thumbnail strip on desktop, swipe strip on mobile,
 * with a full-screen lightbox (keyboard ← → Esc).
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { listingImageUrl } from '@/config/env';
import { cn } from '@/lib/cn';
import { ListingImage } from './ListingImage';
import { IconButton } from '../ui/IconButton';

export function Gallery({ slug, propertyId, imageCount, title }: { slug: string; propertyId: string; imageCount: number; title: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const count = Math.max(0, imageCount);
  const indices = Array.from({ length: count }, (_, i) => i);

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  if (count === 0) {
    return <ListingImage slug={slug} propertyId={propertyId} imageCount={0} alt={title} className="aspect-[16/10] w-full rounded-card" />;
  }

  return (
    <>
      {/* mobile: swipe strip */}
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:hidden" aria-label="Photos">
        {indices.map((i) => (
          <button key={i} type="button" onClick={() => openAt(i)} className="relative aspect-[4/3] w-[86vw] shrink-0 snap-center overflow-hidden rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marigold" aria-label={`Open photo ${i + 1} of ${count}`}>
            <ListingImage slug={slug} propertyId={propertyId} index={i} imageCount={count} alt={`${title} — photo ${i + 1}`} className="h-full w-full" eager={i === 0} />
            <span className="absolute bottom-2 right-2 rounded-pill bg-ink/60 px-2 py-0.5 text-[11px] font-bold text-paper backdrop-blur">
              {i + 1}/{count}
            </span>
          </button>
        ))}
      </div>

      {/* desktop: hero + grid */}
      <div className={cn('hidden gap-2 sm:grid', count > 1 ? 'grid-cols-[2fr_1fr] grid-rows-2' : 'grid-cols-1')} style={{ height: 'min(56vh, 520px)' }}>
        <button type="button" onClick={() => openAt(0)} className={cn('group relative overflow-hidden rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marigold', count > 1 && 'row-span-2')} aria-label="Open photo gallery">
          <ListingImage slug={slug} propertyId={propertyId} index={0} imageCount={count} alt={title} className="h-full w-full" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" eager />
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-pill bg-paper/90 px-3 py-1.5 text-xs font-extrabold text-ink backdrop-blur">
            <Expand size={13} aria-hidden /> View all {count} photos
          </span>
        </button>
        {count > 1 &&
          [1, 2].map((i) =>
            i < count ? (
              <button key={i} type="button" onClick={() => openAt(i)} className="group relative overflow-hidden rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marigold" aria-label={`Open photo ${i + 1}`}>
                <ListingImage slug={slug} propertyId={propertyId} index={i} imageCount={count} alt={`${title} — photo ${i + 1}`} className="h-full w-full" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" />
                {i === 2 && count > 3 && <span className="absolute inset-0 flex items-center justify-center bg-ink/45 font-display text-lg font-extrabold text-paper">+{count - 3}</span>}
              </button>
            ) : (
              <div key={i} className="rounded-card bg-paper-2" aria-hidden />
            ),
          )}
      </div>

      <Lightbox open={open} onClose={() => setOpen(false)} index={index} setIndex={setIndex} count={count} slug={slug} propertyId={propertyId} title={title} />
    </>
  );
}

function Lightbox({ open, onClose, index, setIndex, count, slug, propertyId, title }: { open: boolean; onClose: () => void; index: number; setIndex: (i: number) => void; count: number; slug: string; propertyId: string; title: string }) {
  const prev = useCallback(() => setIndex((index - 1 + count) % count), [index, count, setIndex]);
  const next = useCallback(() => setIndex((index + 1) % count), [index, count, setIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, prev, next]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photos`}
          className="fixed inset-0 z-[95] flex flex-col bg-ink"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="flex items-center justify-between px-4 py-3 text-paper">
            <span className="text-sm font-bold tabular">
              {index + 1} / {count}
            </span>
            <IconButton label="Close gallery" tone="glass" onClick={onClose} autoFocus>
              <X size={20} />
            </IconButton>
          </div>
          <div
            className="relative flex flex-1 items-center justify-center overflow-hidden px-2"
            onTouchStart={(e) => (touchX = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - touchX;
              if (dx > 40) prev();
              if (dx < -40) next();
            }}
          >
            <img key={index} src={listingImageUrl(slug, propertyId, index)} alt={`${title} — photo ${index + 1}`} className="max-h-full max-w-full rounded-lg object-contain" />
            {count > 1 && (
              <>
                <IconButton label="Previous photo" tone="glass" onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2">
                  <ChevronLeft size={22} />
                </IconButton>
                <IconButton label="Next photo" tone="glass" onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <ChevronRight size={22} />
                </IconButton>
              </>
            )}
          </div>
          {count > 1 && (
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-3">
              {Array.from({ length: count }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Photo ${i + 1}`}
                  aria-current={i === index}
                  className={cn('h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors', i === index ? 'border-marigold' : 'border-transparent opacity-60 hover:opacity-100')}
                >
                  <img src={listingImageUrl(slug, propertyId, i)} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

let touchX = 0;
