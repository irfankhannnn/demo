# 13 — AI Marketing Architecture

> **Scope:** productizing AI marketing for tenants — content/campaign/reel generation, social publishing, and closed-loop measurement back to lead acquisition (`08`). Builds on the existing founder marketing system (`06`), exposed via the Marketing MCP (`05`). Research verified June 2026 (`20`).

---

## 1. From Founder Tooling to Tenant Feature
Today's `claude-skills` marketing apparatus + `.mcp.json` MCPs (Higgsfield, Meta-Ads, Blotato) are **internal GTM tooling** (`06`). The vision productizes a **subset** — the *generation + publishing primitives* — as a per-tenant **Marketing engine**, while strategy/consulting skills stay internal. An agency owner should be able to say "make me 3 reels for the new Lodha launch and schedule them" and get grounded, on-brand output.

## 2. Capabilities (from the vision)
Content generation (captions, posts, ad copy — Hinglish), creative/image generation, **reel/video generation**, social publishing (IG/FB), and automated campaign workflows — all closed-loop to lead acquisition.

## 3. Integration Landscape (current methods, June 2026)

| Capability | Options | Recommendation |
|---|---|---|
| **Image gen** | Higgsfield (Nano Banana Pro), Google **Gemini/Nano Banana image API**, Flux, Ideogram | Keep **Higgsfield MCP** (already integrated) + add direct **Gemini image API** as a fallback/cost option |
| **Video/Reels** | Higgsfield (Veo/Kling/Sora wrappers), Google **Veo 3.x** (Gemini API), Runway, **Remotion** (programmatic, code-based) | **Higgsfield** for generative reels; **Remotion** (already in stack: `my-video/`) for templated, brand-locked, data-driven videos (listing cards, price drops) — cheaper and on-brand |
| **Voiceover** | ElevenLabs TTS (already used) | ElevenLabs (shared with voice `12`) |
| **Publishing — IG/FB** | Instagram **Content Publishing API** (Reels), FB Pages publishing; or aggregators **Blotato / Ayrshare / Post Bridge** | **Blotato MCP** (already integrated) for multi-platform scheduling now; evaluate direct **IG Content Publishing API** for control/cost at scale |
| **Paid ads** | **Meta-Ads MCP** (already integrated, ~29 tools), CAPI | Keep Meta-Ads MCP; wire CAPI for offline-conversion upload (closed loop) |

**Verification flags:** Veo/Gemini/IG publishing exact pricing and limits should be reconfirmed on live docs (the deep web-verification pass was interrupted); the *integration approach* (keep existing MCPs, add direct APIs as fallback) is robust regardless.

## 4. Architecture

```
 Agency request (dashboard / WhatsApp command)
        ▼
 Marketing Agent (04, T2, Sonnet)  ── grounded in brand kit + inventory
        ▼
 Marketing MCP (05) tools:
   generate_image (Higgsfield / Gemini)
   generate_reel  (Higgsfield / Remotion templated)
   generate_copy  (Sonnet, Hinglish, brand-tone)
   create_campaign / get_metrics (Meta-Ads MCP, CAPI)
   schedule_post  (Blotato / IG Content Publishing API)
        ▼
 Assets → S3 (tenant-isolated) ; posts scheduled ; campaigns launched
        ▼
 Closed loop: Lead Ads + UTM + CAPI → Acquisition engine (08) → attribution/ROI (Analytics MCP)
```

- **Brand grounding:** each tenant has a brand kit (colors/fonts/tone — the `.brand` pattern), product inventory, and approved claims. The Marketing agent is grounded in these (RAG `14` + Property MCP) so creatives are accurate (real prices/specs) and on-brand — **no hallucinated offers**, same principle as `04 §5`. Reuses the Hinglish 70/30 convention.
- **Human approval:** marketing output is **Level-0/1 by default** (`04 §6`) — agencies review before anything posts publicly. Public posting is a high-stakes action.
- **Closed loop:** campaigns carry attribution; **Meta CAPI** uploads offline conversions (visit booked, deal closed) back to Meta to optimize ad delivery; ROI surfaces in Analytics.

## 5. Multi-Tenancy, Cost, Compliance
- Per-tenant Meta/IG/Blotato credentials in Secrets Manager (`15`); each tenant publishes to **its own** social accounts (Embedded-Signup style connection).
- **Usage metering:** images/reels/posts/campaign-actions are credit-metered (`17`) — generative video is the most expensive unit, priced accordingly.
- **Policy:** respect Meta content/automation policies and ad rules; RERA-aware claims for Indian real estate (no misleading promises); brand-safety review gate.

## 6. KPIs
Content output per tenant, post→engagement, campaign CPL/CPA/ROAS, creative win-rate (A/B), attribution-linked leads/visits/revenue, credit utilization.

## 7. Phasing
- **P3 (after acquisition/qual/voice):** Marketing MCP wrapping existing Higgsfield/Meta/Blotato + Remotion templated videos; dashboard "generate & schedule"; approval gate.
- **P4:** closed-loop CAPI optimization, A/B creative testing, autonomous always-on content calendars per tenant, marketing-copilot tier (productizing strategy skills).
