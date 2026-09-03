# RealEstateFlow — Landing Page Build Pipeline

Vite + Tailwind pipeline that turns the LP HTML pages + `_partials/*.hbs` into a
deployable `dist/` folder with a single compiled stylesheet (replacing the
Tailwind CDN) and build-time env-var injection.

## Usage

```bash
cd landing-pages/build
npm install
npm run build:lps
```

Output is written to `landing-pages/dist/`.

## What `build:lps` does

1. `vite build` — compiles `src/styles.css` (Tailwind) → `dist/assets/main.css`.
2. `node scripts/process-partials.js`:
   - Expands `{{> partial-name}}` includes using files in `_partials/`.
   - Injects build-time env vars (`{{GA4_ID}}`, `{{META_PIXEL_ID}}`, ...) from
     `../.env` (falls back to `../.env.example` placeholders).
   - Copies each LP page + `sitemap.xml`, `robots.txt`, `llms.txt` into `dist/`.

## Environment variables

Copy `../.env.example` to `../.env` and fill the real IDs before a production
build. Values are injected at build time and **never** committed.

```bash
cp ../.env.example ../.env
```

## Partials (`../_partials/`)

| Partial | Purpose |
|---------|---------|
| `head.hbs` | `<head>` block: meta, OG/Twitter, canonical, favicon, compiled CSS, `{{> head-analytics}}` |
| `head-analytics.hbs` | Consent-gated analytics snippet — **stub** (filled by PR-E) |
| `header.hbs` | Sticky nav with logo + Login + Start Free Trial CTA |
| `footer.hbs` | Legal links, DPDP Grievance Officer disclosure, legal entity, cookie-preferences button |
| `cta-block.hbs` | Bottom call-to-action section |
| `pricing-cards.hbs` | 3 pricing tier cards (values from `pricing.json` / env) |
| `faq.hbs` | Vanilla-JS accordion FAQ |
| `cookie-banner.html` | DPDP cookie consent banner (created by PR-C) |

## Scope note

This PR (PR-D) ships the **pipeline + partials + SEO stubs** only. The actual LP
page rewrites (and filling `sitemap.xml` / `llms.txt` with all 12 URLs) are done
in PR-I. The analytics snippet body is filled in PR-E.
