# Implementation — Prioritized Backlog

Ordered by leverage (measure → convert → optimize). T-shirt sizes: S/M/L.

## Sprint 1 — Attribution foundation (EP-1, EP-7 seed)
| Item | Epic | Size |
|---|---|---|
| Lead attribution fields + create-path capture (BE-1, FE-1) | EP-1 | M |
| `MKT_EVENT` entity + service (BE-2) | EP-2 | M |
| `/api/marketing/events` ingest + sig verify (BE-3, INF-5) | EP-2 | M |
| Lead detail/list: source chip + filters (FE-2) | EP-1 | S |
| Minimal dashboard: sources + funnel counts (BE-9, FE-3) | EP-7 | M |

## Sprint 2 — Inbound capture (EP-3)
| IG webhook + DM/comment → attributed lead (INT-1) | EP-3 | L |
| Keyword auto-reply (BE-4) | EP-3 | M |
| Meta Lead Ads ingest + CAPI (INT-3) | EP-3 | M |
| AI-calling auto-qualify trigger (BE-6) | EP-3 | M |

## Sprint 3 — Sequences (EP-4)
| Sequence orchestration on scheduled engine (BE-5, GSI-SeqDue) | EP-4 | L |
| WhatsApp Business API + opt-in + templates (INT-2) | EP-4 | L |
| Onboarding + nurture + demo-reminder + win-back sequences | EP-4 | M |
| Scheduled worker Lambda + SQS/DLQ (INF-1,2) | EP-2/4 | M |

## Sprint 4 — Scoring + Referral (EP-5, EP-6)
| Scoring service + nightly job (BE-7) | EP-5 | M |
| Score badges + hottest-first sort (FE-2, GSI-LeadScore) | EP-5 | S |
| Referral entity + UI + rewards (BE-8, FE-4) | EP-6 | M |

## Sprint 5 — Full dashboard + optimize (EP-7)
| CAC/LTV/payback + content `OPP-*` ROI + cohorts (BE-9, FE-3) | EP-7 | L |
| Observability + alarms (INF-6) | all | M |
| A/B hooks → ab-optimizer | EP-7 | M |

## Definition of done (every item)
Multi-tenant isolation · consent/opt-out respected · idempotent · tested · observable · documented.
