# Store privacy disclosures — answer key

Fill the Google Play **Data safety** form and the App Store **privacy nutrition
labels** from this page. Reviewers cross-check the two against each other and
against `ios/App/App/PrivacyInfo.xcprivacy`, so all three must agree.

Every row cites where the data actually comes from in the code, so you can
defend an answer if review pushes back.

## The shape of the problem

This is a high-sensitivity dataset. A broker's records contain **their clients'**
government IDs, bank details and identity documents — data about people who
never installed the app. Both stores treat that as collected data, and Play's
form has extra requirements for financial and government-ID categories.

## Google Play — Data safety answers

### Collected and shared

| Category → Type | Collected | Shared | Optional? | Purpose | Source |
|---|---|---|---|---|---|
| Personal info → Name | Yes | No | Required | App functionality | `UserProfile.displayName`, `CRMOwner.name`, `CRMCustomer.name` |
| Personal info → Email address | Yes | No | Required | App functionality, Account management | `UserProfile.email` |
| Personal info → Phone number | Yes | No | Required | App functionality, Account management | Sign-in is phone-OTP; `CRMCustomer.phone` |
| Personal info → Address | Yes | No | Optional | App functionality | `CRMOwner.address`, `CRMProperty.address` |
| Personal info → **Government ID** | Yes | No | Optional | App functionality | `CRMOwner.panNumber`, `aadharNumber`; `CRMCustomer.aadharNumber` |
| Personal info → Other info | Yes | No | Optional | App functionality | Free-text notes on leads, owners, enquiries |
| Financial info → **Other financial info** | Yes | No | Optional | App functionality | `CRMOwner.accountNumber`, `ifscCode`, `bankName`; khata ledger |
| Location → **Approximate location** | Yes | No | Optional | App functionality | `CRMProperty.latitude/longitude` |
| Location → **Precise location** | Yes | No | Optional | App functionality | `LocationPicker` device position |
| Photos and videos → Photos | Yes | No | Optional | App functionality | Property images, `photoUrl`, ID scans |
| Files and docs → Files and docs | Yes | No | Optional | App functionality | Agreements, police verification, `aadharDocUrl` |
| App activity → App interactions | Yes | No | **Optional** | Analytics | PostHog, consent-gated |
| App info and performance → Crash logs | Yes | No | Optional | App functionality | Sentry |
| App info and performance → Diagnostics | Yes | No | Optional | App functionality | Sentry performance traces |
| Device or other IDs → Device or other IDs | Yes | No | Optional | Analytics | PostHog anonymous id |

**Not collected:** contacts, calendar, SMS, call logs, health, fitness, browsing
history, installed apps, purchase history (mobile takes no payments), audio
(AI calling ships disabled — see below).

### Security practices

- **Encrypted in transit:** Yes. HTTPS to API Gateway throughout; Android blocks cleartext by default.
- **Users can request data deletion:** Yes — in-app, plus a web URL.
- **Deletion URL:** `https://realestateflow.in/legal/delete-account`
- **Committed to the Play Families policy:** N/A, not a children's app.
- **Independent security review:** No.

### Account deletion (separate Play Console section)

- In-app path: **Profile → Danger Zone → Delete account**
- Deletes immediately: Cognito user, auth identities, user record, session
- Deletes on a 30-day schedule: tenant CRM data
- The 30-day window reconciles DPDP erasure with statutory retention of
  financial records (khata ledger, GST invoices), and **must match the privacy
  policy wording**

### Declarations Play will ask for separately

- **Financial features:** the app displays banking details the user entered. It does **not** process payments on mobile — all purchasing is stripped for App Store 3.1.1 / Play Billing compliance.
- **Permissions:** location (property picker), camera (photos and documents), photo library.
- **Target audience:** 18+, business tool. Not designed for children.
- **Ads:** none.

## App Store — nutrition labels

Same substance, Apple's vocabulary. Mirrors `PrivacyInfo.xcprivacy`.

| Apple category | Types | Linked to user | Used for tracking |
|---|---|---|---|
| Contact Info | Name, Email, Phone, Physical Address | Yes | No |
| Financial Info | Other Financial Info | Yes | No |
| Sensitive Info | Government ID, identity documents | Yes | No |
| Location | Precise Location | Yes | No |
| User Content | Photos or Videos, Other User Content | Yes | No |
| Identifiers | User ID | Yes | No |
| Usage Data | Product Interaction | Yes | No |
| Diagnostics | Crash Data, Performance Data | Yes | No |

**Tracking: No.** No ads, no third-party ad SDKs, no data linked to third-party
data for advertising. Set `NSPrivacyTracking` to false and leave
`NSPrivacyTrackingDomains` empty — both already are.

## Third-party SDKs to disclose

| SDK | What it sees | Notes |
|---|---|---|
| PostHog | Product events, user id, tenant id | Consent-gated; **session replay disabled on mobile** |
| Sentry | Crash and performance data, user id | Not consent-gated — flag for legal review |
| Google Maps JS | Property coordinates | Loaded at runtime |
| hCaptcha | Public grievance form only | |
| Razorpay | Nothing on mobile | Script never injected in native builds |

## AI calling — keep disabled

`VITE_AI_CALLING_ENABLED=false` in `.env.mobile.sample`. **Leave it off for
submission.**

`agency-app/ai-calling/src/services/exotelService.js` sets `Record: 'true'` by
default, and a search for "consent" across `agency-app/ai-calling/` and
`services/callIntelligence/` returns nothing — no recording disclosure, no
callee consent capture, no privacy-policy section. Recording third parties who
never used the app is a legal exposure independent of the stores, and Apple will
ask what the microphone is for.

Enabling it later means adding: an audio/voice data declaration on both forms, a
recording disclosure to the callee, consent capture, and a privacy-policy
section.

## Before you submit

- [ ] Play Data safety form matches the table above
- [ ] App Store nutrition labels match `PrivacyInfo.xcprivacy`
- [ ] `PrivacyInfo.xcprivacy` is in the App target's **Copy Bundle Resources** in Xcode (Capacitor does not add it automatically)
- [ ] Privacy policy describes the 30-day deletion window and mobile data collection
- [ ] `https://realestateflow.in/legal/delete-account` is live and works without the app
- [ ] `VITE_AI_CALLING_ENABLED=false` in the build you actually ship
