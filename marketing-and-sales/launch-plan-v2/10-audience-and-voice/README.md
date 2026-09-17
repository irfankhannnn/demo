# Layer 10 — Audience and voice

> **Status (17 Sep 2026):** Layer index. Who we sell to, what is true about the product, how we sound, and what we are allowed to claim. Everything else in the playbook cites this layer rather than restating it.

This is the first of six reference layers. The next one, `20-content-engine/`, tells you how a piece of content gets made; this one tells you what it is allowed to say and to whom.

---

## The five files

| File | Answers | Read it when |
|---|---|---|
| `product-truth.md` | What the product actually does, with a repo path for every claim | Before writing any feature line. It is the SSOT the rest of the playbook traces to. |
| `claims-and-proof-policy.md` | What we may and may not assert, and the six-item pre-publish check | Before publishing anything, without exception |
| `brand-constants.md` | Name, domain, handle, colours, fonts, language splits, city scope, pricing pointer | Whenever you are about to type a hex value, a handle, a price or a city |
| `icp-and-personas.md` | Who the buyer is, and what wins or loses their attention on each surface | Before choosing a hook, a format or a channel |
| `market-research.md` | The underlying June 2026 desk research on the Mumbai broker market | When you need background, not when you need a fact to publish |
| `language-and-tone.md` | The language mix, register, vocabulary and the phrase bank | When writing copy, captions or scripts |

Positioning itself lives at `marketing-and-sales/realestateflow/BRAND-POSITIONING.md` and is not restated here.

---

## The three rules this layer exists to enforce

1. **Pre-launch means zero customers.** No testimonials, no case studies, no agency counts, no adoption or retention numbers. Product screen recordings and build-in-public notes are the proof we have. (`claims-and-proof-policy.md`)
2. **Never assert a loss figure — make the viewer produce their own.** An asserted "₹20 lakh a year" is the most exposed claim in the set and converts worse than a question they answer themselves.
3. **The founder is never on camera.** Video is fronted by the AI presenter, which may never present itself as a broker, an owner, a customer or the founder. The founder in text, in LinkedIn posts and in voice-over is fine.

---

## Open decisions that hang off this layer

- **D24** — language mix and whether any Pune or Marathi content ships in M1. Three splits are written down at three scopes; none is wrong, and none has been chosen. `brand-constants.md` §3, `language-and-tone.md`, `icp-and-personas.md` §1.
- **D26** — which AI features marketing may show today. Several features are built but are not on the approved-claims list. `claims-and-proof-policy.md` §4.
- **D25** — whether the nine-character cast survives. It affects who speaks, so it touches the personas here, but it is owned by `20-content-engine/cast-and-presenter.md`.

All of them are described in `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`. Do not resolve one by writing a doc as if it were settled.

---

## Where this layer is used

`20-content-engine/` draws hooks, frameworks and prompts from it · `30-channels/` takes the per-surface attention rules from `icp-and-personas.md` · `40-sales-and-conversion/` takes the objection vocabulary from `language-and-tone.md` and the feature truth from `product-truth.md` · every week-folder day file that produces a public artefact runs the `claims-and-proof-policy.md` checklist before it ships.
