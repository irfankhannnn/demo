/**
 * Config loading. Order: defaults <- ~/.ig-agent/config.json <- environment.
 * Nothing here ever holds a secret; secrets live in the vault (src/auth/vault.js).
 */
import fs from 'node:fs';
import { configPath } from './paths.js';

export const DEFAULTS = {
  tokenProvider: 'dev',              // dev | shared | hosted  (see src/auth/tokenProvider.js)
  graphBase: 'https://graph.instagram.com/v23.0',
  oauthAuthorizeUrl: 'https://www.instagram.com/oauth/authorize',
  oauthTokenUrl: 'https://api.instagram.com/oauth/access_token',
  scopes: [
    'instagram_business_basic',
    'instagram_business_manage_messages',
    'instagram_business_manage_comments',
    'instagram_business_content_publish',
  ],
  oauthRedirectPort: 7318,
  console: { host: '127.0.0.1', port: 7317 },
  uplink: { baseUrl: '', enabled: false, batchSize: 250, maxRetries: 12 },
  dryRun: false,
  killSwitch: false,
  drafter: { provider: 'template', model: null, language: 'hinglish' },
  autoSend: { enabled: false, categories: [] },
  schedule: {
    profileMinutes: 24 * 60,
    mediaMinutes: 60,
    commentsMinutes: 5,
    conversationsMinutes: 1,
    uplinkMinutes: 15,
  },
  rateLimits: null,                  // null => contract section 7 defaults
};

function deepMerge(base, patch) {
  if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) return patch ?? base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(base?.[k] ?? {}, v) : v;
  }
  return out;
}

export function loadConfig(overrides = {}) {
  let file = {};
  try {
    const p = configPath();
    if (fs.existsSync(p)) file = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    throw new Error(`config.json is not valid JSON: ${err.message}`);
  }
  let cfg = deepMerge(DEFAULTS, file);

  const env = {};
  if (process.env.IG_AGENT_DRY_RUN === '1') env.dryRun = true;
  if (process.env.IG_AGENT_KILL_SWITCH === '1') env.killSwitch = true;
  if (process.env.IG_AGENT_UPLINK_URL) env.uplink = { baseUrl: process.env.IG_AGENT_UPLINK_URL, enabled: true };
  if (process.env.IG_AGENT_TOKEN_PROVIDER) env.tokenProvider = process.env.IG_AGENT_TOKEN_PROVIDER;
  if (process.env.IG_AGENT_GRAPH_BASE) env.graphBase = process.env.IG_AGENT_GRAPH_BASE;

  cfg = deepMerge(cfg, env);
  cfg = deepMerge(cfg, overrides);
  return cfg;
}

export function saveConfig(cfg) {
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  return cfg;
}
