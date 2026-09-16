# Anti-Conflict Rules — Multi-Agent Parallel Coding

## The Core Problem with Parallel Agents

When 4 agents simultaneously modify `apps/crm/server/server.js` and `App.tsx`, the second through fourth PRs to be created will have merge conflicts because they all branch from the same `main`. This document defines the exact rules to prevent this.

---

## Rule 1: Tagged Comment Blocks in Shared Files

Before any agent starts, the Founder adds placeholder blocks to `apps/crm/server/server.js` and `App.tsx`. Each agent inserts ONLY inside their designated tag — never outside it, never modifying existing content.

**In `apps/crm/server/server.js`**, two blocks are added:

```javascript
// === [LAUNCH ROUTES IMPORTS] ===
// PR-B: import grievanceRoutes from './routes/grievance.js';
// PR-F: import billingRoutes from './routes/billing.js';
// PR-F: import aiEmployeeStatusRoutes from './routes/aiEmployeeStatus.js';
// PR-H: import subscriptionsRoutes from './routes/subscriptions.js';
// PR-J: (no new import needed — subscriptions.js already mounted by PR-H)
// PR-K: import feedbackRoutes from './routes/feedback.js';
// === [/LAUNCH ROUTES IMPORTS] ===
```

```javascript
// === [LAUNCH ROUTES MOUNTS] ===
// PR-F: app.use('/api/billing', billingRoutes);  ← MUST stay first in this block
// PR-B: app.use('/api', grievanceRoutes);
// PR-F: app.use('/api/ai-employee', aiEmployeeStatusRoutes);
// PR-H: app.use('/api/subscriptions', subscriptionsRoutes);
// PR-K: app.use('/api/feedback', feedbackRoutes);
// === [/LAUNCH ROUTES MOUNTS] ===
```

When multiple PRs add lines to the same block:
- Git sees them as additions in the same line range
- Reviewer accepts "both" in the merge conflict dialog
- Each PR's lines are clearly tagged with `// PR-X:` so it's obvious what to keep

**In `apps/crm/real-estate-crm-app/src/App.tsx`**, three blocks are added inside `<Routes>`:

```tsx
{/* === [LAUNCH PUBLIC ROUTES] === */}
{/* PR-B: <Route path="/grievance" element={<Grievance />} /> */}
{/* PR-K: <Route path="/nps" element={<NpsEmailLanding />} /> */}
{/* === [/LAUNCH PUBLIC ROUTES] === */}

{/* === [LAUNCH PROTECTED ROUTES] === */}
{/* PR-B: <Route path="/admin/grievances" element={<ProtectedRoute><GrievanceList /></ProtectedRoute>} /> */}
{/* PR-F: <Route path="/integrations/ai-employee" element={<ProtectedRoute><AIEmployeeStatus /></ProtectedRoute>} /> */}
{/* === [/LAUNCH PROTECTED ROUTES] === */}

{/* === [LAUNCH LAYOUT COMPONENTS] === */}
{/* PR-A: <DemoBanner /> */}
{/* PR-C: <CookieConsentBanner /> */}
{/* PR-J: <TrialCountdownBanner /> */}
{/* PR-J: <PaywallModal /> */}
{/* PR-K: <NpsModal /> */}
{/* === [/LAUNCH LAYOUT COMPONENTS] === */}
```

When resolving conflicts in these blocks: keep ALL lines from ALL PRs that modified the block.

---

## Rule 2: File Ownership Matrix

One owner per file. If a file is not in your ownership list → do not touch it.

| File | Owner PR | Other PRs may read it? |
|---|---|---|
| `apps/crm/server/routes/grievance.js` | PR-B | PR-E (replaces stub) |
| `apps/crm/server/grievanceDynamodbService.js` | PR-B | — |
| `src/pages/public/Grievance.tsx` | PR-B | — |
| `src/pages/admin/GrievanceList.tsx` | PR-B | — |
| `creative/landing-pages/_partials/cookie-banner.html` | PR-C | PR-I (injects in pages) |
| `src/components/CookieConsentBanner.tsx` | PR-C | PR-E (listens to its events) |
| `creative/landing-pages/build/` | PR-D | — |
| `creative/landing-pages/_partials/head.hbs` | PR-D | PR-I (uses it) |
| `creative/landing-pages/_partials/head-analytics.hbs` | PR-D (stub) → PR-E (fills) | PR-I (injects in pages) |
| `creative/landing-pages/netlify.toml` | PR-D | — |
| `src/lib/analytics.ts` | PR-E | PR-J (uses it), PR-K (uses it) |
| `src/types/analytics.ts` | PR-E | all CRM agents (read only) |
| `apps/crm/server/lib/posthog.js` | PR-E (replaces PR-B stub) | all server agents (import it) |
| `apps/crm/server/routes/billing.js` | PR-F (creates) → PR-H (adds one case) | — |
| `apps/crm/server/aiEmployeeProvisioningService.js` | PR-F | — |
| `src/pages/crm/AIEmployeeStatus.tsx` | PR-F | — |
| `apps/crm/server/scripts/escalation-cron.js` | PR-F | — |
| `src/components/DemoBanner.tsx` | PR-A | — |
| `apps/crm/server/scripts/seed-demo-tenant.js` | PR-A | — |
| `apps/crm/server/subscriptionService.js` | PR-H (creates) | PR-J (uses it), PR-F (stubs it) |
| `apps/crm/server/routes/subscriptions.js` | PR-H (creates) → PR-J (adds trial-status) | — |
| `src/components/SeatCounter.tsx` | PR-H | — |
| `src/components/SeatUpgradeModal.tsx` | PR-H | — |
| `src/pages/admin/InviteManagement.tsx` | PR-H | — |
| `src/pages/admin/MemberManagement.tsx` | PR-H | — |
| `apps/crm/server/routes/auth.js` | PR-H (invite handler) → PR-L (register handler) | — |
| All 12 LP HTML files | PR-I | — |
| `creative/landing-pages/sitemap.xml` | PR-D (stub) → PR-I (fills) | — |
| `creative/landing-pages/llms.txt` | PR-D (stub) → PR-I (fills) | — |
| `src/hooks/useSubscription.ts` | PR-J | PR-K (uses it) |
| `src/contexts/SubscriptionContext.tsx` | PR-J | PR-K (uses it) |
| `src/components/TrialCountdownBanner.tsx` | PR-J | — |
| `src/components/PaywallModal.tsx` | PR-J | — |
| `src/lib/razorpay.ts` | PR-J | PR-H (stubs window.Razorpay) |
| `apps/crm/server/routes/feedback.js` | PR-K | — |
| `src/components/NpsModal.tsx` | PR-K | — |
| `tests/grievance.spec.ts` | PR-B | — |
| `tests/analytics.spec.ts` | PR-E | PR-M (adds coverage) |
| `tests/cookie-consent.spec.ts` | PR-C | — |
| `tests/seat-cap.spec.ts` | PR-H | — |
| `tests/cross-tenant-pentest.spec.ts` | PR-G | — |
| `tests/paywall.spec.ts` | PR-J | — |
| `tests/nps.spec.ts` | PR-K | — |
| `apps/crm/real-estate-crm-app/src/main.tsx` | PR-E | — |

**The two exceptions** where multiple PRs touch the same file:
1. `apps/crm/server/routes/billing.js` → PR-F creates it, PR-H adds exactly one `case` block. PR-H's commit must happen AFTER PR-F merges.
2. `apps/crm/server/routes/auth.js` → PR-H adds to invite handler, PR-L adds to register handler. These are different function bodies. PR-L must happen AFTER PR-H merges.
3. `apps/crm/server/routes/subscriptions.js` → PR-H creates with `/current`, PR-J adds `/trial-status`. PR-J must happen AFTER PR-H merges.
4. `head-analytics.hbs` → PR-D creates stub, PR-E fills it. PR-E must happen AFTER PR-D merges.

---

## Rule 3: Stubs for Unavailable Dependencies

When agent X needs something created by agent Y (in the same batch or later batch), X uses a stub:

```javascript
// apps/crm/server/routes/grievance.js (PR-B)
// PostHog stub — PR-E will replace this with the real module
async function serverTrack(distinctId, event, properties) {
  if (process.env.NODE_ENV !== 'test') {
    console.log('[PostHog stub - replace with PR-E]', event);
  }
}
```

```typescript
// real-estate-crm-app (any PR before PR-E)
// Analytics stub — PR-E creates the real analytics.ts
// Don't import analytics.ts yet; these files get trackEvent added by PR-E
```

```javascript
// apps/crm/server/routes/billing.js (PR-F)
// subscriptionService stub — PR-H creates the real service
async function incrementSeatsPaid(tenantId, by) {
  console.log('[subscriptionService stub - replace with PR-H]', tenantId, by);
}
```

Stub rule: **Always add a console.log comment** identifying which PR will replace it. This makes it easy to find + replace after merges.

---

## Rule 4: Import-Only Pattern for Cross-PR Dependencies

Never import a file that might not exist yet. Use dynamic imports or conditional requires when a dependency is in a later batch:

```javascript
// Don't do this in PR-F (PR-E might not be merged yet):
// import { serverTrack } from '../lib/posthog.js';  ← might not exist

// Do this:
let serverTrack;
try {
  const ph = await import('../lib/posthog.js');
  serverTrack = ph.serverTrack;
} catch {
  serverTrack = async () => {};  // graceful no-op fallback
}
```

After the real file is merged, this can be simplified to a direct import in a cleanup PR.

---

## Rule 5: Dependency-Ordered PR Reviews

The Founder must merge PRs in the order specified in `02-PR-SCHEDULE.md`. Within each batch, use the merge order specified at the bottom of that document.

**Checklist before merging each PR:**
- [ ] Branch is up-to-date with main
- [ ] No test failures in the PR
- [ ] File ownership respected (no agent touched a file outside their list)
- [ ] Tagged comment blocks used correctly (no lines added outside `=== [BLOCK] ===`)
- [ ] All stubs have the `// replace with PR-X` comment

---

## Rule 6: Branch Naming Must Include Batch Number

All branches: `cursor/pr-{batch}{letter}-{name}-8e67`

This makes the order obvious at a glance in GitHub:
- `cursor/pr-1a-demo-environment-8e67`
- `cursor/pr-1b-grievance-flow-8e67`
- `cursor/pr-2e-analytics-layer-8e67`
- `cursor/pr-3h-seat-cap-8e67`

---

## Rule 7: PR Description Must Include Batch and Dependencies

Every PR description must start with:
```
Batch N | Day N | [Parallel with PR-X, PR-Y | Depends on: PR-Z merged]
```

This is already specified in each PR prompt's "PR Description Template" section.

---

## Conflict Resolution Quick Reference

When two PRs both modified `apps/crm/server/server.js`:
1. PR-A merges first → main is updated
2. PR-B's branch is now behind main
3. Rebase PR-B on main: `git rebase main`
4. In the conflict, the tagged blocks will conflict: **accept BOTH changes** — each PR adds inside the same block, just different lines
5. The result has both agents' lines inside the tagged block

When `App.tsx` conflicts:
1. Same rebase approach
2. In `{/* === [LAUNCH PUBLIC ROUTES] === */}`, accept all route additions from both PRs

---

## What to Do When You Find a Conflict

1. Read the conflicting sections carefully
2. If both sides add NEW lines (not modifying existing lines): accept both
3. If both sides modify the SAME existing line: this is a real conflict — flag to Founder before resolving
4. After accepting, run `npx playwright test` to verify nothing broke
5. Push the rebased branch

---

## Agent Communication Protocol

Agents don't communicate with each other. They communicate through:
1. **File contracts** (`01-SHARED-CONTRACTS.md`) — pre-agreed interfaces
2. **Stub comments** (`// replace with PR-X`) — signal to later agents
3. **PR descriptions** — explain what was built and what was stubbed
4. **Founder** reviews each batch, resolves any ambiguity, provides the "go" signal for the next batch

---

## Summary: The 6 Things That Prevent Merge Conflicts

1. Tagged comment blocks in `apps/crm/server/server.js` and `App.tsx`
2. File ownership matrix (one owner per file)
3. Stub pattern for cross-PR dependencies
4. Sequential batch merging (Batch 2 starts only after Batch 1 fully merges)
5. PR naming includes batch number
6. Rebase on main before submitting (not merge — rebase keeps history clean)
