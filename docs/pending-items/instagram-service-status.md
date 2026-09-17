# Instagram hosted service — where it stands (2026-09-16)

Context for anyone picking this up. Action items live in
[instagram-app-review-actions.md](instagram-app-review-actions.md) and
[deploys-and-branches.md](deploys-and-branches.md). The full reference is
`docs/agency-app/instagram/`.

## What it is

`backend_insta_sol_ms` (Lambda + DynamoDB) and `frontend_insta_sol_ms` (the
console at `/insta/*` on the CRM CloudFront distribution) replace the old
laptop agent. One Meta app, "Happy Properties-IG", serves every agency:
an agency connects its own Instagram professional account with Connect
Instagram, and the service reads DMs, comments, posts and insights, scores
enquiries, hands leads to the CRM, and sends replies a person writes or a
keyword rule fires.

## Deployed on dev (account 730335176275, profile cloudberry-main)

| Piece | Build | Notes |
|---|---|---|
| `backend_insta_sol_ms` | 0005 | Comments API, 30-day insights, fuller Sync now |
| `frontend_insta_sol_ms` | 0003 | Comments screen, Overview views/engaged cards, Reels columns |
| `real-estate-crm-app` | commit 737e124 | `/insta` (no slash) now opens the console |

Console `https://app.realestateflow.in/insta/` · API
`https://services-api.cloudberrysolutions.in/devrealestateinsta` ·
`INSTA_DRY_RUN_SENDS=true` on dev, so replies are recorded, not sent.

Prod is **not** deployed. The `prod-realestateflow-insta-*` stacks in
532404260898 still hold the old device-pairing build, and `.env.prod` secrets
are blank.

## Verified end to end with the real Meta app

@happyproperties99 is connected on dev. Working: OAuth connect, profile
(442 followers, 23 posts), account insights (30-day reach 324, views 1,49,042,
accounts engaged 3,187), the one owned reel with real numbers (7,878 views,
5,729 reach, 129 likes, 16 saves, 35 shares), Sync now running every job, the
Comments screen, and the CRM hand-off path.

## What Meta does not return yet, and why

| Symptom | Cause | Fix |
|---|---|---|
| 0 DMs, 0 conversations | App is in Development Mode: Meta only returns messages and comments from accounts with a role on the app. Also check "Allow access to messages" in the Instagram phone app (Settings and activity → Messages and story replies → Message controls → Connected tools) | App Review, or add an Instagram Tester account and DM from it |
| 0 of the reel's 8 comments | Same Development Mode filter | Same |
| Only 1 of 23 posts | 22 grid posts are collab posts **owned by @shaikhsameer99**; `/me/media` only returns posts the connected account owns | Connect that account too (several accounts per agency are supported), or publish from @happyproperties99 |
| Enquiries empty | Every enquiry is built from a DM | Follows from the DM fix |

Permanent Instagram limits, already handled in the product: the 20 most recent
messages per conversation, a 24-hour window for free-form DMs, one private
reply per comment within 7 days, and request-folder conversations idle for
30 days.

## Code landed for this (branch history)

| Commit | What |
|---|---|
| `6f49798` | Ask for `instagram_business_manage_insights`; log sync counts |
| `3467f79` | Measure reels whatever their age; Meta's 30-day account totals in the Overview counters; Sync now runs profile, DMs, reels, comments and analysis with a 20 s budget; Reels shows reach, likes, saves, shares |
| `d26c1b8` | CRM sends a bare `/insta` to the console |
| `95345ca` | Comments screen and API: `GET /comments`, `POST /comments/:id/reply` (public or the one private DM) |
| `737e124` | App Review pack, privacy-policy section 3.8, `/legal/data-deletion` page |

Tests: 125 backend tests pass; the console builds clean.

## Diagnostics

Read-only scripts used to prove where the gap was (Graph API only, never
browser scraping, and the token is decrypted in-process and never printed) are
in the session scratchpad, not the repo: `insta-verify.sh` (stored rows plus
Lambda log) and `insta-diag*.mjs` (calls the Lambda's own API functions).
Recreate them from `agency-app/instagram-api/services/instagramApi.js` if needed.
