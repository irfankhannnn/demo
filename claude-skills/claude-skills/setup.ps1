# Cloudberry Claude Skills — Setup Script
# Creates symlinks from claude-skills/ into .claude/ for Claude Code discovery
# Run: .\claude-skills\setup.ps1

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$claudeDir = Join-Path $projectRoot ".claude"
$skillsSource = Join-Path $projectRoot "claude-skills"

Write-Host "=== Cloudberry Claude Skills Setup ===" -ForegroundColor Cyan
Write-Host "Project root: $projectRoot"
Write-Host ""

# Create .claude directories if they don't exist
$agentsDir = Join-Path $claudeDir "agents"
$skillsDir = Join-Path $claudeDir "skills"

if (-not (Test-Path $agentsDir)) {
    New-Item -ItemType Directory -Path $agentsDir -Force | Out-Null
    Write-Host "[+] Created $agentsDir" -ForegroundColor Green
}

if (-not (Test-Path $skillsDir)) {
    New-Item -ItemType Directory -Path $skillsDir -Force | Out-Null
    Write-Host "[+] Created $skillsDir" -ForegroundColor Green
}

# Copy agent files
$sourceAgents = Join-Path $skillsSource "agents"
if (Test-Path $sourceAgents) {
    $agentFiles = Get-ChildItem -Path $sourceAgents -Filter "*.md"
    foreach ($file in $agentFiles) {
        $dest = Join-Path $agentsDir $file.Name
        Copy-Item -Path $file.FullName -Destination $dest -Force
        Write-Host "[+] Agent: $($file.Name)" -ForegroundColor Green
    }
    Write-Host "  Copied $($agentFiles.Count) agent(s)" -ForegroundColor Yellow
}

# Copy skill directories
$sourceSkills = Join-Path $skillsSource "skills"
if (Test-Path $sourceSkills) {
    $skillDirs = Get-ChildItem -Path $sourceSkills -Directory
    foreach ($dir in $skillDirs) {
        $destSkillDir = Join-Path $skillsDir $dir.Name
        if (-not (Test-Path $destSkillDir)) {
            New-Item -ItemType Directory -Path $destSkillDir -Force | Out-Null
        }
        Copy-Item -Path (Join-Path $dir.FullName "*") -Destination $destSkillDir -Recurse -Force
        Write-Host "[+] Skill: $($dir.Name)" -ForegroundColor Green
    }
    Write-Host "  Copied $($skillDirs.Count) skill(s)" -ForegroundColor Yellow
}

# Copy scripts
$sourceScripts = Join-Path $skillsSource "scripts"
$destScripts = Join-Path $claudeDir "scripts"
if (Test-Path $sourceScripts) {
    if (-not (Test-Path $destScripts)) {
        New-Item -ItemType Directory -Path $destScripts -Force | Out-Null
    }
    Copy-Item -Path (Join-Path $sourceScripts "*") -Destination $destScripts -Recurse -Force
    Write-Host "[+] Copied helper scripts" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "Agents and skills are now available in Claude Code."
Write-Host "Use '/agents' in Claude Code to see all available agents."
Write-Host "Use '/<skill-name>' to invoke any skill."
