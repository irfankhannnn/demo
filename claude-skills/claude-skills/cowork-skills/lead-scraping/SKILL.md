---
name: Lead Scraping & Enrichment
description: Extract real estate agent leads from Google Maps, LinkedIn, and Instagram using SerpApi, PhantomBuster, and email enrichment. Includes data cleaning, lead scoring, phone validation, and CSV/JSON export for outreach campaigns targeting India and Dubai.
---

# Lead Scraping & Enrichment Skill

## Overview
This skill enables systematic lead scraping and enrichment for RealtyFlow's 3,000-agent outreach campaign. Covers Google Maps extraction (agencies, brokers, agents), LinkedIn scraping, website email collection, data cleaning, lead scoring, and export for Instantly.ai/outreach tools.

---

## SerpApi Google Maps API (Bash/cURL)

### 1. Basic Google Maps Search Query

```bash
#!/bin/bash

# SerpApi Google Maps Setup
API_KEY="your_serpapi_key"
BASE_URL="https://serpapi.com/search"

# Search parameters
QUERY="real estate agent"
LOCATION="Mumbai, India"
RADIUS="5000"  # meters
PAGE_NUM="1"

# Build URL
URL="${BASE_URL}?api_key=${API_KEY}&engine=google_maps&q=${QUERY}&location=${LOCATION}&radius=${RADIUS}&page=${PAGE_NUM}"

# Execute query
curl -s "$URL" | jq .

# Output: JSON with results including:
# - name, address, phone, website, rating, review count, type
```

### 2. City Coordinates Table (Pre-built for Common Cities)

```yaml
Cities Target List:

India:
  Mumbai:
    lat: 19.0760
    lng: 72.8777
    metro_area: "Greater Mumbai"
    population: 20.5M
    top_zones: ["Bandra", "Worli", "Andheri", "Mulund", "Navi Mumbai"]

  Bangalore:
    lat: 12.9716
    lng: 77.5946
    metro_area: "Bengaluru Urban"
    population: 8.4M
    top_zones: ["Whitefield", "Indiranagar", "Koramangala", "Marathahalli", "JP Nagar"]

  Delhi/NCR:
    lat: 28.7041
    lng: 77.1025
    metro_area: "National Capital Region"
    population: 30.9M
    top_zones: ["Gurgaon", "Noida", "Dwarka", "Greater Noida", "Faridabad"]

  Pune:
    lat: 18.5204
    lng: 73.8567
    metro_area: "Pune Metropolitan"
    population: 3.1M
    top_zones: ["Viman Nagar", "Baner", "Kharadi", "Hinjewadi", "Shivajinagar"]

  Hyderabad:
    lat: 17.3850
    lng: 78.4867
    metro_area: "Hyderabad Metropolitan"
    population: 6.8M
    top_zones: ["HITEC City", "Jubilee Hills", "Banjara Hills", "Secunderabad", "Miyapur"]

  Chennai:
    lat: 13.0827
    lng: 80.2707
    metro_area: "Chennai Metropolitan"
    population: 4.6M
    top_zones: ["Anna Nagar", "T Nagar", "Velachery", "Adyar", "Nungambakkam"]

Dubai:
  Dubai_City:
    lat: 25.2048
    lng: 55.2708
    metro_area: "Dubai Emirate"
    population: 3.6M
    top_zones: ["Downtown Dubai", "Marina", "JBR", "Deira", "Business Bay"]
```

### 3. SerpApi Pagination Script

```bash
#!/bin/bash

# Scrape multiple pages from Google Maps

API_KEY="your_serpapi_key"
QUERY="real estate agent"
LOCATION="Mumbai, India"
OUTPUT_FILE="leads_mumbai.jsonl"

# Pagination parameters
START_PAGE=1
MAX_PAGES=10  # SerpApi allows up to ~100 pages per query
RESULTS_PER_PAGE=20

# Clear output file
> "$OUTPUT_FILE"

for PAGE in $(seq $START_PAGE $MAX_PAGES); do
  echo "Fetching page $PAGE..."

  # Build URL with pagination
  URL="https://serpapi.com/search?api_key=${API_KEY}&engine=google_maps&q=${QUERY}&location=${LOCATION}&page=${PAGE}"

  # Fetch and parse
  RESPONSE=$(curl -s "$URL")

  # Check for results
  RESULTS_COUNT=$(echo "$RESPONSE" | jq '.place_results | length')

  if [ "$RESULTS_COUNT" -eq 0 ]; then
    echo "No results on page $PAGE. Stopping."
    break
  fi

  # Extract and save results (JSONL format: one JSON per line)
  echo "$RESPONSE" | jq -r '.place_results[] | @json' >> "$OUTPUT_FILE"

  echo "Saved $RESULTS_COUNT results from page $PAGE"

  # Rate limiting (SerpApi allows 100 requests/month on free, so space them out)
  sleep 2
done

echo "Scraping complete. Results saved to $OUTPUT_FILE"
```

### 4. SerpApi Response Parsing (Extract Key Fields)

```bash
#!/bin/bash

# Parse SerpApi Google Maps response and extract clean data

INPUT_FILE="leads_mumbai.jsonl"
OUTPUT_FILE="leads_clean.csv"

# CSV Header
echo "name,address,phone,website,rating,review_count,type,lat,lng,city,scraped_date" > "$OUTPUT_FILE"

# Parse each JSONL line
while IFS= read -r line; do
  NAME=$(echo "$line" | jq -r '.title // "N/A"' | sed 's/,/;/g')
  ADDRESS=$(echo "$line" | jq -r '.address // "N/A"' | sed 's/,/;/g')
  PHONE=$(echo "$line" | jq -r '.phone // "N/A"')
  WEBSITE=$(echo "$line" | jq -r '.website // "N/A"')
  RATING=$(echo "$line" | jq -r '.rating // "N/A"')
  REVIEW_COUNT=$(echo "$line" | jq -r '.review_count // 0')
  TYPE=$(echo "$line" | jq -r '.type // "N/A"')
  LAT=$(echo "$line" | jq -r '.coordinates.latitude // "N/A"')
  LNG=$(echo "$line" | jq -r '.coordinates.longitude // "N/A"')

  # Add to CSV
  echo "${NAME},${ADDRESS},${PHONE},${WEBSITE},${RATING},${REVIEW_COUNT},${TYPE},${LAT},${LNG},Mumbai,$(date +%Y-%m-%d)" >> "$OUTPUT_FILE"
done < "$INPUT_FILE"

echo "Clean CSV saved to $OUTPUT_FILE"
```

### 5. Batch Script: Scrape All Cities

```bash
#!/bin/bash

# Scrape all target cities in sequence

API_KEY="your_serpapi_key"
QUERY="real estate agent"
OUTPUT_DIR="./scraped_leads"
CITIES=("Mumbai" "Bangalore" "Delhi" "Pune" "Hyderabad" "Chennai" "Dubai")

mkdir -p "$OUTPUT_DIR"

for CITY in "${CITIES[@]}"; do
  echo "Starting scrape for $CITY..."

  OUTPUT_FILE="${OUTPUT_DIR}/${CITY}_leads.jsonl"
  > "$OUTPUT_FILE"

  for PAGE in {1..10}; do
    echo "  Page $PAGE..."

    URL="https://serpapi.com/search?api_key=${API_KEY}&engine=google_maps&q=${QUERY}&location=${CITY}&page=${PAGE}"
    RESPONSE=$(curl -s "$URL")
    RESULTS_COUNT=$(echo "$RESPONSE" | jq '.place_results | length')

    [ "$RESULTS_COUNT" -eq 0 ] && break

    echo "$RESPONSE" | jq -r '.place_results[] | @json' >> "$OUTPUT_FILE"
    sleep 1
  done

  echo "✓ $CITY complete. Results in ${OUTPUT_FILE}"
done

echo "All cities scraped!"
```

---

## Website Email Extraction

### 1. Basic Email Scraper (from website)

```bash
#!/bin/bash

# Extract emails from agent websites using curl + regex

WEBSITE_URL=$1
OUTPUT_FILE="emails_extracted.txt"

# Fetch HTML
HTML=$(curl -s "$WEBSITE_URL")

# Extract emails using regex (basic pattern)
EMAILS=$(echo "$HTML" | grep -oE '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')

# Save to file
echo "$EMAILS" >> "$OUTPUT_FILE"

echo "Extracted emails from $WEBSITE_URL:"
echo "$EMAILS"
```

### 2. Email Enrichment via Email-to-Name API

```bash
#!/bin/bash

# Enrich emails with person details (Hunter.io or RocketReach API)

API_KEY="your_hunter_io_key"
EMAIL=$1

# Call Hunter.io Email Finder
curl -s "https://api.hunter.io/v2/email-finder?domain=$(echo $EMAIL | cut -d '@' -f2)&api_key=${API_KEY}" | jq .

# Returns: First name, last name, phone, job title, company
```

### 3. LinkedIn URL Scraper (Manual + PhantomBuster)

```bash
#!/bin/bash

# Note: Full automation of LinkedIn requires PhantomBuster (paid automation platform)
# Free alternative: Manual search + Chrome extension

# Option A: Use PhantomBuster (recommended for scale)
# Dashboard: phantombuster.com
# Script: "LinkedIn Sales Navigator Scraper"
# Inputs: Search URL (e.g., "real estate agent Mumbai")
# Outputs: CSV with name, title, company, LinkedIn URL, email (if available)

# Option B: Manual export (if using PhantomBuster)
cat > phantombuster_config.json << 'EOF'
{
  "script": "LinkedIn Sales Navigator Scraper",
  "inputs": {
    "spreadsheetUrl": "",
    "linkedinUrl": "https://www.linkedin.com/search/results/people/?keywords=real%20estate%20agent&location=Mumbai%2C%20India",
    "numberOfScrapers": 1,
    "numberOfPages": 5
  },
  "outputs": [
    "name",
    "linkedinUrl",
    "headline",
    "company",
    "email",
    "phone"
  ]
}
EOF

# Run via phantombuster CLI (requires API key)
# phantombuster --script "LinkedIn Sales Navigator Scraper" --config phantombuster_config.json
```

### 4. Instagram Business Account Scraper (Alternative Channel)

```bash
#!/bin/bash

# Scrape real estate agency Instagram business accounts
# Note: Requires PhantomBuster's Instagram Account Scraper or similar

# Example: Search #realestateagent #mumbairealestate and get business profiles

# PhantomBuster setup:
cat > instagram_config.json << 'EOF'
{
  "script": "Instagram Hashtag Scraper",
  "inputs": {
    "hashtags": ["realestateagent", "mumbairealestate", "banglorerealestate"],
    "numberOfPosts": 100
  },
  "outputs": [
    "username",
    "bio",
    "email",
    "website",
    "followersCount"
  ]
}
EOF

# Manual alternative: Search hashtags, export business account names + websites,
# then cross-reference with phone/email databases
```

---

## Data Cleaning & Deduplication

### 1. Deduplicate & Clean CSV

```bash
#!/bin/bash

# Remove duplicates, standardize formatting, validate data

INPUT_FILE="leads_raw.csv"
OUTPUT_FILE="leads_deduplicated.csv"

# Remove duplicate rows (by phone number)
awk '!seen[$3]++' "$INPUT_FILE" | \
# Trim whitespace
sed 's/^[ \t]*//;s/[ \t]*$//' | \
# Remove rows with empty phone or website
awk -F ',' '$3 != "" && $4 != ""' | \
# Sort by city
sort -t ',' -k 10 > "$OUTPUT_FILE"

echo "Cleaned $INPUT_FILE → $OUTPUT_FILE"
```

### 2. Phone Number Standardization

```bash
#!/bin/bash

# Standardize phone numbers to +91 format (India) or +971 (Dubai)

INPUT_FILE="leads_raw.csv"
OUTPUT_FILE="leads_phone_clean.csv"

# Copy header
head -1 "$INPUT_FILE" > "$OUTPUT_FILE"

# Process phone numbers
tail -n +2 "$INPUT_FILE" | while IFS=',' read -r name address phone website rating reviews type lat lng city date; do
  # Remove spaces, dashes, parentheses
  CLEAN_PHONE=$(echo "$phone" | sed 's/[() -]//g')

  # Add country code if missing
  if [[ "$city" == "Dubai" ]]; then
    [[ ! "$CLEAN_PHONE" =~ ^\+?971 ]] && CLEAN_PHONE="+971${CLEAN_PHONE: -9}"
  else
    [[ ! "$CLEAN_PHONE" =~ ^\+?91 ]] && CLEAN_PHONE="+91${CLEAN_PHONE: -10}"
  fi

  # Write standardized row
  echo "${name},${address},${CLEAN_PHONE},${website},${rating},${reviews},${type},${lat},${lng},${city},${date}" >> "$OUTPUT_FILE"
done

echo "Phone standardization complete: $OUTPUT_FILE"
```

### 3. Remove Invalid Emails

```bash
#!/bin/bash

# Remove rows with invalid email format

INPUT_FILE="leads_with_emails.csv"
OUTPUT_FILE="leads_valid_emails.csv"

# Copy header
head -1 "$INPUT_FILE" > "$OUTPUT_FILE"

# Regex email validation
EMAIL_REGEX='^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

tail -n +2 "$INPUT_FILE" | while IFS=',' read -r name address phone website rating reviews type lat lng city email date; do
  if [[ "$email" =~ $EMAIL_REGEX ]]; then
    echo "${name},${address},${phone},${website},${rating},${reviews},${type},${lat},${lng},${city},${email},${date}" >> "$OUTPUT_FILE"
  fi
done

echo "Valid emails only: $OUTPUT_FILE"
```

---

## Lead Scoring Model

### Scoring Formula

```
Lead Score = (Email_Points) + (Phone_Points) + (Website_Points) + (Rating_Points) + (Activity_Points)

Points Assignment:
─────────────────

Email Available?
  Yes → +10 points
  No  → +0 points

Phone Available?
  Yes, validated → +10 points
  Yes, unvalidated → +5 points
  No → +0 points

Website Available?
  Yes → +5 points
  No → +0 points

Google Rating?
  4.5-5.0 stars → +10 points
  4.0-4.4 stars → +8 points
  3.5-3.9 stars → +5 points
  3.0-3.4 stars → +2 points
  Below 3.0 → +0 points

Review Count (Activity Signal)?
  50+ reviews → +10 points
  20-49 reviews → +8 points
  5-19 reviews → +5 points
  1-4 reviews → +2 points
  No reviews → +0 points

Agency Type?
  Established Agency (50+ reviews) → +5 points
  Solo Agent → +3 points
  Unknown → +0 points

─────────────────
Total Possible: 50 points

Scoring Tiers:
  40-50: HOT (priority outreach)
  25-39: WARM (nurture sequence)
  10-24: COLD (testing outreach)
  Below 10: FILTERED OUT (low potential)
```

### Node.js Implementation

```javascript
// lead-scorer.js

function scoreLeads(leads) {
  return leads.map(lead => {
    let score = 0;

    // Email points
    if (lead.email && isValidEmail(lead.email)) {
      score += 10;
    }

    // Phone points
    if (lead.phone) {
      score += isValidPhone(lead.phone) ? 10 : 5;
    }

    // Website points
    if (lead.website) {
      score += 5;
    }

    // Rating points
    const rating = parseFloat(lead.rating);
    if (rating >= 4.5) score += 10;
    else if (rating >= 4.0) score += 8;
    else if (rating >= 3.5) score += 5;
    else if (rating >= 3.0) score += 2;

    // Review activity points
    const reviews = parseInt(lead.review_count);
    if (reviews >= 50) score += 10;
    else if (reviews >= 20) score += 8;
    else if (reviews >= 5) score += 5;
    else if (reviews >= 1) score += 2;

    // Agency type bonus
    if (reviews >= 50) {
      score += 5; // Established
    } else if (reviews > 0) {
      score += 3; // Active solo
    }

    // Determine tier
    let tier = "FILTERED";
    if (score >= 40) tier = "HOT";
    else if (score >= 25) tier = "WARM";
    else if (score >= 10) tier = "COLD";

    return {
      ...lead,
      score,
      tier,
      scoredDate: new Date().toISOString()
    };
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 10;
}

module.exports = { scoreLeads };
```

---

## Phone Number Validation

### Validation Logic (India + Dubai)

```bash
#!/bin/bash

# Validate phone numbers for India (+91) and Dubai (+971)

validate_phone() {
  local phone=$1
  local country=$2

  # Remove non-digits
  local clean=$(echo "$phone" | grep -oE '[0-9]+')

  if [[ "$country" == "Dubai" ]]; then
    # Dubai: +971 + 9 digits (50/60/70 series)
    if [[ "$clean" =~ ^971[5-7][0-9]{8}$ ]]; then
      echo "VALID"
      return 0
    fi
  else
    # India: +91 + 10 digits (usually 6-9 starting)
    if [[ "$clean" =~ ^91[6-9][0-9]{9}$ ]]; then
      echo "VALID"
      return 0
    fi
  fi

  echo "INVALID"
  return 1
}

# Test
validate_phone "9876543210" "India"      # VALID (would be +919876543210)
validate_phone "+919876543210" "India"  # VALID
validate_phone "+971501234567" "Dubai"  # VALID
validate_phone "1234567890" "India"     # INVALID
```

### Node.js Phone Validation

```javascript
// phone-validator.js

function validatePhoneNumber(phone, country = "India") {
  const clean = phone.replace(/\D/g, '');

  if (country === "Dubai") {
    // Dubai: +971 + 9 digits (50-79 series)
    return /^971[5-7]\d{8}$/.test(clean);
  } else {
    // India: +91 + 10 digits (6-9 starting)
    return /^91[6-9]\d{9}$/.test(clean);
  }
}

function normalizePhoneNumber(phone, country = "India") {
  let clean = phone.replace(/\D/g, '');

  if (country === "Dubai") {
    if (!clean.startsWith('971')) {
      clean = '971' + clean.slice(-9); // Add country code
    }
    return '+' + clean;
  } else {
    if (!clean.startsWith('91')) {
      clean = '91' + clean.slice(-10); // Add country code
    }
    return '+' + clean;
  }
}

module.exports = { validatePhoneNumber, normalizePhoneNumber };
```

---

## CSV & JSON Export for Outreach Tools

### 1. Export to CSV (Instantly.ai Format)

```bash
#!/bin/bash

# Export scored leads to CSV for Instantly.ai email campaigns

INPUT_FILE="leads_scored.jsonl"
OUTPUT_FILE="instantly_ai_import.csv"

# Create header
echo "first_name,last_name,email,phone,website,company,lead_score,lead_tier,city,date_added" > "$OUTPUT_FILE"

# Parse JSONL and convert to CSV
jq -r '[.name, "", .email, .phone, .website, .name, .score, .tier, .city, .scraped_date] | @csv' "$INPUT_FILE" >> "$OUTPUT_FILE"

echo "Export complete: $OUTPUT_FILE ($(wc -l < $OUTPUT_FILE) rows)"
```

### 2. Export to JSON (API-Ready Format)

```bash
#!/bin/bash

# Export to JSON for programmatic use

INPUT_FILE="leads_deduplicated.csv"
OUTPUT_FILE="leads_export.json"

# Convert CSV to JSON
python3 << 'EOF'
import csv
import json

with open("$INPUT_FILE", 'r') as csv_file:
  csv_reader = csv.DictReader(csv_file)
  leads = list(csv_reader)

with open("$OUTPUT_FILE", 'w') as json_file:
  json.dump(leads, json_file, indent=2)

print(f"Exported {len(leads)} leads to $OUTPUT_FILE")
EOF
```

### 3. Split by Lead Tier (for Targeted Outreach)

```bash
#!/bin/bash

# Split leads into HOT/WARM/COLD files for different campaigns

INPUT_FILE="leads_scored.csv"

# Create subdirectories
mkdir -p hot warm cold

# Split by tier
awk -F ',' '$8 == "HOT" { print > "hot/leads.csv" }
           $8 == "WARM" { print > "warm/leads.csv" }
           $8 == "COLD" { print > "cold/leads.csv" }' "$INPUT_FILE"

echo "Split complete:"
echo "  HOT: $(wc -l < hot/leads.csv) leads"
echo "  WARM: $(wc -l < warm/leads.csv) leads"
echo "  COLD: $(wc -l < cold/leads.csv) leads"
```

---

## Node.js Excel Generation Script

### Generate Excel from Lead Data

```javascript
// generate-excel.js
// Requires: npm install exceljs

const ExcelJS = require('exceljs');
const fs = require('fs');

async function generateLeadExcel(jsonFile, outputFile) {
  // Read leads from JSON
  const leads = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

  // Create workbook
  const workbook = new ExcelJS.Workbook();

  // Worksheet 1: All leads
  const wsAll = workbook.addWorksheet('All Leads');

  // Headers
  wsAll.columns = [
    { header: 'First Name', key: 'first_name', width: 15 },
    { header: 'Last Name', key: 'last_name', width: 15 },
    { header: 'Company', key: 'company', width: 25 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Website', key: 'website', width: 25 },
    { header: 'City', key: 'city', width: 12 },
    { header: 'Rating', key: 'rating', width: 8 },
    { header: 'Reviews', key: 'review_count', width: 10 },
    { header: 'Lead Score', key: 'score', width: 10 },
    { header: 'Tier', key: 'tier', width: 8 }
  ];

  // Add rows
  leads.forEach(lead => {
    wsAll.addRow(lead);
  });

  // Format header row
  wsAll.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  wsAll.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };

  // Color code by tier
  leads.forEach((lead, idx) => {
    const row = wsAll.getRow(idx + 2);
    if (lead.tier === 'HOT') {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; // Red
    } else if (lead.tier === 'WARM') {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow
    }
  });

  // Worksheet 2: Summary stats
  const wsSummary = workbook.addWorksheet('Summary');

  const stats = {
    totalLeads: leads.length,
    hotLeads: leads.filter(l => l.tier === 'HOT').length,
    warmLeads: leads.filter(l => l.tier === 'WARM').length,
    coldLeads: leads.filter(l => l.tier === 'COLD').length,
    avgScore: (leads.reduce((sum, l) => sum + l.score, 0) / leads.length).toFixed(2),
    leadsWithEmail: leads.filter(l => l.email).length,
    leadsWithPhone: leads.filter(l => l.phone).length
  };

  wsSummary.columns = [
    { header: 'Metric', key: 'metric', width: 20 },
    { header: 'Value', key: 'value', width: 15 }
  ];

  Object.entries(stats).forEach(([key, value]) => {
    wsSummary.addRow({ metric: key, value });
  });

  // Save
  await workbook.xlsx.writeFile(outputFile);
  console.log(`✓ Excel generated: ${outputFile}`);
}

// Usage
generateLeadExcel('leads_scored.json', 'RealtyFlow_Leads.xlsx');
```

### Run:
```bash
npm install exceljs
node generate-excel.js
```

---

## PhantomBuster LinkedIn/Instagram Scraping Config

### LinkedIn Sales Navigator Config

```json
{
  "name": "LinkedIn Realtor Scraper",
  "platform": "phantombuster.com",
  "script": "LinkedIn Sales Navigator Scraper",
  "inputs": {
    "linkedinUrl": [
      "https://www.linkedin.com/search/results/people/?keywords=real%20estate%20agent&location=Mumbai",
      "https://www.linkedin.com/search/results/people/?keywords=real%20estate%20agent&location=Bangalore",
      "https://www.linkedin.com/search/results/people/?keywords=real%20estate%20broker&location=Delhi"
    ],
    "numberOfPage": 5,
    "numberOfScrapers": 4,
    "maxProfiles": 500,
    "resumable": true
  },
  "outputs": {
    "format": "csv",
    "fields": [
      "name",
      "linkedinUrl",
      "headline",
      "company",
      "location",
      "profileImageUrl"
    ]
  }
}
```

### Instagram Business Scraper Config

```json
{
  "name": "Instagram Real Estate Scraper",
  "platform": "phantombuster.com",
  "script": "Instagram Hashtag Scraper",
  "inputs": {
    "instagramHashtags": [
      "realestateagent",
      "mumbairealestate",
      "banglorerealestate",
      "delhirealestate",
      "dubaiproperties"
    ],
    "numberOfPosts": 100,
    "maxResults": 50
  },
  "outputs": {
    "format": "csv",
    "fields": [
      "username",
      "bio",
      "followerCount",
      "website",
      "email"
    ]
  }
}
```

---

## Complete Lead Generation Pipeline

### Step-by-Step Workflow

```bash
#!/bin/bash
# full-lead-pipeline.sh

echo "=== RealtyFlow Lead Generation Pipeline ==="

# Step 1: Scrape Google Maps
echo "Step 1: Scraping Google Maps..."
./scrape-google-maps.sh

# Step 2: Extract emails from websites
echo "Step 2: Extracting emails..."
./extract-emails.sh

# Step 3: Clean and deduplicate
echo "Step 3: Cleaning data..."
./clean-and-deduplicate.sh

# Step 4: Validate phone numbers
echo "Step 4: Validating phones..."
./validate-phones.sh

# Step 5: Score leads
echo "Step 5: Scoring leads..."
node lead-scorer.js

# Step 6: Export by tier
echo "Step 6: Splitting by tier..."
./split-by-tier.sh

# Step 7: Generate Excel report
echo "Step 7: Generating Excel..."
node generate-excel.js

# Step 8: Export to outreach tools
echo "Step 8: Exporting to Instantly.ai..."
./export-instantly.sh

echo "✓ Pipeline complete!"
echo "  - Total leads scored: $(wc -l < leads_scored.csv)"
echo "  - HOT leads: $(wc -l < hot/leads.csv)"
echo "  - Ready for outreach: hot/leads.csv"
```

---

## Output Files to Generate

1. `leads_raw.jsonl` — Raw Google Maps scrape results
2. `leads_deduplicated.csv` — Cleaned, deduplicated leads
3. `leads_phone_clean.csv` — Phone-validated leads
4. `leads_scored.csv` — Scored with tier assignment
5. `leads_scored.json` — JSON format for API use
6. `instantly_ai_import.csv` — Ready for Instantly.ai
7. `RealtyFlow_Leads.xlsx` — Excel report with summary
8. `hot/leads.csv` — HOT tier (priority outreach)
9. `warm/leads.csv` — WARM tier (nurture)
10. `cold/leads.csv` — COLD tier (testing)

---

## API Keys & Setup Required

```bash
# .env file for lead scraping

# SerpApi (Google Maps)
SERPAPI_KEY="your_key_here"
SERPAPI_RATE_LIMIT=100  # requests per month on free

# Hunter.io (Email enrichment)
HUNTER_IO_KEY="your_key_here"
HUNTER_IO_DOMAIN_SEARCH_LIMIT=50

# PhantomBuster (LinkedIn/Instagram)
PHANTOMBUSTER_API_KEY="your_key_here"

# RocketReach (Phone/email validation)
ROCKETREACH_KEY="your_key_here"

# Output directories
LEAD_OUTPUT_DIR="./leads"
EXCEL_OUTPUT="RealtyFlow_Leads.xlsx"
```

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **Leads per City** | 500-1000 | Across 7 cities = 3,500-7,000 raw |
| **Data Quality (Email/Phone)** | 60%+ | Both fields populated |
| **Lead Score Avg** | 25-35 | Out of 50 possible |
| **HOT Leads %** | 15-20% | Score 40+ |
| **WARM Leads %** | 35-45% | Score 25-39 |
| **Phone Validation Rate** | 90%+ | Standardized format |
| **Deduplication Rate** | 10-15% | Removed duplicates |
| **Time to Generate 3K Leads** | 2-3 weeks | SerpApi + PhantomBuster |

---

## Usage Instructions

1. **Set up API keys** → Update `.env` file
2. **Run scraping pipeline** → `./full-lead-pipeline.sh`
3. **Review Excel report** → `RealtyFlow_Leads.xlsx`
4. **Export HOT tier** → `hot/leads.csv` to Instantly.ai
5. **Monitor quality** → Check email/phone validation rates
6. **Iterate** → Adjust scoring tiers based on conversion data

All leads are ready for multi-channel outreach via the **Multi-Channel Outreach** skill.
