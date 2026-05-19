# Skill Command Sheet

Maps each Claude/Cascade skill to its typical input + output for this launch. Use this when a task file references a skill name — paste the skill name into Cascade, give it the inputs, expect the outputs.

---

## Marketing & Copy

| Skill | Input | Output |
|---|---|---|
| `copywriting` | persona doc + wedge.md + page-brief | hero/value-prop/CTA copy + microcopy |
| `copy-editing` | existing copy | sharper version with tracked changes |
| `landing-page` | brand kit + wedge + persona + pricing.json | full HTML LP with sections + schema slot |
| `pricing-strategy` | competitor research + persona | tier rationale + benchmark + page copy |
| `content-strategy` | wedge + ICP + month-1-results | editorial calendar + topic clusters |
| `social-content` | wedge + persona + cadence rules | LinkedIn post / Twitter thread / Reels script |
| `email-sequence` | trigger + audience + goal | multi-email drip with subjects + bodies |
| `cold-email` | ICP + wedge | 3-step cold sequence with subject/body/CTA |
| `whatsapp-outreach` | ICP + wedge | WhatsApp text + voice script |
| `lead-magnets` | persona pain + wedge | lead-magnet brief + outline |
| `referral-program` | LTV/CAC math + persona | referral mechanic + email/landing |

## Strategy & Research

| Skill | Input | Output |
|---|---|---|
| `brand-strategy` | wedge + persona + research | brand manifesto + tagline options + tone guide |
| `competitor-profiling` | competitor URL list | structured competitor profiles |
| `competitor-alternatives` | competitor profile + wedge | /vs/* page draft |
| `competitive-intel` | trend-hunter output + reviews | positioning gaps + response recs |
| `customer-research` | transcripts / reviews | personas + JTBD + voice-of-customer |
| `icp-research` | wedge + city + revenue model | ICP profile + buyer personas + market size |
| `marketing-psychology` | LP draft | annotated psychology principles applied |
| `marketing-ideas` | wedge + budget + constraints | 10-20 prioritized growth ideas |

## Acquisition

| Skill | Input | Output |
|---|---|---|
| `paid-ads` | persona + budget + offer | ad campaign structure + audiences + creatives brief |
| `ad-creative` | persona + offer | bulk ad copy variations |
| `ugc-scripts` | persona + offer + UGC creator profile | UGC script with hook/body/CTA + camera direction |
| `outbound-outreach` | ICP CSV + wedge | personalized outbound sequences with variants |
| `co-marketing` | partner profile + audience overlap | joint-campaign brief |
| `directory-submissions` | product brief | tracker of 30+ directory targets + submission copy |
| `community-marketing` | community list + persona | engagement plan + post drafts |
| `launch-strategy` | product + audience + day-zero target | launch checklist + Product Hunt/etc plan |

## SEO / AEO

| Skill | Input | Output |
|---|---|---|
| `seo-audit` | LP URLs | technical + on-page audit + fix list |
| `schema-markup` | page type + content | JSON-LD schema block |
| `ai-seo` | target Q&A + persona | AEO answer page draft + citation tactics |
| `programmatic-seo` | template + data set (cities × keywords) | bulk page outputs at scale |
| `site-architecture` | URL list + IA goals | sitemap + URL structure + nav |
| `seo-blog` | keyword + persona | full SEO blog article |

## Conversion / CRO

| Skill | Input | Output |
|---|---|---|
| `page-cro` | LP URL + analytics | prioritized improvement list |
| `signup-flow-cro` | signup flow walk-through | friction list + fixes |
| `onboarding-cro` | onboarding screens + activation metric | activation lift recommendations |
| `paywall-upgrade-cro` | paywall context + tier | modal copy + upgrade UX |
| `popup-cro` | LP + goal | popup copy + trigger spec |
| `form-cro` | form + completion data | field reduction + UX fixes |
| `funnel-analysis` | events CSV / PostHog | drop-point report + actions |

## Tech Implementation

| Skill | Input | Output |
|---|---|---|
| `codebase-analysis` | repo + change request | architecture decision record + plan |
| `pr-review` | PR diff or new code | quality + security + perf review |
| `security-audit` | server source | OWASP top-10 + DPDP audit report |
| `analytics-tracking` | event spec | implementation across SPA + server |
| `revops` | sales process + tools | CRM + handoff workflows + invoice template |

## Media

| Skill | Input | Output |
|---|---|---|
| `image` / `nano-banana-pro` | brand kit + image brief | PNG/SVG asset |
| `json-prompting-for-nano-banana` | natural-language brief | JSON schema for Nano Banana |
| `video` / `remotion-video` | script + brand kit | rendered MP4 |
| `voiceover-gen` | script + voice profile | ElevenLabs spec + audio file |
| `huashu-design` | design brief | high-fidelity HTML prototype |

## Operations

| Skill | Input | Output |
|---|---|---|
| `find-skills` | "I want to do X" | skill recommendation |
| `firecrawl-scrape` | URL | clean markdown |
| `firecrawl-search` | query | search results + content |
| `firecrawl-agent` | URL + JSON schema | structured extraction |

---

## Skill chain examples

### "Write a /vs/sell-do page"
1. `competitor-profiling` → battle-card on Sell.do
2. `competitor-alternatives` → /vs/sell-do markdown draft
3. `schema-markup` → Article + FAQPage JSON-LD
4. `seo-audit` → on-page checklist
5. `landing-page` → render to HTML

### "Send a cold email batch on Day 17"
1. `firecrawl-agent` (lead-enrichment) → enrich Mumbai prospect list
2. `cold-email` → 3-step sequence
3. `analytics-tracking` → UTM + event firing
4. `pricing-strategy` (cross-check offer)

### "Wire analytics events"
1. `analytics-tracking` → event catalogue + SDK setup
2. `codebase-analysis` → instrumentation across SPA pages
3. `pr-review` → security review
4. `funnel-analysis` → validate funnel works end-to-end

---

## Skill-not-yet-installed checks

Before assigning a task, verify the skill exists in your skill list. If not, use `find-skills` first or fall back to general AI prompting.

## Skill version note

Skills update over time; this sheet reflects the inventory at master plan v2 authoring date. If a skill output diverges from this spec, refer to the skill's own description in your tooling.
