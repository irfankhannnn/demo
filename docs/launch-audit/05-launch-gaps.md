# Phase 5 — Launch Gap Analysis

**Branch:** `auth_rbac_feature` @ `5890183`
Gaps ranked **Critical / High / Medium / Low** by launch impact. "Code-fixable" = closed in this PR (Phase 6). "Operational" = human/vendor/AWS action.

---

## Critical

| Gap | Type | Impact | Resolution |
|---|---|---|---|
| **DPDP cookie consent + analytics absent from public marketing site** (BUG-004) | Code-fixable | Public site runs no consent gate and no funnel analytics → DPDP non-compliance on the LP surface + zero ad-spend attribution | **Fixed** — partials injected into all LP pages + grievance redirect; build verified |
| **7 launch DDB tables not deployed to AWS** (INFRA-01) | Operational | Every launch API (grievance, billing, subscriptions, NPS) returns 500 `ResourceNotFoundException` in a fresh account | IaC ready (`launch-tables-cfn.yaml`); founder must `cloudformation deploy` |
| **Production env values not populated** (INFRA-07, DEPLOY-02) | Operational | Apps build but payments/email/captcha/analytics no-op or fail | Populate Lambda + Netlify + LP `.env` from 1Password |
| **Legal sign-off + Razorpay live KYC** (LEGAL-02/03, ACCT-07) | Operational | Cannot legally accept customer data or payments | Lawyer review + CA sign-off + Razorpay KYC (3–7 day SLA) |

## High

| Gap | Type | Impact | Resolution |
|---|---|---|---|
| **Seat-cap not enforced at invite API** (BUG-009) | Code (cross-service) | Team-plan agencies can exceed paid seats via scripted invite → revenue leak | **Documented** — enforce in `reality-flow-authentication` `createInviteHandler` by reading `Subscriptions`; not implemented here (no runtime to validate cross-service). Mitigated short-term by UI `check-seat` |
| **Server-side error tracking missing** (BUG-010) | Code-fixable | Lambda exceptions (billing webhook, crons) invisible outside CloudWatch | **Fixed** — env-guarded `@sentry/node` init in `lambda-handler.js` |
| **LP `/grievance` redirect → 404** (BUG-008) | Code-fixable | Broken DPDP grievance link from LP footer/legal | **Fixed** — `grievance/index.html` redirect to app subdomain |
| **No global rate limiting / WAF** (INFRA-04) | Operational | In-memory limiter is per-Lambda-instance; abuse/DoS surface on public routes | API Gateway usage plan + WAF |
| **No monitoring / alerting** (INFRA-05, ACCT-14) | Operational | Incidents undetected until customer complaint | CloudWatch alarms + BetterStack |
| **No security scan in CI** | Code/process | Vulnerable deps / regressions can merge | Add `npm audit` / CodeQL step |

## Medium

| Gap | Type | Impact | Resolution |
|---|---|---|---|
| **Incomplete P10 event instrumentation** (BUG-007) | Code-fixable | Funnel/CRO analysis incomplete (paywall, NPS, demo, otp_verified) | **Fixed** — key funnel `trackEvent`/`serverTrack` added |
| **grievance.js PostHog stub** (BUG-006) | Code-fixable | Grievance funnel invisible in analytics | **Fixed** — imports real `apps/crm/server/lib/posthog.js` |
| **Billing signature compare not constant-time** | Code-fixable | Minor timing side-channel on webhook HMAC | **Fixed** — `crypto.timingSafeEqual` |
| **Lint not enforced in CI; server has no lint** | Process | Style/type regressions | Add CRM lint to CI; add server lint (P2) |
| **No CD pipeline** | Process | Manual deploys, drift risk | Add deploy workflow post-launch |
| **Onboarding assets** (CONTENT-05/06) | Operational | Brand polish (logo/OG, founder profile) | Generate/host assets |

## Low

| Gap | Type | Impact | Resolution |
|---|---|---|---|
| LP Tailwind via CDN (not compiled CSS) | Code | Lighthouse/perf; render-blocking CDN | Optional: compile `main.css` and swap CDN (deferred — CDN keeps styling correct) |
| `utils/response.js` Lambda error fallback emits `Access-Control-Allow-Origin: *` | Code | Inconsistent with app allowlist (non-credentialed API) | Align to allowlist (P2) |
| No distributed tracing | Code | Harder root-cause across services | Request-ID correlation sufficient for launch |
| Multi-step webhook flow not transactional | Code | Idempotency-guarded; rare partial-state risk | Acceptable; monitor |

---

## Scaling / billing / analytics / onboarding summary

- **Scaling:** Lambda + DDB on-demand scale automatically. Watch: per-instance rate limiter (add WAF), token cache is per-instance (fine).
- **Billing:** webhook path is sound (HMAC + raw body + idempotency + real seat increment). Residual: invite-side seat enforcement (BUG-009) + Razorpay live KYC (operational).
- **Analytics:** architecture correct (PostHog-only CRM, consent-gated LP). After Phase 6, consent + key funnel events fire; full P10 coverage continues post-launch.
- **Onboarding:** signup funnel + consent + demo env complete; demo Cognito pool deploy pending.

## Go / No-Go

**Code:** GO after Phase 6 (no open P0 code blockers).
**Operational:** NO-GO until table deploy + env values + legal/Razorpay sign-off + DNS are completed by the founder. These are tracked and unchanged by this PR.
