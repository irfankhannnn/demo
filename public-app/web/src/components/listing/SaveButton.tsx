import { Heart } from 'lucide-react';
import { useSaved } from '@/hooks/useSaved';
import { cn } from '@/lib/cn';
import { IconButton } from '../ui/IconButton';

export function SaveButton({ slug, propertyId, tone = 'glass', className, size = 'md' }: { slug: string; propertyId: string; tone?: 'glass' | 'paper'; className?: string; size?: 'sm' | 'md' }) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(propertyId);
  return (
    <IconButton
      label={saved ? 'Remove from saved' : 'Save this home'}
      aria-pressed={saved}
      tone={tone}
      size={size}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle(slug, propertyId);
      }}
    >
      <Heart size={size === 'sm' ? 16 : 18} className={cn('transition-transform', saved && 'scale-110 fill-gulal text-gulal')} aria-hidden />
    </IconButton>
  );
}
