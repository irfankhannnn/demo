# Product truth

> **Status (17 Sep 2026):** Source of truth for what the product actually is. Re-verified against the code on `main` after the September repo reorganisation. Replaces the retired Content OS file `content-os/workspaces/realestateflow/01-business-memory.md` (that folder no longer exists — see `archive/content-os/README.md`), whose feature list, pricing table, brand values, markets and paths were all stale.

**Every content claim must trace to a row in this file, and every row cites a repo path.** If a feature is not here, marketing may not claim it. If you add a row, add its path. A row here does not by itself make a claim publishable — see `claims-and-proof-policy.md` §4 for the approved-claims list, which is narrower.

Evidence sources: `apps/crm/`, `apps/instagram/`, `public-app/property-pages/`, `apps/onboarding/`, `agency-app/landing-pages/`, `services/`, `docs/`. Brand values come from `10-audience-and-voice/brand-constants.md`.

---

## 1. One line

**RealEstateFlow** is a mobile-first real estate CRM and Real Estate OS for Indian brokerages, with an optional 24×7 WhatsApp AI Employee. It manages leads, properties, clients, team, follow-ups and the commission ledger (khata), and it can qualify and follow up leads by AI call and by WhatsApp.

- **Market M1:** Mumbai only. Later, in order: Pune → Bangalore → Delhi → Hyderabad (`00-PLAN-OVERVIEW.md` §3).
- **Approved taglines:** "Your business is bigger than WhatsApp." · "Apna business WhatsApp se baahar nikalo." · "Apni Agency ka Real Estate OS." (`marketing-and-sales/creative/realestateflow-launch/brand-kit.md`)
- **Brand and language:** see `10-audience-and-voice/brand-constants.md`. The product UI is English with no i18n; the AI agent speaks Hinglish on calls (`agency-app/web/src/pages/crm/AICalling.tsx`).

---

## 2. Who uses it

Roles in code are **ADMIN** and **MEMBER**, agency-scoped and multi-tenant (`agency-app/web/src/utils/rbac.ts`, `agency-app/web/src/components/PermissionGuard.tsx`).

| In-product role | Real-world persona | What they do |
|---|---|---|
| ADMIN (full CRUD) | Agency owner / brokerage boss | Sees all leads, all agents, pipeline, khata, analytics. Invites members. |
| ADMIN or senior MEMBER | Sales manager / team leader | Assigns leads, tracks team follow-ups, schedules site visits, runs reports. |
| MEMBER (CRUD minus delete) | Broker / property consultant / agent | Works their own leads, properties, follow-ups, calls. Cannot delete records. |
| MEMBER (new) | New joiner | Onboards via invite, limited footprint. |
| (not app users) | Buyer / tenant / owner / developer | The *data* the agency manages. |

A MANAGER role and "members see only their own leads" are **not built**; they are required before Team plans are sold.

Membership: invites and role selection at `agency-app/web/src/pages/admin/InviteManagement.tsx`, `src/pages/admin/MemberManagement.tsx`, `src/pages/member/Invites.tsx`.

---

## 3. Features verified in code

> Path convention: a bare `src/…` path is relative to `agency-app/web/`. Everything else is repo-root relative.

### 3.1 Lead management
`src/pages/crm/LeadList.tsx`, `LeadDetails.tsx`, `LeadDrawer.tsx`, `EnquiryList.tsx`, `B2BLeadsList.tsx`; server routes `agency-app/api/routes/{leads,enquiries,b2bLeads}.js`. Lead capture, assignment, status and stages, per-agent ownership.
**Content angle:** lead leakage, lead accountability — "kaun sa agent kaun sa lead chala raha hai".

### 3.2 Lead intake, deduplication and AI qualification — *the piece most docs got wrong*
Every lead enters through `agency-app/api/leadIngestion.js`. A lead carries `source` (e.g. `'Instagram'`), `sourceAdapter`, `externalRef` (including `sourceMediaId` / `reelRef` for Instagram), `dedupeKey` and an optional `followUp` hint. Ingestion emits an EventBridge `lead.created` event, which triggers `agency-app/api/scripts/lead-qualifier-handler.js`; that emits `lead.qualified` for the lead router. Leads get a HOT/WARM/COLD temperature with `scoreValue`, `scoreReasons`, `scoredAt` and `scoreSource` (`agency-app/api/utils/leadRubric.js`, `src/components/LeadTemperatureBadge.tsx`). Architecture: `docs/lead-adapter-architecture.md`.

**There is no `leadSource`, `utm*` or `contentRef` field on a lead.** UTM is captured at signup only (`agency-app/api/routes/auth.js`). Per-content attribution therefore has to be logged manually in the tracking sheet today.

### 3.3 Property and inventory management
`src/pages/crm/PropertyList.tsx`, `PropertyDetails.tsx`, `BuildingDetail.tsx`, `ProjectList.tsx`, `RentedProperties.tsx`, `RentalList.tsx`; routes `agency-app/api/routes/{buildings,flats,projects}.js`. Media, PDF and document upload; map picker (`GoogleMapPicker.tsx`, `LocationPicker.tsx`).
**Content angle:** inventory at your fingertips, share a property instantly, buyer-property matching.

### 3.4 Client and contact management
Buyers, owners, tenants (customers), developers, contacts — list and detail pages under `src/pages/crm/`; routes `agency-app/api/routes/{buyers,developers,contacts,crm}.js`. Party search, requirement capture.
**Content angle:** "client call aaye toh saari history turant".

### 3.5 Follow-ups, tasks and calendar
`src/pages/crm/Calendar.tsx`, `src/components/ScheduleMeetingModal.tsx`, `MeetingHistoryModal.tsx`, `MeetingRescheduleModal.tsx`, `NotificationCenter.tsx`; route `agency-app/api/routes/notifications.js`.
**Content angle:** "follow-up bhool gaye? Ab nahi hoga" — the number-one pain.

### 3.6 Khata book (commission / settlement ledger) — *differentiator*
`src/pages/crm/KhataBook.tsx`, `src/components/KhataEntryForm.tsx`, `KhataSettlement.tsx`, `KhataDrawer.tsx`, `SettlementModal.tsx`; route `agency-app/api/routes/khata.js`; types `src/types/khata.ts`. To Give / To Take per party and per property, categories (Brokerage, Maintenance, Deep Cleaning, Repair, Security Deposit, Rent, Utility Bills), settlement status, and reminders wired to notifications (`agency-app/api/notificationDynamodbService.js`).
**Content angle:** commission disputes, "kiska kitna paisa", transparent hisaab.

### 3.7 WhatsApp inbox and the AI Employee — *the wedge*
`src/pages/crm/WhatsAppInbox.tsx`, `src/pages/crm/AiEmployee.tsx`, `src/pages/crm/AIEmployeeStatus.tsx`, `src/components/AiEmployeeSettings.tsx`; routes `agency-app/api/routes/{whatsappConversations,aiEmployeeConfig}.js`; transport `platform/whatsapp-platform/` (self-hosted Baileys, QR-linked, **not** a Meta Business API BSP). The agent understands Hinglish domain words and runs real CRM operations from WhatsApp (`agency-app/api/agents/domainRouter.js`, `agency-app/api/shared/toolDefinitions.js`).
**Direction, not today:** the plan is to move customer messaging to the official WhatsApp Business Cloud API (`docs/realestateflow-vision/39-whatsapp-official-api-plan.md`). Do not describe the official API as shipped.
**Disclosure:** the AI Employee is a paid add-on with no trial. Any creative naming it carries its price line, resolved from `pricing.json`.

### 3.8 AI calling
`src/pages/crm/AICalling.tsx`, `src/components/AICallTranscriptDrawer.tsx`, `src/pages/crm/CallRecordings.tsx`; service `agency-app/ai-calling/` (Lambda + Exotel + ElevenLabs); route `agency-app/api/routes/aiCallingInternal.js`. Places and handles calls, records, transcribes, uses a knowledge base. Billed at 15 credits (₹15) per minute; every tenant, trial included, gets 1,000 free credits a month by default (`agency-app/api/creditConfig.js`, `agency-app/api/routes/subscriptions.js`).
**Not yet on the approved-claims list** — see `claims-and-proof-policy.md` §4.

### 3.9 AI follow-up calls
`agency-app/followup-agent/` — site-visit confirmation and post-visit feedback calls, with retries and escalation, only inside the tenant's business hours. UI: `src/components/AiFollowupCard.tsx`.

### 3.10 Hosted Instagram lead service
`agency-app/instagram-api/` + `agency-app/instagram-web/`. Connect Instagram by OAuth; read DMs, comments, posts and insights; keyword rules on comments produce a private reply (`services/ruleMatcher.js`); DM analysis scores enquiries (rules plus Gemini) and hands leads to the CRM (`services/crmBridge.js`); per-reel enquiry, hot and DM counts (`routes/insights.js`).
**Status: dev only. Prod not deployed. Meta App Review pending** (`docs/pending-items/instagram-service-status.md`, `docs/pending-items/instagram-app-review-actions.md`). Meta's limits bind everything built on it: free-form DMs only inside a 24-hour window, and one private reply per comment within 7 days.
**Never describe this as live.**

### 3.11 Public property pages and site-visit booking
`public-app/property-pages/` — public property pages; a booking creates a CRM lead and a meeting (`agency-app/api/siteVisitBooking.js`); publishing controls in the CRM (`src/components/PropertyPublishControl.tsx`, `src/pages/crm/PublicPagesSettings.tsx`). ManyChat is wired for the booking flow (`docs/public-app/property-pages/02-MANYCHAT-SETUP.md`).

### 3.12 Team management and hierarchy
`src/pages/crm/Hierarchy.tsx`, `src/pages/admin/MemberManagement.tsx`, `InviteManagement.tsx`, `src/pages/admin/TeamAnalytics.tsx`, `src/pages/member/Invites.tsx`, `NoAccess.tsx`.
**Content angle:** team visibility without micromanagement.

### 3.13 Dashboards, analytics and the AI assistant
`src/pages/crm/CRMDashboard.tsx`, `BusinessAnalytics.tsx`, `Dashboard.tsx`, `src/pages/crm/Assistant.tsx`. PostHog is wired in the SPA, the server and the landing pages (`src/lib/analytics.ts`, `src/types/analytics.ts`, `agency-app/api/lib/posthog.js`, `agency-app/landing-pages/_partials/head-analytics.hbs`).

### 3.14 Billing, credits, paywall and NPS
Razorpay billing and webhooks (`agency-app/api/routes/billing.js`), GST billing settings (`src/pages/crm/BillingSettings.tsx`), credit purchase (`src/components/BuyCreditsModal.tsx`), paywall and trial countdown (`src/components/PaywallModal.tsx`, `TrialCountdownBanner.tsx`), trial email drip (`agency-app/api/scripts/trial-reminder-cron.js`), in-app NPS (`src/components/NpsModal.tsx`, `agency-app/api/routes/feedback.js`). Trial length is 14 days by default in code (`agency-app/api/subscriptionService.js`).

### 3.15 RBAC and multi-tenancy
`src/utils/rbac.ts`, `src/components/PermissionGuard.tsx`, `agency-app/api/tenantMiddleware.js`. ADMIN full CRUD; MEMBER create/read/update, no delete; agency-scoped.

### 3.16 Auth and onboarding
Phone/OTP login, admin login and register, Google auth callback, forgot password, accept invite, profile — `src/pages/auth/` components and `apps/onboarding/`. KYC and document handling documented at `docs/ai_context_management_plan/KYC_IMPLEMENTATION_SUMMARY.md`.

### 3.17 Public grievance page
`src/pages/public/Grievance.tsx` + `agency-app/api/routes/grievance.js` — required for the India compliance posture.

### 3.18 MCP server
`platform/mcp/` exposes 72 CRM tools, 5 resources and 5 prompts over StreamableHTTP (`platform/mcp/README.md`). This is how Claude and other assistants drive the CRM.

### 3.19 Supporting
Speech-to-text input (`src/components/SpeechToTextButton.tsx`), mobile-first UI, demo mode (`src/components/DemoBanner.tsx`).

---

## 4. Explicitly NOT built (do not claim, do not imply)

| Not built | Evidence |
|---|---|
| Portal integration or sync — MagicBricks, 99acres, Housing | no portal adapter in `agency-app/api/leadIngestion.js` |
| Facebook Messenger lead sync | only the Instagram adapter exists |
| Google Ads lead sync | same |
| Telegram, anywhere | no code; dropped from all copy |
| Lead-leakage / ROI calculator | placeholder markup in `agency-app/landing-pages/agency-owners/index.html` |
| "Broker Follow-up Tracker" or any other lead magnet | does not exist |
| A marketing event stream (`MKT_EVENT`), `/api/marketing/events`, sequence enrolment, a marketing dashboard | zero hits across `apps/` and `services/` |
| Per-lead UTM or `contentRef` | see §3.2 |
| A referral engine (referral codes, routes, UI) | no `routes/referral.js`, no `ReferFriend.tsx` |
| Activation scoring, customer health scoring | not built |
| A MANAGER role, or "members see only their own leads" | required before Team plans are sold |
| Uptime SLA, security certification | no document in the repo supports either |
| Any customer, testimonial, case study or adoption statistic | pre-launch, zero customers |

---

## 5. Feature → pain map (for hooks, CTAs and scripts)

Proof lines below are **framings, not results**. None of them asserts a number.

| Feature | Pain it kills | Framing |
|---|---|---|
| Lead intake + dedupe + AI temperature | Leads scattered across WhatsApp, duplicated, unranked | "Har lead ek jagah, aur pata chale kaunsa garam hai" |
| WhatsApp AI Employee | WhatsApp is the business, and the business is chaos | "Apna business WhatsApp se baahar nikalo" |
| Follow-up reminders | Forgotten follow-ups | "Follow-up bhool gaye? Ab nahi hoga" |
| Khata book + settlement | Commission disputes and manual hisaab | "Commission ka hisaab — zero jhagda" |
| Team hierarchy + analytics | No visibility into the team | "Poori team ek dashboard mein" |
| Property management + public pages | Inventory scattered, slow to share | "Property turant share, deal fast" |
| AI calling / AI follow-up calls | Manual follow-up eats the day | "Call AI karega, deal tum karo" — *not yet an approved claim* |
| Instagram lead service | DMs and comments never reach the CRM | *dev only; do not promise* |
| RBAC | Data chaos and risk | "Tumhara control, tumhare rules" |

---

## 6. Pricing

See `10-audience-and-voice/brand-constants.md` §5 and `marketing-and-sales/launch-plan-v2/pricing.json`. Do not restate a price here or anywhere else.

---

## 7. Hard rules for content

1. Never claim a feature that is not in §3. If it is in §4, it does not exist — do not soften it into a "workflow story".
2. A feature in §3 is not automatically publishable. Check `claims-and-proof-policy.md` §4 first.
3. Never state a customer count, result or unsourced statistic. See `claims-and-proof-policy.md`.
4. Money in ₹, lakh, crore. Never `$` or "million".
5. Mobile-first framing — assume the viewer is on a phone, between site visits.
6. RERA and trust signals where relevant; no false numbers.
7. Tone: street-smart, supportive expert friend. Never corporate, never condescending.
8. A next-generation lead engine is being built separately by the founder. When it lands, §3.2 and §3.10 change — update this file first, then the content that cites it.
