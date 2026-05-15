# elevenlabs-tts.ps1
# Generate voiceover audio via ElevenLabs Text-to-Speech API
# Usage: .\elevenlabs-tts.ps1 -Text "Hello world" -VoiceId "voice-id" -Output "output.mp3"
# Usage: .\elevenlabs-tts.ps1 -TextFile "script.txt" -Preset "ugc_casual" -Output "voiceover.mp3"
# Usage: .\elevenlabs-tts.ps1 -ListVoices

param(
    [string]$Text,                         # Direct text input
    [string]$TextFile,                     # Read text from file
    [string]$VoiceId,                      # ElevenLabs voice ID
    [string]$Output = "voiceover.mp3",     # Output file path

    [ValidateSet("product_demo", "ad_energetic", "ugc_casual", "tutorial_calm")]
    [string]$Preset = "ugc_casual",        # Voice settings preset

    [string]$ModelId = "eleven_multilingual_v2",  # TTS model
    [switch]$ListVoices,                   # List available voices
    [switch]$DryRun                        # Print API call without executing
)

$ErrorActionPreference = "Stop"

$apiKey = $env:ELEVENLABS_API_KEY
if (-not $apiKey) {
    Write-Error "ELEVENLABS_API_KEY environment variable not set. Get one at https://elevenlabs.io/app/settings/api-keys"
    exit 1
}

$headers = @{
    "xi-api-key" = $apiKey
    "Content-Type" = "application/json"
}

# Voice settings presets
$presets = @{
    "product_demo" = @{ stability = 0.7; similarity_boost = 0.8; style = 0.2; use_speaker_boost = $true }
    "ad_energetic" = @{ stability = 0.4; similarity_boost = 0.7; style = 0.6; use_speaker_boost = $true }
    "ugc_casual"   = @{ stability = 0.3; similarity_boost = 0.6; style = 0.7; use_speaker_boost = $true }
    "tutorial_calm" = @{ stability = 0.8; similarity_boost = 0.85; style = 0.1; use_speaker_boost = $true }
}

# List available voices
if ($ListVoices) {
    Write-Host "Fetching available voices..."
    $response = Invoke-RestMethod -Uri "https://api.elevenlabs.io/v1/voices" `
        -Method Get -Headers @{ "xi-api-key" = $apiKey }

    Write-Host "`nAvailable Voices:"
    Write-Host ("-" * 80)
    foreach ($voice in $response.voices) {
        $labels = ($voice.labels.PSObject.Properties | ForEach-Object { "$($_.Name): $($_.Value)" }) -join ", "
        Write-Host "  ID: $($voice.voice_id)"
        Write-Host "  Name: $($voice.name)"
        Write-Host "  Labels: $labels"
        Write-Host ("-" * 40)
    }
    exit 0
}

# Get text content
if ($TextFile) {
    if (-not (Test-Path $TextFile)) {
        Write-Error "Text file not found: $TextFile"
        exit 1
    }
    $Text = Get-Content -Path $TextFile -Raw
}

if (-not $Text) {
    Write-Error "Provide -Text or -TextFile parameter"
    exit 1
}

if (-not $VoiceId) {
    Write-Error "Provide -VoiceId parameter. Use -ListVoices to see available voices."
    exit 1
}

# Build request body
$voiceSettings = $presets[$Preset]
$body = @{
    text = $Text
    model_id = $ModelId
    voice_settings = $voiceSettings
} | ConvertTo-Json -Depth 3

if ($DryRun) {
    Write-Host "DRY RUN — ElevenLabs TTS API call:"
    Write-Host "  Voice ID: $VoiceId"
    Write-Host "  Preset: $Preset"
    Write-Host "  Model: $ModelId"
    Write-Host "  Text length: $($Text.Length) chars"
    Write-Host "  Settings: $($voiceSettings | ConvertTo-Json -Compress)"
    return
}

# Ensure output directory exists
$outputDir = Split-Path -Parent $Output
if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "Generating voiceover via ElevenLabs..."
Write-Host "  Voice ID: $VoiceId"
Write-Host "  Preset: $Preset"
Write-Host "  Text: $($Text.Substring(0, [Math]::Min(80, $Text.Length)))..."
Write-Host "  Output: $Output"

$url = "https://api.elevenlabs.io/v1/text-to-speech/$VoiceId"

try {
    Invoke-WebRequest -Uri $url `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -OutFile $Output

    $fileInfo = Get-Item $Output
    $sizeKB = [math]::Round($fileInfo.Length / 1KB, 1)
    Write-Host "`nSuccess! Audio saved to: $Output ($sizeKB KB)"
} catch {
    Write-Error "ElevenLabs API error: $_"
    exit 1
}
