# Archive — the retired Content OS

> **Status (17 Sep 2026):** This folder holds the June 2026 Content OS after it was merged into the six numbered layers of `marketing-and-sales/launch-plan-v2/`. Nothing here is the current plan. Every file carries an archive banner naming its successor.

**The live playbook starts at `marketing-and-sales/launch-plan-v2/README.md`.**

---

## Why anything is here at all

Three kinds of file end up in this folder:

1. **Merge sources.** Their content was folded into a live file. The original is kept so the merge is auditable — you can see what was dropped and why.
2. **Superseded designs.** Correct for June, wrong now, because the thing they designed was either built differently or never built.
3. **Scaffolding with no role in a single-brand playbook** — the multi-business workspace system and the `_TEMPLATE` workspace.

Original sub-paths are preserved, so `attention-os/audience-research.md` here was `attention-os/audience-research.md` inside the old `content-os/` folder. One exception: the Content OS root `README.md` is filed as **`content-os-README.md`**, because this file occupies the `README.md` slot.

---

## The archive rule

An archived file keeps its body. Only two things change: the banner directly under its H1, and any repo path that the September 2026 reorganisation moved (`/.brand/` → the real brand-kit and positioning paths, `apps/crm/server/` → `apps/crm/server/`, `my-video/` → `marketing-and-sales/video-projects/my-video/`, `marketing-and-sales/assets/` → `marketing-and-sales/creative/`).

**Do not fix the facts inside an archived file.** Its stale prices, stale brand colours, fabricated proof and invented customers are exactly why it is archived. Correcting them here would hide the reason. If you want the correct version, follow the banner to its successor.

---

## What was retired in the entry-point and audience pass

| Archived file | Why | Successor |
|---|---|---|
| `content-os-README.md` | One of four competing entry points. Its brand truth was `#2563EB`/Inter at a `/.brand/` folder that does not exist, and its market was "Mumbai & Pune" | `launch-plan-v2/README.md` |
| `GTM-OS-README.md` | Second entry point. Claimed "success criteria (met)" when nothing had been executed or measured | `launch-plan-v2/README.md`; its four layers became `30-`, `40-`, `50-`, `60-` |
| `master-index.md` | Third entry point, and the largest source of stale path references. Asserted a "confirmed gap: leads have no source", which is false | `launch-plan-v2/README.md`; its stable-ID namespace table survives there |
| `user-guide.md` | Fourth entry point. Proposed paid tests in week 1 against the no-paid-ads-in-M1 decision, and claimed the product measures nothing (PostHog is wired) | `launch-plan-v2/README.md` and `20-content-engine/README.md` |
| `growth-dashboard.md` | Cited a `growth-strategist` agent and a `channel-cac-analysis` skill that do not exist; its targets contradicted the PMF gate | `50-measurement/weekly-scorecard.md` |
| `marketing-and-sales/launch-plan-v2/month-2-plus/README.md` | One of four competing roadmaps. The week folders plus `month-2-plus/` win, and forward items are re-expressed as phases with no dates | `month-2-plus/README.md` |
| `attention-os/audience-research.md` | Sound attention research wrapped around a named-agency peer testimonial and a fabricated Pune case study | `10-audience-and-voice/icp-and-personas.md` |
| `global/00-content-os-overview.md` | The object model is worth keeping; its brand truth pointed at a folder that does not exist, and its success test was "correct language mix for Mumbai/Pune" | `20-content-engine/README.md` |
| `global/01-workspace-system.md` | Accurate, but multi-business workspace scaffolding has no role in a single-brand playbook | None. **Restore this file if a second brand is ever onboarded.** |

The rest of the archive — the growth-platform designs, the two engineering-implementation sets, the `explanation/` layer, `automation-os/`, the `_TEMPLATE` workspace and the distribution and sales merge sources — is indexed with a build trigger for each in **`50-measurement/design-only-backlog.md`**.

---

## Where the live material went

| You are looking for | It is now at |
|---|---|
| Who we sell to, personas, attention rules | `10-audience-and-voice/icp-and-personas.md` |
| What the product actually does | `10-audience-and-voice/product-truth.md` |
| What we may and may not claim | `10-audience-and-voice/claims-and-proof-policy.md` |
| Colours, fonts, handle, language splits | `10-audience-and-voice/brand-constants.md` |
| Frameworks, characters, hooks, CTAs, visuals, prompts | `20-content-engine/` |
| Channel playbooks | `30-channels/` |
| Sales scripts | `40-sales-and-conversion/` |
| Metrics and dashboards | `50-measurement/` |
| Automation | `60-automation/` |
| Unresolved marketing questions | `launch-plan-v2/00-OPEN-DECISIONS.md` |

---

## Provenance

The launch-plan-v2 folder was originally generated from two planning documents that lived outside the repository, on the founder's machine (`realestateflow-launch-implementation-plan-v2` and `launch-plan-v2-file-inventory`). Those paths were not repo-relative and have been removed from `README.md`, which requires repo-relative paths. They are recorded here so the provenance is not lost.
