# sheets-update.ps1
# Manage the RealtyFlow lead pipeline in JSON/CSV format (offline mode)
# For Google Sheets online mode, use Google Sheets MCP directly in Claude Code
#
# Usage:
#   .\sheets-update.ps1 -Action "create" -Output "pipeline.json"
#   .\sheets-update.ps1 -Action "add-lead" -Name "Sharma Properties" -Phone "+919876543210" -City "Mumbai" -Source "meta_ads"
#   .\sheets-update.ps1 -Action "update-stage" -LeadId "L001" -Stage "DEMO_SCHEDULED" -DemoDate "2025-02-15T10:00:00"
#   .\sheets-update.ps1 -Action "summary"
#   .\sheets-update.ps1 -Action "export-csv" -Output "pipeline.csv"

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("create", "add-lead", "update-stage", "summary", "export-csv")]
    [string]$Action,

    [string]$PipelineFile = "marketing-and-sales/leads/pipeline.json",
    [string]$Output,

    # For add-lead
    [string]$Name,
    [string]$ContactName,
    [string]$Phone,
    [string]$Email,
    [string]$City,
    [string]$TeamSize,
    [string]$Source,
    [string]$CampaignId,
    [int]$LeadScore = 50,

    # For update-stage
    [string]$LeadId,
    [ValidateSet("LEAD", "CONTACTED", "DEMO_SCHEDULED", "DEMO_COMPLETED", "TRIAL", "PAID", "COLD", "NO_RESPONSE", "NO_SHOW", "LOST", "CHURNED")]
    [string]$Stage,
    [string]$DemoDate,
    [string]$Notes
)

$ErrorActionPreference = "Stop"

# Ensure pipeline directory exists
$pipelineDir = Split-Path -Parent $PipelineFile
if ($pipelineDir -and -not (Test-Path $pipelineDir)) {
    New-Item -ItemType Directory -Path $pipelineDir -Force | Out-Null
}

function Get-Pipeline {
    if (Test-Path $PipelineFile) {
        return Get-Content -Path $PipelineFile -Raw | ConvertFrom-Json
    }
    return @{ leads = @(); metadata = @{ created = (Get-Date -Format "o"); version = "1.0" } }
}

function Save-Pipeline {
    param($pipeline)
    $pipeline | ConvertTo-Json -Depth 10 | Set-Content -Path $PipelineFile -Encoding UTF8
}

function Get-LeadGrade {
    param([int]$score)
    if ($score -ge 80) { return "A" }
    if ($score -ge 60) { return "B" }
    if ($score -ge 40) { return "C" }
    if ($score -ge 20) { return "D" }
    return "F"
}

function Get-NextAction {
    param([string]$stage)
    switch ($stage) {
        "LEAD"           { return @{ action = "Initial outreach"; days = 0 } }
        "CONTACTED"      { return @{ action = "Follow-up if no reply"; days = 3 } }
        "DEMO_SCHEDULED" { return @{ action = "Send demo reminder"; days = -1 } }
        "DEMO_COMPLETED" { return @{ action = "Send trial link"; days = 1 } }
        "TRIAL"          { return @{ action = "Check-in call"; days = 3 } }
        "NO_RESPONSE"    { return @{ action = "Re-engage sequence"; days = 7 } }
        "NO_SHOW"        { return @{ action = "Reschedule attempt"; days = 1 } }
        default          { return @{ action = "Review"; days = 7 } }
    }
}

switch ($Action) {
    "create" {
        $pipeline = @{
            leads = @()
            metadata = @{
                created = (Get-Date -Format "o")
                version = "1.0"
                target = 3000
            }
        }
        Save-Pipeline $pipeline
        Write-Host "Pipeline created at: $PipelineFile"
    }

    "add-lead" {
        if (-not $Name) { Write-Error "Provide -Name parameter"; exit 1 }

        $pipeline = Get-Pipeline

        # Check duplicates
        $existing = $pipeline.leads | Where-Object {
            ($_.phone -eq $Phone -and $Phone) -or ($_.email -eq $Email -and $Email)
        }
        if ($existing) {
            Write-Warning "Duplicate found: $($existing.agency_name) (ID: $($existing.lead_id))"
            Write-Host "Updating source attribution..."
            return
        }

        $leadId = "L" + ((Get-Date).ToString("yyyyMMddHHmmss")) + (Get-Random -Minimum 100 -Maximum 999)
        $nextAction = Get-NextAction "LEAD"

        $lead = @{
            lead_id = $leadId
            agency_name = $Name
            contact_name = if ($ContactName) { $ContactName } else { "" }
            phone = if ($Phone) { $Phone } else { "" }
            email = if ($Email) { $Email } else { "" }
            city = if ($City) { $City } else { "" }
            team_size = if ($TeamSize) { $TeamSize } else { "" }
            source = if ($Source) { $Source } else { "manual" }
            campaign_id = if ($CampaignId) { $CampaignId } else { "" }
            stage = "LEAD"
            stage_date = (Get-Date -Format "yyyy-MM-dd")
            lead_score = $LeadScore
            lead_grade = Get-LeadGrade $LeadScore
            assigned_to = ""
            demo_date = ""
            demo_outcome = ""
            trial_start = ""
            trial_end = ""
            paid_date = ""
            plan = ""
            mrr = 0
            notes = ""
            last_contact = ""
            next_action = $nextAction.action
            next_action_date = (Get-Date).AddDays($nextAction.days).ToString("yyyy-MM-dd")
            created_at = (Get-Date -Format "o")
        }

        $pipeline.leads += $lead
        Save-Pipeline $pipeline
        Write-Host "Lead added: $Name (ID: $leadId, City: $City, Source: $Source)"
    }

    "update-stage" {
        if (-not $LeadId -or -not $Stage) { Write-Error "Provide -LeadId and -Stage"; exit 1 }

        $pipeline = Get-Pipeline
        $lead = $pipeline.leads | Where-Object { $_.lead_id -eq $LeadId }

        if (-not $lead) { Write-Error "Lead not found: $LeadId"; exit 1 }

        $lead.stage = $Stage
        $lead.stage_date = (Get-Date -Format "yyyy-MM-dd")

        if ($DemoDate -and $Stage -eq "DEMO_SCHEDULED") { $lead.demo_date = $DemoDate }
        if ($Stage -eq "DEMO_COMPLETED") { $lead.demo_outcome = "completed" }
        if ($Stage -eq "NO_SHOW") { $lead.demo_outcome = "no_show" }
        if ($Stage -eq "TRIAL") {
            $lead.trial_start = (Get-Date -Format "yyyy-MM-dd")
            $lead.trial_end = (Get-Date).AddDays(14).ToString("yyyy-MM-dd")
        }
        if ($Stage -eq "PAID") { $lead.paid_date = (Get-Date -Format "yyyy-MM-dd") }
        if ($Notes) { $lead.notes = $Notes }

        $nextAction = Get-NextAction $Stage
        $lead.next_action = $nextAction.action
        $lead.next_action_date = (Get-Date).AddDays($nextAction.days).ToString("yyyy-MM-dd")

        Save-Pipeline $pipeline
        Write-Host "Updated $LeadId → Stage: $Stage"
    }

    "summary" {
        $pipeline = Get-Pipeline
        $leads = $pipeline.leads
        $total = $leads.Count

        $summary = @"
# Pipeline Summary — $(Get-Date -Format "yyyy-MM-dd")

## Funnel Metrics
| Stage | Count | % of Total |
|-------|-------|-----------|
"@
        $stages = @("LEAD", "CONTACTED", "DEMO_SCHEDULED", "DEMO_COMPLETED", "TRIAL", "PAID", "COLD", "NO_RESPONSE", "NO_SHOW", "LOST", "CHURNED")
        foreach ($s in $stages) {
            $count = ($leads | Where-Object { $_.stage -eq $s }).Count
            $pct = if ($total -gt 0) { [math]::Round(($count / $total) * 100, 1) } else { 0 }
            $summary += "| $s | $count | ${pct}% |`n"
        }

        $summary += "`n## Key Metrics`n"
        $summary += "- **Total Leads:** $total`n"
        $summary += "- **Target:** $($pipeline.metadata.target)`n"
        $paidCount = ($leads | Where-Object { $_.stage -eq "PAID" }).Count
        $convRate = if ($total -gt 0) { [math]::Round(($paidCount / $total) * 100, 1) } else { 0 }
        $summary += "- **Conversion Rate:** ${convRate}%`n"

        $summary += "`n## By City`n"
        $leads | Group-Object -Property city | ForEach-Object {
            $summary += "- **$($_.Name):** $($_.Count) leads`n"
        }

        $summary += "`n## By Source`n"
        $leads | Group-Object -Property source | ForEach-Object {
            $summary += "- **$($_.Name):** $($_.Count) leads`n"
        }

        $outputFile = if ($Output) { $Output } else { "marketing-and-sales/leads/daily-summary-$(Get-Date -Format 'yyyy-MM-dd').md" }
        $outputDir2 = Split-Path -Parent $outputFile
        if ($outputDir2 -and -not (Test-Path $outputDir2)) {
            New-Item -ItemType Directory -Path $outputDir2 -Force | Out-Null
        }
        $summary | Set-Content -Path $outputFile -Encoding UTF8
        Write-Host $summary
        Write-Host "`nSummary saved to: $outputFile"
    }

    "export-csv" {
        $pipeline = Get-Pipeline
        $outputFile = if ($Output) { $Output } else { "marketing-and-sales/leads/pipeline.csv" }
        $outputDir3 = Split-Path -Parent $outputFile
        if ($outputDir3 -and -not (Test-Path $outputDir3)) {
            New-Item -ItemType Directory -Path $outputDir3 -Force | Out-Null
        }
        $pipeline.leads | Export-Csv -Path $outputFile -NoTypeInformation -Encoding UTF8
        Write-Host "Exported $($pipeline.leads.Count) leads to: $outputFile"
    }
}
