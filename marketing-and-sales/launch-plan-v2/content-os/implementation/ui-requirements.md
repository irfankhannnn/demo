# Implementation — UI Requirements

React + TS + Tailwind, brand `#2563EB` + Inter, mobile-first, RBAC-gated (`PermissionGuard`). Admin-only for marketing config.

## New screens
1. **Marketing Dashboard** (`pages/crm/MarketingDashboard.tsx`, admin):
   - Funnel widget: reach → DM → demo → trial → paid → referral with drop-off %.
   - Attribution table: leads/demos/paid by `leadSource` and by `contentRef (OPP-*)`.
   - CAC / LTV / payback cards; channel ROI.
   - Cohort retention chart (trial→paid).
   - Date range + tenant scope.
2. **Referral admin** + **customer referral link** UI.
3. **Automation/Sequences admin** (rules list, enrollments, opt-outs) — admin.

## Changed components
- `LeadDetails.tsx` / `LeadList.tsx`: show source chip, `contentRef`, score badge; filter by source/score/stage.
- Web signup: capture UTM (hidden fields) → pass to lead create.
- `Calendar.tsx`: demo booking slots + reminders surface.

## Components to reuse
`GlassDataTable`, charts, `NotificationCenter` (automation notifications), `PermissionGuard`, existing modals.

## States
Empty (no data yet → guidance), loading, error (`{error}` shape), and "attribution unknown" handling for legacy leads.
