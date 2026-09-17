# RealEstateFlow GTM Operating System

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/README.md`. The four GTM layers became `30-channels/`, `40-sales-and-conversion/`, `50-measurement/` and `60-automation/`.

The Content OS generates content. The **GTM OS** wraps it to acquire and convert customers — and to *measure and automate* the whole motion. Four integrated layers plus engineering.

```
        CONTENT OS  ──►  ATTENTION OS  ──►  DISTRIBUTION OS  ──►  SALES OS
        (generate)       (capture)          (distribute)          (convert)
              └──────────────┴──────── AUTOMATION OS ────────────────┘
                              (measure + automate)
                                       │
                                 GROWTH DASHBOARD (KPIs)
```

## The layers
| Layer | Folder | Job | Phases |
|---|---|---|---|
| **Content OS** | `frameworks/ characters/ hooks/ ctas/ visual-system/ higgsfield/ production-sop/ workspaces/` | Generate consistent content | (prior build) |
| **Attention OS** | `attention-os/` | Capture attention → conversations | 1 |
| **Distribution OS** | `distribution-os/` (+ `instagram/ whatsapp/ linkedin/`) | Distribute across IG/WA/LinkedIn/YouTube/FB + founder engine | 2–5, 12 |
| **Sales OS** | `sales-os/` | Qualify → demo → close → onboard → referral | 6–7 |
| **Automation OS** | `automation-os/` | Marketing + internal automations, attribution, scoring | 8–11 |
| **Engineering** | `implementation/` | Build the in-product GTM features | coding req |
| **KPIs** | `growth-dashboard.md` | The scoreboard | 13 |
| **Roadmap** | `marketing-and-sales/launch-plan-v2/month-2-plus/README.md` | Sequenced execution | 14 |

## How they integrate (the flow)
1. **Content OS** produces a reel from an `OPP-*` recipe (framework + character + hook + CTA + Higgsfield).
2. **Attention OS** ensures it stops the scroll and converts viewers to DMs (`content-to-conversation`).
3. **Distribution OS** publishes + repurposes across channels and runs the founder engine.
4. **Sales OS** takes the DM → WhatsApp → demo → trial → paid → referral.
5. **Automation OS** instruments every step (`MKT_EVENT`, attribution to `OPP-*`, scoring, sequences) inside RealEstateFlow itself.
6. **Growth Dashboard** shows what works → feed back into the Content OS (make more of what books demos).

## Success criteria (met)
Generate · Distribute · Capture attention · Generate conversations · Generate demos · Convert customers · Measure results · Automate growth — all integrated, and workspace-aware for future businesses (`global/01-workspace-system.md`).

## Start here
New AI agent: read `README.md` (Content OS) → this file → the layer you need → execute via `marketing-and-sales/launch-plan-v2/20-content-engine/prompt-library.md`. Activate a business with `ACTIVE_WORKSPACE`.
