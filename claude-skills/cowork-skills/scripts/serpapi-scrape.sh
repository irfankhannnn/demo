#!/bin/bash
# RealtyFlow — Google Maps Lead Scraping via SerpApi
# Scrapes real estate agencies from Google Maps
# Usage: ./serpapi-scrape.sh -c "Mumbai" -q "real estate agency" -o "leads.json"
# Usage: ./serpapi-scrape.sh --all-cities -o "all-leads.json"

set -euo pipefail

# Defaults
CITY=""
QUERY="real estate agency"
OUTPUT="leads.json"
MAX_PAGES=3
ALL_CITIES=false
RATE_LIMIT=2  # seconds between requests

# City coordinates
declare -A CITY_LAT CITY_LNG
CITY_LAT[Mumbai]=19.0760;    CITY_LNG[Mumbai]=72.8777
CITY_LAT[Pune]=18.5204;      CITY_LNG[Pune]=73.8567
CITY_LAT[Delhi]=28.6139;     CITY_LNG[Delhi]=77.2090
CITY_LAT[Bangalore]=12.9716; CITY_LNG[Bangalore]=77.5946
CITY_LAT[Hyderabad]=17.3850; CITY_LNG[Hyderabad]=78.4867
CITY_LAT[Chennai]=13.0827;   CITY_LNG[Chennai]=80.2707
CITY_LAT[Kolkata]=22.5726;   CITY_LNG[Kolkata]=88.3639
CITY_LAT[Ahmedabad]=23.0225; CITY_LNG[Ahmedabad]=72.5714
CITY_LAT[Jaipur]=26.9124;    CITY_LNG[Jaipur]=75.7873
CITY_LAT[Goa]=15.2993;       CITY_LNG[Goa]=74.1240
CITY_LAT[Dubai]=25.2048;     CITY_LNG[Dubai]=55.2708

usage() {
    echo "Usage: $0 [options]"
    echo "  -c  City name (required unless --all-cities)"
    echo "  -q  Search query (default: 'real estate agency')"
    echo "  -o  Output JSON file (default: leads.json)"
    echo "  -m  Max pages per city, ~20 results/page (default: 3)"
    echo "  --all-cities  Scrape all Indian cities + Dubai"
    echo ""
    echo "Available cities: Mumbai, Pune, Delhi, Bangalore, Hyderabad, Chennai, Kolkata, Ahmedabad, Jaipur, Goa, Dubai"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -c) CITY="$2"; shift 2 ;;
        -q) QUERY="$2"; shift 2 ;;
        -o) OUTPUT="$2"; shift 2 ;;
        -m) MAX_PAGES="$2"; shift 2 ;;
        --all-cities) ALL_CITIES=true; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

if [ -z "${SERPAPI_API_KEY:-}" ]; then
    echo "Error: SERPAPI_API_KEY environment variable not set"
    exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

scrape_city() {
    local city="$1"
    local lat="${CITY_LAT[$city]:-}"
    local lng="${CITY_LNG[$city]:-}"

    if [ -z "$lat" ]; then
        echo "Error: Unknown city '$city'"
        echo "Available: ${!CITY_LAT[*]}"
        return 1
    fi

    echo "Scraping: $city ($QUERY) — up to $MAX_PAGES pages..."
    local results="[]"
    local page=0

    while [ $page -lt $MAX_PAGES ]; do
        local start=$((page * 20))
        echo "  Page $((page + 1))/$MAX_PAGES (offset: $start)..."

        local response
        response=$(curl -s "https://serpapi.com/search.json" \
          --data-urlencode "engine=google_maps" \
          --data-urlencode "q=${city} ${QUERY}" \
          --data-urlencode "ll=@${lat},${lng},14z" \
          --data-urlencode "type=search" \
          --data-urlencode "start=${start}" \
          --data-urlencode "api_key=${SERPAPI_API_KEY}")

        # Extract local results
        local page_results
        page_results=$(echo "$response" | jq '[.local_results[]? | {
          name: .title,
          address: .address,
          phone: .phone,
          website: .website,
          rating: .rating,
          reviews: .reviews,
          place_id: .place_id,
          gps_lat: .gps_coordinates.latitude,
          gps_lng: .gps_coordinates.longitude,
          city: "'"$city"'",
          query: "'"$QUERY"'",
          scraped_at: (now | todate)
        }]' 2>/dev/null || echo "[]")

        local count
        count=$(echo "$page_results" | jq 'length')

        if [ "$count" -eq 0 ]; then
            echo "  No more results. Stopping."
            break
        fi

        echo "  Found $count results"
        results=$(echo "$results" "$page_results" | jq -s '.[0] + .[1]')

        page=$((page + 1))
        sleep "$RATE_LIMIT"
    done

    local total
    total=$(echo "$results" | jq 'length')
    echo "  Total for $city: $total leads"
    echo "$results"
}

# Main execution
if [ "$ALL_CITIES" = true ]; then
    echo "=== Scraping all cities ==="
    ALL_RESULTS="[]"

    for city in Mumbai Pune Delhi Bangalore Hyderabad Chennai Kolkata Ahmedabad Jaipur Goa Dubai; do
        CITY_RESULTS=$(scrape_city "$city")
        ALL_RESULTS=$(echo "$ALL_RESULTS" "$CITY_RESULTS" | jq -s '.[0] + .[1]')
        echo ""
    done

    echo "$ALL_RESULTS" | jq '.' > "$OUTPUT"
    TOTAL=$(echo "$ALL_RESULTS" | jq 'length')
    echo "=== Complete: $TOTAL total leads saved to $OUTPUT ==="

elif [ -n "$CITY" ]; then
    CITY_RESULTS=$(scrape_city "$CITY")
    echo "$CITY_RESULTS" | jq '.' > "$OUTPUT"
    TOTAL=$(echo "$CITY_RESULTS" | jq 'length')
    echo "=== Complete: $TOTAL leads saved to $OUTPUT ==="

else
    echo "Error: Specify a city with -c or use --all-cities"
    usage
fi
