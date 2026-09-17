# ManyChat Setup — Instagram Comment-to-DM Booking Link

Operator runbook for connecting one agency's Instagram to the site-visit
booking flow. Assumes no prior ManyChat knowledge. Facts below were verified
live against ManyChat's product and docs on 2026-09-10 — don't extend past
what's written here without re-checking the dashboard, since ManyChat
changes its UI and plan limits without much notice.

> **Setup is manual, by a human, in a browser. Do not automate this.**
> ManyChat's ToS, Section 7, prohibits "any automated system... to access
> the Services" and access "by any means (automated or otherwise) other than
> through our currently available, published interfaces." That covers
> browser automation of the dashboard itself — a script clicking through the
> ManyChat UI is exactly what it prohibits, even though the ManyChat REST API
> (a published interface) is fine to call programmatically. Every step below
> is done by hand.

## Why ManyChat at all

ManyChat is an official Meta Business Partner. Building this ourselves means
our own Meta App Review and Business Verification before Instagram lets any
app read comments or send DMs at scale. Operating inside ManyChat's
already-approved app skips all that — the agency connects their Instagram to
ManyChat's app, not ours, and ManyChat's approval covers it. This is the
entire reason for the pivot.

## Prerequisites

- The agency's Instagram must be a **Professional account** (Business or
  Creator, not Personal) — ManyChat refuses to connect a Personal account.
- Decide which connection method to use (below).
- Pro plan or above only if we'll call the ManyChat REST API ourselves (see
  `03-PRICING.md`); Free/Essential are fine for everything done manually in
  the dashboard.

## Step 1 — Connect Instagram

| Method | Needs | Notes |
|---|---|---|
| **Connect Via Instagram** | Nothing beyond the Professional account. No Facebook Page. | Use this by default — simplest, lowest friction. |
| Connect Via Meta | A Meta Business Portfolio. | Unlocks Follow-to-DM, which this feature doesn't use. |
| Connect Via Meta Business Suite | A Facebook Page linked to the Instagram account, full Admin. | Nothing this feature needs beyond Method 1. |

## Step 2 — Build the comment-to-DM automation

**Automation → Quick Automations → "Auto-DM Links from comments,"** built on
ManyChat's "Instagram Post and Reel Comments" trigger.

1. **Target**: a specific post/reel, any post/reel, or the next post/reel
   published.
2. **Keyword match**: optional restriction (e.g. "visit," "interested,"
   "price"); leave open to trigger on every comment.
3. **Enable "Conversation Starters."** Required — without it ManyChat cannot
   message someone who has never DM'd the account, which is true of nearly
   every commenter on a cold post.
4. The DM should contain the booking link from Step 3.

## Step 3 — Construct the CTA link

The booking page's query string is read by two functions in
`public-app/property-pages/routes/pages.js`:

**`prefillFrom(query)`** — form prefill, always just a hint, never trusted:

| Param | Meaning | Our-side handling |
|---|---|---|
| `name` | Visitor's name | Trimmed, capped at 120 chars, echoed into the field. |
| `phone` | Visitor's phone | Run through `normaliseIndianMobile()`. If it doesn't resolve to a valid 10-digit Indian mobile, dropped silently (empty prefill), not rejected. |

**`externalRefFrom(query)`** — attribution attached to the lead:

| Param | Maps to | Meaning |
|---|---|---|
| `ig` | `igUsername` | Commenter's Instagram username |
| `mc` | `manychatSubscriberId` | ManyChat's Contact ID |
| `ref` | `campaignRef` | Free-form label you choose |
| `post` | `sourceMediaId` | The post/reel ID |

Each is trimmed and capped at 80 chars; all four are optional.

Example, using ManyChat merge fields (type `{{` in any text/URL field to
insert one — official Instagram system fields include Instagram username,
Contact ID, First name, Last name, Full name, Email, Phone, Messaging window
segment, Follower count, Follows your Instagram account, Verified on
Instagram):

```
https://sunrise-realty.pages.realestateflow.in/visit/prop-1
  ?name={{first name}}&ig={{ig username}}&mc={{contact id}}
  &ref=ig-comment-dm&post=<post/reel ID>
```

**Expect `name` to often be blank and `phone` to essentially never be
filled by ManyChat.** For Instagram subscribers, ManyChat reliably has only
the username and Contact ID — phone/email are empty unless collected
in-flow via a Data Collection block, and names are frequently blank too.
That's why `public-app/property-pages/views/visit.js` marks phone `required` and
always user-entered, prefilling only what ManyChat actually handed it. Don't
add a Data Collection step to force phone/email up front — it adds friction
for a value the form asks for anyway.

### Caveat: merge tags in a Button block's URL

Putting a `{{merge field}}` inside a **Button** block's URL is common
practice among ManyChat users, but is **not confirmed in ManyChat's official
docs**. Treat as unverified — it may silently fail to resolve or behave
inconsistently across channels.

## Recommended alternative: Dynamic Block

More robust: a **Dynamic Block**, where ManyChat POSTs the full contact
payload to an endpoint we control, and we return the button with the query
string already resolved server-side.

Response schema (`version: v2`):

```json
{
  "version": "v2",
  "content": {
    "type": "instagram",
    "messages": [ /* up to 10 */ ],
    "actions": [ /* up to 5 */ ],
    "quick_replies": [ /* up to 11 */ ]
  }
}
```

Instagram supports text, image, and buttons only in these responses — no
video, audio, file, or gallery cards.

This endpoint **does not exist yet** in this codebase. It would be new work
— an endpoint that receives ManyChat's POST, builds the
`/visit/<propertyId>?name=...&ig=...&mc=...` URL, and returns it inside a
button action.

## Test checklist

- [ ] Instagram shows "Connected," Professional account type confirmed.
- [ ] Automation enabled, correct target scope, "Conversation Starters" on.
- [ ] Comment from an account that's never messaged the agency before —
      confirm a DM arrives.
- [ ] Tap the link from a phone inside Instagram's in-app browser (the real
      usage pattern, not a desktop browser). Confirm the form loads and
      prefill appears correctly.
- [ ] Submit a real booking with a real phone number. Confirm a lead +
      meeting in the CRM with `externalRef.igUsername` populated.
- [ ] Confirm the DM sent within Meta's 24-hour post-comment window, and
      that no automated message was sent outside it.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| No DM after commenting | "Conversation Starters" off, or the target/keyword filter didn't match. |
| DM sent but link 404s | Wrong subdomain/slug; check `agencySlug` in `AgencyConfig`, and whether `PUBLIC_PAGES_BASE_DOMAIN` DNS is live (use `/t/<slug>/...` if not). |
| `{{merge field}}` shows literally | Wrong field name — a genuinely-empty value renders empty, not literal `{{...}}`. |
| No prefill at all | Expected for most contacts — see prefill limitation above. Not a bug. |
| Manual follow-up rejected/delayed | Outside the 24-hour messaging window. The "Human Agent" tag extends to 7 days, but only for manually typed messages — automated messages are explicitly not allowed in that extended window. |
| Automation silently stops working | Check ManyChat's own plan limits — a lapsed subscription or exceeded contact count can disable paid features. |
| ManyChat API returns 429 / contacts stop syncing | Rate limits: sending 25 rps, subscriber writes 10 rps, `findBySystemField` 100 rps. Breaching gives a 24-hour lockout — back off well before the limit. |
