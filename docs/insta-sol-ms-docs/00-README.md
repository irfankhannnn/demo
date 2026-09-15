# Instagram Solution — Documentation Index

All documentation for this feature lives in this folder.

An Instagram lead system for real estate agencies, hosted inside RealtyFlow. An agency
owner clicks **Connect Instagram** in the console; the service reads their DMs through
Meta's official Instagram API, scores every conversation as a lead with a summary, next
step and a Hinglish reply, hands qualified leads to the CRM, applies comment keyword
rules, and lets the team reply from the console inside Instagram's 24-hour window.

## Read in this order

| Doc | What it covers |
|---|---|
| [07-META-APP-SETUP.md](07-META-APP-SETUP.md) | **Where the App ID and secret go**, URLs to register, testers, going live |
| [03-ARCHITECTURE.md](03-ARCHITECTURE.md) | How it works: auth schemes, data model, flows, Meta endpoints, safety rules |
| [04-BACKEND-API.md](04-BACKEND-API.md) | Endpoint reference for `backend_insta_sol_ms` |
| [06-DEPLOYMENT.md](06-DEPLOYMENT.md) | Stacks, deploy scripts, secrets, switches, local development |
| [08-TESTING.md](08-TESTING.md) | What is tested, how to run it, what was verified end to end |
| [09-CLOUDFRONT-INTEGRATION.md](09-CLOUDFRONT-INTEGRATION.md) | Serving the console at `/insta/*` on the CRM distribution |
| [10-APP-REVIEW.md](10-APP-REVIEW.md) | Meta App Review: prerequisites, per-permission text, screencast scripts |
| [01-PLAN.md](01-PLAN.md), [02-FEATURES.md](02-FEATURES.md) | The original laptop-agent plan and feature catalogue (historical) |

## Code layout

| Folder | What |
|---|---|
| `backend_insta_sol_ms/` | The microservice. Express on Lambda + EventBridge worker, API Gateway, two DynamoDB tables |
| `frontend_insta_sol_ms/` | The console. React 18 + TS + Vite, served at `/insta/` |
| `cfn-templates-cicd/backend_insta_sol_ms/` | CI/CD wrapper with build tracking and rollback |
| `cfn-templates-cicd/frontend_insta_sol_ms/` | Same, plus per-build `dist/` archives |

## Decisions

| # | Decision | Chosen |
|---|---|---|
| D0 | Isolation | Own stack and tables; the CRM is reached only through its internal adapter API |
| D1 | Meta app model | **One hosted Meta app** for all agencies. Tested in Development Mode with Instagram testers; the same app and code serve every agency after App Review |
| D2 | DM delivery | Webhooks (Live mode) plus a scheduled poll that also covers Development Mode |
| D3 | Lead analysis | Pluggable: rule-based by default, Gemini when a key is set; model output is checked against the conversation |
| D4 | Sending | A person sends from the console; keyword rules send one private reply per comment. No other automation |

The laptop agent (`instagram-local-agent`) was removed in September 2026: it could not
onboard other agencies (every laptop would need the app secret, and Meta does not
approve a localhost login), and it could not receive webhooks. Its window classifier,
enquiry extractor, error taxonomy and rule matcher were ported into the backend.

## Things Meta decides, not us

1. **No Facebook Page is required.** Instagram API with Instagram Login authenticates
   the professional account directly.
2. **Only the 20 most recent messages** of a conversation are returned, plus everything
   that arrives after connecting.
3. **Sending is window-limited, reading is not.** A reply is allowed within 24 hours of
   the person's last message; a private reply to a comment within 7 days; nothing else.
4. **Webhooks need Live mode**, and comment webhooks need Advanced Access.
