# 01 — RealEstateFlow Business Memory

> **Source of truth for what the product actually is.** Extracted from the codebase (`real-estate-crm-app/`, `server/`, `ai-calling-service/`) and brand docs (`/.brand/`). Features below are verified in code, not assumed. Any content claim must trace back to this file.

---

## 1. One-Line Truth

**RealEstateFlow** (brand name "RealtyFlow") is a **mobile-first real estate CRM built for Indian brokerages and agencies** — managing leads, properties, clients, team, follow-ups, commission ledgers (khata), and **AI calling** in one platform, in Hinglish.

- **Markets:** Mumbai, Pune, Delhi NCR, Bangalore (primary); Dubai (secondary).
- **Tagline:** "Agency ki Growth, Aapke Control Mein."
- **Primary color:** `#2563EB` · **Font:** Inter · **Language:** Hinglish (70/30).

---

## 2. Who Uses It (verified by role/RBAC code)

The app has **Admin** and **Member** roles (`real-estate-crm-app/src/utils/rbac.ts`), agency-scoped (multi-tenant). Mapped to real personas:

| In-product role | Real-world persona | What they do |
|---|---|---|
| **ADMIN** (full CRUD) | **Agency Owner / Brokerage Boss** | Sees everything: all leads, all agents, pipeline, khata, analytics. Invites members. |
| **ADMIN / elevated MEMBER** | **Sales Manager / Team Leader** | Assigns leads, tracks team follow-ups, schedules site visits, runs reports. |
| **MEMBER** (CRUD minus delete) | **Broker / Property Consultant / Agent** | Works own leads, properties, follow-ups, calls; can't delete records. |
| **MEMBER** (new) | **New Joiner** | Onboards via invite, limited footprint. |
| (external) | **Buyer / Tenant / Owner / Developer** | The *data* the agency manages — not app users. |

Membership model: invites (`AcceptInvite.tsx`, `InviteManagement.tsx`, `MemberManagement.tsx`), role selection (`RoleSelection.tsx`), agency membership (`getAgencyMembershipDescription`).

---

## 3. Features (verified in code)

### 3.1 Lead Management
- Lead list, detail, drawer, enquiries, B2B leads — `pages/crm/LeadList.tsx`, `LeadDetails.tsx`, `LeadDrawer.tsx`, `EnquiryList.tsx`, `B2BLeadsList.tsx`; routes `leads.js`, `enquiries.js`, `b2bLeads.js`.
- Lead capture, assignment, status/stages, ownership (which agent owns which lead).
- **Content angle:** lead leakage, lead accountability, "kaun sa agent kaun sa lead chala raha hai".

### 3.2 Property / Inventory Management
- Properties, property detail, buildings, flats, projects, rented properties — `PropertyList.tsx`, `PropertyDetails.tsx`, `BuildingDetail.tsx`, `ProjectList.tsx`, `RentedProperties.tsx`, `RentalList.tsx`; routes `buildings.js`, `flats.js`, `projects.js`.
- Add property modal, media/PDF/document uploads, map picker (`GoogleMapPicker.tsx`, `LocationPicker.tsx`), properties map view.
- **Content angle:** inventory at fingertips, share property instantly, buyer-property matching.

### 3.3 Client / Contact Management
- Buyers, Owners, Tenants (Customers), Developers, Contacts — `BuyerList`, `OwnerList`, `TenantList`, `CustomerList`, `DeveloperList`, `ContactList` + detail pages; routes `buyers.js`, `developers.js`, `contacts.js`, `crm.js`.
- Party search selector, requirement capture.
- **Content angle:** "client call aaye toh saari history turant" — no fumbling.

### 3.4 Follow-ups, Tasks & Calendar
- Calendar, schedule meeting, meeting history, reschedule — `Calendar.tsx`, `ScheduleMeetingModal.tsx`, `MeetingHistoryModal.tsx`, `MeetingRescheduleModal.tsx`.
- Site-visit scheduling, follow-up reminders, notifications (`NotificationCenter.tsx`, route `notifications.js`).
- **Content angle:** "follow-up bhool gaye? Ab nahi hoga" — the #1 pain.

### 3.5 Khata Book (Commission / Settlement Ledger) — *differentiator*
- Khata book, entry form, settlement, drawer, settlement modal — `KhataBook.tsx`, `KhataEntryForm.tsx`, `KhataSettlement.tsx`, `KhataDrawer.tsx`, `SettlementModal.tsx`; route `khata.js`.
- Tracks commissions, dues, settlements between parties.
- **Content angle:** commission disputes, "kiska kitna paisa", transparent hisaab — emotionally charged for owners.

### 3.6 AI Calling — *flagship differentiator*
- Dashboard, call history, call details, knowledge manager, start-call modal, settings — `pages/crm/AICalling/*`; service `ai-calling-service/` (Lambda + **Exotel** + **ElevenLabs**); route `aiCallingInternal.js`.
- AI places/handles calls, records, transcribes, uses a knowledge base.
- **Content angle:** "AI does the follow-up calls, you do the closing" — saves ~10 hrs/week (per ICP research).

### 3.7 Team Management & Hierarchy
- Hierarchy view, member management, invites — `Hierarchy.tsx`, `MemberManagement.tsx`, `InviteManagement.tsx`, `Invites.tsx`, `NoAccess.tsx`.
- **Content angle:** team visibility without micromanagement.

### 3.8 Dashboards, Analytics & Reports
- CRM dashboard, business analytics, main dashboard — `CRMDashboard.tsx`, `BusinessAnalytics.tsx`, `Dashboard.tsx`.
- **Content angle:** "office ka hisaab ek click mein", pipeline visibility, owner reporting.

### 3.9 RBAC / Permissions
- `rbac.ts`, `PermissionGuard.tsx` — Admin = full CRUD; Member = create/read/update, no delete; agency-scoped multitenancy.
- **Content angle:** control, data safety, "naya banda delete nahi kar sakta".

### 3.10 Auth & Onboarding
- Phone/OTP login, admin login/register, Google auth callback, forgot password, accept invite, profile — `PhoneLogin.tsx`, `OTPInput.tsx`, `AdminLogin.tsx`, `RegisterAdmin.tsx`, `AuthCallback.tsx`, `onboarding-page/`.
- **Content angle:** quick start, phone-first (Indian-friendly), no credit card.

### 3.11 Supporting capabilities
- Speech-to-text input (`SpeechToTextButton.tsx`), mobile-first UI, demo mode (`DemoBanner.tsx`), notifications, document/KYC management (`KYC_IMPLEMENTATION_SUMMARY.md`).

---

## 4. Feature → Pain → Proof Map (for hooks/CTAs/scripts)

| Feature | Pain it kills | Proof line |
|---|---|---|
| Lead Management | Lead leakage (losing 30–40%) | "Ek bhi lead miss nahi" |
| AI Calling | 20 hrs/week of manual follow-up | "AI calls karega, tu deals close kar" |
| Follow-up reminders | Forgotten follow-ups | "Follow-up bhool gaye? Ab nahi hoga" |
| Khata / Settlement | Commission disputes & manual hisaab | "Commission ka hisaab — zero jhagda" |
| Team Hierarchy | No visibility into team | "Poori team ek dashboard mein" |
| Property Mgmt | Inventory scattered, slow sharing | "Property turant share, deal fast" |
| Analytics | No pipeline visibility | "Pata chalega kitne leads, kahan atke" |
| RBAC | Data chaos / risk | "Tumhara control, tumhare rules" |
| WhatsApp workflow* | WhatsApp lead chaos | "WhatsApp ka kaam, system mein" |

\* WhatsApp is positioned as a workflow/lead-source the CRM organizes (per brand/positioning). Treat as an *integration/workflow story*, not a verified in-code WhatsApp API feature — keep claims at the workflow level.

---

## 5. Pricing (from positioning.md / pricing.json)

| Plan | Price | Target |
|---|---|---|
| Free | ₹0/mo | Solopreneurs, testing (50 leads, 2 users) |
| Starter | ₹999/mo | Small teams (500 leads, 5 users, WhatsApp) |
| Growth | ₹2,999/mo | Growing agencies (unlimited leads, 15 users, AI matching) |
| Pro | ₹5,999/mo | Large agencies (+ API, analytics) |
| Enterprise | Custom | Developers |

---

## 6. Proof / Trust Assets (use carefully, keep honest)

- Positioning claims "500+ agencies" / research mentions "200+ brokerages across Mumbai, Delhi, Pune, Dubai." **Use the lower, defensible number in public content** and confirm before publishing. RERA visibility is non-negotiable in Indian RE content.

---

## 7. Hard Rules for Content (RealEstateFlow)

1. Never claim a feature not in §3. If unsure, frame as workflow/benefit, not a hard feature.
2. Always Hinglish 70/30 (see language strategy for Marathi).
3. Money in ₹, lakh, crore. Never $/million.
4. Mobile-first framing — assume the viewer is on a phone, in the field.
5. RERA / trust signals where relevant; no false numbers.
6. Tone: street-smart, supportive expert friend — never corporate, never condescending.
