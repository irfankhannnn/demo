# Putting the marketplace on realestateflow.in

State on 2026-09-20, checked against live DNS and AWS.

## What exists today

| Name | Points to | Serves |
|---|---|---|
| `realestateflow.in` (root) | `A 162.215.226.6` (a BigRock host) | Nothing useful: it answers `503`. The root has not been working. |
| `www.realestateflow.in` | `CNAME d2flnb4locg3qf.cloudfront.net` | Agency landing pages (distribution `E32IPERHPYOUKA`) |
| `app.realestateflow.in` | `CNAME d1puhl30kdl0vs.cloudfront.net` | CRM web app |
| `services-api.realestateflow.in` | `CNAME d-hy7ix13b27.execute-api.ap-south-1.amazonaws.com` | Prod API domain |
| `MX` | `smtp.google.com` (priority 1) | Google Workspace mail |
| `TXT` | `google-site-verification=…` | Google verification |
| three `…._domainkey` CNAMEs | `….dkim.amazonses.com` | SES DKIM for `info@realestateflow.in` |

- Registrar and DNS host: BigRock (`dns1`–`dns4.bigrock.in`). There is no Route53 zone.
- Certificates already issued in us-east-1:
  - `arn:aws:acm:us-east-1:730335176275:certificate/40d24037-547a-4e6d-95ad-0fc68ffa3999` covers `realestateflow.in` and `www.realestateflow.in`.
  - `arn:aws:acm:us-east-1:730335176275:certificate/bedaa7cd-0798-408e-bd08-c0d72481eaf6` covers `*.realestateflow.in`.
  - No new certificate and no validation records are needed.
- Marketplace distribution: `E2I9ONS2EFISXL`, `dgkq6styuedci.cloudfront.net`.

## Two things to decide first

### 1. Where the agency landing pages go

CloudFront allows a hostname on one distribution only. `realestateflow.in` and `www.realestateflow.in` are both aliases on the landing distribution, so they have to come off it before the marketplace can take them. The landing site needs a new host. `agents.realestateflow.in` is assumed below; the wildcard certificate already covers it.

Every ad, bio link and printed QR that points at `realestateflow.in` will open the consumer site after the switch. The marketplace header should carry a "For agents" link to the new host.

### 2. How the root name reaches CloudFront

A root name cannot be a CNAME, CloudFront has no fixed IP addresses, and BigRock's DNS has no ALIAS/ANAME record type. So with DNS left at BigRock the root cannot point at CloudFront directly.

| | Option A: move DNS to Route53 (recommended) | Option B: keep DNS at BigRock |
|---|---|---|
| Root `https://realestateflow.in` | Works, served by CloudFront | Does not work over HTTPS. BigRock forwarding answers on HTTP only, so `https://realestateflow.in` fails |
| Canonical address | `realestateflow.in` | `www.realestateflow.in` |
| Cost | About ₹45 a month for the zone | None |
| Domain registration | Stays at BigRock | Stays at BigRock |

## Option A: Route53 DNS (root works)

1. AWS: create a public hosted zone for `realestateflow.in`. Note the zone id and its four `ns-….awsdns-…` nameservers.
2. In that zone, recreate every record from the table above before touching the nameservers:
   - `MX 1 smtp.google.com`
   - `TXT "google-site-verification=JKK0jqUmnBFrVuI-8H8plsBFYsoYnHpe1DZGtP03fGw"`
   - `app` CNAME `d1puhl30kdl0vs.cloudfront.net`
   - `services-api` CNAME `d-hy7ix13b27.execute-api.ap-south-1.amazonaws.com`
   - the three SES DKIM CNAMEs: `<token>._domainkey` → `<token>.dkim.amazonses.com` for tokens `v2tppvwjykrsdfguxkiibyt46n7sfb3q`, `t2zn7qump5tidvixssln344dq45cvr4f`, `iqoezdqiujzk2fq35y4y7yl5iezp4gls`
   - `agents` CNAME `d2flnb4locg3qf.cloudfront.net`
   - Open BigRock → DNS Management and copy anything else listed there (SPF, DMARC, other verification records). Records that exist only at BigRock cannot be read from outside.
3. BigRock → My Orders → `realestateflow.in` → Name Servers: replace `dns1`–`dns4.bigrock.in` with the four Route53 nameservers. Allow up to 24 hours, usually under one.
4. Move the landing pages to `agents.realestateflow.in` (its own env file and wrapper), which frees the two names.
5. `public-app/web/.env.dev`:
   ```
   WEB_DOMAIN_NAME=realestateflow.in
   WEB_DOMAIN_ALT_NAMES=www.realestateflow.in
   WEB_ACM_CERTIFICATE_ARN=arn:aws:acm:us-east-1:730335176275:certificate/40d24037-547a-4e6d-95ad-0fc68ffa3999
   WEB_HOSTED_ZONE_ID=<zone id from step 1>
   ```
   Deploy with `infra/cicd/public-app/web/deploy.sh dev`. The stack creates the root A/AAAA alias records. Add `www` by hand in Route53: A and AAAA alias to `dgkq6styuedci.cloudfront.net`.

## Option B: BigRock DNS (www is the address)

BigRock → DNS Management for `realestateflow.in`:

| Tab | Host | Value | TTL |
|---|---|---|---|
| CNAME Records | `agents` | `d2flnb4locg3qf.cloudfront.net` | 14400 |
| CNAME Records | `www` (edit the existing record) | `dgkq6styuedci.cloudfront.net` | 14400 |
| A Records | the `162.215.226.6` root record | leave as is; forwarding uses it | |

Then BigRock → Domain Forwarding for `realestateflow.in`: forward to `https://www.realestateflow.in`, type 301 permanent, URL masking off, path forwarding on.

`public-app/web/.env.dev`:
```
WEB_DOMAIN_NAME=www.realestateflow.in
WEB_DOMAIN_ALT_NAMES=
WEB_ACM_CERTIFICATE_ARN=arn:aws:acm:us-east-1:730335176275:certificate/40d24037-547a-4e6d-95ad-0fc68ffa3999
WEB_HOSTED_ZONE_ID=
```

## After either option: tell the backends about the new origin

| Where | Key | New value |
|---|---|---|
| `public-app/api/.env.dev` | `MARKETPLACE_WEB_ORIGIN` | add `https://realestateflow.in,https://www.realestateflow.in` |
| `public-app/auth/.env.dev` | `ALLOWED_ORIGINS` | add the same two |
| `public-app/auth/.env.dev` | `IDENTITY_CALLBACK_URL` | add `https://realestateflow.in/auth/callback` and the `www` form |
| `public-app/auth/.env.dev` | `IDENTITY_LOGOUT_URL` | add `https://realestateflow.in/` and the `www` form |
| Google Cloud Console, OAuth client | Authorised JavaScript origins | the same two origins. The redirect URI stays the Cognito one. |
| hCaptcha site settings | Hostnames | `realestateflow.in` |
| Google Maps Embed key | HTTP referrers | `https://realestateflow.in/*`, `https://www.realestateflow.in/*` |

Then redeploy `public-app/api` and `public-app/auth` through their wrappers.

The login refresh cookie is set by the auth API. On dev that API is on `cloudberrysolutions.in`, a different site from `realestateflow.in`, and Safari drops such cookies, so a Safari user is logged out on reload. Prod does not have the problem because its API domain is `services-api.realestateflow.in`, the same site as the web app.
