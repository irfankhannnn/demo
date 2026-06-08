# ============================================
# AI Brain Sync Script (Windows PowerShell)
# ============================================

# Get current project name (folder name)
$projectName = Split-Path -Leaf (Get-Location)

# Define Obsidian base path
$obsidianBase = "$HOME\AI-BRAIN\Projects"

# Define source (Obsidian) and destination (repo)
$source = Join-Path $obsidianBase $projectName
$dest = ".ai\brain_sync"

Write-Host "----------------------------------------"
Write-Host "Project: $projectName"
Write-Host "Source : $source"
Write-Host "Dest   : $dest"
Write-Host "----------------------------------------"

# Ensure destination exists
if (!(Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest | Out-Null
}

# Clean old sync
Remove-Item "$dest\*" -Recurse -Force -ErrorAction SilentlyContinue

# Validate source exists
if (Test-Path $source) {
    Copy-Item "$source\*.md" -Destination $dest -Recurse -Force
    Write-Host "✅ Sync complete: Obsidian → .ai/brain_sync"
} else {
    Write-Host "⚠️ WARNING: No matching Obsidian folder found!"
    Write-Host "Expected path: $source"
    Write-Host "👉 Create this folder in Obsidian or fix naming."
}

Write-Host "----------------------------------------"