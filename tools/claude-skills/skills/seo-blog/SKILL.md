---
name: seo-blog
description: >
  Create SEO-optimized blog articles in Hinglish for RealtyFlow targeting
  Mumbai/Pune/Delhi real estate agents. Includes keyword research, editorial
  calendar, full article writing, and distribution assets. Use for any blog
  content or SEO strategy work.
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Grep
---

# SEO Blog Content — RealtyFlow

Create SEO blog content for RealtyFlow. Focus: $ARGUMENTS

## Keyword Categories

### High-Intent
"real estate CRM India", "best CRM for real estate agents", "property management software India"

### Informational
"how to manage real estate leads", "real estate agent tips India", "RERA compliance guide"

### Local
"real estate CRM Mumbai", "property management Pune", "real estate agency Delhi"

## Article Structure

```
H1: Primary keyword + Hinglish hook (60 chars max)
Meta Title: keyword + benefit (60 chars)
Meta Desc: keyword + Hinglish value (155 chars)
Word Count: 800-1200

Sections:
1. Intro (100-150 words) — Hinglish hook + problem + promise
2. H2: First point (include keyword)
3. H2: Second point
4. H2: Third point
5. H2: How RealtyFlow Solves This (soft sell)
6. Conclusion + CTA
```

## Hinglish Rules
- Headlines in Hinglish: "5 Galtiyan Jo Agents Ko Leads Cost Karti Hain"
- 70% English, 30% Hindi romanized
- Short paragraphs (3-4 lines max), heavy bullet lists
- Numbers: ₹, crore, lakh format
- Bold key Hinglish phrases

## On-Page SEO
- [ ] Primary keyword in H1, first 100 words, URL, meta title, meta description
- [ ] 2-3 secondary keywords used naturally
- [ ] Internal links to 2+ related articles
- [ ] Alt text on all images
- [ ] FAQ schema where applicable

## Output

Save to `marketing-and-sales/creative/blog/[slug].md`:
```markdown
# [Article Title]
## Metadata (keyword, word count, search vol)
## Full Article (Markdown with Hinglish)
## SEO Tags (title, description, schema)
## Distribution (LinkedIn snippet, IG carousel, email excerpt, WhatsApp msg)
```
