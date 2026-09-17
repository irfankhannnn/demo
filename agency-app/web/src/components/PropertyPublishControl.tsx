/**
 * Publish control shown on an existing property's edit page.
 *
 * Two independent gates decide whether a listing is actually live on the
 * agency's public site (mirrors agency-app/api/publicListingService.js):
 *   1. `publicVisibility === 'public'` — this control.
 *   2. lifecycle `status` is still marketable (available/for-sale/for-rent).
 * A SOLD or RENTED property can be marked public and still not be live, so
 * this never claims "published" when it isn't — it says exactly why.
 *
 * Also gated on the agency itself: publishing is meaningless until public
 * pages are enabled and a subdomain is claimed, so this checks that first and
 * links to the settings screen instead of silently letting the toggle do
 * nothing.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, ExternalLink, Globe, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { publicPagesApi } from '../services/publicPagesApi';

/** Mirrors PUBLICLY_MARKETABLE_STATUSES in agency-app/api/publicListingService.js. */
const PUBLICLY_MARKETABLE_STATUSES = new Set(['available', 'for-sale', 'for-rent']);

const STATUS_LABELS: Record<string, string> = {
  available: 'available',
  'for-sale': 'listed for sale',
  'for-rent': 'listed for rent',
  rented: 'rented',
  sold: 'sold',
  'on-hold': 'on hold',
  'out-of-stock': 'out of stock',
  inactive: 'inactive',
  'not-listed': 'not listed',
  archived: 'archived',
};

const PUBLIC_PAGES_BASE_URL = (import.meta.env.VITE_PUBLIC_PAGES_BASE_URL as string | undefined)?.replace(/\/+$/, '');

/** Cosmetic only — the server redirects to the canonical slug on mismatch, so this never needs to be exact. */
function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return base || 'property';
}

interface AgencyPagesState {
  enabled: boolean;
  slug: string | null;
}

interface PropertyPublishControlProps {
  propertyId: string;
  title: string;
  status: string;
  publicVisibility?: 'public' | 'private' | null;
  onVisibilityChange: (next: 'public' | 'private') => void;
}

export default function PropertyPublishControl({
  propertyId,
  title,
  status,
  publicVisibility,
  onVisibilityChange,
}: PropertyPublishControlProps) {
  const navigate = useNavigate();

  const [agencyPages, setAgencyPages] = useState<AgencyPagesState | null>(null);
  const [loadingAgency, setLoadingAgency] = useState(true);
  const [agencyError, setAgencyError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingAgency(true);
    setAgencyError(null);
    publicPagesApi
      .getSettings()
      .then(({ settings }) => {
        if (cancelled) return;
        setAgencyPages({ enabled: settings.enabled, slug: settings.slug });
      })
      .catch((err) => {
        if (cancelled) return;
        setAgencyError(err instanceof Error ? err.message : 'Failed to load public pages settings');
      })
      .finally(() => {
        if (!cancelled) setLoadingAgency(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isPublic = publicVisibility === 'public';
  const isLive = isPublic && PUBLICLY_MARKETABLE_STATUSES.has(status);
  const agencyReady = Boolean(agencyPages?.enabled && agencyPages?.slug);

  const shareableUrl =
    isLive && agencyReady && PUBLIC_PAGES_BASE_URL
      ? `${PUBLIC_PAGES_BASE_URL}/t/${agencyPages!.slug}/property/${slugifyTitle(title)}/${propertyId}`
      : null;

  const handleToggle = async () => {
    if (!agencyReady) return;
    const next = isPublic ? 'private' : 'public';
    setToggling(true);
    setToggleError(null);
    try {
      await api.updateCRMProperty(propertyId, { publicVisibility: next });
      onVisibilityChange(next);
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Failed to update publish status');
    } finally {
      setToggling(false);
    }
  };

  const handleCopy = async () => {
    if (!shareableUrl) return;
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToggleError('Could not copy the link — copy it manually');
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-slate-500" />
        <label className="text-sm font-medium text-gray-700">Public listing</label>
      </div>

      {loadingAgency && (
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking public pages status...
        </p>
      )}

      {!loadingAgency && agencyError && (
        <p className="text-xs text-red-600">
          Couldn't check your public pages settings ({agencyError}). Reload the page to try again.
        </p>
      )}

      {!loadingAgency && !agencyError && !agencyReady && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Public pages aren't set up yet.{' '}
          <button
            type="button"
            onClick={() => navigate('/crm/settings/public-pages')}
            className="underline font-semibold hover:text-amber-900"
          >
            Claim your subdomain and turn public pages on
          </button>{' '}
          before publishing a listing.
        </p>
      )}

      {!loadingAgency && !agencyError && agencyReady && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-900">
                {isPublic ? 'Marked public' : 'Not published'}
              </p>
              {isPublic && !isLive && (
                <p className="text-xs text-amber-700 mt-0.5">
                  Marked public, but not live because this property is {STATUS_LABELS[status] || status}.
                </p>
              )}
              {isLive && (
                <p className="text-xs text-emerald-600 mt-0.5">Live on your public site</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleToggle}
              disabled={toggling}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                isPublic ? 'bg-brand' : 'bg-slate-200'
              }`}
              role="switch"
              aria-checked={isPublic}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isPublic ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {toggleError && <p className="text-xs text-red-600">{toggleError}</p>}

          {shareableUrl && (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-blue-800 bg-white px-2.5 py-1.5 rounded-lg border border-blue-200 truncate">
                {shareableUrl}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors flex-shrink-0"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <a
                href={shareableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center p-1.5 bg-white border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-50 transition-colors flex-shrink-0"
                aria-label="Open public listing"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
