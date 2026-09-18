# 10 — Meta App Review for the Instagram console

What has to be true before submitting the "Happy Properties-IG" Meta app for
review, what to write for each permission, and what to record. The app uses the
**Instagram API with Instagram Login**. There is one app for every agency: review
and Live mode apply to the app, not to an environment.

Until the app is approved and Live, Meta returns messages and comments only
from accounts that have a role on the app. That is why the dev console shows 0
DMs and 0 comments for @happyproperties99 even though the permissions are granted.

---

## 1. Status

| Area | State | Owner |
|---|---|---|
| Permissions used by the product: basic, messages, comments, insights | Done: requested at connect, used on screens reviewers can see | code |
| Screen per permission (Accounts, DM inbox, Comments, Reels, Overview) | Done: Comments screen added for manage_comments | code |
| Deauthorize and data deletion callbacks | Done: `POST /api/insta/meta/deauthorize`, `POST /api/insta/meta/data-deletion` (+ status URL) | code |
| Privacy Policy section on Instagram data | Done in `agency-app/landing-pages/legal/privacy` (Section 3.8, sub-processors, retention) | code, **counsel to review** |
| Data deletion instructions page | Done: `agency-app/landing-pages/legal/data-deletion` | code, **counsel to review** |
| Legal pages reachable on the public internet | **Blocked**: `realestateflow.in` resolves to 162.215.226.6 and HTTPS does not answer. The landing CloudFront distribution has the alias, but DNS does not point to it | you |
| Business Verification | Not done | you |
| Reviewer login to the console | Not done (see 3.4) | you |
| Real sends in the review environment | Dev has `INSTA_DRY_RUN_SENDS=true`; must be `false` while reviewers test | decision |
| Screencasts and submission | Not done (scripts in section 4) | you |

---

## 2. What review cannot change

- **Collab posts owned by another account are never returned.** `/me/media`
  lists only media the connected account owns. On @happyproperties99, 22 of 23
  grid posts are collabs owned by @shaikhsameer99, so only one reel appears. To
  include them, that account connects too (the console supports several
  accounts per agency), or the posts are published from @happyproperties99.
- Instagram shares the **20 most recent messages** of a conversation, plus
  everything after connecting.
- A free-form DM is allowed only within **24 hours** of the person's last
  message; a private reply to a comment only within **7 days** of the comment,
  once. The console enforces both and explains them. The Human Agent tag
  (7-day DM window) is not requested.
- Request-folder conversations inactive for 30 days are not returned.

---

## 3. Before you submit

### 3.1 Business Verification

Meta Business Settings → Security Center → **Start verification** for Cloudberry
IT Solutions, and connect the app to that business portfolio (App settings →
Basic → Business portfolio). Advanced Access is not granted without it.

### 3.2 App settings → Basic

| Field | Value |
|---|---|
| App icon | 1024 × 1024 PNG, RealEstateFlow mark |
| Privacy Policy URL | `https://realestateflow.in/legal/privacy` |
| Terms of Service URL | `https://realestateflow.in/legal/terms` |
| User data deletion | Data deletion callback URL (below). Instructions page: `https://realestateflow.in/legal/data-deletion` |
| Category | Business and pages |
| Contact email | info@realestateflow.in |

Meta's crawler opens the privacy and terms URLs. They must load over HTTPS
without a login before you submit (section 1, "Blocked").

### 3.3 Instagram → API setup with Instagram login

Values come from the stack outputs (`infra/cicd/agency-app/instagram-api/deploy.sh dev` prints them).
For dev:

| Setting | URL |
|---|---|
| OAuth redirect URI | `https://services-api.cloudberrysolutions.in/devrealestateinsta/api/insta/oauth/callback` |
| Deauthorize callback | `https://services-api.cloudberrysolutions.in/devrealestateinsta/api/insta/meta/deauthorize` |
| Data deletion request | `https://services-api.cloudberrysolutions.in/devrealestateinsta/api/insta/meta/data-deletion` |
| Webhooks callback (fields `messages`, `comments`) | `https://services-api.cloudberrysolutions.in/devrealestateinsta/api/insta/webhooks/instagram` |

Add the prod redirect URI as well once prod is deployed; one app can list both.

### 3.4 Reviewer access

Reviewers must be able to sign in to `https://app.realestateflow.in` and open
`/insta/`. The CRM signs in with Google or a phone OTP, and reviewers cannot
receive an OTP.

1. Create a dedicated Google account for Meta reviewers, with 2-step
   verification off (Meta cannot complete it).
2. Sign in with it once, create a workspace, and leave @happyproperties99
   connected to that workspace or let the reviewer connect their own test account.
3. Enter its email and password only in App Review → **App verification
   details**. Do not put them in this repo, a ticket, or chat.

### 3.5 Review environment

Reviewers use dev (`app.realestateflow.in/insta/`), which already has the
account connected. While the review is open:

- Set `INSTA_DRY_RUN_SENDS=false` for dev and run a config-only deploy
  (`infra/cicd/agency-app/instagram-api/deploy.sh config-deploy dev`), so a
  reviewer's reply actually arrives on Instagram. Set it back afterwards if you
  want test mode again.
- Keep the kill switch off.
- Add the reviewer's Instagram test account as an Instagram Tester only if Meta
  asks; approved review does not need testers.

---

## 4. Permissions: what to write and what to record

Record each screencast in English, at 1080p, with a short caption or voice-over.
Start signed out, sign in to RealEstateFlow, and show the Instagram consent
screen with the permission listed. Use a second Instagram account (on a phone)
as "the customer".

### instagram_business_basic

**How it is used.** "RealEstateFlow is a CRM for real estate agencies. An agency
connects its Instagram professional account with Instagram Login. We read the
account's profile (username, name, picture, follower and post counts) to show
which account is connected, and its posts and reels so the agency can see which
post produced each enquiry."

**Record:** Instagram accounts → Connect Instagram → consent → back in the
console, the account card (username, followers, posts) → Reels screen listing the
account's reels.

### instagram_business_manage_messages

**How it is used.** "Agencies receive property enquiries as Instagram DMs. We show
each conversation in the RealEstateFlow DM inbox, summarise and score the enquiry
so the agent knows who to answer first, and let the agent reply from the
console. Replies are written and sent by a person, only inside Instagram's
24-hour messaging window; the console shows when the window closes."

**Record:** on the phone, the customer DMs the business ("2 BHK on rent in Kurla,
budget 45k") → console DM inbox shows the conversation (wait for the webhook, or
Sync now) → open it, show the enquiry summary → type a reply → Send → on the
phone, the reply arrives.

### instagram_business_manage_comments

**How it is used.** "Buyers comment on listing reels to ask for price and
details. The Comments screen shows comments on the agency's newest posts. The
agent replies publicly under the post or sends the commenter one private reply
as a DM, within 7 days, which then continues in the DM inbox. Agencies can also
set a keyword rule, for example 'PRICE', that sends the same public reply and DM
to everyone who comments that word, capped per hour."

**Record:** on the phone, the customer comments "Price?" on a reel → console
Comments screen shows it → Public reply → Send → reply visible under the post
on the phone → Reply → Private DM → Send → the DM arrives on the phone and the
conversation appears in the DM inbox. Optionally: Keyword rules → create
"PRICE" → comment "PRICE" → public reply and DM arrive.

### instagram_business_manage_insights

**How it is used.** "We show the agency how its Instagram account and each reel
perform: reach, views and accounts engaged over the last 30 days, and views,
reach, likes, saves and shares per reel, next to the number of enquiries each
reel produced, so the agency makes more of the reels that bring buyers."

**Record:** Overview (reach, views, accounts engaged, 30 days) → Reels (views,
reach, likes, saves, shares and enquiries per reel).

---

## 5. Data handling questions (draft answers)

| Question | Answer to confirm |
|---|---|
| Data processors with access to Platform Data | Amazon Web Services (hosting, ap-south-1 Mumbai); Google (Gemini API, message text for enquiry scoring) |
| Responsible entity | Cloudberry IT Solutions, India |
| Requests from public authorities | Answer from company policy; confirm with counsel |
| Data deletion | Deauthorize and data deletion callbacks, the in-app Disconnect, and email, as described on `/legal/data-deletion` |

---

## 6. Submit

App Review → **Requests** → for each of the four permissions, **Request advanced
access**. Paste the section 4 description, attach the screencast, add the
reviewer login from 3.4, and submit together.

## 7. After approval

1. App Mode → **Live**.
2. The account card changes from "Subscribed · polling until Live" to live
   webhooks when the first webhook arrives; nothing to deploy.
3. Deploy prod (backend, console, CRM), add the prod OAuth redirect URI, and
   decide `INSTA_DRY_RUN_SENDS` for prod.
4. Any agency can now connect with no tester invite.
