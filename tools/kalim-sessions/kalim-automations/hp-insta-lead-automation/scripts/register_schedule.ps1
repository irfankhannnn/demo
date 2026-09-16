# Registers the Windows scheduled task that runs the Instagram lead pipeline.
#   powershell -ExecutionPolicy Bypass -File scripts\register_schedule.ps1            # every 6 hours
#   powershell -ExecutionPolicy Bypass -File scripts\register_schedule.ps1 -Hours 4
#   powershell -ExecutionPolicy Bypass -File scripts\register_schedule.ps1 -Remove
# Runs as the logged-in user, only while logged on, because Chrome needs the desktop.
param([int]$Hours = 6, [switch]$Remove)

$TaskName = "HP Insta Lead Automation"
if ($Remove) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Output "Removed $TaskName"
    exit 0
}

$Root = Split-Path -Parent $PSScriptRoot
$Cmd = Join-Path $PSScriptRoot "run_pipeline.cmd"
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$Cmd`"" -WorkingDirectory $Root

# First firing at the next multiple of $Hours from midnight, then every $Hours hours forever.
$Now = Get-Date
$NextSlot = [math]::Ceiling(($Now.Hour + $Now.Minute / 60 + 0.01) / $Hours) * $Hours
$Start = $Now.Date.AddHours($NextSlot)
$Trigger = New-ScheduledTaskTrigger -Once -At $Start -RepetitionInterval (New-TimeSpan -Hours $Hours)

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 3) `
    -MultipleInstances IgnoreNew
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings `
    -Principal $Principal -Description "Fetch Instagram DMs for @happyproperties99, analyse leads, update master\hp-insta-leads.xlsx. See README section 9." -Force | Out-Null

$Info = Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo
Write-Output "Registered '$TaskName': every $Hours h, next run $($Info.NextRunTime)"
