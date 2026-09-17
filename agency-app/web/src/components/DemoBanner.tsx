import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * DemoBanner
 *
 * Sticky yellow banner shown only on the demo deployment (demo.realestateflow.in).
 * Gated on the `VITE_IS_DEMO` build-time env var — renders nothing unless it is
 * exactly the string `'true'`, so it is a no-op in production and local dev.
 *
 * Behaviour:
 * - Dismissable via the X button. The dismissal is stored in `sessionStorage`,
 *   so it stays dismissed across in-tab navigation but reappears in a new session
 *   (new tab / after the tab is closed and reopened).
 * - Accessible: `role="alert"` and a keyboard-focusable dismiss control.
 */
const DISMISS_KEY = 'demoBannerDismissed';

export default function DemoBanner() {
  const isDemo = import.meta.env.VITE_IS_DEMO === 'true';
  const [dismissed, setDismissed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.sessionStorage.getItem(DISMISS_KEY) === 'true',
  );

  if (!isDemo || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // sessionStorage may be unavailable (private mode / SSR) — fail open and
      // still hide the banner for this render.
    }
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-yellow-100 px-4 py-2 text-center text-sm font-medium text-yellow-800"
    >
      <span>
        🟡 DEMO TENANT — data resets daily at 2:00 AM IST. Do not enter real data.
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss demo banner"
        className="ml-2 flex-shrink-0 rounded p-1 text-yellow-800 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
