# Experiments — Hypothesis-Driven Growth Testing

This directory is owned by the `experiment-designer` agent.
All A/B tests, growth experiments, and structured tests live here.

## Directory Map

```
experiments/
├── backlog.md              ← scored experiment ideas, prioritized
├── active-experiments.md   ← currently running, do not duplicate
├── pending/                ← experiment candidates from growth-strategist (not yet briefed)
├── briefs/                 ← full experiment briefs, ready to execute
└── completed/              ← finished experiments with results
```

## Workflow

```
growth-strategist writes candidates → pending/
                                          │
experiment-designer scores + scopes →  briefs/
                                          │
media-buyer / landing-page-builder executes
                                          │
ab-optimizer collects daily data
                                          │
experiment-designer applies stats → completed/
                                          │
                                       Learnings feed back to backlog
```

## Files

### backlog.md
Master list of all experiment candidates, scored by Impact × Confidence / Effort.
Re-ranked weekly by experiment-designer.

### active-experiments.md
What's running right now. Read this BEFORE proposing a new test to avoid conflicts.

### pending/
Raw experiment candidates from growth-strategist (in Weekly Growth Brief).
experiment-designer picks these up Monday morning to score and scope.

### briefs/
Full experiment briefs ready to be executed by:
- `media-buyer` for ad tests
- `landing-page-builder` for page tests
- `sdr` for outreach tests
- `nurture-bot` for email sequence tests

### completed/
Finished experiments with statistical analysis and learnings.
These feed strategic memory back to growth-strategist.

## Experiment File Naming

```
exp-<slug>-<date>.md
Example: exp-hero-headline-rajesh-2026-W20.md
```

## Required Brief Fields

Every brief must include:
- Hypothesis (specific, data-grounded)
- Primary metric (chosen BEFORE launch)
- Sample size calculation (formula and result)
- Duration estimate (must be <21 days at current traffic)
- Priority score (Impact × Confidence / Effort)
- Pre-defined stopping rules
- Owner agent (who executes)
- Implementation steps

See `.claude/skills/experiment-design/SKILL.md` for the full template.

## Statistical Standards

- Significance threshold: p<0.05 (two-sided)
- Power: 80%
- Confidence: 95%
- Pre-registration required (no mid-test changes)
- Stopping rules required (early-win or early-kill defined upfront)
- No HARK-ing (Hypothesizing After Results are Known) — primary metric chosen BEFORE launch

## What This Directory Is NOT

- Not a feature backlog (use product issue tracker)
- Not a creative ideas list (use marketing-and-sales/creative/)
- Not a marketing calendar (use marketing-and-sales/MARKETING-MASTER-PLAN.md)
- Only goes here if there's a measurable hypothesis being tested
