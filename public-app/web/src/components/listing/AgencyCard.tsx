import { Link } from 'react-router-dom';
import { BadgeCheck, Building2, Phone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { maskPhone } from '@/lib/format';
import type { AgencyCard as AgencyCardShape } from '@/types/api';
import { cn } from '@/lib/cn';

/** Agency card — phone masked until logged in (then a tap-to-call link). */
export function AgencyCard({ agency, phone, className, note }: { agency: AgencyCardShape; phone?: string | null; className?: string; note?: string }) {
  const { isAuthed, openModal } = useAuth();
  const color = agency.brandPrimaryColor || '#FF7A1A';
  return (
    <div className={cn('rounded-card border border-line bg-paper-2/50 p-4', className)}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-paper" style={{ background: color }} aria-hidden>
          <Building2 size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-dust-dim">Listed by</p>
          <Link to={`/agency/${encodeURIComponent(agency.slug)}`} className="flex items-center gap-1 truncate font-display text-[15px] font-extrabold text-ink hover:text-marigold-deep">
            {agency.name}
            <BadgeCheck size={15} className="shrink-0 text-tulsi" aria-label="Verified partner" />
          </Link>
        </div>
      </div>
      {phone !== undefined && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Phone size={15} className="text-dust-dim" aria-hidden />
          {phone ? (
            isAuthed ? (
              <a href={`tel:${phone}`} className="font-bold text-ink hover:text-marigold-deep tabular">
                {phone}
              </a>
            ) : (
              <button type="button" className="font-bold text-ink tabular" onClick={() => openModal({ reason: 'Login to see the agency phone number' })}>
                {maskPhone(phone)} <span className="ml-1 text-xs font-bold text-marigold-deep underline">login to reveal</span>
              </button>
            )
          ) : (
            <span className="text-dust-dim">Reach them via chat below</span>
          )}
        </div>
      )}
      {note && <p className="mt-2 text-xs text-dust-dim">{note}</p>}
    </div>
  );
}
