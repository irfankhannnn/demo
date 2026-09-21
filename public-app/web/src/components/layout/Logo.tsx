import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden className={className}>
      <path d="M30 4L56 25V56H4V25L30 4Z" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round" />
      <path d="M12 33Q19 30 26 33Q33 36 40 33Q44 31 48 33" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M12 40Q19 37 26 40Q33 43 40 40Q44 38 48 40" stroke="currentColor" strokeOpacity="0.6" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M12 47Q19 44 26 47Q33 50 40 47Q44 45 48 47" stroke="#FF7A1A" strokeWidth="2.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cn('inline-flex items-center gap-2 rounded-lg text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marigold', className)} aria-label="RealEstateFlow Homes — home">
      <LogoMark size={28} />
      <span className="font-display text-[15px] font-extrabold leading-none tracking-[-0.02em] sm:text-base">
        RealEstateFlow{!compact && <span className="text-marigold"> Homes</span>}
      </span>
    </Link>
  );
}
