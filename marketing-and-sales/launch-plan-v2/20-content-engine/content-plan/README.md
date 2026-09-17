# Content plan — from a row to a scheduled post

Two files, one dataset:

- [`content-plan-500.csv`](content-plan-500.csv) — 526 scored content opportunities, one per row, machine-readable. **This is the working file.**
- [`content-plan-500.md`](content-plan-500.md) — the human-readable summary: scoring method, distributions, the top 50, and the top 10 per content type.

**They must stay in sync.** Edit the CSV, then update the markdown. If you add rows, keep the `OPP-NNN` ids unique and never reuse a retired one — other documents cite them by id, and an id that silently changes meaning is worse than a broken link.

## The columns

| Column | What it is |
|---|---|
| `opp_id` | Stable id, `OPP-001` … `OPP-526`. Cite this everywhere. |
| `title` | The angle in one line, in the row's own language mix. Not a headline — the hook comes from the hook library. |
| `content_type` | `CT-*` → the recipe in [`../content-types.md`](../content-types.md) |
| `framework` | `FW-*` → the structure in [`../framework-library.md`](../framework-library.md) |
| `characters` | `CH-*`, pipe-separated → [`../cast-and-presenter.md`](../cast-and-presenter.md) |
| `language` | `hi-dominant` / `mixed` / `en-leaning` / `mr-dominant` |
| `persona`, `city` | Who it is for, and where |
| `reach`, `shareability`, `save`, `comment`, `lead_gen` | Five axes, 1–10, **estimated in June before anything was published** |
| `total`, `priority_score` | Sum, and the lead-gen-weighted blend |
| `hook_category`, `cta_category` | Which slice of the hook and CTA libraries to pull from |
| `status` | Whether the row can be produced as written — see below |
| `gate` | Which open decision the row waits on — `D23`, `D24`, `D26` |

## Filter before you sort

The scores rank rows against each other. They do not tell you whether a row is *allowed*. Filter first:

1. Drop everything where `status` is not `ok`.
2. Drop `gate=D24` while M1 is Mumbai-only.
3. Drop `gate=D26` until AI calling is on the approved-claims list.
4. Then sort by `priority_score`, or filter by `cta_category` for a lead-gen week.

| `status` | Rows | What to do |
|---|---|---|
| `ok` | 367 | Produce it. |
| `blocked-prelaunch` | 97 | Do not produce. Asserts a customer, case study, testimonial or result we do not have. Kept for post-launch reuse. |
| `review-number` | 28 | The title asserts a percentage or ₹ figure. Source it, turn it into a number the viewer works out for themselves, or drop it — then produce. |
| `blocked-founder-oncamera` | 15 | Rewrite as an AI-presenter piece or a text post, and remove the unverifiable claim, before producing. |
| `blocked-feature` | 12 | The feature does not exist or is not reachable yet (the lead-leakage calculator is a placeholder; there is no portal sync; Instagram automation is built but blocked on Meta App Review). |
| `retitled` | 7 | Already fixed in place. Produce as now written. |

> Open decision D23 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`
> Open decision D24 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`
> Open decision D26 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`

`status` catches what a machine can catch. It is not a substitute for running the pre-publish checklist in [`../../10-audience-and-voice/claims-and-proof-policy.md`](../../10-audience-and-voice/claims-and-proof-policy.md) on the finished piece.

## Row → post

1. **Pick the week's rows** (filter, sort, take the top N).
2. **Expand the recipe.** `content_type` → [`../content-types.md`](../content-types.md) gives framework, cast, CTA category, workflow and visual preset. The row's `framework` overrides the type's default when they differ.
3. **Pull the hook.** Filter [`../hooks/hooks.json`](../hooks/hooks.json) by `category = hook_category` and `best_frameworks` containing the row's `framework`. Record the `HK-` id.
4. **Pull the CTA.** Filter [`../ctas/ctas.json`](../ctas/ctas.json) by `category = cta_category` and the funnel stage the piece is aiming at. Record the `CTA-` id.
5. **Write and route.** [`../production-pipeline.md`](../production-pipeline.md), Steps 5–7. Tag every shot `[AI]`, `[REC]` or `[ED]`, and check the week's `[ED]` count against the editor's ~3-video cap.
6. **Land it on a day.** The week folders (`../../week-1-foundation/` … `../../month-2-plus/`) are the schedule. A row without a day is a backlog item, not a plan.
7. **Log the outcome** against the `OPP-` id so the June estimates can eventually be replaced with measured numbers.

## What the plan still does not cover well

The June plan was written before several things shipped, and three gaps are worth naming because they are where the best remaining material is:

1. **Instagram automation** — DM capture into the CRM and comment-keyword auto-reply. `OPP-521` and `OPP-522` are seeds; both sit at `blocked-feature` until Meta App Review passes, because the feature cannot reach real followers yet.
2. **Property pages and site-visit booking** — built and reachable today. `OPP-523` is a seed and there is room for more.
3. **The WhatsApp AI Employee handling a lead end to end** — this is the product's wedge and the M1 activation event, and the June plan has almost nothing on it. `OPP-524` is a seed; this deserves a series, not a row.

The two AI follow-up calls (`OPP-525`, `OPP-526`) are seeded but gated on **D26**, since AI calling is not on the approved-claims list.

Everything else the plan is thin on — it has no rows about credits and billing, the AI Assistant, call recordings, team analytics, or the grievance and trust surfaces — is a genuine gap rather than a blocked one. Add rows as those become things worth talking about.
