import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { listingImageUrl } from '@/config/env';
import { cn } from '@/lib/cn';

/**
 * A listing photo with a shimmer while loading and a paper fallback when the
 * listing has no images or the presigned redirect fails.
 */
export function ListingImage({
  slug,
  propertyId,
  index = 0,
  imageCount,
  alt,
  className,
  imgClassName,
  eager,
  sizes,
}: {
  slug: string;
  propertyId: string;
  index?: number;
  imageCount: number;
  alt: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  sizes?: string;
}) {
  const has = imageCount > index;
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(has ? 'loading' : 'error');

  return (
    <div className={cn('relative overflow-hidden bg-paper-3', className)}>
      {state === 'loading' && <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,#EEDFC9_0%,#F7EBD9_40%,#EEDFC9_80%)] bg-[length:800px_100%]" aria-hidden />}
      {has && state !== 'error' && (
        <img
          src={listingImageUrl(slug, propertyId, index)}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          sizes={sizes}
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          className={cn('h-full w-full object-cover transition-opacity duration-300', state === 'ok' ? 'opacity-100' : 'opacity-0', imgClassName)}
        />
      )}
      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-dust-dim" aria-hidden>
          <ImageOff size={22} />
          <span className="text-[11px] font-bold uppercase tracking-widest">No photo yet</span>
        </div>
      )}
    </div>
  );
}
