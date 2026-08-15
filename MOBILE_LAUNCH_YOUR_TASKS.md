# 📱 Mobile Launch — YOUR Tasks (Human-Only)

> **This file is only the things I cannot do.** Everything else — all code, config, native
> projects, tests — I am building end to end. Work through this list at your own pace.
>
> Each item says **why** it needs you: an account, a payment, a legal identity, a physical
> device, or a credential I must never hold.

**Legend** — 🔴 blocks launch · 🟠 blocks a phase · 🟢 do before submission
**Status** — tick the box as you finish. Nothing here depends on my progress.

---

## ⚡ START TODAY — these have multi-week lead times

Everything else can be compressed by working harder. These cannot.

### 🔴 1. Apply for a D-U-N-S number — **gates BOTH stores**

**Why you:** legal-identity verification tied to your registered company.
**Cost:** free · **Time:** 5–14 business days in India, sometimes 3 weeks

- [ ] Apply at **https://developer.apple.com/enroll/duns-lookup** (Apple's free form — do **not** pay a reseller, they charge for something free)
- [ ] Enter legal entity name, address and phone **exactly** as on your GST / incorporation certificate
- [ ] Wait for the D&B email, then re-run the lookup to confirm it resolves

> ⚠️ **The single most common cause of blown mobile timelines.** Any mismatch between what
> you type and your registration documents restarts the clock. Check character by character.
> Your GST certificate is in `assets/GST Certificate.pdf`.

### 🔴 2. Rotate the exposed API keys — **they are live right now**

**Why you:** vendor dashboard logins I don't have, and I must never hold production keys.
**Cost:** free · **Time:** 30 minutes

- [ ] Rotate `GEMINI_API_KEY`, then **delete** the old key (creating a new one does not disable the old one)
- [ ] Rotate `BAILEY_API_KEY` and revoke the old one
- [ ] Update both in the Lambda environment and your local `server/whatsapp-env.json`
- [ ] Confirm prod has `TestOtpEnabled=false` (exact command in the runbook)

📄 **Full steps: [`docs/security-key-rotation.md`](docs/security-key-rotation.md)**

> I untracked both files and fixed the broken ignore pattern, but **untracking does not
> revoke anything.** These keys work until you rotate them. Good news: I verified the fixed
> OTP `123456` is *not* a live bypass — it is gated behind an env flag that defaults to off.

### 🔴 3. Install the Android toolchain — **I cannot build an APK without it**

**Why you:** software installation on your machine.
**Cost:** free · **Time:** ~1 hour including downloads

- [ ] **JDK 21** (Temurin or Oracle) — `java` is currently not on this machine at all
- [ ] **Android Studio Otter 2025.2.1** or newer
- [ ] In Studio → SDK Manager: install **Android SDK Platform 36** + Build Tools 36
- [ ] Set `ANDROID_HOME` (currently unset) and add `platform-tools` to `PATH`
- [ ] Verify: `java -version` shows 21, and `npx cap doctor` reports Android healthy

> Node 26.1.0 is already installed and fine. This is the only gap.

---

## 🏢 Store Accounts

### 🔴 4. Google Play Console — **register as ORGANIZATION, not Personal**

**Why you:** payment + business identity verification.
**Cost:** $25 one-time · **Time:** 3–10 business days *after* D-U-N-S

- [ ] Sign up at **https://play.google.com/console/signup** → choose **Organization**
- [ ] Pay $25 (lifetime, not annual)
- [ ] Legal entity name exactly as registered + your D-U-N-S number
- [ ] Upload GST certificate / incorporation certificate
- [ ] Complete owner identity verification

> ⚠️ **Choosing "Organization" saves you roughly two weeks.** Personal accounts created after
> Nov 2023 must run a closed test with **12 testers opted in continuously for 14 unbroken
> days** before they can publish. Organization accounts are exempt entirely. You have a
> registered entity — use it.

### 🔴 5. Apple Developer Program — Organization

**Why you:** payment, legal identity, and a verification phone call.
**Cost:** $99/year · **Time:** 2 days – 2 weeks after D-U-N-S

- [ ] Create a **dedicated** Apple ID (e.g. `developer@yourdomain`) with 2FA — never a personal ID you might lose
- [ ] Enroll **through the Apple Developer app on an iPhone or iPad** — in India the website route is not available
- [ ] Choose Organization, supply D-U-N-S + legal name + `realestateflow.in`
- [ ] **Answer Apple's verification phone call** to the number on the D-U-N-S record
- [ ] Pay $99

### 🔴 6. A Mac that can run Xcode 26

**Why you:** hardware purchase. iOS cannot be built anywhere else.
**Cost:** Mac mini from ~₹60,000, or ~$60/month cloud

- [ ] Buy a Mac mini **or** rent a cloud Mac (MacStadium, Scaleway)
- [ ] Confirm its macOS version supports **Xcode 26** before buying
- [ ] Install Xcode 26

> Non-negotiable: Apple has required Xcode 26 / iOS 26 SDK for **all** uploads since 28 Apr
> 2026, and Capacitor 8 requires it too. Android ships without this, which is exactly why
> we sequenced Android first.

---

## 🔑 Credentials & Third-Party Setup

### 🟠 7. A separate, restricted Google Maps key for mobile

**Why you:** Google Cloud Console billing account.

- [ ] Create a **new** key in the same GCP project (do not reuse the web key)
- [ ] Restrict to the **Maps JavaScript API only**
- [ ] Set a hard **daily quota cap** and billing alerts
- [ ] Put it in `.env.mobile` as `VITE_GOOGLE_MAPS_API_KEY`

> The key ships inside the app and is extractable — an APK is a zip. HTTP-referrer
> restrictions cannot protect it because the WebView referrer is `https://localhost`, and
> the Maps *JavaScript* API cannot be restricted by bundle ID or package name (only the
> native SDKs can). The quota cap is your actual protection against a stolen key.

### 🟠 8. Firebase project for push notifications

**Why you:** Google account + Apple push certificate.

- [ ] Create a Firebase project
- [ ] Add an **Android** app with package `in.realestateflow.app` → download `google-services.json`
- [ ] Add an **iOS** app with bundle `in.realestateflow.app` → download `GoogleService-Info.plist`
- [ ] In the Apple Developer portal create an **APNs Auth Key (.p8)** and upload it to Firebase
- [ ] Send me both files — I will wire them into the native projects

### 🟠 9. Register the new OAuth callback URLs in Cognito

**Why you:** AWS console access to the Cognito user pool.

- [ ] Add callback URL: `in.realestateflow.app://auth/callback`
- [ ] Add sign-out URL: `in.realestateflow.app://auth/logout`
- [ ] **Keep the existing https URLs** — the web app still uses them

> Needed because Google blocks OAuth inside embedded WebViews (`disallowed_useragent`).
> I am moving mobile sign-in into a real browser that returns via this custom scheme.

### 🟠 10. Redeploy the backend so the CORS fix goes live

**Why you:** AWS deploy credentials.

- [ ] Redeploy the `server/` Lambda stack
- [ ] Redeploy the `reality-flow-authentication` stack
- [ ] Verify the **OPTIONS preflight**, not just GET:
  ```bash
  curl -i -X OPTIONS https://services-api.cloudberrysolutions.in/realestatecrm/api/health \
    -H "Origin: capacitor://localhost" \
    -H "Access-Control-Request-Method: GET"
  ```
  Expect `Access-Control-Allow-Origin: capacitor://localhost`

> No CloudFormation parameter change needed — I put the native origins in code, so a
> redeploy is all it takes.

### 🔴 11a. Add the privacy manifest to the Xcode target

**Why you:** needs Xcode; Capacitor does not do this automatically.
**Time:** 30 seconds, but the upload fails without it.

- [ ] Open `ios/App/App.xcworkspace` in Xcode
- [ ] Select **App** target → **Build Phases** → **Copy Bundle Resources**
- [ ] Add `App/PrivacyInfo.xcprivacy` if it is not already listed

> I wrote the file (`ios/App/App/PrivacyInfo.xcprivacy`) with all 13 data types
> and 4 required-reason APIs declared. It just has to be a member of the target,
> or App Store Connect rejects the upload.

### 🟢 11b. Review the app icon

**Why you:** a brand decision, and I am not a designer.

- [ ] Look at `real-estate-crm-app/assets/icon.png`

> I generated the whole icon and splash set (156 files) from the house mark in
> `marketing-and-sales/realestateflow/assets/logos/final/logo.png`, dropping the
> wordmark because it is illegible at 48px. It is clean and on-brand, but if you
> want a designed icon, replace the five files in `assets/` and re-run
> `npm run mobile:assets`.

### 🟢 11. Host the deep-link verification files

**Why you:** DNS / web hosting access.

- [ ] `https://app.realestateflow.in/.well-known/assetlinks.json` (Android App Links)
- [ ] `https://app.realestateflow.in/.well-known/apple-app-site-association` (iOS Universal Links, **no** file extension, served as `application/json`)

> I will generate both files' contents once you send me the signing fingerprint and Team ID.

---

## ⚖️ Legal & Content

### 🔴 12. Update the privacy policy and terms

**Why you:** requires a lawyer; this is a legal document, not code.

- [ ] Disclose mobile data collection (precise location, camera, photos, push tokens)
- [ ] Document account deletion + the **30-day** soft-delete window I am implementing
- [ ] Publish a public deletion page at `https://realestateflow.in/legal/delete-account` that works **without installing the app** (Google requires this)
- [ ] If you ever enable AI calling: add a call-recording disclosure and callee consent

> ⚠️ Your current policy (§10) offers deletion "on request, by email". **Apple does not
> accept that** — deletion must be initiated inside the app. I am building that flow; the
> policy has to say so.

### 🟢 13. Store listing content

**Why you:** brand and marketing decisions.

- [ ] Title (30 chars), short description (80), full description (4000)
- [ ] Play feature graphic **1024×500**
- [ ] Screenshots: Play (min 2) and App Store (**6.9" iPhone required**) — I can generate these from the running app once Android builds
- [ ] Support email + support URL
- [ ] Confirm the store name: **"RealEstateFlow"** (bundle ID `in.realestateflow.app` is now locked and cannot change after first publish)

> Your brand docs say "RealtyFlow" while the domain says realestateflow.in. I used
> **RealEstateFlow**. Tell me now if you want otherwise — after first publish it means a
> brand-new listing with zero reviews and installs.

### 🟢 14. Reviewer demo account

**Why you:** decide what demo data is acceptable to expose.

- [ ] Seeded tenant with realistic-looking but **fake** PII
- [ ] ⚠️ **A login that works from outside India** — sign-in is phone-OTP only today, and a reviewer in Cupertino cannot receive your OTP. This is a classic guideline 2.1 rejection. Either whitelist a demo number or give me a reviewer bypass to build.

---

## 🔐 Signing (Android first)

### 🔴 15. Generate and back up the upload keystore

**Why you:** this is the most security-critical secret in the whole project.

- [ ] Generate it:
  ```bash
  keytool -genkey -v -keystore realestateflow-upload.keystore \
    -alias realestateflow -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] **Back it up in two separate places** (password manager + offline)
- [ ] Save the passwords somewhere you will still have in 5 years
- [ ] Enrol in **Play App Signing** so Google holds the distribution key
- [ ] Put the paths in `android/key.properties` — already gitignored, **never commit it**

> 🚨 **Lose this file and you can never update the app again.** Not "it's difficult" —
> you would have to publish a new listing and every existing user would have to reinstall.

---

## 🧹 Later (coordinated, not urgent)

### 🟢 16. Git history purge

**Why you:** needs a force-push and a teammate's cooperation.

- [ ] Rotate keys first (task 2) — that is what actually revokes them
- [ ] Coordinate with **zishan chaudhary** (34 of the last 60 commits) — everyone must push, then re-clone
- [ ] Run the runbook in [`docs/security-key-rotation.md`](docs/security-key-rotation.md)

> Deliberately deferred. A history rewrite breaks every clone, and with rotated keys what
> remains in history is inert. Low urgency, real disruption.

---

## Order of operations

```
Day 1     → 1 (D-U-N-S)  2 (rotate keys)  3 (JDK/Studio)      ← all three today
Week 1-2  → 7 (Maps key)  9 (Cognito)  10 (redeploy)  12 (legal)
On D-U-N-S→ 4 (Play Console)  5 (Apple)  6 (Mac)
Pre-build → 8 (Firebase)  15 (keystore)
Pre-submit→ 11 (deep links)  13 (listing)  14 (demo account)
Whenever  → 16 (history purge)
```

**Total spend: ~$124 + a Mac.** ($25 Play one-time, $99/yr Apple, D-U-N-S free.)

---

## What I've built — all done, no action needed

- ✅ Capacitor 8 + native Android/iOS projects (targetSdk 36, iOS 15.0)
- ✅ CORS fixed so the app can reach the API at all
- ✅ All purchasing stripped from mobile (App Store 3.1.1)
- ✅ WebView auth: browser-based OAuth + Keychain/Keystore token storage
- ✅ In-app account deletion (App Store 5.1.1(v))
- ✅ Native app shell: bottom tabs, Android back button, safe areas, splash, status bar
- ✅ Mobile-native CSS + design tokens + 44px touch targets
- ✅ Working file exports, geolocation, external links (all were broken on Android)
- ✅ Native camera capture, share sheet, haptics
- ✅ App icons, splash screens, privacy manifest, Data Safety answer key
- ✅ Mobile Playwright projects (Pixel 7 + iPhone 14 Pro), 22 specs each
- ✅ Tables and the calendar made usable on a phone

## Still outstanding — needs a device or your accounts

| What | Blocked on |
|---|---|
| Push notifications | No backend push infrastructure exists (device tokens, send path). Needs your Firebase project too. |
| Biometric app lock | Needs a third-party plugin I cannot compile or device-test from here. |
| Per-screen polish of PropertyDetails, LeadDetails, LeadDrawer, PhoneLogin, ConnectWhatsApp | Needs visual checking on a real device → your task 3 (JDK + Android Studio) |
| Any actual APK/AAB | Your task 3 |

**Ping me the moment any 🔴 clears** — the per-screen work and the first real build
start the moment the Android toolchain is installed.
