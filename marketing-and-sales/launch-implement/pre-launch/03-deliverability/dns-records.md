# DNS Records — realestateflow.in

**Zone:** realestateflow.in  
**DNS provider:** Cloudflare  
**Last updated:** 2026-06-11

> **Rule:** Set Proxy = **OFF** (DNS only / grey cloud) for all mail-related records (SPF, DKIM, DMARC, MX).

---

## SPF Record

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Host** | `@` |
| **Value** | `v=spf1 include:spf.brevo.com include:_spf.google.com include:smtp.instantly.ai ~all` |
| **TTL** | Auto |
| **Proxy** | OFF |
| **Source** | Combined: Brevo + Google Workspace + Instantly |
| **Status** | ☐ pending / ☐ published / ☐ verified |

**Verification:**
```bash
dig TXT realestateflow.in +short
```

---

## DKIM — Brevo

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Host** | `mail._domainkey` |
| **Value** | `{{BREVO_DKIM_VALUE}}` *(copy from Brevo → Senders & IP → Domains → realestateflow.in)* |
| **TTL** | Auto |
| **Proxy** | OFF |
| **Source** | Brevo |
| **Status** | ☐ pending / ☐ published / ☐ verified |

**Verification:**
```bash
dig TXT mail._domainkey.realestateflow.in +short
```

---

## DKIM — Google Workspace

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Host** | `google._domainkey` |
| **Value** | `{{GOOGLE_WORKSPACE_DKIM_VALUE}}` *(from admin.google.com → Apps → Gmail → Authenticate email)* |
| **TTL** | Auto |
| **Proxy** | OFF |
| **Source** | Google Workspace |
| **Status** | ☐ pending / ☐ published / ☐ verified |

**Verification:**
```bash
dig TXT google._domainkey.realestateflow.in +short
```

**Note:** Allow 24–48 hours after publishing before clicking "Start authentication" in Workspace admin.

---

## DKIM — Instantly

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Host** | `instantly1._domainkey` |
| **Value** | `{{INSTANTLY_DKIM_VALUE}}` *(from Instantly → Settings → Email Accounts → DKIM)* |
| **TTL** | Auto |
| **Proxy** | OFF |
| **Source** | Instantly |
| **Status** | ☐ pending / ☐ published / ☐ verified |

**Verification:**
```bash
dig TXT instantly1._domainkey.realestateflow.in +short
```

---

## DMARC

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Host** | `_dmarc` |
| **Value** | `v=DMARC1; p=quarantine; rua=mailto:dmarc@realestateflow.in; ruf=mailto:dmarc@realestateflow.in; pct=100; aspf=s; adkim=s; sp=quarantine; fo=1` |
| **TTL** | Auto |
| **Proxy** | OFF |
| **Source** | RealEstateFlow policy |
| **Status** | ☐ pending / ☐ published / ☐ verified |

**Verification:**
```bash
dig TXT _dmarc.realestateflow.in +short
```

**Rollout note:** Consider `p=none` for Week 1 while DKIM propagates, then escalate to `p=quarantine` after all three DKIM selectors verify green.

**Prerequisite:** Create `dmarc@realestateflow.in` alias → forwards to `founder@realestateflow.in`.

---

## MX Records — Google Workspace

| Priority | Type | Host | Value | Proxy | Status |
|----------|------|------|-------|-------|--------|
| 1 | MX | `@` | `aspmx.l.google.com` | OFF | ☐ |
| 5 | MX | `@` | `alt1.aspmx.l.google.com` | OFF | ☐ |
| 5 | MX | `@` | `alt2.aspmx.l.google.com` | OFF | ☐ |
| 10 | MX | `@` | `alt3.aspmx.l.google.com` | OFF | ☐ |
| 10 | MX | `@` | `alt4.aspmx.l.google.com` | OFF | ☐ |

**Verification:**
```bash
dig MX realestateflow.in +short
```

---

## Google Workspace Domain Verification

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Host** | `@` |
| **Value** | `{{GOOGLE_SITE_VERIFICATION_TXT}}` |
| **TTL** | Auto |
| **Proxy** | OFF |
| **Source** | Google Workspace signup |
| **Status** | ☐ pending / ☐ published / ☐ verified |

---

## Brevo Domain Verification

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Host** | `@` *(or as specified by Brevo)* |
| **Value** | `{{BREVO_VERIFICATION_TXT}}` |
| **TTL** | Auto |
| **Proxy** | OFF |
| **Source** | Brevo domain setup |
| **Status** | ☐ pending / ☐ published / ☐ verified |

---

## BIMI (Optional — after logo ships)

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Host** | `default._bimi` |
| **Value** | `v=BIMI1; l=https://realestateflow.in/assets/og/logo-bimi.svg; a=https://realestateflow.in/assets/og/bimi-cert.pem` |
| **TTL** | Auto |
| **Proxy** | OFF |
| **Source** | RealEstateFlow brand |
| **Status** | ☐ pending (requires VMC certificate) |

---

## Application CNAMEs (non-mail — Proxy ON)

| Host | Type | Value | Proxy |
|------|------|-------|-------|
| `www` | CNAME | Netlify / hosting target | ON |
| `app` | CNAME | CRM SPA hosting | ON |
| `api` | CNAME | API Gateway / ALB | ON |
| `status` | CNAME | BetterStack status page target | ON |
| `demo` | CNAME | Demo tenant hosting | ON |

---

## Verification Checklist

Run after publishing all records:

```bash
# SPF
dig TXT realestateflow.in +short | grep spf

# DKIM (all three)
dig TXT mail._domainkey.realestateflow.in +short
dig TXT google._domainkey.realestateflow.in +short
dig TXT instantly1._domainkey.realestateflow.in +short

# DMARC
dig TXT _dmarc.realestateflow.in +short

# MX
dig MX realestateflow.in +short
```

**External validators:**
- [MXToolbox SPF](https://mxtoolbox.com/spf.aspx)
- [MXToolbox DKIM](https://mxtoolbox.com/dkim.aspx)
- [MXToolbox DMARC](https://mxtoolbox.com/dmarc.aspx)
- [mail-tester.com](https://www.mail-tester.com) — target score ≥ 9/10

**Mailboxes to provision:**
- `founder@realestateflow.in` — primary founder mailbox
- `info@realestateflow.in` — Grievance Officer + support alias
- `dmarc@realestateflow.in` — DMARC aggregate reports
