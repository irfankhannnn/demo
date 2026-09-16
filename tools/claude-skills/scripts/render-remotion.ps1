# render-remotion.ps1
# Render Remotion video compositions for RealtyFlow marketing content
# Usage: .\render-remotion.ps1 -Composition "RealtyFlowAd" -Props '{"headline":"Test"}' -Output "out/ad.mp4"
# Usage: .\render-remotion.ps1 -Composition "InstagramReel" -Width 1080 -Height 1920 -Output "out/reel.mp4"
# Usage: .\render-remotion.ps1 -Still -Composition "CarouselSlides" -Frame 0 -Output "out/slide-1.png"

param(
    [Parameter(Mandatory=$true)]
    [string]$Composition,

    [string]$Props = "{}",
    [string]$Output = "out/render.mp4",
    [int]$Width = 1920,
    [int]$Height = 1080,
    [int]$Fps = 30,
    [switch]$Still,                    # Render a single frame as PNG
    [int]$Frame = 0,                   # Frame number for still render
    [switch]$Lambda,                   # Use Lambda cloud rendering
    [string]$RemotionProjectPath,      # Path to Remotion project (auto-detected)
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Auto-detect Remotion project path
if (-not $RemotionProjectPath) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)  # tools/claude-skills/scripts -> repo root
    $candidates = @(
        (Join-Path $repoRoot "marketing-and-sales/video-projects/my-video"),
        (Join-Path $repoRoot "marketing-and-sales/video-projects/first-video")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path (Join-Path $candidate "remotion.config.ts")) {
            $RemotionProjectPath = $candidate
            break
        }
    }
    if (-not $RemotionProjectPath) {
        Write-Error "Could not find Remotion project. Specify -RemotionProjectPath."
        exit 1
    }
}

Write-Host "Remotion Project: $RemotionProjectPath"
Write-Host "Composition: $Composition"
Write-Host "Output: $Output"

# Ensure output directory exists
$outputDir = Split-Path -Parent $Output
if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

if ($Still) {
    $cmd = "npx remotion still `"$Composition`" `"$Output`" --frame=$Frame --props='$Props'"
    Write-Host "Rendering still frame $Frame..."
} elseif ($Lambda) {
    $cmd = "node deploy.mjs"
    Write-Host "Deploying to Lambda for cloud render..."
} else {
    $cmd = "npx remotion render `"$Composition`" `"$Output`" --width=$Width --height=$Height --fps=$Fps --props='$Props'"
    Write-Host "Rendering video: ${Width}x${Height} @ ${Fps}fps..."
}

if ($DryRun) {
    Write-Host "`nDRY RUN — Would execute:"
    Write-Host "  cd $RemotionProjectPath"
    Write-Host "  $cmd"
    return
}

Write-Host "`nExecuting: $cmd"
Push-Location $RemotionProjectPath
try {
    Invoke-Expression $cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Remotion render failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

Write-Host "`nDone! Output saved to: $Output"

# Print file info
if (Test-Path $Output) {
    $fileInfo = Get-Item $Output
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host "File size: ${sizeMB} MB"
}
