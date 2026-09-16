# Meta App Setup

The product uses one Meta app for every agency: **Instagram API with Instagram
Login** (no Facebook Page needed). The app's ID and secret live only in the backend.
Each agency connects its own Instagram account through the console's
"Connect Instagram" button, and gets its own encrypted access token.

| | How many |
|---|---|
| App ID | 1 for the whole product, same before and after App Review |
| App Secret | 1, backend only, never shown to agencies |
| Access token | 1 per connected Instagram account, 60 days, refreshed automatically |

## 1. Where the App ID and App Secret go

Use the **Instagram App ID / Instagram App Secret** from *Meta app → Instagram → API
setup with Instagram business login*. They are not the Facebook App ID on the app's
Basic settings page; mixing them up is the most common setup failure.

| Environment | File | Variables |
|---|---|---|
| Local | `apps/instagram/backend_insta_sol_ms/.env.local` | `META_APP_ID`, `META_APP_SECRET` |
| dev stack | `apps/instagram/backend_insta_sol_ms/.env.dev` | same |
| prod stack | `apps/instagram/backend_insta_sol_ms/.env.prod` | same |

All three files are gitignored (`.env.*`). `infra/deploy.sh` passes the values to
CloudFormation as `NoEcho` parameters, and from there to the Lambda environment.

Three more values belong next to them:

| Variable | What | Generate |
|---|---|---|
| `META_WEBHOOK_VERIFY_TOKEN` | Pasted into the Meta webhook form too | `openssl rand -hex 24` |
| `INSTA_TOKEN_ENCRYPTION_KEY` | Encrypts stored access tokens (AES-256-GCM) | `openssl rand -hex 32` (once per environment; changing it forces every account to reconnect) |
| `INSTA_CONSOLE_URL` | Where the browser lands after connecting | e.g. `https://app.realestateflow.in/insta` |

`deploy.sh` refuses to run if any of these is missing or the key is not 64 hex
characters. `GET /api/insta/health` reports `instagramConfigured: true` once the
backend has everything it needs.

## 2. URLs to register in the Meta app

The deploy prints them as stack outputs (`MetaOAuthRedirectUri`, …). For dev
(`services-api.cloudberrysolutions.in` + `devrealestateinsta`):

| Meta app field | URL |
|---|---|
| Instagram → Business login settings → **OAuth redirect URIs** | `https://services-api.cloudberrysolutions.in/devrealestateinsta/api/insta/oauth/callback` |
| Instagram → Business login settings → **Deauthorize callback URL** | `https://services-api.cloudberrysolutions.in/devrealestateinsta/api/insta/meta/deauthorize` |
| Instagram → Business login settings → **Data deletion request URL** | `https://services-api.cloudberrysolutions.in/devrealestateinsta/api/insta/meta/data-deletion` |
| Instagram → **Webhooks** → Callback URL | `https://services-api.cloudberrysolutions.in/devrealestateinsta/api/insta/webhooks/instagram` |
| Webhooks → **Verify token** | the value of `META_WEBHOOK_VERIFY_TOKEN` |
| Webhooks → **Fields** | `messages`, `comments` |

For prod, swap in `services-api.realestateflow.in` and `prodrealestateinsta`.

The redirect URI must match exactly, including the path. The backend derives it as
`https://<INSTA_API_DOMAIN_NAME>/<INSTA_API_BASE_PATH>/api/insta/oauth/callback`;
set `META_REDIRECT_URI` only if it has to differ (for example an https tunnel to a
local backend).

## 3. Permissions

| Scope | Used for |
|---|---|
| `instagram_business_basic` | profile, media, insights |
| `instagram_business_manage_messages` | reading DMs, replying, private replies to comments |
| `instagram_business_manage_comments` | reading comments, public replies for keyword rules |

Nothing publishes content, so `instagram_business_content_publish` is not requested.

## 4. Testing before App Review (Development Mode)

1. The Instagram account must be **Professional** (Business or Creator).
2. Meta app → **App roles → Roles → Add people → Instagram Tester**, enter the handle.
3. On that Instagram account: **Settings → Apps and websites → Tester invites → Accept**.
4. In the account's message settings, allow access to messages for connected tools.
5. In the console, **Instagram accounts → Connect Instagram**. Log out of instagram.com
   between accounts, or the consent screen reuses the one already signed in.

Limits worth knowing:

- Apps not linked to a verified business can have up to 50 testers; after Business
  Verification, 500 testers and analytics users combined.
- Webhooks are only delivered to apps in **Live** mode. In Development Mode the
  scheduled worker polls conversations every few minutes, so the flow is the same,
  just slower. The account card shows "Subscribed · polling until Live" until the
  first webhook arrives, then "Live webhooks".
- Instagram returns only the 20 most recent messages of each conversation.
- Comment webhooks need Advanced Access; until then keyword rules run from the
  comments poll.

Start every new environment with `INSTA_DRY_RUN_SENDS=true`: replies and rule DMs are
recorded in the console but not sent. Switch it to `false` when you want real sends.

## 5. Going live for other agencies

Nothing in the code or configuration changes. In the Meta dashboard:

1. **Business Verification** for the company.
2. **App Review** for the three scopes, with a screencast: connecting from the console,
   a DM arriving, a reply sent from the console inside the 24-hour window.
3. Switch the app to **Live**.

After that any agency's professional account can connect; testers are no longer
required, and webhooks start arriving on the URLs already registered.

## What the service will not do

Mass or cold DMs, follow/unfollow, auto-liking, follower scraping, browser automation
of instagram.com, and the HUMAN_AGENT tag. None of these have an official API. Every
send passes `services/windowPolicy.js`: a free-form reply only inside 24 hours of the
person's last message, one private reply per comment within 7 days, nothing after.
A window error from Meta closes the thread and is never retried.
