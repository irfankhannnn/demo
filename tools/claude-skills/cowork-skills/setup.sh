#!/bin/bash
# RealtyFlow Marketing System — Cowork Setup Script
# Installs skills into the Cowork skill discovery directories
# Run: bash cowork-skills/setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_SKILLS_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)/.claude/skills"  # tools/claude-skills/cowork-skills -> repo root

echo "=== RealtyFlow Marketing System — Cowork Setup ==="
echo ""

# Install to .claude/skills (writable user skill directory)
for DEST_DIR in "$CLAUDE_SKILLS_DIR"; do
    echo "Installing to: $DEST_DIR"

    SKILLS=(
        "brand-strategy"
        "landing-page"
        "seo-blog"
        "image-generation"
        "video-production"
        "ugc-scripts"
        "voiceover-gen"
        "meta-ads"
        "outreach"
        "lead-scraping"
        "pipeline-tracker"
        "market-research"
        "marketing-orchestrator"
    )

    for SKILL in "${SKILLS[@]}"; do
        SOURCE="$SCRIPT_DIR/$SKILL/SKILL.md"
        DEST="$DEST_DIR/$SKILL"

        if [ -f "$SOURCE" ]; then
            mkdir -p "$DEST"
            cp "$SOURCE" "$DEST/SKILL.md"
            echo "  [+] $SKILL"
        else
            echo "  [!] Missing: $SOURCE"
        fi
    done
    echo ""
done

# Copy scripts
SCRIPT_DEST="$SCRIPT_DIR/scripts"
echo "Scripts available at: $SCRIPT_DEST/"
ls -la "$SCRIPT_DEST/"*.sh 2>/dev/null | awk '{print "  " $NF}'

# Create output directories
OUTPUT_BASE="$(dirname "$SCRIPT_DIR")/marketing-outputs"
DIRS=(brand landing-pages blog images videos audio outreach leads pipeline ads research)
echo ""
echo "Creating output directories at: $OUTPUT_BASE/"
for DIR in "${DIRS[@]}"; do
    mkdir -p "$OUTPUT_BASE/$DIR"
    echo "  [+] $DIR/"
done

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Your 13 marketing skills are now installed and ready."
echo ""
echo "To use in Claude Cowork, just describe what you need:"
echo "  'Create a brand manifesto for RealtyFlow Mumbai launch'"
echo "  'Build a landing page for lead generation'"
echo "  'Write an SEO blog article about real estate CRM'"
echo "  'Set up a Meta Ads campaign for Mumbai'"
echo "  'Scrape real estate agencies from Google Maps'"
echo "  'Plan a full city launch campaign'"
echo ""
echo "See USAGE-GUIDE.md for complete instructions."
