# AWS SES Setup (manual steps — release gate for EPIC 3)

These are out-of-CloudFormation, one-time console/CLI steps the operator must complete. Until SES production access is granted, **keep Brevo fallback enabled**.

## 1. Verify sender identity
- Region: `ap-south-1` (matches server/cron clients).
- Verify the sender: `noreply@realestateflow.in` (or verify the whole `realestateflow.in` domain — preferred).
- Domain verification: add the SES-provided CNAME/TXT records to DNS; enable **DKIM** (3 CNAMEs) for deliverability.

## 2. Move out of the SES sandbox
- New SES accounts are in **sandbox**: can only send to verified addresses, low quota.
- Request **production access** (Account dashboard → Request production access). Provide use-case (transactional: trial reminders, billing, grievance/NPS alerts), bounce/complaint handling plan, and expected volume.
- **Until approved:** transactional mail to arbitrary tenant addresses will fail SES → `emailService` falls back to Brevo automatically. This is the intended safety net.

## 3. IAM
- The API Lambda role and each cron Lambda role need `ses:SendEmail`, `ses:SendRawEmail` (added in CFN per `07-infra-cfn-deploy.md`). Optionally scope `Resource` to the verified identity ARN.

## 4. Bounce/complaint handling (recommended before high volume)
- Create an SNS topic for bounces/complaints; set SES identity notifications to it.
- Suppress repeat-bounce addresses (SES account-level suppression list is on by default).

## 5. Env wiring
```
AWS_SES_FROM_EMAIL=noreply@realestateflow.in
EMAIL_PROVIDER_PRIMARY=ses
EMAIL_PROVIDER_FALLBACK=brevo
# Brevo retained for fallback:
BREVO_API_KEY=...
BREVO_FROM_EMAIL=no-reply@realestateflow.in
BREVO_FROM_NAME=RealEstateFlow
```

## Release gate
- [ ] Domain + DKIM verified
- [ ] Production access granted
- [ ] IAM SES permissions deployed
- [ ] Test send to an external address succeeds via SES (not fallback)
- [ ] Bounce/complaint SNS wired
