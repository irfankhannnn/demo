# Outreach Sequence

## Metadata
- **Sequence Name:** [Name]
- **Created By:** SDR / Nurture Bot Agent
- **Date:** [YYYY-MM-DD]
- **Type:** Cold Outbound / Warm Nurture / Re-engagement / Trigger-Based
- **Target Segment:** [ICP segment]
- **Duration:** [X days]
- **Total Touches:** [X]

## Target Profile
- **Company Type:** [industry/size/geo]
- **Contact Title:** [role/seniority]
- **Lead Grade:** A / B / C / D
- **Trigger:** [what activated this sequence]

## Sequence Flow

```
Day 0 → Email 1 (Introduction)
         ↓ [Wait 3 days]
Day 3 → Email 2 (Social Proof)
         ↓ [Wait 2 days]
Day 5 → LinkedIn Connect
         ↓ [Wait 2 days]
Day 7 → Email 3 (Value/Question)
         ↓ [Wait 3 days]
Day 10 → Email 4 (Breakup Warning)
          ↓ [Wait 4 days]
Day 14 → Email 5 (Value Drop / Final)

EXIT CONDITIONS:
→ Reply received → Route to manual handling
→ Meeting booked → Move to "Demo Scheduled" stage
→ Unsubscribe → Remove from sequence
→ Bounce → Mark invalid, remove
→ "Not interested" → Move to long-term drip (90 days)
```

## Email Templates

### Email 1: [Title] — Day [X]
**Subject Line A:** [Option A]
**Subject Line B:** [Option B — for A/B test]

```
Hi [First Name],

[Body copy with personalization tokens]

[CTA — clear, single ask]

[Signature]
```

**Personalization Tokens:**
- `[First Name]` — Contact first name
- `[Company]` — Company name
- `[City]` — City/location
- `[Specific Observation]` — From research (projects, listings, etc.)
- `[Similar Company]` — Reference customer in their segment
- `[Pain Point]` — From Trend Hunter data

---

### Email 2: [Title] — Day [X]
**Subject Line:** [Subject]

```
[Body copy]
```

---

### Email 3: [Title] — Day [X]
**Subject Line:** [Subject]

```
[Body copy]
```

---

### Email 4: [Title] — Day [X]
**Subject Line:** [Subject]

```
[Body copy]
```

---

### Email 5: [Title] — Day [X]
**Subject Line:** [Subject]

```
[Body copy]
```

## LinkedIn Touchpoints

### Connection Request — Day [X]
```
[300 char max message]
```

### Follow-Up Message — Day [X] (after accepted)
```
[Message copy]
```

## SMS Templates (if applicable)

### SMS 1 — Day [X]
```
[160 char max message with opt-out]
```

## Objection Responses

| Objection | Response Template |
|-----------|-------------------|
| "[Objection 1]" | "[Response]" |
| "[Objection 2]" | "[Response]" |
| "[Objection 3]" | "[Response]" |

## A/B Test Plan

| Element | Variant A | Variant B | Metric |
|---------|-----------|-----------|--------|
| Email 1 Subject | [A] | [B] | Open Rate |
| Email 3 CTA | [A] | [B] | Reply Rate |
| LinkedIn Approach | [A] | [B] | Accept Rate |

## Performance Tracking

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Delivery Rate | >97% | | |
| Open Rate | >50% | | |
| Reply Rate | >8% | | |
| Positive Reply Rate | >3% | | |
| Meeting Booked Rate | >2% | | |
| Unsubscribe Rate | <1% | | |
| Bounce Rate | <2% | | |

## Sending Configuration
- **Sending Account:** [email address]
- **Daily Volume:** [X contacts/day]
- **Send Window:** [9am-6pm] [timezone]
- **Warmup Status:** [Warmed / Warming — Day X]
- **ESP/Tool:** [Instantly / Lemlist / Custom]

## Notes
- [Any special instructions or context]
