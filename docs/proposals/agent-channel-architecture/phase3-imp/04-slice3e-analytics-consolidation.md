# Slice 3e — Analytics tool consolidation

**Status: ✅ Done.** Planner's analytics view: **12 → 4**. Nothing removed from the callable surface.

## The problem

The `analytics` domain held twelve tools whose triggers overlapped heavily: *"summary"*, *"overview"*, *"dashboard"*, *"sab kuch dikhao"*, *"how are we doing"*, *"what should I do"*. The router hands the planner a **whole domain at once**, so the model was choosing between twelve near-synonymous descriptions.

That is a tool-choice problem, not a capability gap. Different guesses returned different shapes for the same question, which then hit different formatter branches.

## The consolidation

Three tools fold eleven of them behind explicit enums:

| New tool | Parameter | Replaces |
|---|---|---|
| `get_crm_summary` | `scope: all \| metrics \| properties \| buyers \| pipeline` | `get_crm_metrics`, `get_properties_summary`, `get_buyers_summary`, `get_pipeline_summary`, `get_dashboard_snapshot` |
| `get_work_queue` | `focus: today \| priority_leads \| followups \| next_actions` | `get_daily_brief`, `get_priority_leads`, `get_followup_summary`, `suggest_next_actions` |
| `get_business_trends` | `days` | `get_business_health`, `get_recent_activity` |

The planner now picks a tool and **states an intent**, rather than picking between twelve descriptions. The enum is load-bearing: a free-text parameter would just move the guessing one level down, so a test asserts each consolidated tool exposes its branch as an enum.

## What was deliberately NOT folded in

`get_leads_summary` stays visible. It is the only analytics tool with a bespoke formatter card (`presentationTemplate: 'summary_leads_card'`) — routing *"kitni leads hain"* through the generic path would silently downgrade a rendered card to LLM prose. It also has the cleanest, least ambiguous trigger of the twelve, so it contributes almost nothing to the confusion the slice is fixing.

That is why the result is 4 rather than 3.

## Why this is safe to ship without eval data

Slice 3c is blocked on the eval set, and consolidation's benefit — better tool choice — is exactly the thing that eval set would measure. Shipping it blind is only defensible because **it hides rather than deletes**.

The eleven tools are marked `deprecated: true` and excluded from `TOOL_NAMES_BY_DOMAIN` (what the planner sees), but remain in `ALLOWED_TOOL_NAMES`. So:

- MCP clients that already name them keep working.
- The call-intelligence approval executor, which stores tool names in DynamoDB rows, keeps working — an action proposed before this change and approved after it still executes.
- Any saved automation keeps working.

The worst case is that the consolidation makes tool choice no better, in which case nothing has been lost. The failure mode of the alternative — deleting them — would have been a 400 on a stored action.

## The bug this slice introduced, caught by the next one

`prompts.js` contained an explicit trigger table naming ten of the eleven deprecated tools, plus a fully worked example (*"Who should I call today?" → call `get_priority_leads`*). `plannerPrompt.js` named one more.

Deprecating the tools left those instructions pointing at tools the model can no longer see. **This does not fail loudly** — the model either emits a call that gets rejected or picks something adjacent, and the reply quietly gets worse.

This is the **third** time prompt prose has drifted from the tool registry here (Slice 5's delete-tool leftovers were the first, and were missed by two subsequent audits). Fixed in Slice 3f, along with `promptToolReferences.test.js`, which runs the grep that would have caught all three.

## Verification

- 32 tests in `shared/toolDefinitions.consolidation.test.js`, covering: planner view is 4, each deprecated tool is still callable, none appears in any domain, `get_leads_summary` keeps its card, every consolidated tool has a real handler and is read-only.
- MCP regenerated: 71 tools, drift check and scope check pass.
- Full suite green.
