/**
 * Quick-action chips under the composer.
 *
 * These answer the blank-page problem: a chat box with a cursor tells a broker
 * nothing about what the assistant can actually do. Each chip opens a short
 * list of real phrasings, so the first useful turn is one tap away and the
 * user learns the vocabulary by using it.
 *
 * EVERY PROMPT HERE MAPS TO A TOOL THAT EXISTS. The list was written against
 * the live registry in `server/shared/toolDefinitions.js`, which is also why
 * there is no "add a khata entry" — khatabook is deliberately read-only to the
 * agent, so offering it would teach a capability that then refuses. Creating a
 * khata entry is in the "+" menu instead, where it opens the real form.
 *
 * Prompts come in two kinds:
 *   - `send` fires the turn immediately. Used where the phrasing is complete.
 *   - `prefill` drops the text in the composer with the cursor at the end.
 *     Used where the user has to supply a name, an area or a number — sending
 *     "2BHK in " on its own would just make the agent ask.
 */

import { useState } from 'react';
import {
  Users, Building2, Contact as ContactIcon, CalendarDays, BookOpen, BarChart3, ChevronDown,
} from 'lucide-react';
import Popover from './Popover';

export interface QuickPrompt {
  label: string;
  /** The text that goes to the agent, or into the composer when `prefill`. */
  text: string;
  /** Put the text in the box instead of sending it — the user must finish the sentence. */
  prefill?: boolean;
}

interface QuickGroup {
  key: string;
  label: string;
  Icon: typeof Users;
  /** Tailwind classes for the chip's icon tile. */
  tone: string;
  prompts: QuickPrompt[];
}

const GROUPS: QuickGroup[] = [
  {
    key: 'leads',
    label: 'Leads',
    Icon: Users,
    tone: 'bg-indigo-50 text-indigo-600',
    prompts: [
      { label: "Today's new leads", text: 'Aaj ke naye leads dikhao' },
      { label: 'Priority leads', text: 'Priority leads dikhao' },
      { label: 'Pending follow-ups', text: 'Konse leads ka follow-up pending hai?' },
      { label: 'Create a lead', text: 'Naya lead banao: ', prefill: true },
      { label: 'Update a lead', text: 'Is lead ko update karo: ', prefill: true },
    ],
  },
  {
    key: 'properties',
    label: 'Properties',
    Icon: Building2,
    tone: 'bg-blue-50 text-blue-600',
    prompts: [
      { label: 'Available properties', text: 'Available properties dikhao' },
      { label: 'Search by area', text: '2BHK in ', prefill: true },
      { label: 'Add a property', text: 'Nayi property add karo: ', prefill: true },
      { label: 'Properties summary', text: 'Properties ka summary dikhao' },
    ],
  },
  {
    key: 'contacts',
    label: 'Contacts',
    Icon: ContactIcon,
    tone: 'bg-teal-50 text-teal-600',
    prompts: [
      { label: 'Look up a number', text: 'Is number ka contact dikhao: ', prefill: true },
      { label: 'Find a person', text: 'Find karo: ', prefill: true },
      { label: 'Add a contact', text: 'Naya contact add karo: ', prefill: true },
    ],
  },
  {
    key: 'meetings',
    label: 'Meetings',
    Icon: CalendarDays,
    tone: 'bg-violet-50 text-violet-600',
    prompts: [
      { label: "Tomorrow's meetings", text: 'Kal ke meetings dikhao' },
      { label: 'Upcoming site visits', text: 'Aane wale site visits dikhao' },
      { label: 'Schedule a meeting', text: 'Meeting schedule karo: ', prefill: true },
    ],
  },
  {
    key: 'khata',
    label: 'Khatabook',
    Icon: BookOpen,
    tone: 'bg-amber-50 text-amber-600',
    prompts: [
      { label: 'Khata summary', text: 'Khata ka summary dikhao' },
      { label: 'Search entries', text: 'Khata entries search karo: ', prefill: true },
    ],
  },
  {
    key: 'business',
    label: 'Business',
    Icon: BarChart3,
    tone: 'bg-emerald-50 text-emerald-600',
    prompts: [
      { label: "Today's brief", text: 'Aaj ka brief dikhao' },
      { label: 'Business health', text: 'Business health kaisi hai?' },
      { label: 'Pipeline summary', text: 'Pipeline ka summary dikhao' },
      { label: 'This month vs last', text: 'Is mahine ke trends dikhao' },
    ],
  },
];

export default function QuickActions({
  onSend,
  onPrefill,
  disabled = false,
}: {
  onSend: (text: string) => void;
  onPrefill: (text: string) => void;
  disabled?: boolean;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const pick = (prompt: QuickPrompt) => {
    setOpenKey(null);
    if (prompt.prefill) onPrefill(prompt.text);
    else onSend(prompt.text);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {GROUPS.map((group) => {
        const open = openKey === group.key;
        return (
          <div key={group.key} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              disabled={disabled}
              onClick={() => setOpenKey(open ? null : group.key)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-all duration-200 disabled:opacity-50 ${
                open
                  ? 'border-indigo-200 bg-white text-slate-900 shadow-sm'
                  : 'border-slate-200/70 bg-white/70 text-slate-600 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-md ${group.tone}`}>
                <group.Icon className="h-3 w-3" />
              </span>
              {group.label}
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              />
            </button>

            <Popover
              open={open}
              onClose={() => setOpenKey(null)}
              align="center"
              side="bottom"
              label={`${group.label} prompts`}
              /* Caps the width on a phone so a centred menu cannot push the
                 page into a horizontal scroll. */
              className="max-w-[min(18rem,calc(100vw-2rem))]"
            >
              {group.prompts.map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  role="menuitem"
                  onClick={() => pick(prompt)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-100"
                >
                  <span className="text-[13px] font-medium text-slate-800">{prompt.label}</span>
                  <span className="line-clamp-1 text-[11px] text-slate-400">
                    {prompt.prefill ? `${prompt.text}…` : prompt.text}
                  </span>
                </button>
              ))}
            </Popover>
          </div>
        );
      })}
    </div>
  );
}
