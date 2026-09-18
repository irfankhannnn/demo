/**
 * Number / date formatting helpers — Indian conventions.
 *   formatRupees(8500000)          → "₹85 L"
 *   formatRupees(12000000)         → "₹1.2 Cr"
 *   formatRupees(45000, 'rent')    → "₹45k/mo"
 */

const LAKH = 100_000;
const CRORE = 10_000_000;

function trimZero(n: number, digits: number): string {
  const s = n.toFixed(digits);
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/** Compact Indian currency: "₹80 L", "₹1.2 Cr", "₹45k", "₹900". */
export function formatCompactRupees(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '—';
  if (amount >= CRORE) return `₹${trimZero(amount / CRORE, 2)} Cr`;
  if (amount >= LAKH) return `₹${trimZero(amount / LAKH, 1)} L`;
  if (amount >= 1000) return `₹${trimZero(amount / 1000, 1)}k`;
  return `₹${Math.round(amount)}`;
}

/** Price with mode suffix: rent adds "/mo". Null → "Price on request". */
export function formatRupees(amount: number | null | undefined, mode: 'sale' | 'rent' = 'sale'): string {
  if (amount == null) return 'Price on request';
  const base = formatCompactRupees(amount);
  return mode === 'rent' ? `${base}/mo` : base;
}

/** Full Indian-grouped number: 8500000 → "85,00,000". */
export function formatIndianNumber(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
}

/** Full price with ₹ and Indian grouping. */
export function formatFullRupees(amount: number | null | undefined): string {
  if (amount == null) return 'Price on request';
  return `₹${formatIndianNumber(amount)}`;
}

/** Price per sq ft when both numbers exist. */
export function formatPerSqft(amount: number | null | undefined, area: number | null | undefined): string | null {
  if (amount == null || !area || area <= 0) return null;
  return `₹${formatIndianNumber(Math.round(amount / area))}/sq ft`;
}

export function formatArea(sqft: number | null | undefined): string | null {
  if (!sqft || sqft <= 0) return null;
  return `${formatIndianNumber(sqft)} sq ft`;
}

export function formatBhk(bhk: number | null | undefined): string | null {
  if (bhk == null || bhk <= 0) return null;
  return bhk === 0.5 ? '1 RK' : `${bhk} BHK`;
}

/** "Semi-furnished" from "semi-furnished"; "Apartment" from "apartment". */
export function titleCase(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Relative time: "just now", "5m ago", "3h ago", "2d ago", "12 Aug". */
export function formatRelativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const diff = Math.max(0, now.getTime() - then.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "Wed, 18 Sep" from "2026-09-18". */
export function formatDateLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "10:30 AM" from "10:30". */
export function formatTimeLabel(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/** Time of day for chat bubbles: "3:42 PM". */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** Match score 0..1 → "81%". */
export function formatMatchPercent(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  return `${Math.round(Math.min(1, Math.max(0, score)) * 100)}%`;
}

/** Mask a phone for display before login: "+91 98••• ••210". */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '•••••';
  const last = digits.slice(-3);
  const first = digits.slice(0, Math.min(4, digits.length - 3));
  return `${first.startsWith('91') ? '+91 ' + first.slice(2) : first}•••• ••${last}`;
}

/** Normalise user-typed Indian phone: "98765 43210" → "+919876543210". */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  return null;
}

/** Clamp plain text to n chars with an ellipsis. */
export function truncate(text: string | null | undefined, n: number): string {
  if (!text) return '';
  return text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text;
}
