/**
 * process-partials.js
 *
 * Second half of `npm run build:lps` (runs after `vite build` compiles the CSS).
 *
 * Responsibilities:
 *   1. Expand `{{> partial-name}}` includes in every LP HTML page using the
 *      shared partials in `_partials/` (.hbs preferred, .html fallback).
 *   2. Inject build-time env vars (`{{GA4_ID}}`, `{{META_PIXEL_ID}}`, ...) from
 *      `landing-pages/.env` (falls back to .env.example placeholders).
 *   3. Copy the processed pages + SEO files (sitemap.xml, robots.txt, llms.txt)
 *      into `dist/`, mirroring the existing folder layout.
 *
 * It is intentionally dependency-light (only `dotenv`) and side-effect free on
 * the source HTML — it only ever writes to `dist/`. Real templated pages are
 * authored in PR-I; this pipeline is what builds them.
 */
import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LP_ROOT = resolve(__dirname, '../..'); // landing-pages
const PARTIALS_DIR = join(LP_ROOT, '_partials');
const DIST_DIR = join(LP_ROOT, 'dist');

// Directories that are never treated as page sources.
const IGNORE_DIRS = new Set(['build', 'dist', 'node_modules', '_partials', 'assets', '.git', 'realestateflow-directions']);

// --- 1. Load env: .env.example provides defaults, a local .env overrides
//        them, and real CI/host env vars (e.g. set in the Netlify dashboard)
//        win over both — that's how real secrets reach the build on Netlify,
//        since no .env file is ever committed to the repo. ---
const envPath = join(LP_ROOT, '.env');
const envExamplePath = join(LP_ROOT, '.env.example');
const env = {};
if (existsSync(envExamplePath)) {
  loadEnv({ path: envExamplePath, processEnv: env });
}
if (existsSync(envPath)) {
  loadEnv({ path: envPath, processEnv: env });
} else {
  console.warn('[process-partials] No .env found — using .env.example placeholder values (overridden by any matching process.env vars).');
}
for (const key of Object.keys(env)) {
  if (process.env[key]) env[key] = process.env[key];
}

// --- 2. Collect partials map: name -> rendered string ---
const partials = {};
if (existsSync(PARTIALS_DIR)) {
  for (const file of readdirSync(PARTIALS_DIR)) {
    const m = file.match(/^(.+)\.(hbs|html)$/);
    if (m) partials[m[1]] = readFileSync(join(PARTIALS_DIR, file), 'utf-8');
  }
}

function injectEnv(html) {
  // Replace {{ENV_TOKEN}} only when the all-caps token exists in env.
  return html.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (full, key) =>
    Object.prototype.hasOwnProperty.call(env, key) ? env[key] : full,
  );
}

function expandPartials(html, depth = 0) {
  if (depth > 5) return html; // guard against cycles
  let changed = false;
  const out = html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (full, name) => {
    if (Object.prototype.hasOwnProperty.call(partials, name)) {
      changed = true;
      return partials[name];
    }
    return full;
  });
  return changed ? expandPartials(out, depth + 1) : out;
}

function processHtml(html) {
  return injectEnv(expandPartials(html));
}

// --- 3. Walk LP root for page HTML files (one level of subdirs + root) ---
function findPages(dir) {
  const pages = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      pages.push(...findPages(full));
    } else if (entry.endsWith('.html')) {
      pages.push(full);
    }
  }
  return pages;
}

mkdirSync(DIST_DIR, { recursive: true });

// Drop the empty JS entry Vite emits for the CSS-only build.
const strayEntry = join(DIST_DIR, 'assets', 'build-entry.js');
if (existsSync(strayEntry)) rmSync(strayEntry);

const pages = existsSync(LP_ROOT) ? findPages(LP_ROOT) : [];
let written = 0;
for (const page of pages) {
  const rel = relative(LP_ROOT, page);
  const dest = join(DIST_DIR, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, processHtml(readFileSync(page, 'utf-8')));
  written += 1;
}

// --- 4. Copy SEO files to dist root ---
for (const f of ['sitemap.xml', 'robots.txt', 'llms.txt']) {
  const src = join(LP_ROOT, f);
  if (existsSync(src)) copyFileSync(src, join(DIST_DIR, f));
}

// --- 5. Copy static assets (images, fonts, logo) into dist/assets/,
//        merging alongside the CSS Vite already wrote there. ---
function copyDir(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}
const assetsSrc = join(LP_ROOT, 'assets');
if (existsSync(assetsSrc)) copyDir(assetsSrc, join(DIST_DIR, 'assets'));

console.log(`[process-partials] ${Object.keys(partials).length} partials, ${written} page(s) -> dist/`);
