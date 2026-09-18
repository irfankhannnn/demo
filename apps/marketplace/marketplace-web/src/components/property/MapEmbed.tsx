import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { env } from '@/config/env';

/** Google Maps Embed — only when a key and coordinates exist; loads on tap to keep the page light. */
export function MapEmbed({ lat, lng, label }: { lat: number | null; lng: number | null; label: string }) {
  const [armed, setArmed] = useState(false);
  if (!env.googleMapsEmbedKey || lat == null || lng == null) return null;
  const src = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(env.googleMapsEmbedKey)}&q=${lat},${lng}&zoom=15`;
  return (
    <section aria-label="Location map" className="overflow-hidden rounded-card border border-line">
      {armed ? (
        <iframe title={`Map: ${label}`} src={src} className="h-72 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
      ) : (
        <button type="button" onClick={() => setArmed(true)} className="flex h-56 w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_30%,#F3E6D2,#EBDBC2)] text-ink hover:bg-paper-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-marigold text-ink">
            <MapPin size={20} aria-hidden />
          </span>
          <span className="text-sm font-extrabold">Show on map</span>
          <span className="text-xs text-dust-dim">Loads Google Maps</span>
        </button>
      )}
    </section>
  );
}
