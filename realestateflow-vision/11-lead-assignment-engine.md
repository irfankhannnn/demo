# 11 — Lead Assignment Engine

> **Scope:** routing each lead to the right agent/team automatically, with rules agencies control. Consumes scoring (`10`), feeds tasks/follow-up (`09`), and depends on the team/RBAC model (`15`).

---

## 1. Goal
Zero leads dropped, fast distribution, fair workload, right-fit agent — configurable per agency. Assignment is mostly **deterministic rules** (transparent, instant, free) with an optional LLM tiebreak; it is **not** a place for opaque AI.

## 2. Assignment Strategies (from the vision)

| Strategy | Logic | Typical use |
|---|---|---|
| **Round-robin** | Next agent in rotation | Small teams, fairness |
| **Region/area-based** | Match lead location to agent's territory | Geographic teams |
| **Project-based** | Match lead's project interest to project specialist | Builder-tie-up agencies |
| **Team-based** | Route to a team, then within-team rule | Larger orgs |
| **Lead-quality-based** | Hot → senior closers; Cold → nurture pool/AI | Performance optimization |

These **compose** into a per-tenant rule chain, evaluated in order, e.g.:
```
1. If project ∈ {specialist map} → that specialist (if available)
2. Else if area ∈ {territory map} → round-robin within territory team
3. Else if band = Hot → round-robin within senior pool
4. Else → general round-robin
5. Fallback → manager queue
```

## 3. Engine Design

```
LeadQualified / LeadScored event
   → Assignment function (T0, rules engine in domain layer)
       load tenant AssignmentRules (config)
       evaluate rule chain with availability + capacity + workload
       pick agent → create assignment + Task (Task MCP) → notify agent
       (optional) Haiku tiebreak when multiple equal candidates
   → AssignmentMade event → dashboard, follow-up, SLA timer
```

**Inputs:** lead attributes (area, project, band, source, language), agent attributes (territory, specialties, languages, seniority), **availability** (online/working hours/leave), **capacity** (current open-lead count, WIP limit), and recent workload (for fairness).

**Capacity & fairness:** each agent has a configurable WIP cap; round-robin skips at-capacity/offline agents; load-balancing prevents dumping all leads on the fastest responder.

**SLA & reassignment:** on assignment, an **SLA timer** starts (e.g. respond within 15 min for Hot). If breached → auto-escalate/reassign (manager queue or next agent) and notify — this directly attacks the "lead rots unassigned" failure. Reuses the existing escalation/cron pattern.

## 4. Multi-Tenancy & RBAC
- Rules, territories, teams, and capacities are **per-tenant config**.
- Assignment respects the team/role model (`15`): an agent only ever sees/owns their assigned leads; managers see their team; owners see all.
- Only Owner/Manager can edit assignment rules.

## 5. Edge Cases
- **No eligible agent** (all offline/at-capacity) → manager queue + alert; optionally AI keeps nurturing until a human frees up.
- **Duplicate/returning lead** → route to the prior owner (continuity) rather than round-robin.
- **Reassignment** preserves history and notifies both agents.
- **AI as an "agent"** in the rota: Cold/after-hours leads can be assigned to the AI nurture pool until business hours.

## 6. Integration
- **← Scoring (`10`):** band/score gates quality-based routing.
- **→ Task MCP / Follow-Up (`09`):** assignment creates the owning task and kicks the journey.
- **→ Analytics:** assignment latency, SLA compliance, per-agent load/conversion, leakage.

## 7. KPIs
Time-to-assignment, SLA compliance, leakage (unassigned/expired), workload balance (Gini across agents), assigned-lead conversion by strategy, reassignment rate.

## 8. Phasing
- **P1:** round-robin + region + manager-queue fallback + SLA timer/escalation.
- **P2:** project-based, team-based, quality-based, capacity/availability awareness.
- **P3:** fairness optimization, AI-pool routing, learned routing suggestions.
