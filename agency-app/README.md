# agency-app/

Everything an agency owner or agent uses: the CRM, lead channels, AI calling and
follow-ups. This is the RealtyFlow SaaS product.

| Folder | What it is | Runtime |
|---|---|---|
| `web/` | CRM web + mobile frontend (React/Vite/Capacitor); also hosts the Instagram console at `/insta/*` | S3 + CloudFront |
| `api/` | CRM backend; owns the CRM, agencies and subscriptions tables; publishes `crm.*` events | Express on Lambda + cron/event workers |
| `instagram-web/`, `instagram-api/` | Instagram lead console + Meta Graph API backend | S3 / Express on Lambda |
| `ai-calling/` | AI voice calling (Exotel + ElevenLabs); publishes `aicalling.calls` events | Express on Lambda |
| `followup-agent/` | Follow-up agent: API + event/cron worker consuming `lead.created`, `meeting.*`, `call.ended` | two Lambdas |
| `landing-pages/` | Marketing site for the agency product | S3 + CloudFront |

Onboarding is part of `api/` (trial signup in `routes/auth.js`); the old
standalone `onboarding` app was removed on 2026-09-17.

Rules that apply here:

- `api/` is the only unit that touches the CRM tables. Other units in this
  folder call it through the gateway (`/agency/*`, internal routes with a
  service key today, IAM-signed calls once the gateway is regrouped).
- Anything the public app needs is published as an event; see
  `platform/contracts/events/`.

Deploy wrappers: `infra/cicd/agency-app/<name>/deploy.sh`. Design docs: `docs/agency-app/<name>/`.
