---
version: alpha
name: Cloudberry Solutions — Frame (video / frame layer)
description: >
  Brand tokens scraped live from cloudberrysolutions.in (2026-08-31): dark tech/AI
  canvas, a single saturated cloud-blue (#0077C8) as the only accent, thin-line
  icon motif (cloud/shield/bot/cpu), animated gradient-orb + grid-overlay hero
  texture, checkmark bullet lists, card-based service grid. Applied here to an
  unrelated talking-head clip as a deliberate capability test, not a real
  campaign for Cloudberry's own business.
unit: the frame — 1920x1080 primary (16:9)
principle: atoms are sacred · composition is free · numbers come from the transcript

colors:
  bg: "#0a0e14"
  bg-elevated: "#10151d"
  primary: "#0077C8"
  primary-glow: "rgba(0,119,200,0.35)"
  text: "#f5f7fa"
  text-muted: "#a7b0bd"
  border: "rgba(0,119,200,0.25)"
  card-bg: "rgba(0,119,200,0.08)"
  positive: "#22c55e"
  grid-line: "rgba(0,119,200,0.10)"

radii:
  card-lg: "16px"
  card-sm: "10px"
  pill: "100px"

typography:
  # register split: Montserrat for the human voice (statements), JetBrains Mono for data/labels — echoes the source site's dev/tech identity
  body:      { fontFamily: "Montserrat", cqw: 0.95, weight: 400, lineHeight: 1.5, color: "text-muted" }
  caption:   { fontFamily: "Montserrat", cqw: 1.6, weight: 700, lineHeight: 1.25, color: "text" }
  h1:        { fontFamily: "Montserrat", cqw: 4.0, weight: 900, lineHeight: 1.05, tracking: "-0.02em", color: "text" }
  stat-num:  { fontFamily: "JetBrains Mono", cqw: 3.4, weight: 700, lineHeight: 1.0, color: "primary" }
  stat-label:{ fontFamily: "JetBrains Mono", cqw: 0.85, weight: 400, tracking: "0.08em", upper: true, color: "text-muted" }
  eyebrow:   { fontFamily: "JetBrains Mono", px: 14, weight: 700, tracking: "0.12em", upper: true, color: "primary" }

spacing:
  pad-x: "6cqw"
  pad-y: "6cqw"
  gap-cards: "1.6cqw"

components:
  stat-card:
    backgroundColor: "{colors.card-bg}"
    border: "1.5px solid {colors.border}"
    rounded: "{radii.card-lg}"
    shadow: "0 0 40px {colors.primary-glow}"
    typography: "{typography.stat-num} + {typography.stat-label}"
    description: "Used for the 12,000-products / 6-figures count-up moment."
  caption-bar:
    backgroundColor: "rgba(10,14,20,0.72)"
    border: "none"
    rounded: "{radii.pill}"
    typography: "{typography.caption}"
    description: "Bottom-anchored animated subtitle bar, word-by-word reveal synced to transcript.json timestamps."
  grid-overlay:
    description: "Faint blue grid lines (colors.grid-line) across the full canvas, very slow drift — echoes the source site's hero grid-overlay div."
  orb-glow:
    description: "1-2 large soft radial blurs in primary-glow, slow breathing scale (6-10s loop) — echoes the source site's animated hero orbs."

## Overview

Dark tech/SaaS register borrowed directly from cloudberrysolutions.in's live
hero (animated gradient orbs + grid overlay over near-black). One accent hue
only (#0077C8). No gradient text, no left-edge accent stripes, no generic
purple/cyan neon — the source site itself is disciplined (one blue, thin-line
icons, checkmark lists), so the frame stays disciplined too.

## Do's

- Keep bg pure near-black-blue (#0a0e14) across every scene — no per-scene palette drift.
- Stats (12,000 / 6-figures) render in JetBrains Mono to read as "data," never as decorative type.
- Every decorative element (orb glow, grid) gets slow ambient motion — never static.

## Don'ts

- Do not introduce a second accent hue.
- Do not use pure #000 or pure #fff — always the tinted bg/text values above.
- Do not imply this is a real Cloudberry Solutions campaign — it's a style borrow for an unrelated clip.
