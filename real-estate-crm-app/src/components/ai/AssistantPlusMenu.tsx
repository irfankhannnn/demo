/**
 * The composer's "+" menu — the CRM's flows, reachable without leaving the chat.
 *
 * The split against the quick-action chips below the composer is deliberate
 * and worth stating, because "put everything in both" is the failure mode:
 *
 *   - This menu launches **flows** — things with a screen, a file picker or a
 *     form behind them. Uploading a recording, opening the WhatsApp inbox.
 *   - The chips send **prompts** — things the agent answers in the chat.
 *
 * Purely presentational. The upload itself lives on the page, next to the
 * progress UI that reports it, so there is one owner of that state.
 */

import { useRef } from 'react';
import {
  Plus, UploadCloud, PhoneCall, Inbox, CalendarDays, Bot, Plug,
  UserPlus, Building2, BookOpen,
} from 'lucide-react';
import Popover, { PopoverItem, PopoverLabel, PopoverDivider } from './Popover';

export interface PlusMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the audio file picker for the call-recording flow. */
  onUploadRecording: () => void;
  /** Navigate away to a CRM screen. */
  onNavigate: (path: string) => void;
  /** Disabled while a turn or an upload is in flight. */
  busy?: boolean;
}

export default function AssistantPlusMenu({
  open,
  onOpenChange,
  onUploadRecording,
  onNavigate,
  busy = false,
}: PlusMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  const choose = (run: () => void) => () => {
    onOpenChange(false);
    // Return focus to the trigger so keyboard users are not dropped at the top
    // of the document after the menu unmounts.
    triggerRef.current?.focus();
    run();
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Add or open a CRM flow"
        onClick={() => onOpenChange(!open)}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
          open
            ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
            : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
        }`}
      >
        <Plus className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-45' : ''}`} />
      </button>

      <Popover open={open} onClose={() => onOpenChange(false)} align="left" side="top" label="CRM flows">
        <PopoverLabel>Bring in</PopoverLabel>
        <PopoverItem
          Icon={UploadCloud}
          label="Upload call recording"
          hint="Transcribe and suggest CRM updates"
          onSelect={choose(onUploadRecording)}
          disabled={busy}
        />

        <PopoverDivider />
        <PopoverLabel>Open</PopoverLabel>
        <PopoverItem
          Icon={PhoneCall}
          label="Call recordings"
          hint="Review and approve suggestions"
          onSelect={choose(() => onNavigate('/crm/call-recordings'))}
        />
        <PopoverItem
          Icon={Inbox}
          label="WhatsApp inbox"
          hint="Conversations your AI is handling"
          onSelect={choose(() => onNavigate('/crm/whatsapp-inbox'))}
        />
        <PopoverItem
          Icon={CalendarDays}
          label="Calendar"
          hint="Site visits and meetings"
          onSelect={choose(() => onNavigate('/crm/calendar'))}
        />

        <PopoverDivider />
        <PopoverLabel>Create with a form</PopoverLabel>
        <PopoverItem
          Icon={UserPlus}
          label="New lead"
          hint="Full form — the chat can do this too"
          onSelect={choose(() => onNavigate('/crm/leads/new'))}
        />
        <PopoverItem
          Icon={Building2}
          label="New property"
          hint="With photos and documents"
          onSelect={choose(() => onNavigate('/crm/properties/new'))}
        />
        <PopoverItem
          Icon={BookOpen}
          /* Khatabook is read-only to the agent by design, so this is the only
             way to add an entry — hence a form rather than a chip prompt. */
          label="New khata entry"
          hint="Only available as a form"
          onSelect={choose(() => onNavigate('/crm/khata/new'))}
        />

        <PopoverDivider />
        <PopoverLabel>Configure</PopoverLabel>
        <PopoverItem
          Icon={Bot}
          label="AI Employee"
          hint="Personality, hours and auto-reply"
          onSelect={choose(() => onNavigate('/crm/ai-employee'))}
        />
        <PopoverItem
          Icon={Plug}
          label="Integrations"
          hint="Instagram, ManyChat and MCP apps"
          onSelect={choose(() => onNavigate('/crm/ai-integrations'))}
        />
      </Popover>
    </div>
  );
}
