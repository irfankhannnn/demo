---
name: serpapi-scraping
description: >
  Scrape local business data from Google Maps via SerpApi, extract contact info
  using Browserbase/PhantomBuster, and compile lead databases in Excel format.
  Supports city-variable queries for real estate agencies in Mumbai, Pune, Delhi,
  Bangalore, and Dubai. Use for lead list building and local data scraping.
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Grep
---

# Local Agency Data Scraping — RealtyFlow

Scrape and compile real estate agency contact data. Focus: $ARGUMENTS

## Step 1: Google Maps Scraping via SerpApi

### API Call
```bash
curl -s "https://serpapi.com/search.json?engine=google_maps&q=[CITY]+real+estate+agency&ll=@[LAT],[LNG],14z&type=search&api_key=${SERPAPI_API_KEY}" | jq '.local_results[] | {
  name: .title,
  address: .address,
  phone: .phone,
  website: .website,
  rating: .rating,
  reviews: .reviews,
  gps_coordinates: .gps_coordinates,
  place_id: .place_id
}'
```

### City Coordinates
| City | Query | Latitude | Longitude |
|------|-------|----------|-----------|
| Mumbai | "Mumbai real estate agency" | 19.0760 | 72.8777 |
| Pune | "Pune real estate agency" | 18.5204 | 73.8567 |
| Delhi NCR | "Delhi real estate agency" | 28.6139 | 77.2090 |
| Bangalore | "Bangalore real estate agency" | 12.9716 | 77.5946 |
| Dubai | "Dubai real estate agency" | 25.2048 | 55.2708 |

### Pagination (get all results)
```bash
# SerpApi returns ~20 results per page. Use 'start' parameter to paginate.
for START in 0 20 40 60 80; do
  curl -s "https://serpapi.com/search.json?engine=google_maps&q=${CITY}+real+estate+agency&start=${START}&api_key=${SERPAPI_API_KEY}"
done
```

## Step 2: Website & Social Media Extraction

### Option A: Browserbase (Headless Browser)
```bash
# Use Browserbase MCP or API to visit each website and extract contact info
curl -X POST "https://api.browserbase.com/v1/sessions" \
  -H "Authorization: Bearer ${BROWSERBASE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "${BROWSERBASE_PROJECT_ID}",
    "browserSettings": { "blockAds": true }
  }'

# Then navigate to each website and extract:
# - Email addresses (regex: [\w.-]+@[\w.-]+\.\w+)
# - Phone numbers
# - Social media links (Instagram, Facebook, LinkedIn)
# - Team/About page contacts
```

### Option B: PhantomBuster Flows
```json
{
  "flow": "Google Maps Search to Contact Data",
  "input": {
    "searchQuery": "[CITY] real estate agency",
    "numberOfResults": 100,
    "extractEmails": true,
    "extractSocialMedia": true
  },
  "output": "leads-[city].csv"
}
```

### PhantomBuster Instagram Scraper
```json
{
  "phantom": "Instagram Profile Scraper",
  "input": {
    "profileUrls": ["list of Instagram URLs from step 1"],
    "extractFollowers": true,
    "extractBio": true,
    "extractContactInfo": true
  }
}
```

### PhantomBuster Facebook Page Scraper
```json
{
  "phantom": "Facebook Page Scraper",
  "input": {
    "pageUrls": ["list of Facebook URLs from step 1"],
    "extractAbout": true,
    "extractContactInfo": true
  }
}
```

## Step 3: Data Aggregation & Excel Export

### Lead Schema
```
Agency Name | Contact Person | Email | Phone | Website | City | State |
Address | Google Rating | Reviews Count | Instagram | Facebook | LinkedIn |
RERA Number | Active Projects | Team Size | Source | Scraped Date
```

### PowerShell Excel Generation
```powershell
# Use the serpapi-scrape.ps1 script
.\claude-skills\scripts\serpapi-scrape.ps1 -City "Mumbai" -Output "leads-mumbai.xlsx"
.\claude-skills\scripts\serpapi-scrape.ps1 -City "Pune" -Output "leads-pune.xlsx"
```

### Node.js Excel Generation (using xlsx package)
```javascript
const XLSX = require('xlsx');

function exportToExcel(leads, filename) {
  const ws = XLSX.utils.json_to_sheet(leads);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  XLSX.writeFile(wb, filename);
}
```

## Step 4: Data Cleaning
- Deduplicate by phone number and email
- Validate phone format (+91 for India, +971 for Dubai)
- Flag missing emails for manual lookup
- Standardize city names and addresses
- Remove obviously non-real-estate businesses

## Environment Variables Required
- `SERPAPI_API_KEY` — SerpApi key (https://serpapi.com/manage-api-key)
- `BROWSERBASE_API_KEY` — Browserbase API key (https://browserbase.com)
- `BROWSERBASE_PROJECT_ID` — Browserbase project ID
- `PHANTOMBUSTER_API_KEY` — PhantomBuster API key (https://phantombuster.com)

## Output

Save to `marketing-and-sales/leads/`:
- `leads-[city].xlsx` — Excel file per city
- `leads-all.xlsx` — Merged file with all cities
- `scrape-log-[date].md` — Log of scraping session
