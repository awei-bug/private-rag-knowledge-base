$ErrorActionPreference = "Stop"

param(
    [string]$TaskName = "RAG Local Knowledge Base Backup",
    [string]$Time = "02:00"
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$backupScript = Join-Path $PSScriptRoot "scheduled_backup.ps1"

if (!(Test-Path $backupScript)) {
    throw "scheduled_backup.ps1 not found."
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File `"$backupScript`"" `
    -WorkingDirectory $projectRoot

$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Create and validate a versioned backup for the local RAG knowledge base." `
    -Force | Out-Null

Write-Host "Scheduled backup task installed: $TaskName at $Time" -ForegroundColor Green
