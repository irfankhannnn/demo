/**
 * The Assistant ↔ CRM switch that sits in the middle of the header.
 *
 * Two surfaces render this: the assistant page and the CRM dashboard. Keeping
 * it in one component is what makes the switch feel like a single control that
 * stays put while the page behind it changes, rather than two lookalike
 * buttons that drift apart.
 *
 * It navigates rather than toggling local state. The CRM dashboard is a
 * 900-line page with its own data fetching, polling and modals; mounting it
 * inside the assistant page to satisfy a tab metaphor would double-run all of
 * that. Two routes with one shared control gives the same feel and keeps the
 * back button working.
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, LayoutDashboard } from 'lucide-react';

export const ASSISTANT_PATH = '/crm/assistant';
export const CRM_HOME_PATH = '/crm';

interface Option {
  label: string;
  to: string;
  Icon: typeof Sparkles;
}

const OPTIONS: Option[] = [
  { label: 'Assistant', to: ASSISTANT_PATH, Icon: Sparkles },
  { label: 'CRM', to: CRM_HOME_PATH, Icon: LayoutDashboard },
];

export default function WorkspaceSwitch({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const onAssistant = location.pathname.startsWith(ASSISTANT_PATH);

  return (
    <div
      role="tablist"
      aria-label="Workspace"
      className={`inline-flex items-center gap-0.5 rounded-xl border border-white/50 bg-white/60 p-0.5 shadow-sm backdrop-blur-sm ${className}`}
    >
      {OPTIONS.map(({ label, to, Icon }) => {
        const active = to === ASSISTANT_PATH ? onAssistant : !onAssistant;
        return (
          <button
            key={to}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => { if (!active) navigate(to); }}
            className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${
              active
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 1.9} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
