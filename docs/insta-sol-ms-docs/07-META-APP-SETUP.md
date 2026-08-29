# Meta App Setup — Development Mode

The chosen model is **Development Mode** (decision D1 in `01-PLAN.md`): our own Meta app,
with each Instagram account we test added as an Instagram tester. No Business
Verification, no App Review, no waiting. Once the tool is proven we move to a shared
RealtyFlow app with App Review, or a hosted service.

## What Development Mode does and does not limit

It does **not** limit which endpoints work or how much data you get — a tester account
has the full API surface. It limits *whose* accounts you can touch: each account must be
explicitly added as a tester and accept the invite. That is fine for you plus a handful
of design partners; it is not something to hand to 500 agents.

This is why the agent's token layer is built behind a `TokenProvider` interface with
`DevModeProvider`, `SharedAppProvider` and `HostedProvider`. Everything downstream only
ever calls `provider.getToken(accountId)`, so moving to app mode later is a config change
and one new class rather than a rewrite.

## Prerequisites per Instagram account

1. The account must be **Professional** (Business or Creator). In the Instagram app:
   Settings → Account type and tools → Switch to professional account.
2. **No Facebook Page is required.** We use *Instagram API with Instagram Login*, not the
   older Facebook-Login-for-Business path. This is the single biggest onboarding
   difference from most guides you will find online, which are written against the
   deprecated flow.

## One-time app setup

1. Go to <https://developers.facebook.com> and sign in.
2. **My Apps → Create App**. Use case: **Other**. Type: **Business**.
   Name it something identifiable, e.g. `RealtyFlow Insta Agent (dev)`.
3. In the app dashboard, **Add Product → Instagram → Set up**, and pick
   **API setup with Instagram business login**.
4. Under **Instagram → API setup with Instagram business login → Business login settings**:
   - **OAuth redirect URI:** `http://localhost:7318/oauth/callback`
     (the local agent's loopback listener — see `instagram-local-agent/src/auth/oauth.js`)
   - **Deauthorize callback URL** and **Data deletion request URL** can be left at
     placeholders in Development Mode.
5. Note the **Instagram App ID** and **Instagram App Secret** from that same screen.
   These are *not* the same as the Facebook App ID/Secret shown elsewhere in the
   dashboard — using the wrong pair is the most common setup failure.

## Permissions to request

Request exactly these four. Anything more will make the later App Review harder, and none
of the extra scopes buy us anything we use:

| Scope | Used for |
|---|---|
| `instagram_business_basic` | profile, media list, insights |
| `instagram_business_manage_messages` | read conversations, send DMs, comment private replies |
| `instagram_business_manage_comments` | read comments, public replies, hide/unhide |
| `instagram_business_content_publish` | Phase 4 publishing only — request it now, use it later |

The old `instagram_manage_*` scope names were retired on 27 Jan 2025. If a tutorial tells
you to request those, it is out of date.

## Adding a tester account

1. App dashboard → **App roles → Roles → Add people**.
2. Choose **Instagram Tester** and enter the Instagram handle.
3. Log in as that Instagram account → **Settings → Apps and websites → Tester invites**
   → accept.
4. Only after the invite is accepted will the OAuth flow succeed for that account.

## Connecting the agent

```bash
cd instagram-local-agent
cp config/config.example.json config/config.json
# put the Instagram App ID + Secret in config.json (or IG_APP_ID / IG_APP_SECRET env vars)

npm install
npm run connect          # opens the consent screen, stores an encrypted long-lived token
npm run pair -- <code>   # pairing code from the web app's Devices page
npm run sync             # first data pull
npm run console          # local UI at http://127.0.0.1:7317
```

`npm run connect` performs the full exchange: authorization code → short-lived token →
long-lived (60 day) token, then schedules a refresh at day 50. The token is encrypted at
rest with AES-256-GCM under a machine-local key file and never leaves the laptop — the
cloud only ever learns the *expiry*, so the CRM can warn before it lapses.

## Moving out of Development Mode later

When you are ready to hand this to agencies who are not testers:

1. **Business Verification** — 3 to 7 days. Legal documents for the business entity.
2. **App Review** for `instagram_business_manage_messages` — allow several weeks.
   Reviewers are strict on DM automation. What helps: a screencast of a real user
   consenting and receiving a reply, and being able to point at
   `instagram-local-agent/src/engine/windowClassifier.js` as the single enforced gate
   showing we cannot send outside Meta's windows.
3. Swap `DevModeProvider` for `SharedAppProvider` in the agent config. No other code
   changes.

## Things that will get an account restricted — none of which we implement

Mass or cold DMs, follow/unfollow, auto-liking, follower-list scraping, browser
automation of instagram.com, and using the `HUMAN_AGENT` tag on autopilot. None of these
have an official API. `08-TESTING.md` includes tests asserting that the sender refuses a
`CLOSED` thread, because that guarantee is the product.
