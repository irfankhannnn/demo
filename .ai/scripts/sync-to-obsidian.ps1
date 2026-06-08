$projectRoot = Resolve-Path ".."
Set-Location $projectRoot

$config = Get-Content ".ai\project.config.json" | ConvertFrom-Json
$projectName = $config.obsidianProject

$obsidianBase = "$HOME\AI-BRAIN\Projects"
$dest = Join-Path $obsidianBase $projectName

$source = ".ai\brain_sync"

if (!(Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest | Out-Null
}

Copy-Item "$source\*.md" -Destination $dest -Recurse -Force

Write-Host "✅ Synced back to Obsidian"