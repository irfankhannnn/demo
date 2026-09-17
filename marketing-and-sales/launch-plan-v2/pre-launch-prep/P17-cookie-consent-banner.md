# P17 — Cookie Consent Banner (DPDP-Compliant)

> **Type:** 🤖 AUTO
> **Phase:** Pre-launch
> **Day / Block:** T-8 (alongside analytics spec)
> **Skill(s):** `analytics-tracking` + `copywriting`
> **Estimated time:** 0.25h founder · 2h AI

## Architecture: Two Banner Variants — LP vs CRM

The LP (`realestateflow.in`) and CRM (`app.realestateflow.in`) run different tracker sets, so the consent banner has two distinct variants with different toggle options:

| Surface | What it gates | Implementation |
|---|---|---|
| **LP** (`realestateflow.in`) | PostHog session recording + GA4 + Meta Pixel + LinkedIn + Hotjar | `creative/landing-pages/_partials/cookie-banner.html` (vanilla HTML+JS) |
| **CRM** (`app.realestateflow.in`) | PostHog session recording ONLY — GA4/Pixel/LinkedIn/Hotjar are not loaded in the CRM | `agency-app/web/src/components/CookieConsentBanner.tsx` (React) |

Both use the same `localStorage.cookieConsent` key so the choice persists on same-device cross-domain visits. The CRM banner has fewer toggles (no "Marketing" category) because ad-platform trackers are not present in the CRM.

## Objective
Build two cookie-consent banner variants — LP (vanilla JS, gates 5 trackers) and CRM (React, gates PostHog session recording only) — DPDP Act 2023 + ePrivacy-style compliant.

## Why This Matters for RealEstateFlow
DPDP Act mandates explicit consent for non-essential personal data processing. ePrivacy-style banners are also expected by enterprise prospects' security reviews. A clean accept/reject UX without dark patterns earns trust and stays compliant.

## User Story
As a first-time visitor to `realestateflow.in`, I want a clear cookie banner with Accept All / Reject Non-Essential / Customize options that doesn't obstruct content + remembers my choice, so I trust the brand and analytics works for consenting users.

## Acceptance Criteria

### LP Banner (`creative/landing-pages/_partials/cookie-banner.html`)
- [x] Banner appears on first visit at bottom of viewport (sticky, doesn't block content above)
- [x] 3 buttons: "Accept all" (primary green), "Reject non-essential" (secondary outline), "Customize" (tertiary text-link)
- [x] Customize opens a modal with 4 toggles: Essential (locked-on), Functional (Hotjar), Analytics (PostHog + GA4), Marketing (Meta Pixel + LinkedIn)
- [x] Choice stored in `localStorage.cookieConsent = {essential: true, functional: bool, analytics: bool, marketing: bool, version: 1, timestamp: ISO}`
- [ ] On Accept all: PostHog (full mode), GA4, Pixel, LinkedIn, Hotjar all initialise _(banner dispatches `cookie-consent-done`; tracker init lives in `head-analytics.hbs` — PR-E)_
- [ ] On Reject: only essential cookies — PostHog runs with `disable_session_recording: true`; GA4/Pixel/LinkedIn/Hotjar do NOT load _(tracker gating in `head-analytics.hbs` — PR-E)_
- [x] No dark patterns: "Reject" same visual prominence as "Accept" (per DPDP guidance)
- [ ] Footer of every LP page has "Cookie preferences" link → re-opens Customize modal _(`window.openCookiePreferences()` exposed; footer wiring in LP rewrite — PR-I)_

### CRM Banner (`agency-app/web/src/components/CookieConsentBanner.tsx`)
- [x] Same 3 buttons: "Accept all" / "Reject non-essential" / "Customize"
- [x] Customize opens modal with only **2 meaningful toggles**: Essential (locked) + Analytics ("We measure product usage via PostHog — no ads, no retargeting")
- [x] **NO Marketing toggle** in CRM banner — GA4/Pixel/LinkedIn are NOT present in the CRM
- [ ] On Accept: PostHog full mode (session recording enabled) _(banner dispatches `cookieConsentChanged`; PostHog init in `analytics.ts` — PR-E)_
- [ ] On Reject: PostHog `disable_session_recording: true` only _(handled by `analytics.ts` listener — PR-E)_
- [x] Same `localStorage.cookieConsent` key with same schema — persists across LP and CRM on same device

### Both Surfaces
- [x] Re-prompts only if `version` increments in `localStorage.cookieConsent`
- [x] ARIA roles, keyboard navigation (Tab/Enter/Esc), screen-reader text
- [x] Mobile-responsive: 100vw bottom sheet on small screens
- [x] Dark mode support
- [ ] `/legal/cookies` page (P1 + P15) explains every cookie (table) _(separate page — P1/P15 / PR-I)_
- [x] Banner copy in English (Mumbai launch English-first); Hinglish drafted but not deployed M1
- [x] Tests: first visit → banner visible; Accept → no banner second visit; Reject → consent persisted (analytics/marketing=false). _Tracker-load network assertions deferred to PR-E (head-analytics.hbs / analytics.ts)._

## AI Prompt (🤖)

```
You are a senior front-end engineer + privacy compliance writer. Read inputs:
- `marketing-and-sales/launch-plan-v2/pre-launch-prep/P10-analytics-events.md` (defines what trackers exist)
- `marketing-and-sales/launch-implement/pre-launch/01-legal/cookies.md` (P1 cookie inventory)
- `creative/landing-pages/main/index.html` (LP structure)
- `agency-app/web/src/main.tsx` + `src/App.tsx` (SPA entry)
- `marketing-and-sales/creative/realestateflow-launch/brand-kit.md`

Produce these outputs:

## 1. `creative/landing-pages/_partials/cookie-banner.html`
Plain HTML+JS+inline-CSS banner injected into all 5 LPs `<body>` end:
```html
<aside id="cookie-consent" role="dialog" aria-labelledby="cc-title" aria-describedby="cc-desc" hidden>
  <div class="cc-inner">
    <h2 id="cc-title" class="sr-only">Cookie consent</h2>
    <p id="cc-desc">We use cookies to power the site and remember your preferences. Analytics + marketing cookies help us improve. Pick what you're OK with.</p>
    <div class="cc-actions">
      <button id="cc-accept-all" class="primary">Accept all</button>
      <button id="cc-reject" class="secondary">Reject non-essential</button>
      <button id="cc-customize" class="tertiary">Customize</button>
    </div>
    <a href="/legal/cookies" class="cc-link">More about cookies</a>
  </div>
</aside>

<script>
(function () {
  const KEY = 'cookieConsent';
  const VERSION = 1;
  const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (stored && stored.version === VERSION) {
    applyConsent(stored);
  } else {
    document.getElementById('cookie-consent').hidden = false;
  }
  function save(consent) {
    consent.version = VERSION;
    consent.timestamp = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(consent));
    applyConsent(consent);
    document.getElementById('cookie-consent').hidden = true;
  }
  function applyConsent(c) {
    if (c.analytics) { /* init PostHog full + GA4 */ window.dispatchEvent(new CustomEvent('cookie-consent-analytics', {detail: c})); }
    if (c.marketing) { /* init Meta Pixel + LinkedIn Tag */ window.dispatchEvent(new CustomEvent('cookie-consent-marketing', {detail: c})); }
    if (c.functional) { /* init Hotjar */ window.dispatchEvent(new CustomEvent('cookie-consent-functional', {detail: c})); }
  }
  document.getElementById('cc-accept-all').onclick = () => save({essential:true, functional:true, analytics:true, marketing:true});
  document.getElementById('cc-reject').onclick = () => save({essential:true, functional:false, analytics:false, marketing:false});
  document.getElementById('cc-customize').onclick = () => openCustomizeModal();
  function openCustomizeModal() { /* render modal with 4 checkboxes; on save, call save(...) */ }
})();
</script>

<style>
#cookie-consent { position: fixed; bottom: 0; left: 0; right: 0; background: #07111E; color: #F5F1E8; padding: 16px 24px; z-index: 9999; box-shadow: 0 -4px 12px rgba(0,0,0,0.3); }
.cc-inner { max-width: 1200px; margin: 0 auto; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.cc-actions { display: flex; gap: 8px; }
.cc-actions button { padding: 8px 16px; border: 1px solid #22C55E; border-radius: 4px; cursor: pointer; font-size: 14px; }
.cc-actions .primary { background: #22C55E; color: #07111E; }
.cc-actions .secondary { background: transparent; color: #22C55E; }
.cc-actions .tertiary { background: transparent; border-color: transparent; color: #C8D4DF; text-decoration: underline; }
.cc-link { color: #C8D4DF; font-size: 12px; text-decoration: underline; }
@media (max-width: 640px) {
  #cookie-consent { padding: 12px 16px; }
  .cc-inner { flex-direction: column; align-items: stretch; gap: 8px; }
  .cc-actions { width: 100%; }
  .cc-actions button { flex: 1; }
}
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
</style>
```

(Expand the `openCustomizeModal()` body to render a full overlay modal with the 4 checkboxes.)

## 2. CRM version `agency-app/web/src/components/CookieConsentBanner.tsx`
React component — **different toggles from the LP banner**:
- Same 3 buttons (Accept / Reject / Customize)
- Customize modal shows only 2 toggles: Essential (locked) + Analytics ("PostHog product usage analytics — no ads")
- NO Marketing toggle (GA4/Pixel/LinkedIn are never loaded in the CRM)
- Same `localStorage.cookieConsent` key; reads `.analytics` flag to control PostHog session recording
- `applyConsent(c)` in React version ONLY calls `posthog.setPersonPropertiesForFlags({...})` and controls `capture_pageview` + session recording — no GA4/Pixel/LinkedIn dispatch
- Emits `cookieConsentChanged` event for `analytics.ts` to consume

## 3. `marketing-and-sales/launch-implement/pre-launch/17-cookie-banner/copy.md`
Banner + customize-modal copy in English + Hinglish (Hinglish for M1+1 month if we test bilingual UX):

### English banner
"We use cookies to power the site and remember your preferences. Analytics + marketing cookies help us improve. Pick what you're OK with."

### Customize modal copy
- Essential (locked): "Required for the site to work — auth, security, your preferences."
- Functional: "Remember your custom layouts, language preference, recently-viewed properties."
- Analytics: "We measure how the site performs (PostHog, Google Analytics) — no individual tracking."
- Marketing: "We measure ad performance (Meta, LinkedIn) — used only if you came from an ad."

### Hinglish banner (drafted, deploy M1+1)
"Hum cookies use karte hain site chalane ke liye. Analytics + marketing cookies humein behtar banane mein madad karte hain. Tum apni marzi se chuno."

## 4. Cookie inventory (cross-references P1 cookies.md)
Table at `marketing-and-sales/launch-implement/pre-launch/17-cookie-banner/cookie-inventory.md`:
- Cookie name | Provider | Purpose | Category | Retention | Third-party? | Domain
- Examples: `_ga` (GA4, Analytics, 2 years, third-party, .realestateflow.in), `_fbp` (Meta Pixel, Marketing, 90 days, third-party), `__hssc` (Hotjar, Functional, session, third-party), `auth_token` (RealEstateFlow, Essential, 7 days, first-party), `cookieConsent` (RealEstateFlow, Essential, 1 year, first-party — stores the choice itself)

## 5. Tests `tests/cookie-consent.spec.ts`
- Visit `/`, banner visible, no PostHog/GA4 calls in network tab
- Click "Accept all", reload, banner hidden, PostHog snippet loaded, GA4 calls made
- Localstorage cleared, visit `/`, banner visible, click "Reject", PostHog runs in restricted mode (disable_session_recording=true), GA4/Pixel/LinkedIn NOT loaded
- Click "Customize", toggle Analytics on + Marketing off, save, assert state matches

## 6. `marketing-and-sales/launch-implement/pre-launch/17-cookie-banner/maintenance-sop.md`
Internal SOP:
- When sub-processor changes (add/remove): bump VERSION, force re-prompt
- When new tracker added: update copy.md + cookie-inventory.md + adjust applyConsent() branches
- Quarterly review: spot-check cookies vs inventory; remove orphan cookies

Stop here. Do not deploy. Do not auto-set IDs (env-driven).
```

## Manual Steps (🧍)

1. **Run AI Prompt above**.
2. **Inject banner partial** into each of the 5 LPs (P15 build pipeline includes this automatically once partial exists).
3. **Verify SPA banner mounts** at App root.
4. **Run `tests/cookie-consent.spec.ts`** — confirm 100% pass.
5. **Test on real iPhone + Android** — confirm bottom-sheet doesn't block content + buttons reachable.
6. **Confirm localStorage persistence** across reload.
7. **Tick ACs** + log to `00-DECISIONS-LOG.md`.

## Inputs
- P10 analytics spec (which trackers to gate)
- P1 cookies.md (legal cookie inventory)
- Brand kit
- Founder feedback (UX prefs)

## Outputs
- `creative/landing-pages/_partials/cookie-banner.html`
- `agency-app/web/src/components/CookieConsentBanner.tsx`
- `marketing-and-sales/launch-implement/pre-launch/17-cookie-banner/{copy.md, cookie-inventory.md, maintenance-sop.md}`
- `tests/cookie-consent.spec.ts`

## Success Criterion
Banner shows on first visit; non-essential trackers gated until consent; localStorage persists choice; tests green.

## Fallback / Plan B
If custom banner is buggy, swap to Cookiebot (free for <100 pages) — minor UX customization loss but reliable. Update P1 to disclose Cookiebot as a sub-processor.

## Risks
| Risk | Mitigation |
|---|---|
| Reject still loads trackers | tests/cookie-consent.spec.ts asserts no GA4/Pixel calls |
| LocalStorage cleared by user → repeat banner | Acceptable behaviour; per DPDP, that's a fresh consent moment |
| Customize modal too complex on mobile | Modal scrolls; toggles big tap targets ≥44px |
| Sub-processor change without version bump | Maintenance SOP enforces |

## India / Mumbai-Specific Notes
- DPDP-compliant: explicit opt-in for non-essential
- Hinglish version drafted for M1+1 bilingual test
- All third-party domains disclosed in cookies.md (P1)

## Dependencies
- **Blocks:** P10 (analytics events use consent state), P15 (LP build includes banner)
- **Depends on:** P1 cookies.md

## Connected Skills
- `analytics-tracking` — consent integration with trackers
- `copywriting` — banner copy
- `pr-review` — security review of localStorage handling
