# EPIC-4 COMPLETION — PR-D: LP Build Pipeline + Partials + SEO Stubs (ZEE-008-T1 / P15)

**Branch:** `cursor/pr-1d-lp-build-pipeline-8e67` (base: `cursor/launch-plan-v2-architecture-updates-8e67`)
**Story:** ZEE-008-T1 (LP build pipeline) + SEO file stubs (ZEE-009-T4/T5)

## Implemented Features
- **Vite + Tailwind build pipeline** in `marketing-and-sales/creative/landing-pages/build/`:
  - `vite build` compiles `src/styles.css` (Tailwind) → `dist/assets/main.css` (single file, replaces the Tailwind CDN). Brand colours `primary #22C55E`, `navy #0F3A66`, `dark #07111E`; Inter/Poppins font layers + `.gt`/`.btn-primary`/`.faq-*` component utilities.
  - `scripts/process-partials.js` expands `{{> partial}}` includes, injects build-time env vars (`{{GA4_ID}}`, `{{META_PIXEL_ID}}`, `{{FOUNDER_NAME}}`, pricing tokens, ...) from `.env` (falls back to `.env.example`), and writes processed pages + SEO files to `dist/`.
  - Scripts: `npm run build:lps` (build + process), `dev:lps` (preview), `clean`.
- **Shared partials** in `_partials/` (7 `.hbs`): `head` (meta/OG/canonical/favicon/compiled-CSS/`{{> head-analytics}}`), `head-analytics` (**stub — PR-E fills**), `header` (sticky nav + house+wave SVG logo + trial CTA), `footer` (legal links + DPDP Grievance Officer disclosure + cookie-preferences button), `cta-block`, `pricing-cards` (3 tiers, values from env/`pricing.json`), `faq` (vanilla-JS accordion). Co-exists with `cookie-banner.html` from PR-C.
- **SEO files** at LP root: `robots.txt` (complete), `sitemap.xml` (stub), `llms.txt` (stub) — real content filled by PR-I.
- **`.env.example`** documenting all build-time analytics IDs + founder/legal/pricing placeholders.

## APIs Added
- None (static build tooling only).

## Database Changes
- None.

## Infrastructure Changes
- **`netlify.toml`** updated: build `command = "cd build && npm install && npm run build:lps"`, `publish = "dist"`; **enterprise redirect removed**; pretty-URL 200 redirects added for all documented pages (`/agency-owners`, `/agents`, `/ai-employee`, `/demo`, `/pricing`, `/about`, `/grievance`, `/legal/{terms,privacy,refund,cookies}`, `/vs/*`); convenience 301s (`/legal`→`/legal/terms`, `/help`→`/grievance`); **security headers** added (HSTS, full CSP, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection).

## Security Enhancements
- HSTS (`max-age=31536000; includeSubDomains`) + tightened CSP allow-listing only the trackers the LPs use (PostHog/GA4/Meta/LinkedIn/Hotjar/hCaptcha/jsDelivr) and first-party API origins.
- `.env` git-ignored; only `.env.example` (placeholders) is committed — no analytics secrets in the repo.

## Testing Performed
- `npm install` in `build/` succeeds.
- `npm run build:lps` runs clean: `vite` emits `dist/assets/main.css` (~23 kB, gzip 4.9 kB); `process-partials` reports `7 partials, 6 page(s) -> dist/`; stray CSS-only JS entry removed.
- Verified partial expansion + env injection on a throwaway page: `{{> header}}`/`{{> footer}}`/`{{> faq}}` expanded (0 remaining `{{> }}`), `{{FOUNDER_NAME}}`/`{{COMPANY_LEGAL_NAME}}` injected, and lowercase handlebars (`{{#each faqs}}`, `{{question}}`) left intact for PR-I's renderer.

## Known Constraints / Out of Scope (documented)
- **Path mapping:** docs say `creative/landing-pages/...`; actual repo path is `marketing-and-sales/creative/landing-pages/...` (all existing LP pages live there).
- LP page rewrites (ZEE-008-T2/T3), deleting `enterprise/` (T5), filling `sitemap.xml`/`llms.txt`, and Lighthouse pass (T7) are **PR-I** scope. PR-D ships only the pipeline + partials + stubs.
- `head-analytics.hbs` body is filled by **PR-E** (ZEE-003); PR-D ships the consent-gating contract as a stub comment.
- The pipeline currently copies existing CDN-based pages into `dist/` unchanged (no `{{> }}` includes in them yet); the CDN→compiled-CSS swap lands when PR-I authors the templated pages against `head.hbs`.

## Rollback Notes
- Delete `creative/landing-pages/build/`, `_partials/{head,head-analytics,header,footer,cta-block,pricing-cards,faq}.hbs`, `.env.example`, `sitemap.xml`, `robots.txt`, `llms.txt`, the two `.gitignore` files, and the generated `dist/`.
- Revert `netlify.toml` to the prior version (restore enterprise redirect, drop new redirects/headers/build block).
- No server/DB/CRM changes to undo.
