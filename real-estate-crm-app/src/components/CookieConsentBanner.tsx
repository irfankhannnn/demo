import { useCallback, useEffect, useState } from 'react';

/**
 * CRM Cookie Consent Banner (DPDP-compliant).
 *
 * Distinct from the landing-page banner: the CRM only loads PostHog, so this
 * banner exposes a SINGLE meaningful toggle (Analytics). There is intentionally
 * NO Marketing/Functional toggle — GA4, Meta Pixel, LinkedIn and Hotjar are not
 * loaded inside the app.
 *
 * Shares the `cookieConsent` localStorage key + schema (version 1) with the LP
 * banner (01-SHARED-CONTRACTS §3.5). On every save it dispatches a
 * `cookieConsentChanged` event that analytics.ts (PR-E) listens to.
 */

const CONSENT_KEY = 'cookieConsent';
const CONSENT_VERSION = 1;

interface CrmCookieConsent {
  essential: true;
  analytics: boolean;
  version: number;
  timestamp: string;
}

declare global {
  interface Window {
    openCRMCookiePreferences?: () => void;
  }
}

function readStoredConsent(): CrmCookieConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CrmCookieConsent;
  } catch {
    return null;
  }
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  const openPreferences = useCallback(() => {
    const stored = readStoredConsent();
    setAnalytics(stored?.analytics ?? true);
    setShowCustomize(true);
    setVisible(true);
  }, []);

  useEffect(() => {
    const stored = readStoredConsent();
    if (!stored || stored.version !== CONSENT_VERSION) {
      setVisible(true);
    }
    window.openCRMCookiePreferences = openPreferences;
    return () => {
      if (window.openCRMCookiePreferences === openPreferences) {
        delete window.openCRMCookiePreferences;
      }
    };
  }, [openPreferences]);

  const persist = useCallback((analyticsAllowed: boolean) => {
    const consent: CrmCookieConsent = {
      essential: true,
      analytics: analyticsAllowed,
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    } catch {
      /* storage unavailable — banner still hides for this session */
    }
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: consent }));
    setShowCustomize(false);
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-modal={showCustomize}
      className="fixed inset-x-0 bottom-0 z-[9999] border-t border-slate-700 bg-[#07111E] text-white shadow-2xl"
    >
      {!showCustomize ? (
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-slate-200">
            We use essential cookies to run the app. With your consent we also measure product
            usage via PostHog to improve RealtyFlow. No ads, no retargeting. See our{' '}
            <a href="/legal/privacy" className="underline hover:text-white">
              Privacy Policy
            </a>
            .
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => persist(false)}
              className="rounded-md border border-slate-500 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Reject non-essential
            </button>
            <button
              type="button"
              onClick={openPreferences}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 underline hover:text-white"
            >
              Customize
            </button>
            <button
              type="button"
              onClick={() => persist(true)}
              className="rounded-md bg-[#22C55E] px-4 py-2 text-sm font-semibold text-[#07111E] hover:bg-[#16A34A]"
            >
              Accept all
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-5xl px-5 py-5">
          <h2 className="text-base font-semibold text-white">Cookie preferences</h2>
          <p className="mt-1 text-sm text-slate-300">
            Manage how RealtyFlow uses cookies in the app.
          </p>

          <div className="mt-4 space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-md border border-slate-700 bg-slate-900/40 p-3">
              <div>
                <p className="text-sm font-medium text-white">Essential</p>
                <p className="text-xs text-slate-400">Required for the site to work.</p>
              </div>
              <span className="select-none rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200">
                Always on
              </span>
            </div>

            <label className="flex items-start justify-between gap-4 rounded-md border border-slate-700 bg-slate-900/40 p-3">
              <div>
                <p className="text-sm font-medium text-white">Analytics</p>
                <p className="text-xs text-slate-400">
                  We measure product usage via PostHog to improve the app. No ads, no retargeting.
                </p>
              </div>
              <input
                type="checkbox"
                aria-label="Analytics"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-[#22C55E]"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => persist(false)}
              className="rounded-md border border-slate-500 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Reject non-essential
            </button>
            <button
              type="button"
              onClick={() => persist(analytics)}
              className="rounded-md bg-[#22C55E] px-4 py-2 text-sm font-semibold text-[#07111E] hover:bg-[#16A34A]"
            >
              Save preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
