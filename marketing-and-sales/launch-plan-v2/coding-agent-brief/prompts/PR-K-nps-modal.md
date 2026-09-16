# Agent Prompt — PR-K: NPS Modal + Feedback Backend

**Branch to create:** `cursor/pr-4k-nps-modal-8e67`
**Base branch:** `main` (after Batch 3 is merged)
**Batch:** 4 (Day 4) — runs in parallel with PR-J

---

## MANDATORY: Read First

1. `marketing-and-sales/launch-plan-v2/coding-agent-brief/00-MASTER-BRIEF.md`
2. `marketing-and-sales/launch-plan-v2/coding-agent-brief/01-SHARED-CONTRACTS.md` (§1.6 NPSResponses table)
3. `apps/crm/real-estate-crm-app/src/App.tsx`
4. `apps/crm/real-estate-crm-app/src/components/CookieConsentBanner.tsx` (PR-C — modal pattern to follow)
5. `apps/crm/server/routes/grievance.js` (PR-B — route pattern)
6. `marketing-and-sales/launch-plan-v2/week-4-optimize-convert/day-28-nps-feedback-loops.md`

---

## What to Build

### 1. `apps/crm/server/routes/feedback.js`

Two endpoints:

```js
// POST /api/feedback/nps — validateToken (auth required)
// Body: { score: 0-10, freeText?: string, shareTestimonial?: boolean }
// Validation: score 0-10 required; freeText required if score ≤ 6
// Stores to NPSResponses DDB table
// Side effects:
//   - PostHog: serverTrack(userId, 'nps_response', { score, free_text_present, plan })
//   - If score ≤ 6: send Telegram/Slack notification to founder (via FOUNDER_TELEGRAM_CHAT_ID or just email)
//   - If score ≥ 9 && shareTestimonial: add Brevo tag 'promoter-testimonial' to contact
// Returns: { success: true, message: 'Thank you for your feedback.' }

// GET /api/nps — PUBLIC (email link NPS)
// Query params: score (0-10), token (HMAC of userId+score)
// Validate HMAC: crypto.createHmac('sha256', process.env.NPS_HMAC_SECRET).update(userId+score).digest('hex')
// If valid: renders a JSON page with { validToken: true, userId }
//   (SPA handles the actual NPS form via this token)
// If invalid: returns 401
```

### 2. `apps/crm/real-estate-crm-app/src/components/NpsModal.tsx`

Trigger logic:
- Triggered by `useEffect` that checks: `user.createdAt` was >14 days ago AND last NPS shown >90 days ago (stored in `localStorage.nps_last_asked`)
- Only shown if user is authenticated AND `isPaying || isTrialing` (active user)
- Shows maximum once per 90 days (localStorage throttle)

Modal content:
```typescript
// Step 1: Score selection
// "How likely are you to recommend RealEstateFlow to a fellow Mumbai broker?"
// 11 buttons: 0 through 10, labeled with emoji hints at extremes
// "0 = Not likely · 10 = Definitely would"

// Step 2 (conditional on score):
// Score 0-6: required free-text "What would have made this a 9 or 10?" (required, min 20 chars)
// Score 7-8: optional free-text "What could we improve?"
// Score 9-10: optional free-text "What do you love most?" + "May we share your testimonial?" checkbox

// Step 3: Confirmation
// "Thank you! Your feedback shapes our Month 2 roadmap."
// If score ≥ 9: "We may reach out to feature your success story."

// Dismiss: X button; stores localStorage.nps_dismissed_at = now
// Submits to POST /api/feedback/nps
// After submit: fires trackEvent('nps_response', { score, free_text_present })
```

Styling:
- Centered modal overlay (not full-screen — bottom-right corner preferred, non-intrusive)
- Tailwind; brand colors
- Score buttons: grid of 11 small rounded buttons; selected = green filled; unselected = outline
- Mobile: larger touch targets (≥44px per button)

### 3. `tests/nps.spec.ts`

```
- Mock user with createdAt 15 days ago + no previous NPS → modal renders
- Mock user createdAt 10 days ago → modal NOT shown
- Mock localStorage.nps_last_asked = 80 days ago → modal NOT shown (within 90 day throttle)
- Select score 5 → free-text field becomes required
- Select score 9 → testimonial checkbox appears; free-text optional
- Submit valid form → POST to /api/feedback/nps → success message shown
- Verify localStorage.nps_last_asked set after submit
```

---

## apps/crm/server/server.js Modification

In `// === [LAUNCH ROUTES IMPORTS] ===`:
```js
// PR-K
import feedbackRoutes from './routes/feedback.js';
```

In `// === [LAUNCH ROUTES MOUNTS] ===`:
```js
// PR-K
app.use('/api/feedback', feedbackRoutes);
```

---

## App.tsx Modification

In `{/* === [LAUNCH LAYOUT COMPONENTS] === */}`:
```tsx
{/* PR-K */}
<NpsModal />
```

In `{/* === [LAUNCH PUBLIC ROUTES] === */}`:
```tsx
{/* PR-K — email-link NPS landing page */}
<Route path="/nps" element={<NpsEmailLanding />} />
```

Create a minimal `apps/crm/real-estate-crm-app/src/pages/public/NpsEmailLanding.tsx`:
- Reads `score` + `token` from URL params
- Validates token via `GET /api/nps?score={N}&token={T}`
- If valid: shows the NPS form inline (reuses NpsModal form component)
- If invalid: shows "This link has expired. Please open the app to submit your feedback."

---

## What NOT to Touch

- `apps/crm/server/subscriptionService.js` (PR-H)
- `src/hooks/useSubscription.ts` (PR-J)
- Any LP files

---

## PR Description Template

```
PR-K: NPS survey — in-app modal + feedback backend + email-link flow

Batch 4 | Day 4 | Parallel with PR-J

Files created:
- apps/crm/server/routes/feedback.js — POST /api/feedback/nps + GET /api/nps (email link)
- apps/crm/real-estate-crm-app/src/components/NpsModal.tsx — 3-step NPS modal (triggered after 14 days)
- apps/crm/real-estate-crm-app/src/pages/public/NpsEmailLanding.tsx — email-link NPS form
- tests/nps.spec.ts — Playwright tests

Files modified:
- apps/crm/server/server.js — feedback route mount
- apps/crm/real-estate-crm-app/src/App.tsx — NpsModal in layout + /nps public route

Source task: Day-28 NPS (week-4-optimize-convert/day-28-nps-feedback-loops.md)
```
