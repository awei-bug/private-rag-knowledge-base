$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $projectRoot "frontend"

function Resolve-PythonExe {
    if ($env:RAG_PYTHON -and (Test-Path $env:RAG_PYTHON)) {
        return $env:RAG_PYTHON
    }

    $candidates = @(
        "D:\学习\Anaconda\python.exe",
        "D:\学习\Anaconda3\python.exe",
        "C:\Users\徐炜\AppData\Local\Programs\Python\Python312\python.exe"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd -and $pythonCmd.Source) {
        return $pythonCmd.Source
    }

    return $null
}

$pythonExe = Resolve-PythonExe

Write-Host "== Enterprise RAG Local Check ==" -ForegroundColor Cyan

function Test-Cmd {
    param(
        [string]$Name,
        [string]$Command
    )

    try {
        $output = Invoke-Expression $Command | Out-String
        Write-Host "[OK] $Name" -ForegroundColor Green
        if ($output.Trim()) {
            Write-Host $output.Trim()
        }
    }
    catch {
        Write-Host "[FAIL] $Name" -ForegroundColor Red
        Write-Host $_.Exception.Message
    }

    Write-Host ""
}

if ($pythonExe -and (Test-Path $pythonExe)) {
    Test-Cmd "Python" "& `"$pythonExe`" --version"
}
else {
    Write-Host "[FAIL] Python" -ForegroundColor Red
    Write-Host "No usable python executable found. Set RAG_PYTHON first."
    Write-Host ""
}

Test-Cmd "Node" "node --version"
Test-Cmd "npm" "npm --version"
Test-Cmd "PostgreSQL Port 5432" "netstat -ano | findstr 5432"

if (Test-Path (Join-Path $projectRoot ".env")) {
    Write-Host "[OK] Backend .env found" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Backend .env missing" -ForegroundColor Red
}
Write-Host ""

if (Test-Path (Join-Path $frontendRoot ".env")) {
    Write-Host "[OK] Frontend .env found" -ForegroundColor Green
} else {
    Write-Host "[WARN] Frontend .env missing, can copy from frontend/.env.example" -ForegroundColor Yellow
}
Write-Host ""

try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health/db" -TimeoutSec 3
    Write-Host "[OK] Backend health endpoint" -ForegroundColor Green
    $health | ConvertTo-Json -Depth 4
}
catch {
    Write-Host "[WARN] Backend health endpoint not reachable" -ForegroundColor Yellow
    Write-Host "If backend is not started yet, run scripts\start_backend.bat"
}
