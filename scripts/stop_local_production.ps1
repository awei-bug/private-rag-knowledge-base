$ErrorActionPreference = "Stop"

$ports = @(8000, 8080)
$stopped = @()

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
        continue
    }

    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
        if (-not $processId -or $processId -eq $PID) {
            continue
        }

        try {
            $process = Get-Process -Id $processId -ErrorAction Stop
            Stop-Process -Id $processId -Force -ErrorAction Stop
            $stopped += [PSCustomObject]@{
                Port = $port
                PID = $processId
                Name = $process.ProcessName
            }
        } catch {
            Write-Warning "Failed to stop process $processId on port ${port}: $($_.Exception.Message)"
        }
    }
}

if ($stopped.Count -eq 0) {
    Write-Host "No local production listeners found on ports 8000 or 8080." -ForegroundColor Yellow
    exit 0
}

$stopped | Format-Table -AutoSize
Write-Host "Local production listeners stopped." -ForegroundColor Green
