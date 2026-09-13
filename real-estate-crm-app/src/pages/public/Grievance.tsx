import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, Mail, Clock } from 'lucide-react';
import { CRM_API_URL } from '../../config/apiConfig';

/**
 * Public DPDP Act 2023 grievance portal.
 *
 * PUBLIC page — must NOT be wrapped in ProtectedRoute. Submits to the public
 * `POST /api/grievance` endpoint (rate-limited + hCaptcha + honeypot server-side).
 */

const API_BASE_URL = CRM_API_URL;
const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY || '';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'data_access', label: 'Access my data' },
  { value: 'data_correction', label: 'Correct my data' },
  { value: 'data_deletion', label: 'Delete my data' },
  { value: 'data_export', label: 'Export my data' },
  { value: 'account_security', label: 'Account security' },
  { value: 'billing', label: 'Billing issue' },
  { value: 'service_complaint', label: 'Service complaint' },
  { value: 'other', label: 'Other' },
];

const GO_NAME = import.meta.env.VITE_GRIEVANCE_OFFICER_NAME || 'Grievance Officer';
const GO_EMAIL = 'info@realestateflow.in';

declare global {
  interface Window {
    hcaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

type Errors = Partial<Record<'name' | 'email' | 'phone' | 'category' | 'description' | 'captcha' | 'form', string>>;

export default function Grievance() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [middleName, setMiddleName] = useState(''); // honeypot
  const [captchaToken, setCaptchaToken] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  // Load + render the hCaptcha widget (only when a site key is configured).
  useEffect(() => {
    if (!HCAPTCHA_SITE_KEY) return;

    const renderWidget = () => {
      if (window.hcaptcha && captchaRef.current && widgetId.current === null) {
        widgetId.current = window.hcaptcha.render(captchaRef.current, {
          sitekey: HCAPTCHA_SITE_KEY,
          callback: (token: string) => setCaptchaToken(token),
          'expired-callback': () => setCaptchaToken(''),
        });
      }
    };

    if (window.hcaptcha) {
      renderWidget();
      return;
    }

    const existing = document.querySelector('script[data-hcaptcha]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-hcaptcha', 'true');
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else {
      existing.addEventListener('load', renderWidget);
    }
  }, []);

  const validate = (): boolean => {
    const next: Errors = {};
    if (name.trim().length < 1 || name.trim().length > 100) next.name = 'Please enter your name (max 100 chars).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Please enter a valid email address.';
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (cleanPhone && !/^\d{10}$/.test(cleanPhone)) next.phone = 'Phone must be a 10-digit number.';
    if (!category) next.category = 'Please select a category.';
    if (description.trim().length < 10 || description.trim().length > 2000) {
      next.description = 'Description must be between 10 and 2000 characters.';
    }
    if (HCAPTCHA_SITE_KEY && !captchaToken) next.captcha = 'Please complete the captcha.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch(`${API_BASE_URL}/grievance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.replace(/[\s-]/g, '') || undefined,
          category,
          description: description.trim(),
          middle_name: middleName, // honeypot — should always be empty
          hcaptchaToken: captchaToken || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setErrors({ form: 'Too many submissions from your network. Please try again later.' });
        return;
      }
      if (!res.ok) {
        setErrors({ form: data.error || 'Something went wrong. Please try again.' });
        if (HCAPTCHA_SITE_KEY && window.hcaptcha) {
          window.hcaptcha.reset(widgetId.current || undefined);
          setCaptchaToken('');
        }
        return;
      }

      setTrackingId(data.trackingId || 'GR-XXXXXX');
    } catch {
      setErrors({ form: 'Network error. Please check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Grievance &amp; Data Rights</h1>
          <p className="mt-2 text-slate-600">
            Exercise your rights under the DPDP Act 2023 or report a concern. We respond within 7 working days.
          </p>
        </header>

        {trackingId ? (
          <div
            role="status"
            className="mx-auto max-w-2xl rounded-2xl border border-green-200 bg-green-50 p-8 text-center"
          >
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
            <h2 className="text-xl font-semibold text-green-800">Grievance received</h2>
            <p className="mt-2 text-green-700">
              Your tracking ID is{' '}
              <span className="font-mono font-bold">{trackingId}</span>.
            </p>
            <p className="mt-2 text-sm text-green-700">
              Please save this ID. Our Grievance Officer will respond within 7 working days as per the DPDP Act 2023.
            </p>
            <Link to="/" className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700">
              Back to home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Form (left, 2 cols on desktop) */}
            <form onSubmit={handleSubmit} noValidate className="md:col-span-2 rounded-2xl bg-white p-6 shadow-sm">
              {errors.form && (
                <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errors.form}
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="g-name" className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                <input
                  id="g-name"
                  type="text"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="g-email" className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
                  <input
                    id="g-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="g-phone" className="mb-1 block text-sm font-medium text-slate-700">Phone (optional)</label>
                  <input
                    id="g-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit number"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="g-category" className="mb-1 block text-sm font-medium text-slate-700">Category *</label>
                <select
                  id="g-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a category…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
              </div>

              <div className="mb-4">
                <label htmlFor="g-description" className="mb-1 block text-sm font-medium text-slate-700">
                  Description * <span className="font-normal text-slate-400">({description.trim().length}/2000)</span>
                </label>
                <textarea
                  id="g-description"
                  value={description}
                  maxLength={2000}
                  rows={6}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
              </div>

              {/* Honeypot — visually hidden, off the tab order, not for humans */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 'auto', height: 0, width: 0, overflow: 'hidden' }}>
                <label htmlFor="middle_name">Middle name</label>
                <input
                  id="middle_name"
                  name="middle_name"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                />
              </div>

              {HCAPTCHA_SITE_KEY && (
                <div className="mb-4">
                  <div ref={captchaRef} />
                  {errors.captcha && <p className="mt-1 text-xs text-red-600">{errors.captcha}</p>}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit grievance'}
              </button>
            </form>

            {/* Info column (right) */}
            <aside className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <ShieldCheck className="h-5 w-5 text-blue-600" /> Grievance Officer
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Name</dt>
                  <dd className="font-medium text-slate-800">{GO_NAME}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-slate-500"><Mail className="h-4 w-4" /> Email</dt>
                  <dd className="font-medium text-slate-800">
                    <a className="text-blue-600 hover:underline" href={`mailto:${GO_EMAIL}`}>{GO_EMAIL}</a>
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-slate-500"><Clock className="h-4 w-4" /> Response time</dt>
                  <dd className="font-medium text-slate-800">Within 7 working days per DPDP Act 2023</dd>
                </div>
              </dl>
            </aside>
          </div>
        )}

        <footer className="mt-10 text-center text-sm text-slate-500">
          <Link to="/legal/terms" className="hover:underline">Terms</Link>
          <span className="mx-2">·</span>
          <Link to="/legal/privacy" className="hover:underline">Privacy</Link>
          <span className="mx-2">·</span>
          <Link to="/" className="hover:underline">Home</Link>
        </footer>
      </div>
    </div>
  );
}
