export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeName(value: string) {
  return normalizeWhitespace(value);
}

export function isValidName(value: string) {
  const v = normalizeName(value);
  if (v.length < 2 || v.length > 80) return false;
  return /^[A-Za-z][A-Za-z\s.'-]*$/.test(v);
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  const v = normalizeEmail(value);
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export function normalizeIndianPhone(value: string) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, '');

  let national = digits;

  if (national.startsWith('91') && national.length > 10) {
    national = national.slice(-10);
  }

  if (national.startsWith('0') && national.length > 10) {
    national = national.slice(-10);
  }

  if (national.length !== 10) {
    return '';
  }

  return `+91${national}`;
}

export function isValidIndianMobile(value: string) {
  const normalized = normalizeIndianPhone(value);
  if (!normalized) return false;
  const last10 = normalized.slice(-10);
  return /^[6-9]\d{9}$/.test(last10);
}

export function normalizeAge(value: string | number) {
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function isValidAge(value: string | number, min = 18, max = 100) {
  const n = normalizeAge(value);
  if (n === null) return false;
  return n >= min && n <= max;
}
