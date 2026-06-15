$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

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

    try {
        & py -3 --version *> $null
        if ($LASTEXITCODE -eq 0) {
            return "py -3"
        }
    } catch {
    }

    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python -and $python.Source) {
        return $python.Source
    }

    throw "No usable python executable found. Set RAG_PYTHON first."
}

$pythonExe = Resolve-PythonExe
Set-Location $projectRoot

if (-not $env:RAG_DATABASE_URL) {
    $env:RAG_DATABASE_URL = "sqlite:///./rag.db"
    Write-Host "RAG_DATABASE_URL not set, defaulting to local SQLite." -ForegroundColor Yellow
}

Write-Host "Using Python: $pythonExe" -ForegroundColor Cyan
Write-Host "Database: $env:RAG_DATABASE_URL" -ForegroundColor Cyan

if ($pythonExe -eq "py -3") {
    & py -3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
} else {
    & $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
}
