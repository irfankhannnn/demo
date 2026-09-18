import { Share2 } from 'lucide-react';
import { listingShareUrl } from '@/config/env';
import { useToast } from '@/contexts/ToastContext';
import { IconButton } from '../ui/IconButton';

export function ShareButton({ slug, propertyId, title, tone = 'paper' }: { slug: string; propertyId: string; title: string; tone?: 'paper' | 'glass' }) {
  const toast = useToast();
  const share = async () => {
    const url = listingShareUrl(slug, propertyId);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, text: title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link copied', 'Send it on WhatsApp, family ko dikhao.');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      } catch {
        toast.error('Could not share', url);
      }
    }
  };
  return (
    <IconButton label="Share this home" tone={tone} onClick={() => void share()}>
      <Share2 size={18} aria-hidden />
    </IconButton>
  );
}
