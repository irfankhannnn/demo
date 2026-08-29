import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { hasNativeRuntime } from '../../lib/platform';
import { openAuthBrowser } from '../../lib/nativeAuth';

/**
 * Canonical home of the legal documents. They live on the marketing site
 * (marketing-and-sales/creative/landing-pages/legal/) and are deployed
 * separately, so the app points at them rather than keeping a second copy that
 * would quietly drift out of sync with the lawyer-reviewed version.
 */
const LEGAL_BASE_URL =
  import.meta.env.VITE_LEGAL_BASE_URL || 'https://realestateflow.in/legal';

export type LegalDocumentKind = 'privacy' | 'terms' | 'cookies' | 'refund';

const TITLES: Record<LegalDocumentKind, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  cookies: 'Cookie Policy',
  refund: 'Refund Policy',
};

interface LegalDocumentProps {
  kind: LegalDocumentKind;
}

/**
 * Renders a legal document route.
 *
 * These routes existed only as links before: CookieConsentBanner pointed at
 * /legal/privacy and Grievance at /legal/terms, but neither route was defined,
 * so both fell through the catch-all. On the web that redirected to /crm; in
 * the mobile WebView it is a dead end a reviewer will find, and an unreachable
 * privacy policy is a straightforward rejection.
 *
 * Native opens the document in the system browser rather than navigating the
 * WebView, so the user keeps their place in the app and can return with one tap.
 */
export default function LegalDocument({ kind }: LegalDocumentProps) {
  const url = `${LEGAL_BASE_URL}/${kind}`;
  const title = TITLES[kind];
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (hasNativeRuntime()) {
      openAuthBrowser(url).catch(() => {
        // Leave the manual link below as the fallback.
      });
      setOpened(true);
      return;
    }
    window.location.replace(url);
  }, [url]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-xl font-semibold text-slate-900 mb-2">{title}</h1>
        <p className="text-sm text-slate-600 mb-6">
          {opened
            ? `The ${title.toLowerCase()} has opened in your browser.`
            : `Opening the ${title.toLowerCase()}…`}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
        >
          Open {title}
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
