# serpapi-scrape.ps1
# Scrape real estate agency data from Google Maps via SerpApi
# Usage: .\serpapi-scrape.ps1 -City "Mumbai" -Output "leads-mumbai.json"
# Usage: .\serpapi-scrape.ps1 -City "Pune" -MaxPages 5 -Output "leads-pune.json"
# Usage: .\serpapi-scrape.ps1 -City "all" -Output "leads-all.json"

param(
    [Parameter(Mandatory=$true)]
    [string]$City,                         # City name or "all" for all cities

    [string]$Output = "leads.json",        # Output file path
    [int]$MaxPages = 5,                    # Max pages to scrape (20 results/page)
    [string]$Query = "real estate agency", # Search query suffix
    [switch]$IncludeSocial,                # Also try to extract social media URLs
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$apiKey = $env:SERPAPI_API_KEY
if (-not $apiKey) {
    Write-Error "SERPAPI_API_KEY environment variable not set. Get one at https://serpapi.com/manage-api-key"
    exit 1
}

# City configurations with coordinates
$cities = @{
    "Mumbai"    = @{ lat = "19.0760"; lng = "72.8777"; state = "Maharashtra" }
    "Pune"      = @{ lat = "18.5204"; lng = "73.8567"; state = "Maharashtra" }
    "Delhi"     = @{ lat = "28.6139"; lng = "77.2090"; state = "Delhi NCR" }
    "Bangalore" = @{ lat = "12.9716"; lng = "77.5946"; state = "Karnataka" }
    "Hyderabad" = @{ lat = "17.3850"; lng = "78.4867"; state = "Telangana" }
    "Chennai"   = @{ lat = "13.0827"; lng = "80.2707"; state = "Tamil Nadu" }
    "Kolkata"   = @{ lat = "22.5726"; lng = "88.3639"; state = "West Bengal" }
    "Dubai"     = @{ lat = "25.2048"; lng = "55.2708"; state = "Dubai" }
}

function Invoke-SerpApiSearch {
    param([string]$CityName, [hashtable]$CityConfig)

    $allResults = @()
    $searchQuery = "$CityName $Query"

    Write-Host "`nScraping: $searchQuery"
    Write-Host "  Coordinates: $($CityConfig.lat), $($CityConfig.lng)"

    for ($page = 0; $page -lt $MaxPages; $page++) {
        $start = $page * 20
        $url = "https://serpapi.com/search.json?engine=google_maps&q=$([uri]::EscapeDataString($searchQuery))&ll=@$($CityConfig.lat),$($CityConfig.lng),14z&type=search&start=$start&api_key=$apiKey"

        if ($DryRun) {
            Write-Host "  DRY RUN — Page $($page + 1): $url"
            continue
        }

        Write-Host "  Page $($page + 1)/$MaxPages (start=$start)..."

        try {
            $response = Invoke-RestMethod -Uri $url -Method Get
            $results = $response.local_results

            if (-not $results -or $results.Count -eq 0) {
                Write-Host "  No more results at page $($page + 1)"
                break
            }

            foreach ($result in $results) {
                $lead = @{
                    agency_name    = $result.title
                    phone          = $result.phone
                    address        = $result.address
                    website        = $result.website
                    rating         = $result.rating
                    reviews_count  = $result.reviews
                    latitude       = $result.gps_coordinates.latitude
                    longitude      = $result.gps_coordinates.longitude
                    place_id       = $result.place_id
                    city           = $CityName
                    state          = $CityConfig.state
                    source         = "google_maps_serpapi"
                    scraped_date   = (Get-Date -Format "yyyy-MM-dd")
                    instagram      = ""
                    facebook       = ""
                    linkedin       = ""
                    email          = ""
                    contact_person = ""
                }
                $allResults += $lead
            }

            Write-Host "    Found $($results.Count) results (total: $($allResults.Count))"

            # Rate limit: 1 request per second
            Start-Sleep -Seconds 1

        } catch {
            Write-Warning "  Error on page $($page + 1): $_"
            break
        }
    }

    return $allResults
}

# Determine which cities to scrape
$targetCities = @{}
if ($City -eq "all") {
    $targetCities = $cities
} else {
    if ($cities.ContainsKey($City)) {
        $targetCities[$City] = $cities[$City]
    } else {
        Write-Error "Unknown city: $City. Available: $($cities.Keys -join ', ')"
        exit 1
    }
}

# Scrape all target cities
$allLeads = @()
foreach ($cityName in $targetCities.Keys) {
    $cityLeads = Invoke-SerpApiSearch -CityName $cityName -CityConfig $targetCities[$cityName]
    $allLeads += $cityLeads
}

if ($DryRun) {
    Write-Host "`nDRY RUN complete. Would scrape $($targetCities.Count) cities, up to $($MaxPages * 20 * $targetCities.Count) results."
    return
}

# Ensure output directory exists
$outputDir = Split-Path -Parent $Output
if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Save results
$allLeads | ConvertTo-Json -Depth 5 | Set-Content -Path $Output -Encoding UTF8

Write-Host "`n========================================="
Write-Host "Scraping Complete!"
Write-Host "  Cities scraped: $($targetCities.Count)"
Write-Host "  Total leads found: $($allLeads.Count)"
Write-Host "  Output: $Output"
Write-Host "========================================="

# Print summary per city
$allLeads | Group-Object -Property city | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count) leads"
}
