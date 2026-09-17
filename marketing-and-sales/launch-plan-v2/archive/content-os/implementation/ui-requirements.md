# Implementation — UI Requirements

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/design-only-backlog.md`.

React + TS + Tailwind, brand `#2563EB` + Inter, mobile-first, RBAC-gated (`PermissionGuard`, `rbac.ts`). Marketing config = Admin only.

## New screens
### 1. Marketing Dashboard — `pages/crm/MarketingDashboard.tsx` (Admin)
- **Funnel widget:** reach → DM → demo → trial → paid → referral, with stage counts + drop-off %; date-range + source filter.
- **Attribution table:** leads / demos / paid by `leadSource` AND by `contentRef (OPP-*)`; sortable; drill-down to leads.
- **Efficiency cards:** CAC (by channel), LTV, LTV:CAC, payback period.
- **Cohort chart:** trial→paid + retention by signup month.
- **Channel efficiency:** CPL, effective CAC (CPL ÷ trial-to-paid) per channel.
- **This-week ops panel:** demos today, no-shows, at-risk trials.
- States: empty (guidance), loading (skeleton), error (`{error}` shape), "attribution unknown" for legacy leads.

### 2. Referral — customer link page + Admin referral list
- Customer: 1-tap copy link + pre-written WhatsApp invite + reward status.
- Admin: referrals sent/converted, payouts, top referrers.

### 3. Automation / Sequences admin (Admin)
- Rules list (`on/if/do`), enrollments view, opt-outs, send logs.

## Changed components
- `LeadDetails.tsx` / `LeadList.tsx`: source chip, `contentRef`, score badge; filter by source/score/stage; sort by score (hottest first).
- Web signup form: hidden UTM capture → pass to lead create.
- `Calendar.tsx`: demo booking slots + reminder surface; `NotificationCenter.tsx`: surface automation notifications.

## Reuse
`GlassDataTable`, chart components, `NotificationCenter`, `PermissionGuard`, existing modals/toasts.

## Wireframe-in-words (dashboard)
Top: date-range + KPI cards (north-star demos/wk, CAC, LTV:CAC). Middle: funnel bar (left→right) with drop-off labels. Below: two tables side-by-side (by source | by content OPP-*). Bottom: cohort heatmap + ops panel.
