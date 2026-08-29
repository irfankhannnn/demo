# 08 — Testing & Acceptance (E2E, Integration, Unit)

**Scope:** MVP test strategy for critical paths: onboarding → payment → credit deduction → lead creation → agent invocation.

---

## E2E Test Scenarios (Playwright)

### **Scenario 1: Onboarding → Trial → CRM**
- User completes Google OAuth + RegisterAdmin form.
- Tenant created, trial subscription (14 days), 1,000 free credits granted.
- TrialCountdownBanner shows "14 days left".

### **Scenario 2: Upgrade via Razorpay**
- Trial user clicks "Upgrade" → Razorpay checkout → payment captured.
- Subscription updated (plan='plan_team', isPaying=true).
- Credits reset to 5,000 (set-to, not add).
- Banner disappears (isPaying=true).

### **Scenario 3: Create Lead → Deduct Credit**
- User with 500 credits creates lead (cost=10).
- Ledger row written atomically with balance update (500-10=490).
- Response includes creditsRemaining: 490.
- UI updates immediately.

### **Scenario 4: Out of Credits → Buy → Resume**
- User with 5 credits tries to create lead (needs 10).
- Returns 402 insufficient_credits.
- "Buy Credits" modal opens → Razorpay → payment → grantCredits(+500).
- Balance now 505; lead creation succeeds.

### **Scenario 5: Agent Qualification (Lead Qualifier)**
- Lead created → EventBridge triggers lead-qualifier-handler.
- Handler calls skillInvoker.get_lead() → Bedrock invoke.
- Deducts 15 credits (agent_action cost).
- Updates lead with score + reasons + confidence.
- Publishes lead.qualified event (triggers router).

### **Scenario 6: WhatsApp Inbound Message**
- Admin connected WhatsApp (+919998765432).
- External sends: "lead: Rahul, 9999999999, buyer".
- Webhook POST /api/webhooks/whatsapp verifies signature.
- Tenant resolved by destination number.
- EventBridge event published → Lambda processes → create_lead skill.
- Credits deducted: 10 (lead_add) + 1 (whatsapp_send).
- Reply sent via Bailey: "✅ Lead created: Rahul".

### **Scenario 7: Monthly Credit Reset Cron**
- Tenant on Starter plan (5,000/month), subscription anniversary today.
- credit-reset-cron runs → queries subscription + creditConfig.
- Writes balance = 5,000 (SET, not ADD; idempotent).
- Ledger row: action='monthly_reset'.
- Cron runs again same day → skipped (lastCreditResetAt == today).

---

## Integration Tests (Jest/Vitest)

### **CreditService Atomic Deduction**
- ✓ TransactWriteItems: BALANCE + LEDGER in one tx.
- ✓ InsufficientCreditsError: balance < required → throws, no write.
- ✓ Concurrency: 2 parallel deducts (balance=40, each=30) → 1 succeeds, 1 fails (TransactionCanceled).

### **SkillInvoker Multi-Tenancy**
- ✓ create_lead: PK includes tenantId, cross-tenant leak impossible.
- ✓ Input validation: empty name → throws before DynamoDB write.
- ✓ Credit deduction: only on skill success (failed = no charge).

### **Agent Quality Gates**
- ✓ Confidence + reasons stored on lead alongside score.
- ✓ Idempotency: already scored in past 24h → skip re-run.
- ✓ Escalation: Haiku confidence < 0.5 → escalate to Sonnet.

### **Webhook Idempotency**
- ✓ payment.captured replayed → webhookLogService logs & skips grant.
- ✓ Lead creation: no duplicate on webhook replay.

---

## Security Audit

| Check | Pass? |
|-------|-------|
| Tenant isolation: tenantB queries tenantA data → 403/empty | ✓ |
| Credit auth: POST /credits/purchase without admin → 403 | ✓ |
| Webhook signature: malformed Bailey sig → 401 | ✓ |
| HMAC: timing-safe compare (crypto.timingSafeEqual) | ✓ |
| Env secrets: all from CFN params, no hardcode | ✓ |
| Input validation: Joi/Zod schemas on mutations | ✓ |
| XSS: no dangerouslySetInnerHTML | ✓ |
| Rate limiting: per-IP throttle on webhooks | ✓ |
| CORS: whitelist to realestateflow.in | ✓ |

---

## MVP Ship Gate

- ✓ Onboarding E2E: signup → trial → upgrade → paid subscription active.
- ✓ Credits atomic: concurrent writes safe; ledger balances.
- ✓ Webhooks safe: signatures verified; replay prevented.
- ✓ Agents working: qualify → route; audit logged; costs charged.
- ✓ Error recovery: SES→Brevo fallback; Bedrock timeout→logged; no double-charge.
- ✓ Performance: lead P99 < 500ms; agent P99 < 2s.
- ✓ Security: no tenant leaks; OWASP top 10 covered.