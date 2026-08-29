import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { API_URL } from './config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_CACHE = path.join(__dirname, '..', '.auth', 'api-token.json');

export type ApiAuth = {
  token: string;
  tenantId?: string | null;
};

/** Prefer fresh token from auth.setup; fall back to env TEST_TOKEN. */
export function resolveApiAuth(): ApiAuth {
  try {
    if (fs.existsSync(TOKEN_CACHE)) {
      const cached = JSON.parse(fs.readFileSync(TOKEN_CACHE, 'utf8'));
      if (cached?.token) {
        const exp = cached.exp ? Number(cached.exp) : null;
        if (!exp || Date.now() / 1000 < exp - 60) {
          return { token: cached.token, tenantId: cached.tenantId || null };
        }
      }
    }
  } catch {
    // ignore cache errors
  }

  const token = process.env.TEST_TOKEN || process.env.TENANT_A_TOKEN || '';
  return { token, tenantId: null };
}

export function jsonAuthHeaders(auth?: ApiAuth): Record<string, string> {
  const resolved = auth || resolveApiAuth();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${resolved.token}`,
  };
  if (resolved.tenantId) headers['x-tenant-id'] = resolved.tenantId;
  return headers;
}

export function writeApiAuthCache(data: {
  token: string;
  tenantId?: string | null;
  exp?: number | null;
}): void {
  const dir = path.dirname(TOKEN_CACHE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKEN_CACHE, JSON.stringify({
    token: data.token,
    tenantId: data.tenantId || null,
    exp: data.exp || null,
    savedAt: new Date().toISOString(),
    apiUrl: API_URL,
  }, null, 2));
}
