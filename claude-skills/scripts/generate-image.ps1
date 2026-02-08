# generate-image.ps1
# Generate images via OpenAI DALL-E 3 or Google Gemini Imagen API
# Usage: .\generate-image.ps1 -Provider "openai" -Prompt "your prompt" -Size "1024x1024" -Output "output.png"
# Usage: .\generate-image.ps1 -Provider "gemini" -Prompt "your prompt" -AspectRatio "1:1" -Output "output.png"

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("openai", "gemini")]
    [string]$Provider,

    [Parameter(Mandatory=$true)]
    [string]$Prompt,

    [string]$Size = "1024x1024",          # For OpenAI: 1024x1024, 1792x1024, 1024x1792
    [string]$AspectRatio = "1:1",          # For Gemini: 1:1, 3:4, 4:3, 9:16, 16:9
    [string]$Quality = "hd",              # For OpenAI: standard, hd
    [string]$Style = "natural",           # For OpenAI: natural, vivid
    [string]$Output = "generated-image.png",
    [switch]$DryRun                        # Print the API call without executing
)

$ErrorActionPreference = "Stop"

function Generate-OpenAI {
    $apiKey = $env:OPENAI_API_KEY
    if (-not $apiKey) {
        Write-Error "OPENAI_API_KEY environment variable not set. Get one at https://platform.openai.com/api-keys"
        exit 1
    }

    $body = @{
        model = "dall-e-3"
        prompt = $Prompt
        n = 1
        size = $Size
        quality = $Quality
        style = $Style
    } | ConvertTo-Json

    if ($DryRun) {
        Write-Host "DRY RUN — OpenAI DALL-E 3 API call:"
        Write-Host $body
        return
    }

    Write-Host "Generating image via OpenAI DALL-E 3..."
    Write-Host "  Prompt: $Prompt"
    Write-Host "  Size: $Size | Quality: $Quality | Style: $Style"

    $response = Invoke-RestMethod -Uri "https://api.openai.com/v1/images/generations" `
        -Method Post `
        -Headers @{ "Authorization" = "Bearer $apiKey"; "Content-Type" = "application/json" } `
        -Body $body

    $imageUrl = $response.data[0].url
    $revisedPrompt = $response.data[0].revised_prompt

    Write-Host "  Revised prompt: $revisedPrompt"
    Write-Host "  Downloading image..."

    Invoke-WebRequest -Uri $imageUrl -OutFile $Output
    Write-Host "  Saved to: $Output"
}

function Generate-Gemini {
    $apiKey = $env:GOOGLE_AI_API_KEY
    if (-not $apiKey) {
        Write-Error "GOOGLE_AI_API_KEY environment variable not set. Get one at https://aistudio.google.com/apikey"
        exit 1
    }

    $body = @{
        instances = @(@{ prompt = $Prompt })
        parameters = @{
            sampleCount = 1
            aspectRatio = $AspectRatio
            safetyFilterLevel = "block_few"
        }
    } | ConvertTo-Json -Depth 4

    if ($DryRun) {
        Write-Host "DRY RUN — Gemini Imagen API call:"
        Write-Host $body
        return
    }

    Write-Host "Generating image via Google Gemini Imagen..."
    Write-Host "  Prompt: $Prompt"
    Write-Host "  Aspect Ratio: $AspectRatio"

    $url = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=$apiKey"

    $response = Invoke-RestMethod -Uri $url `
        -Method Post `
        -Headers @{ "Content-Type" = "application/json" } `
        -Body $body

    $base64Image = $response.predictions[0].bytesBase64Encoded
    [System.IO.File]::WriteAllBytes($Output, [System.Convert]::FromBase64String($base64Image))
    Write-Host "  Saved to: $Output"
}

# Ensure output directory exists
$outputDir = Split-Path -Parent $Output
if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

switch ($Provider) {
    "openai" { Generate-OpenAI }
    "gemini" { Generate-Gemini }
}

Write-Host "`nDone! Image saved to: $Output"
