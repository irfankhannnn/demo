# 14 — RAG & Knowledge Architecture

> **Scope:** the tenant-scoped knowledge layer that grounds every agent (sales, voice, follow-up, marketing) in real property/sales/agency/marketing knowledge. Builds on the existing Bedrock KB pattern in `ai-calling-service`. Research verified June 2026 (`20`); **AWS pricing pages 403-blocked — reconfirm exact vector costs before budgeting.**

---

## 1. Why a Knowledge Layer
The product principle "grounded, never hallucinated" (`02`, `04 §5`) requires a retrieval layer for **unstructured/semi-structured** knowledge that doesn't live cleanly in the CRM: project brochures, RERA docs, locality guides, payment-plan PDFs, FAQs, policies, sales playbooks, objection-handling scripts. Structured facts (prices, availability) come from the **Property MCP** (the CRM is their source of truth); the **Knowledge MCP** handles everything else.

**Knowledge domains (from the vision):** property knowledge, sales knowledge, agency knowledge, marketing knowledge — all **per-tenant**.

## 2. Build on Bedrock Knowledge Bases
The calling service already uses **Bedrock KB** (`RetrieveAndGenerate`, `anthropic.claude-3-sonnet`, **tenant_id metadata filtering**, citations). We standardize on **Bedrock Knowledge Bases** platform-wide because:
- It gives retrieval + generation + **citations** out of the box (citations are essential for groundedness).
- **Metadata filtering** cleanly enforces **per-tenant isolation** (filter every query by `tenant_id`, plus `domain` and `project_id`).
- It supports multiple vector stores, so we choose the backing store on cost (next section) without changing the app.

## 3. Vector Store Choice — optimize for the startup cost curve

| Store | Idle/floor cost | Verdict |
|---|---|---|
| **OpenSearch Serverless** | ~**$175/mo** (1 OCU) / ~$350 (2-OCU HA) hard floor | **Avoid early** — the OCU floor is a tax on a pre-scale startup |
| **S3 Vectors** (GA Dec 2025) | ~**cents/mo** at small scale, no floor; sub-second latency; native Bedrock KB integration | **Default choice** for cost |
| **Aurora pgvector** | **$0** scaled-to-zero (storage only) | Use **if** we adopt Aurora for reporting anyway → co-locate vectors with relational data |

**Recommendation:** **S3 Vectors** as the Bedrock KB backing store from day one (cheapest, no floor, fine RAG latency). If/when **Aurora Serverless v2** is adopted for reporting (`16`), consider **pgvector** to co-locate knowledge with relational data and cut moving parts. **Defer OpenSearch Serverless** until query volume clearly justifies its floor. (Caveat: S3 Vectors stores hierarchical parent-child chunk relations as non-filterable metadata — design chunking accordingly.)

## 4. Architecture

```
 Tenant uploads (brochures, RERA, FAQs, playbooks) → S3 (tenant-isolated)
        │  ingestion pipeline (chunk + embed via Bedrock Titan/Cohere)
        ▼
 Bedrock Knowledge Base  (backing store: S3 Vectors → later pgvector)
   metadata: { tenant_id, domain, project_id, source, version }
        ▲ retrieve+generate (filtered by tenant_id + domain)
        │
 Knowledge MCP (05): query_knowledge / list_sources / ingest_document
        ▲
 Agents (04): Sales, Voice, Follow-Up, Marketing — quote with citations
```

- **Ingestion:** per-tenant document upload (reuse the calling service's knowledge-doc flow + S3 KYC/doc patterns); auto-chunk + embed; version documents (price lists change). Structured data (inventory) is **not** dumped into vectors — it's queried live from the Property MCP.
- **Retrieval:** every query is tenant- and domain-filtered; returns passages **with citations** the agent must quote. Hybrid (keyword + vector) where the store supports it.
- **Freshness:** scheduled re-ingestion / event-driven updates when a tenant changes brochures/pricing docs; stale-knowledge guardrails (prefer live Property MCP for anything price/availability).

## 5. Multi-Tenancy & Security
- **Isolation by metadata filter** on every retrieve (`tenant_id`) — never cross-tenant. Validated server-side in the Knowledge MCP (tenant from token, not args).
- Tenant documents in **tenant-prefixed S3** with KMS encryption (`15`).
- PII in documents handled per DPDP; retention controls.

## 6. Knowledge Domains in Practice
| Domain | Examples | Primary consumers |
|---|---|---|
| Property | brochures, floor plans, RERA, locality guides, amenities | Sales, Voice, Marketing |
| Sales | playbooks, objection handling, scripts, payment-plan explainers | Sales, Voice, Follow-Up |
| Agency | policies, FAQs, process, team info | Sales, Voice |
| Marketing | brand kit, approved claims, past creatives | Marketing agent (`13`) |

## 7. KPIs
Retrieval relevance, groundedness/citation rate, "I-don't-know→task" rate (healthy, not zero), answer accuracy vs source, ingestion freshness lag, cost per 1k queries.

## 8. Phasing
- **P2:** standardize Bedrock KB + **S3 Vectors**; Knowledge MCP; ground Sales Assistant + Voice in property/sales/agency knowledge with citations.
- **P3:** marketing knowledge for the Marketing agent; versioning + freshness automation; hybrid retrieval; evaluate pgvector co-location if Aurora adopted.
