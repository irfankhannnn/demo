# Meta App Review — what is left to do

The app cannot receive DMs or comments from real followers until Meta grants
Advanced Access and the app is Live. Everything the product side needs is
built. What remains is Meta paperwork, public URLs and two decisions.

The wording to paste for each permission, the screencast scripts, the Meta
settings and the data-handling answers are in
`docs/agency-app/instagram/10-APP-REVIEW.md`. This file is only the checklist.

## Blocking, in order

- [ ] **1. Make the legal pages load.** `realestateflow.in` resolves to
  162.215.226.6 and HTTPS does not answer, so
  `/legal/privacy`, `/legal/terms` and the new `/legal/data-deletion` are
  unreachable. Meta's crawler opens them and rejects an app whose privacy
  policy does not load. Point the domain (and `www`) at the landing
  CloudFront distribution `d2flnb4locg3qf.cloudfront.net`, then deploy the
  landing pages (`infra/cicd/agency-app/landing-pages/deploy.sh dev`). The CRM's
  `/legal/*` routes just redirect to these pages, so they are broken too.
  **Owner: Kalim.**
- [ ] **2. Business Verification** for Cloudberry IT Solutions in Meta Business
  Settings → Security Center, and connect the app to that business portfolio.
  Advanced Access is not granted without it. **Owner: Kalim.**
- [ ] **3. Reviewer login.** The CRM signs in only with Google or a phone OTP,
  and Meta's reviewers cannot receive an OTP. Create a dedicated Google account
  with 2-step verification off, sign in once so it has a workspace, and enter
  the credentials only in App Review → App verification details. Never in the
  repo or in chat. **Owner: Kalim.**
- [ ] **4. App settings → Basic:** 1024×1024 icon, privacy and terms URLs, the
  data deletion callback plus `/legal/data-deletion` as the instructions URL,
  category and contact email. **Owner: Kalim.**
- [ ] **5. Record the four screencasts** (basic, messages, comments, insights)
  using a second Instagram account as the customer, and submit all four
  permissions together. **Owner: Kalim.**

## Decisions needed

- [ ] **Turn test mode off while reviewers test.** Dev has
  `INSTA_DRY_RUN_SENDS=true`, so a reviewer's reply would be recorded and not
  delivered, which fails the messages review. Setting it to `false` and running
  `infra/cicd/agency-app/instagram-api/deploy.sh config-deploy dev` makes
  replies really go out from @happyproperties99. Decide before recording.
- [ ] **Which account owns the reels.** Only posts owned by the connected
  account are returned, so today the console shows 1 of 23. Either
  @shaikhsameer99 connects in the same workspace, or future reels are published
  from @happyproperties99. Worth deciding before the insights screencast.

## Before waiting on review — see real data now

1. In the Instagram phone app: Settings and activity → Messages and story
   replies → Message controls → Connected tools → turn on **Allow access to
   messages**. The toggle does not exist on instagram.com.
2. Add a second Instagram account as an **Instagram Tester** in the Meta app and
   accept the invite from that account.
3. From it, DM @happyproperties99 and comment on the Atul Horizon reel.
4. Click **Sync now** in the console. The DM should appear in the inbox within
   about five minutes, then in Enquiries once it is scored.

## After approval

- [ ] Switch the app to **Live**. The account card moves off
  "Subscribed · polling until Live" by itself when the first webhook arrives.
- [ ] Deploy prod (backend, console, CRM), fill the blank `.env.prod` secrets,
  add the prod OAuth redirect URI to the same Meta app, and decide
  `INSTA_DRY_RUN_SENDS` for prod.
- [ ] Tester invites are no longer needed; any agency can connect.
- [ ] Have counsel review the new privacy-policy section 3.8 and the
  `/legal/data-deletion` page; both are still marked as drafts.
