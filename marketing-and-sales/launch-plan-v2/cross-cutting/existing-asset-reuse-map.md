# Existing Asset Reuse Map

What's already built in `marketing-and-sales/` and what to **reuse** vs **rewrite** vs **retire** for v2.

---

## Reuse as-is (no edit needed)

| Asset | Path | Why reuse |
|---|---|---|
| ICP report Mumbai | `research/icp-report-mumbai-launch.md` | Persona facts still valid |
| Buyer personas summary | `research/buyer-personas-summary.md` | Priya/Arjun/Suresh archetypes |
| Mumbai positioning strategy | `research/mumbai-positioning-strategy.md` | Wedge logic |
| Broker branding research | `research/broker-branding-mumbai-pune-research.md` | Local brand language |
| Mumbai launch executive summary | `research/MUMBAI-LAUNCH-EXECUTIVE-SUMMARY.md` | Strategic context |
| Brand kit | `creative/realestateflow-launch/brand-kit.md` | Colors + typography |
| Mumbai outreach templates | `outreach/mumbai-outreach-templates.md` | Day 9 invites |
| WhatsApp broadcast sequences | `outreach/whatsapp-broadcast-sequences.md` | Day 13 drip |
| Lead scoring template | `outreach/lead-scoring-template.md` | Day 17+ |
| Logo PNG | `realestateflow/assets/logos/final/logo.png` | Source for SVG re-trace (P8) |
| 4 broker-segment design references | `realestateflow/direction1..4.html` | Visual reference for P15 |
| Page-wise graphics checklist | `creative/realestateflow-launch/page-wise-graphics-checklist.md` | Image production briefs |
| Canva layout specs | `creative/realestateflow-launch/canva-layout-specs.md` | Backup design path |
| WhatsApp graphics spec | `creative/realestateflow-launch/whatsapp-automation-graphics-spec.md` | Post 2 mockup (P6) |
| Motion graphics spec | `creative/realestateflow-launch/motion-graphics-spec.md` | M2 video ads |
| 8 AI image prompts | `creative/realestateflow-launch/ai-image-prompts.md` | P8 OG card prompts derive from these |
| 2 video scripts | `creative/realestateflow-launch/video-scripts/` | Day 6 demo + M2 ads |

## Rewrite (existing source, new content)

| Asset | Path | Why rewrite | Owner task |
|---|---|---|---|
| 5 LPs (main, agency-owners, agents, ai-employee, demo) | `creative/landing-pages/{slug}/index.html` | Hinglish → English; old pricing → new; old social proof → Mumbai-only | P15 |
| LP README | `creative/landing-pages/README.md` | Reflect 12 pages + new placeholders | P15 |
| netlify.toml | `creative/landing-pages/netlify.toml` | Drop /enterprise; add /pricing /legal /vs /grievance /about; security headers | P15 |
| Mumbai positioning headlines | `creative/realestateflow-launch/mumbai-positioning-strategy.md` | New wedge "AI Employee" front and centre | P4 |
| 24-week marketing master plan | `MARKETING-MASTER-PLAN.md` | Reconcile with v2 plan (no paid ads M1, Mumbai-only) — append v2 reconciliation note | reconciliation note (see decisions log) |

## Retire (delete or archive)

| Asset | Path | Why retire |
|---|---|---|
| `/enterprise` LP | `creative/landing-pages/enterprise/index.html` | Dropped from M1 (per decisions log) |
| Pune-Delhi-Bangalore outreach lists in `outreach/` | various | Out of M1 scope; archive to `marketing-and-sales/_archive/` |
| Dubai marketing references | `creative/realestateflow-launch/mumbai-pune-launch-prompts.md` (Dubai blocks) | Out of M1 scope |
| Multi-city pricing of ₹3,000 | LP source files | Replaced by ₹999/₹1,999/₹500/₹7,999 |

## Net new (build in v2)

| Asset | Task file |
|---|---|
| `pricing.json` | shipped at folder root |
| `/pricing`, `/about`, `/grievance`, `/vs/*`, `/legal/*` LPs | P15 |
| Logo SVG + favicons + OG cards | P8 |
| Cookie consent banner | P17 |
| JSON-LD schema | P16 |
| sitemap.xml + robots.txt + llms.txt | P16 |
| Cold email templates v2 | Day 17 |
| LinkedIn 5 pre-launch posts | P6 |
| In-app trial banner + paywall | P14 |
| Grievance flow | P9 |
| Analytics events | P10 |
| OpenClaw concierge backend + status page | P11 |
| Seat-cap enforcement | P12 |
| Multi-tenancy security audit | P13 |
| Demo tenant + reset cron | P5 |
| 5 AEO answer pages | P16 |
| 3 vs-pages | P4 + P15 |
| NPS in-app + email | Day-28 |

---

## Asset hygiene rules

- Never edit a "reuse as-is" asset without logging a decision
- Anything in `_archive/` is read-only history
- New assets always go under `marketing-and-sales/launch-implement/...` (work-in-progress) before promotion to `creative/` or `realestateflow/` (final)
- All v2 plans live under `launch-plan-v2/` (this folder); v1 plans untouched in `launch-plan/`

---

## Audit log of asset moves

When you move a file from one bucket (reuse/rewrite/retire) to another, append here:

| Date | File | From → To | Reason |
|---|---|---|---|
| YYYY-MM-DD | example.html | reuse → retire | replaced by P15 |
