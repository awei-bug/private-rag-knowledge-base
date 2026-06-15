$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $projectRoot "frontend"
$port = 5173

if (!(Test-Path (Join-Path $frontendRoot "package.json"))) {
    throw "frontend\package.json not found."
}

function Get-ListeningProcessId {
    param([int]$TargetPort)

    $connection = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($connection) {
        return $connection.OwningProcess
    }

    return $null
}

function Stop-StaleViteProcess {
    param([int]$ProcessId)

    if (-not $ProcessId) {
        return
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if (-not $process) {
        return
    }

    $commandLine = ""
    if ($null -ne $process.CommandLine) {
        $commandLine = [string]$process.CommandLine
    }
    if ($process.Name -eq "node.exe" -and $commandLine -match [regex]::Escape($frontendRoot) -and $commandLine -match "vite") {
        Write-Host "Stopping stale frontend process on port $port (PID $ProcessId)." -ForegroundColor Yellow
        Stop-Process -Id $ProcessId -Force
        Start-Sleep -Seconds 1
        return
    }

    throw "Port $port is already in use by PID $ProcessId. Stop that process first, then retry."
}

$existingPid = Get-ListeningProcessId -TargetPort $port
if ($existingPid) {
    Stop-StaleViteProcess -ProcessId $existingPid
}

Set-Location $frontendRoot
Write-Host "Starting frontend on http://127.0.0.1:$port" -ForegroundColor Cyan
npm run dev -- --host 127.0.0.1 --port $port --strictPort
