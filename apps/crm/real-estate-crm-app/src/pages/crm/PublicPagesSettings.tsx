/**
 * Public Pages settings.
 *
 * Where an agency admin claims the subdomain slug their public property site
 * is reachable at, sets the branding shown there, and switches the site on.
 * Nothing here is meaningful until a slug is claimed — enabling with no slug
 * is rejected by the server (see apps/crm/server/routes/publicPagesSettings.js), so
 * the save button and the slug field are the two things this screen protects
 * most carefully.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  Globe,
  Loader2,
  X,
} from 'lucide-react';
import Toast from '../../components/Toast';
import {
  publicPagesApi,
  PublicPagesApiError,
  type PublicPagesSettings as PublicPagesSettingsData,
} from '../../services/publicPagesApi';
import { getUserProfile } from '../../utils/authStorage';

const ADMIN_ROLES = ['ADMIN', 'FOUNDER', 'OWNER'];

const PUBLIC_PAGES_BASE_URL = (import.meta.env.VITE_PUBLIC_PAGES_BASE_URL as string | undefined)?.replace(/\/+$/, '');

type SlugCheckState = 'idle' | 'checking' | 'valid' | 'taken' | 'invalid';

interface FormState {
  agencySlug: string;
  agencyName: string;
  brandPrimaryColor: string;
  publicPhone: string;
  publicEmail: string;
  publicAddress: string;
  publicAbout: string;
  publicPagesEnabled: boolean;
}

function toFormState(settings: PublicPagesSettingsData, suggestedSlug: string): FormState {
  return {
    agencySlug: settings.slug || suggestedSlug || '',
    agencyName: settings.name || '',
    brandPrimaryColor: /^#[0-9a-fA-F]{6}$/.test(settings.brandPrimaryColor || '')
      ? settings.brandPrimaryColor
      : '#2563EB',
    publicPhone: settings.publicPhone || '',
    publicEmail: settings.publicEmail || '',
    publicAddress: settings.publicAddress || '',
    publicAbout: settings.about || '',
    publicPagesEnabled: settings.enabled,
  };
}

/** Cheap client-side shape check so obviously-bad input never reaches the server. Reserved names still round-trip through the API. */
function isPlausibleSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 40) return false;
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) return false;
  if (slug.includes('--')) return false;
  return true;
}

export default function PublicPagesSettings() {
  const profile = getUserProfile();
  const isAdmin = profile?.role ? ADMIN_ROLES.includes(profile.role) : false;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [settings, setSettings] = useState<PublicPagesSettingsData | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const [slugCheck, setSlugCheck] = useState<SlugCheckState>('idle');
  const [copied, setCopied] = useState(false);
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slugCheckSeq = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { settings: loaded, suggestedSlug } = await publicPagesApi.getSettings();
      setSettings(loaded);
      setForm(toFormState(loaded, suggestedSlug));
      setSlugCheck(loaded.slug ? 'valid' : 'idle');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load public pages settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced slug availability check. Skipped entirely when the slug is
  // unchanged from what's already saved — that's always available to us.
  useEffect(() => {
    if (!form) return;
    const slug = form.agencySlug.trim().toLowerCase();

    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);

    if (!slug) {
      setSlugCheck('idle');
      return;
    }
    if (settings?.slug && slug === settings.slug) {
      setSlugCheck('valid');
      return;
    }
    if (!isPlausibleSlug(slug)) {
      setSlugCheck('invalid');
      return;
    }

    setSlugCheck('checking');
    const seq = ++slugCheckSeq.current;
    slugCheckTimer.current = setTimeout(async () => {
      try {
        const result = await publicPagesApi.checkSlugAvailability(slug);
        if (seq !== slugCheckSeq.current) return; // a newer keystroke superseded this check
        setSlugCheck(result.available ? 'valid' : result.reason === 'taken' ? 'taken' : 'invalid');
      } catch {
        if (seq !== slugCheckSeq.current) return;
        setSlugCheck('idle');
      }
    }, 400);

    return () => {
      if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.agencySlug, settings?.slug]);

  const shareableUrl = useMemo(() => {
    if (!PUBLIC_PAGES_BASE_URL || !settings?.slug || !settings.enabled) return null;
    return `${PUBLIC_PAGES_BASE_URL}/t/${settings.slug}/`;
  }, [settings]);

  const handleCopy = async () => {
    if (!shareableUrl) return;
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast({ message: 'Could not copy — copy the link manually', type: 'error' });
    }
  };

  const handleSave = async () => {
    if (!form) return;
    setSaveError(null);

    const slug = form.agencySlug.trim().toLowerCase();

    if (form.publicPagesEnabled && !slug) {
      setSaveError('Choose a subdomain before switching public pages on.');
      return;
    }
    if (slug && (slugCheck === 'invalid' || slugCheck === 'taken')) {
      setSaveError(
        slugCheck === 'taken'
          ? 'That subdomain is already taken. Please choose another.'
          : 'That subdomain is not valid. Use 3-40 lowercase letters, numbers and single hyphens.',
      );
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(form.brandPrimaryColor)) {
      setSaveError('Brand colour must be a 6-digit hex value, e.g. #2563EB.');
      return;
    }

    setSaving(true);
    try {
      const { settings: saved } = await publicPagesApi.updateSettings({
        agencySlug: slug || undefined,
        agencyName: form.agencyName.trim() || undefined,
        brandPrimaryColor: form.brandPrimaryColor,
        publicPhone: form.publicPhone.trim() || null,
        publicEmail: form.publicEmail.trim() || null,
        publicAddress: form.publicAddress.trim() || null,
        publicAbout: form.publicAbout.trim() || null,
        publicPagesEnabled: form.publicPagesEnabled,
      });
      setSettings(saved);
      setForm(toFormState(saved, saved.slug || slug));
      setSlugCheck(saved.slug ? 'valid' : 'idle');
      setToast({ message: 'Public pages settings saved', type: 'success' });
    } catch (err) {
      if (err instanceof PublicPagesApiError) {
        setSaveError(err.details ? `${err.message}: ${err.details}` : err.message);
      } else {
        setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/crm" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to="/crm"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CRM
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Globe className="h-6 w-6 text-brand" />
          <h1 className="text-2xl font-bold text-slate-900">Public Pages</h1>
        </div>
        <p className="text-slate-500 mb-6">
          Claim your public property site address and set how it looks to visitors.
        </p>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-brand animate-spin" />
          </div>
        )}

        {!loading && loadError && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
            <p className="text-sm text-red-700">{loadError}</p>
            <button
              onClick={load}
              className="text-sm font-medium text-brand hover:text-blue-700"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && form && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            {saveError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
                {saveError}
              </div>
            )}

            {/* Enable toggle */}
            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">Enable public pages</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Turns on your public site. Visitors can browse published listings and book a
                  site visit once this is on and a subdomain is claimed below.
                </p>
              </div>
              <button
                onClick={() => setForm((prev) => (prev ? { ...prev, publicPagesEnabled: !prev.publicPagesEnabled } : prev))}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  form.publicPagesEnabled ? 'bg-brand' : 'bg-slate-200'
                }`}
                role="switch"
                aria-checked={form.publicPagesEnabled}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.publicPagesEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <label className="block font-medium text-slate-900 text-sm">Subdomain</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.agencySlug}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, agencySlug: e.target.value.toLowerCase() } : prev,
                    )
                  }
                  placeholder="your-agency"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
                />
                <span className="text-sm text-slate-400 whitespace-nowrap">.pages.realestateflow.in</span>
              </div>
              <div className="min-h-[1.25rem]">
                {slugCheck === 'checking' && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Checking availability...
                  </p>
                )}
                {slugCheck === 'valid' && form.agencySlug && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Available
                  </p>
                )}
                {slugCheck === 'taken' && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <X className="h-3 w-3" /> Already taken by another agency
                  </p>
                )}
                {slugCheck === 'invalid' && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <X className="h-3 w-3" /> Use 3-40 lowercase letters, numbers and single hyphens. Some names are reserved.
                  </p>
                )}
              </div>
            </div>

            {/* Shareable URL */}
            {shareableUrl && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <p className="text-sm font-medium text-slate-900">Your public site</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-blue-800 bg-white px-3 py-2 rounded-lg border border-blue-200 truncate">
                    {shareableUrl}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {/* Agency name */}
            <div className="space-y-2">
              <label className="block font-medium text-slate-900 text-sm">Agency name</label>
              <input
                type="text"
                value={form.agencyName}
                onChange={(e) => setForm((prev) => (prev ? { ...prev, agencyName: e.target.value } : prev))}
                placeholder="Cloudberry Real Estate"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
              />
            </div>

            {/* Brand colour */}
            <div className="space-y-2">
              <label className="block font-medium text-slate-900 text-sm">Brand colour</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(form.brandPrimaryColor) ? form.brandPrimaryColor : '#2563EB'}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, brandPrimaryColor: e.target.value } : prev))}
                  className="h-10 w-14 border border-slate-200 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={form.brandPrimaryColor}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, brandPrimaryColor: e.target.value } : prev))}
                  placeholder="#2563EB"
                  className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand focus:outline-none"
                />
              </div>
            </div>

            {/* Contact details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block font-medium text-slate-900 text-sm">Public phone</label>
                <input
                  type="tel"
                  value={form.publicPhone}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, publicPhone: e.target.value } : prev))}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block font-medium text-slate-900 text-sm">Public email</label>
                <input
                  type="email"
                  value={form.publicEmail}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, publicEmail: e.target.value } : prev))}
                  placeholder="hello@youragency.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-slate-900 text-sm">Public address</label>
              <input
                type="text"
                value={form.publicAddress}
                onChange={(e) => setForm((prev) => (prev ? { ...prev, publicAddress: e.target.value } : prev))}
                placeholder="Office address shown to visitors"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-slate-900 text-sm">About the agency</label>
              <textarea
                value={form.publicAbout}
                onChange={(e) => setForm((prev) => (prev ? { ...prev, publicAbout: e.target.value } : prev))}
                rows={4}
                placeholder="A short introduction shown on your public site"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:outline-none"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 px-4 bg-brand text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
