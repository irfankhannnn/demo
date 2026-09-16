# Security — Abuse Controls on the Public Booking Flow

Scope: `apps/property-pages-ms/routes/pages.js` (the POST handler),
`services/abuseGuard.js`, `services/sessionToken.js`, `services/captcha.js`.
This is the anonymous, internet-facing write path — the one place this
service creates data instead of only reading it.

## The ordered checks, and why that order

`submitBooking()` runs seven checks, cheapest and most certain first:

1. **Honeypot** (`company_website`) — free, no I/O; a filled honeypot is
   unambiguous, since it's off-screen (`tabindex="-1"`) and unreachable by a
   real user.
2. **Session** — signature, expiry, tenant/property binding, fill-time; pure
   CPU, no I/O.
3. **Captcha** — a network call, only reached once this IP has already
   tripped the adaptive threshold.
4. **Field shape** — phone/date/time validity. Cheap, and deliberately does
   **not** count as abuse.
5. **Nonce burn** — the first write. Makes the token single-use; concurrent
   submits of the same token race on one DynamoDB item, exactly one wins.
6. **Quota checks** — per-IP, per-phone-hash, per-tenant daily caps.
7. **The CRM write** — the only expensive, billable step (a lead that can
   trigger a billable AI qualification call).

Rejecting at step 1–2 costs nothing; rejecting at step 7 means everything
expensive was already paid for. The ordering exists to fail cheap requests
cheaply.

## What counts toward the adaptive captcha, and what doesn't

`recordFailure(ip)` increments an hourly counter; past `LIMIT_CAPTCHA_TRIGGER`
(default 3), that IP must solve a captcha until the hour rolls over.

**Counted**: a filled honeypot; a session rejection reasoned
`bad_signature`, `too_fast`, `wrong_tenant`, or `wrong_property` (none of
which an unmodified page can produce on its own); a failed captcha; a reused
nonce (`already_used`).

**Not counted**: `session_expired` (a visitor who left the tab open);
field-shape rejections (`missing_name_or_phone`, `invalid_phone`,
`invalid_date`, `invalid_time`) — a mistyped phone number is not an
attacker, and treating it as one would put a captcha in front of exactly the
people most likely to be real customers.

## Fail-open reads, fail-closed writes

`checkPageView()` (every GET, via `pageViewGuard`) fails **open** on a
DynamoDB error — an outage must never take a tenant's listings offline. Its
limits are also looser than the booking-side ones with similar names:
page-view burst uses `ipBurst × 4`, page-view hourly uses `ipHourly × 10`,
in separate counter scopes (`pv-burst`/`pv-hour` vs. `sess-burst`/`sess-hour`).

`checkSessionMint()`, `checkBookingAttempt()`, and `consumeNonce()` fail
**closed**: every booking creates a lead that can trigger a billable AI
call, so silently permitting unlimited bookings on a counter outage is the
expensive failure mode — a booking page that briefly refuses new visits
during a blip is the survivable one.

`verifyCaptcha()` mirrors this in the direction opposite the CRM's own
`grievance.js` check (which defaults to pass with no secret configured, fine
for a flow that gates nothing financial). Here, a missing secret returns
fail — captcha is only ever demanded once `captchaEnabled()` confirms both
keys exist, so reaching this function unconfigured means something is
already wrong.

## Why DynamoDB counters, not a process Map

The CRM's existing limiter (`apps/crm/server/middleware/rateLimiter.js`) keeps
counters in a per-process `Map`. Under Lambda that's one counter per warm
container — "40/hour" becomes "40/hour per container," and a bigger burst
just spins up more containers to absorb it, backwards for a control meant to
catch "many requests from one IP quickly." `abuseGuard.js` counters live in
DynamoDB, incremented atomically (`UpdateCommand` + `ADD`), expiring via TTL.
The one exception — an in-memory fallback gated to `NODE_ENV` in
`{test, development}` or explicit `GUARD_STORE=memory` — exists only so
local dev/tests can exercise the flow without a real table, and must never
be set in a deployed environment.

## Fixed windows, not sliding

Each counter key embeds its own time bucket (`scope:subject:b:<bucket>`), so
a window rolls over by writing to a new item — no read-then-write, no race
between concurrent requests. Cost: a burst straddling a boundary can briefly
hit up to 2x the limit. Accepted as-is — burst limits are low enough that 2x
is still harmless, and a true sliding window costs multiple reads per
request for a benefit not worth paying for here.

## The per-tenant daily cap is the real backstop

Per-IP limits (`LIMIT_IP_BOOKINGS_DAILY`, default 6) matter against a script
on one host; they matter little against a botnet or rotating proxies, where
per-IP limiting simply doesn't bind. `LIMIT_TENANT_BOOKINGS_DAILY` (default
200) is what actually bounds the damage — no matter how distributed the
attack, a tenant cannot exceed this many booking-driven leads (and billable
AI calls) per day. Hitting it logs at `error` level
(`abuseGuard.tenant_cap_reached`), distinct from ordinary 429s, because it
means a human should look at the account.

## The X-Forwarded-For trust decision

`getClientIp()` takes only the **leftmost** entry. A client can put anything
there, but CloudFront/API Gateway append the real source address after it —
a spoofed value shifts the genuine IP rightward, doesn't replace it. Taking
the leftmost entry lets an attacker evade their own limit, but not forge
someone else's IP into hitting one and locking out a real visitor. Given
evadable vs. weaponisable, evadable is accepted; the per-tenant cap covers
the evasion case.

## The allowlist serialiser

Covered in `01-ARCHITECTURE.md`. Relevant here as the other half of the
threat model: rate limiting and captcha bound *how much* someone can do;
`apps/crm/server/publicListingService.js`'s allowlist bounds *what* is ever exposed
regardless. Even a fully successful abuse run can only produce more of the
same already-public data.

## Tunable limits (`.env.sample` defaults)

| Variable | Default | Governs |
|---|---|---|
| `LIMIT_IP_BURST` | 5 | Session mints per IP per burst window (closed) |
| `LIMIT_IP_BURST_WINDOW_SECONDS` | 10 | Burst window length |
| `LIMIT_IP_HOURLY` | 40 | Session mints per IP per hour (closed) |
| `LIMIT_IP_BOOKINGS_DAILY` | 6 | Bookings per IP per day (closed) |
| `LIMIT_PHONE_BOOKINGS_DAILY` | 3 | Bookings per hashed phone per day (closed) |
| `LIMIT_TENANT_BOOKINGS_DAILY` | 200 | Bookings per tenant per day — the real backstop (closed) |
| `LIMIT_CAPTCHA_TRIGGER` | 3 | IP failures/hour before captcha is demanded |
| `VISIT_SESSION_TTL_SECONDS` | 1800 | Booking form validity window |
| `VISIT_MIN_FILL_SECONDS` | 3 | Min render-to-submit time before `too_fast` |
| `HCAPTCHA_VERIFY_TIMEOUT_MS` | 5000 | hCaptcha verify timeout (a timeout = fail) |
| `CRM_TIMEOUT_MS` | 6000 | Timeout on every CRM internal API call |
| `ASSET_CACHE_SECONDS` | 300 | Asset-redirect edge cache (must stay under 900s presign lifetime) |
| `PAGE_CACHE_SECONDS` | 60 | Listing/detail HTML edge cache |

Note: `LIMIT_IP_BURST`/`LIMIT_IP_HOURLY` also indirectly size the page-view
throttle — `checkPageView()` multiplies them (×4, ×10) rather than reading
separate env vars, and that path fails open.

## Known gaps / possible hardening

- **Phone OTP is the obvious next step.** The phone is validated for *shape*
  only, not ownership — an OTP before the CRM write would close the largest
  remaining gap (invented-but-plausible numbers, currently slowed only by
  the daily caps and captcha threshold).
- Per-IP limits are weak against a botnet/rotating proxies; the per-tenant
  cap is the real backstop, not per-IP.
- The fixed-window 2x burst tolerance is accepted, not fixed.
- `X-Forwarded-For` leftmost-entry trust is evadable for an attacker's own
  bucket, as described above.

## Discrepancies found while documenting

None. The check ordering, fail-open/fail-closed split, fixed-window design,
per-tenant cap, and `X-Forwarded-For` handling all match the code and its
inline comments in `abuseGuard.js`, `sessionToken.js`, `captcha.js`, and
`routes/pages.js` exactly as read.
