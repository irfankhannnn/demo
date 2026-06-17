# Workspace Template

Copy this folder to onboard a new business into the Content OS:

```bash
cp -r workspaces/_TEMPLATE workspaces/<business-slug>
```

Then fill the 5 files below **in order**. The global engine (frameworks, characters scaffold, hooks/CTAs taxonomy, visual system, Higgsfield mapping, content factory) works unchanged — you only supply this business's memory.

| File | Fill from | See reference |
|---|---|---|
| `01-business-memory.md` | the product's CODE + docs + screenshots (don't assume) | realestateflow/01-business-memory.md |
| `02-market-research.md` | market, ICP, lead sources, pains, objections, content habits | realestateflow/02-market-research.md |
| `03-language-strategy.md` | optimal language mix + when-to-use rules | realestateflow/03-language-strategy.md |
| `casting.md` (optional) | re-skin the 9 CH-* archetypes for this audience | characters/04-character-system.md |
| `04-content-plan-500.md` + `.csv` | 500+ scored opportunities | realestateflow/04-content-plan-500.* |
| `05-14-day-launch-plan.md` | the launch sprint pulling top OPP-ids | realestateflow/05-14-day-launch-plan.md |

Set `ACTIVE_WORKSPACE: <business-slug>` in the content factory / prompt library to activate. Full process: `global/01-workspace-system.md`.

> Keep workspaces isolated — no file here may reference another business's facts. Brand colors/fonts come from this business's own brand kit.
