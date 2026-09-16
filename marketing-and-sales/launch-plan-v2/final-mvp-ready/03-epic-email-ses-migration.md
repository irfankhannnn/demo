# EPIC 3 — Email: AWS SES Primary + Brevo Fallback

**Outcome:** All transactional email goes through AWS SES first, with Brevo as automatic fallback. One abstraction (`emailService.js`) replaces the scattered direct Brevo calls.

**Architecture anchors:**
- Server AWS SDK is **v3** → use `@aws-sdk/client-sesv2` (`SESv2Client`, `SendEmailCommand`). Add to `apps/crm/server/package.json` matching existing `^3.669` version prefix.
- `apps/crm/server/emailService.js` goes at **server root** (ships via `*.js` glob in deploy.sh zip).
- Brevo currently called directly in **4 routes** + **2 crons** via inline `fetch('https://api.brevo.com/v3/smtp/email', ...)`:
  - `apps/crm/server/routes/auth.js` — adds a **contact to a Brevo marketing list** (NOT transactional email; keep as-is; out of SES scope)
  - `apps/crm/server/routes/billing.js` — `sendBrevoEmail(...)` call inside payment/subscription webhook handlers
  - `apps/crm/server/routes/grievance.js` — contact-form email after grievance submission
  - `apps/crm/server/routes/feedback.js` — NPS score alert email
  - `apps/crm/server/scripts/trial-reminder-cron.js` — trial reminder sends (exports `handler`)
  - `apps/crm/server/scripts/escalation-cron.js` — SLA escalation sends (exports `handler`)
- Env already in CFN Lambda: `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME`.
- New env to add (see `07-infra-cfn-deploy.md` §3): `AWS_SES_FROM_EMAIL`, `EMAIL_PROVIDER_PRIMARY`.
- See `notes/codebase-reference.md` §12 for the complete env var addition list.

---

## E3-T1 — `emailService.js` abstraction (SES primary, Brevo fallback)

**Status:** ✅ IMPLEMENTED (2026-06-19, branch `mvp-readiness-launch`)

**Goal:** Single send function used everywhere.

**Files**
- NEW `apps/crm/server/emailService.js`
- MODIFY `apps/crm/server/package.json` — add `@aws-sdk/client-sesv2` (match existing `^3.669` line).

**API**
```js
// returns { provider:'ses'|'brevo', messageId }
sendEmail({ to, subject, html, text, brevoTemplateId, params, from })
```

**Detail**
- Try SES (`SendEmailCommand`, `FromEmailAddress = from || SES_FROM_EMAIL`, `Destination.ToAddresses`, `Content.Simple` with Subject + Html/Text).
- On SES error (or `EMAIL_PROVIDER_PRIMARY!=='ses'`), fall back to Brevo (`https://api.brevo.com/v3/smtp/email`, headers `api-key`, supports `templateId`/`params`).
- If both fail: log error, throw (callers already wrap email in non-fatal try/catch — preserve that behavior).
- Region from `AWS_REGION || 'ap-south-1'` (matches cron clients).

**Error Recovery & Retry**
- **SES Attempt:** 5-second timeout (SDK default + explicit AbortController if needed); on timeout/error → proceed to Brevo immediately (no retry).
- **Brevo Fallback:** 5-second fetch timeout; if fails → throw error to caller.
- **Total E2E:** max 10 seconds per email send (5s SES + 5s Brevo).
- **Idempotency:** Do NOT retry in `emailService` itself. Callers (crons, routes) implement their own idempotency guards (e.g., `lastEmailSentAt` flag for crons).
- **Logging:** Log `{ to, subject, provider, messageId, duration, error }` at info level on success; error level on double-failure.
- **Non-Fatal:** All calls wrap in try/catch; email failures never cascade to request response (fire-and-forget crons, silent retry on route).

**Security**
- No secrets logged. `to`/subject can be logged at info; never log full html or API keys.

**Tests**
- Unit (mock SESv2 + fetch): SES success → provider 'ses'; SES throws → Brevo path → provider 'brevo'; both throw → rejects.
- Retry behavior: SES timeout (5s) → Brevo attempted within 10s total E2E window.

**Acceptance**
- `sendEmail` works against SES; SES timeout/fail falls back to Brevo within 10s; both failures are logged, error thrown (caller handles).

**Depends on:** none.

---

## E3-T2 — Migrate `billing.js`, `grievance.js`, `feedback.js`

**Goal:** Replace direct Brevo SMTP sends with `emailService.sendEmail`.

**Files**
- MODIFY `apps/crm/server/routes/billing.js` — replace local `sendBrevoEmail(...)` body to call `emailService.sendEmail({ to, brevoTemplateId: templateId, params })` (keep template-id support for existing Brevo templates; SES will use a rendered html when no template — provide minimal html for these).
- MODIFY `apps/crm/server/routes/grievance.js` — contact-form email via `sendEmail({ to: FROM-equivalent recipient, subject, html })` using existing `FROM_EMAIL`/`FROM_NAME`.
- MODIFY `apps/crm/server/routes/feedback.js` — NPS alert via `sendEmail`.

**Detail**
- Where code currently relies on a **Brevo template ID** with no html, pass `brevoTemplateId` so the Brevo path still works; for SES provide a basic html fallback (template content can be migrated to SES templates later — out of MVP scope).
- Keep all sends non-fatal (wrap in try/catch as today).

**Security/behavior**
- Preserve existing recipients and gating (`if (!apiKey) skip` becomes: SES attempted regardless; Brevo skipped if no key).

**Tests**
- Integration: each route, on its trigger, calls `emailService.sendEmail` once with expected `to`/subject (spy).

**Acceptance**
- Billing/grievance/feedback emails send via SES (or Brevo fallback) with identical recipients.

**Depends on:** E3-T1.

---

## E3-T3 — Migrate the two crons

**Goal:** Trial-reminder and escalation crons send via SES-first.

**Files**
- MODIFY `apps/crm/server/scripts/trial-reminder-cron.js` — replace `sendBrevoEmail` with `emailService.sendEmail` (import path `../emailService.js`; both ship in the zip).
- MODIFY `apps/crm/server/scripts/escalation-cron.js` — same.
- MODIFY `cron/trial-reminder.yaml` and the escalation cron template — add env `AWS_SES_FROM_EMAIL`, `EMAIL_PROVIDER_PRIMARY=ses`; keep `BREVO_API_KEY` for fallback. Add `ses:SendEmail`/`ses:SendRawEmail` to those cron Lambda roles (or attach a shared policy).

**Detail**
- Cron Lambdas run outside the API role; ensure **their** execution roles get SES permission (the cron CFN templates define their own roles — update them).

**Security**
- Least privilege: SES action scoped to the verified identity ARN if desired.

**Tests**
- Unit: cron handler invokes `sendEmail` for due tenants; idempotency (`lastTrialEmail`) preserved.

**Acceptance**
- Trial reminders + escalations deliver via SES with Brevo fallback.

**Depends on:** E3-T1.

---

## E3-T4 — Config, IAM, and AWS setup doc

**Goal:** Make SES deployable.

**Files**
- MODIFY `apps/crm/server/.env.example` — add:
  ```
  AWS_SES_FROM_EMAIL=noreply@realestateflow.in
  EMAIL_PROVIDER_PRIMARY=ses
  EMAIL_PROVIDER_FALLBACK=brevo
  ```
- MODIFY `apps/crm/server/infra/cfn-backend.yaml`:
  - Add `AWS_SES_FROM_EMAIL`, `EMAIL_PROVIDER_PRIMARY` to `ApiLambdaFunction.Environment`.
  - Add to `ApiLambdaExecutionRole` policy: `ses:SendEmail`, `ses:SendRawEmail` (Resource `*` or the identity ARN).
- MODIFY `apps/crm/server/infra/deploy.sh` — pass the new params.
- NEW `marketing-and-sales/launch-plan-v2/final-mvp-ready/notes/ses-aws-setup.md` — manual steps: verify sender/domain, DKIM, request production access (sandbox gate).

**Security**
- Document that until SES production access is granted, only verified recipients receive mail → **keep Brevo fallback enabled** as the release gate.

**Tests**
- `cloudformation validate-template` passes; `deploy.sh --dry` (or param-gen step) includes new keys.

**Acceptance**
- Stack deploys with SES env + IAM; sender verified; fallback intact.

**Depends on:** E3-T1.

---

## Note on `auth.js`
`auth.js` adds a **contact to a Brevo list** (marketing list), not a transactional email. Leave it on Brevo (it's list management, not SMTP). Out of SES scope.