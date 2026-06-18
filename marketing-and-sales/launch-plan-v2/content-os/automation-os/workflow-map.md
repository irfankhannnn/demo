# Automation OS — Workflow Map (Marketing Automations)

Phase 9 marketing automation workflows. Each: Trigger → Workflow → Actions → Expected outcome. Implemented on the event-router architecture (architecture.md). Channels: in-app notifications (existing), WhatsApp (Blotato/WhatsApp API + opt-in), email, AI calling.

| # | Trigger | Workflow | Actions | Expected outcome |
|---|---|---|---|---|
| 1 | **New Reel Published** (Blotato webhook / manual) | Log content asset + open attribution window | Create `MKT_EVENT(content_published, OPP-*)`; notify team; start tracking DMs/comments to this asset | Content attribution baseline; team aware |
| 2 | **Comment Received** (IG/FB webhook) | Detect intent keyword | If keyword → auto-DM (content-to-conversation); create `MKT_EVENT(comment)`; flag buying-intent for SDR | Comment → DM conversion; nothing missed |
| 3 | **DM Received** | Qualify + capture | Auto-reply by keyword; create **Lead** (source=`instagram_dm`, contentRef=OPP-*); push to qualification | Lead created + attributed; fast response |
| 4 | **Lead Magnet Downloaded** | Deliver + nurture | Send asset; create Lead (source=`lead_magnet`); enroll in nurture sequence | Captured + nurtured automatically |
| 5 | **Demo Requested** | Schedule + prep | Create/booked demo event; reminder sequence (T-24h/T-1h via scheduled-notification); notify SDR; brief from qualification | Fewer no-shows; prepared demos |
| 6 | **Trial Started** | Onboarding drip | Enroll in 7-day onboarding (onboarding-script); Day-2 AI-calling nudge; set activation tracking | Higher week-1 activation |
| 7 | **Trial Inactive** (no login 48h/7d) | Win-back | Personal WhatsApp nudge; offer setup call; escalate to founder/nurture-bot | Reduced trial churn |
| 8 | **Customer Activated** (milestones hit) | Celebrate + expand | Congrats message; usage review schedule; trigger referral ask + case-study request | Retention + advocacy |
| 9 | **Referral Requested/Sent** | Track + reward | Create Referral entity + code; attribute referee; issue rewards on conversion | Word-of-mouth loop measured |

## Cross-cutting
- Every workflow writes a `MKT_EVENT` → feeds attribution + `growth-dashboard.md`.
- Sequences = scheduled events (reuse `SCHEDULED_NOTIFICATION`); idempotent + cancellable on reply/convert.
- All multi-tenant (`TENANT#`), consent-gated for WhatsApp.

## Mapping to agents (existing agent teams)
nurture-bot (seq 4,6,7), sdr (2,3,5), pipeline-manager (all → pipeline), ab-optimizer/oracle (1 → content ROI), media-buyer (Meta lead ads → seq 4).
