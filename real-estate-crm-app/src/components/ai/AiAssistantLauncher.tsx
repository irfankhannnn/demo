/**
 * Floating launcher for the AI assistant (Phase 5).
 *
 * Rendered globally next to BottomTabBar rather than as a layout route, for the
 * same reason: App.tsx is a flat list of ~55 routes with no <Outlet>, so a
 * layout-based approach would be a far larger change than this needs.
 *
 * Positioning has to dodge two things that already sit bottom-right: the NPS
 * card (`bottom-4 right-4`, z-[90]) and, below `md:`, the bottom tab bar. The
 * offsets below account for both — see the class comments.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import AiChatPanel from './AiChatPanel';

/**
 * Routes with no assistant: unauthenticated screens, onboarding and public
 * pages. Mirrors BottomTabBar's list — offering an authenticated CRM assistant
 * on the login screen would be nonsense, and it would sit over the form.
 */
const HIDDEN_PREFIXES = [
  '/login',
  '/phone-login',
  '/signup',
  '/auth/callback',
  '/onboarding',
  '/legal',
  '/grievance',
  '/nps',
  '/member/no-access',
];

export default function AiAssistantLauncher() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const hidden = HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));

  // Close on navigation — clicking an entity card routes away, and leaving the
  // panel open over the record the user just asked to see defeats the point.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  if (hidden) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
          /*
           * bottom-20 clears the 56px tab bar plus its safe-area inset on
           * phones; md:bottom-6 drops back down once the bar is gone.
           * z-[60] sits under the panel (z-[71]) and under the NPS card
           * (z-[90]) so neither is ever obscured by the launcher.
           */
          className="fixed bottom-20 right-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
      <AiChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
