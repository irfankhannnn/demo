import type { LeadTemperature } from '../types/crm';

interface LeadTemperatureBadgeProps {
  temperature?: LeadTemperature | null;
  className?: string;
}

const TEMPERATURE_STYLES: Record<string, string> = {
  HOT: 'bg-rose-50/80 text-rose-700 ring-1 ring-rose-200',
  WARM: 'bg-amber-50/80 text-amber-700 ring-1 ring-amber-200',
  COLD: 'bg-sky-50/80 text-sky-700 ring-1 ring-sky-200',
};

const TEMPERATURE_LABEL: Record<string, string> = {
  HOT: '🔥 Hot',
  WARM: '🌤️ Warm',
  COLD: '❄️ Cold',
};

/**
 * Shared Hot/Warm/Cold badge — used in both LeadList's temperature column and
 * LeadDrawer's header, so the color mapping only lives in one place.
 */
export default function LeadTemperatureBadge({ temperature, className = '' }: LeadTemperatureBadgeProps) {
  if (!temperature) {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 ring-1 ring-slate-200 ${className}`}>
        Unscored
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${TEMPERATURE_STYLES[temperature] || 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'} ${className}`}>
      {TEMPERATURE_LABEL[temperature] || temperature}
    </span>
  );
}
