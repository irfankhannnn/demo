# Unified Task File Template

Copy this template into any new task file under `launch-plan-v2/`. Every existing task file in this folder follows this structure so AI agents can parse and execute uniformly.

---

```markdown
# [Phase][N] — [Title]

> **Type:** 🤖 AUTO · 🤝 HYBRID · 🧍 MANUAL  (one or multiple)
> **Phase:** Pre-launch · Week 1 · Week 2 · Week 3 · Week 4 · Month 2+
> **Day / Block:** T-X · Day Y · Block Z
> **Skill(s):** `skill-name` (if AUTO/HYBRID; see `cross-cutting/skill-command-sheet.md`)
> **Estimated time:** Xh founder · Yh AI

## Objective
1-2 sentences. What this task delivers and why.

## Why This Matters for RealEstateFlow
2-3 sentences anchored in the wedge, Mumbai launch, or specific risk this task mitigates.

## User Story
As a [role: founder / agency owner / agent / Cascade agent / support team], I want [outcome], so that [benefit].

## Acceptance Criteria
- [ ] Verifiable AC 1 (numeric or boolean)
- [ ] Verifiable AC 2
- [ ] ...

## Manual Steps (🧍 — for the human)
> Skip this block for pure 🤖 AUTO tasks.

1. **Action verb · location/URL · expected screen/state.** What to verify before next step.
2. ...

## AI Prompt (🤖 — verbatim, copy-paste into Cascade)
> Skip this block for pure 🧍 MANUAL tasks.

```
[Full prompt. References existing files by repo-relative path. Names exact output paths under `marketing-and-sales/launch-implement/...` or in code. Sets format constraints (markdown / JSON / TypeScript / etc). Specifies failure handling.]
```

## Inputs
- Files / data / credentials the AI or human needs before starting.

## Outputs
- Exact paths produced. Example: `marketing-and-sales/launch-implement/pre-launch/01-legal/tos.md`

## Success Criterion
1 sentence — when is this task DONE? Must be numeric or boolean.

## Fallback / Plan B
What to do if the primary path fails or vendor is down.

## Risks
| Risk | Mitigation |
|---|---|

## India / Mumbai-Specific Notes
DPDP / RBI / GST / language nuances if applicable.

## Dependencies
**Blocks:** task X, day Y · **Depends on:** task A, day B

## Connected Skills
- `skill-1` — for sub-step
- `skill-2` — for verification
```

---

## How AI agents should consume a task file

1. Read the **Type** header and route only if your role matches (e.g., a Cascade agent only acts on 🤖 or the AI half of 🤝).
2. Read **Inputs**; refuse the task if inputs are missing.
3. Run the **AI Prompt** verbatim. Do not paraphrase.
4. Produce the exact **Outputs** at the specified paths.
5. Verify each **Acceptance Criterion** before marking the task done.
6. Write a one-line entry in `00-DECISIONS-LOG.md` if a non-trivial decision was made (e.g., file conflict resolution, default value chosen).
7. If any AC fails, follow the **Fallback / Plan B** instead of guessing.

---

## How humans should consume a task file

1. Read the **Type** header.
2. For 🧍 tasks, follow the numbered **Manual Steps** in order.
3. For 🤝 tasks, run the AI prompt first to get a draft, then complete Manual Steps to publish/sign/post.
4. Tick each AC checkbox in the file as you complete it.
5. End your work session with a `daily-log/dayXX.md` entry using `00-DAILY-STANDUP-TEMPLATE.md`.

---

## File naming conventions

| Folder | Pattern | Example |
|---|---|---|
| `pre-launch-prep/` | `P{N}-{slug}.md` (P1 to P18) | `P9-grievance-flow.md` |
| `week-{1..4}-*/` | `day-{NN}-{slug}.md` (NN zero-padded) | `day-04-analytics-events-final.md` |
| `cross-cutting/` | `{slug}.md` | `risks-mitigations.md` |
| `linkedin-posts/` | `post-{N}-T-{X}-{slug}.md` | `post-1-T-14-broker-research.md` |
| `vs-pages/` | `vs-{competitor-slug}.md` | `vs-sell-do.md` |
| `month-2-plus/` | `M2-{slug}.md` | `M2-meta-ads-campaign.md` |

---

## Type label semantics

- 🤖 **AUTO:** AI agent does this end-to-end with no human interaction other than running the prompt.
- 🤝 **HYBRID:** AI produces a draft; human reviews, edits, and publishes/signs/posts.
- 🧍 **MANUAL:** Human-only (e.g., publishing DNS records, signing legal docs, dialling a prospect).

A file may carry multiple labels if different sub-steps require different routes (e.g., 🤖+🧍).

---

## Related

- `README.md` — folder navigation
- `00-PLAN-OVERVIEW.md` — wedge / pricing / roadmap
- `cross-cutting/skill-command-sheet.md` — which skill maps to what input/output
