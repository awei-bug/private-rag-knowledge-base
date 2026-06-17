$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$port = 8000

function Clear-ListenerPort {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
        return
    }

    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
        if (-not $processId -or $processId -eq $PID) {
            continue
        }

        try {
            $process = Get-Process -Id $processId -ErrorAction Stop
            Write-Host "Stopping existing listener on port $Port (PID $processId, $($process.ProcessName))" -ForegroundColor Yellow
            Stop-Process -Id $processId -Force -ErrorAction Stop
        } catch {
            Write-Warning "Failed to stop existing listener on port $Port (PID $processId): $($_.Exception.Message)"
        }
    }

    Start-Sleep -Seconds 1
}

function Resolve-PythonExe {
    if ($env:RAG_PYTHON -and (Test-Path $env:RAG_PYTHON)) {
        return $env:RAG_PYTHON
    }

    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python -and $python.Source) {
        return $python.Source
    }

    try {
        & py -3 --version *> $null
        if ($LASTEXITCODE -eq 0) {
            return "py -3"
        }
    } catch {}

    throw "No usable python executable found."
}

$pythonExe = Resolve-PythonExe
Set-Location $projectRoot

if (-not $env:RAG_DATABASE_URL) {
    $env:RAG_DATABASE_URL = "sqlite:///./rag.db"
}

Clear-ListenerPort -Port $port

Write-Host "Starting production backend on http://127.0.0.1:$port" -ForegroundColor Cyan

if ($pythonExe -eq "py -3") {
    & py -3 -m uvicorn app.main:app --host 127.0.0.1 --port $port
} else {
    & $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port $port
}
