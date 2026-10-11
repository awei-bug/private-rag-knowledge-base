$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-PythonCommand {
    if ($env:RAG_PYTHON -and (Test-Path $env:RAG_PYTHON)) {
        return @($env:RAG_PYTHON)
    }

    $commonPaths = @(
        "C:\Python312\python.exe",
        "C:\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
    )

    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            return @($path)
        }
    }

    try {
        & py -3 --version *> $null
        if ($LASTEXITCODE -eq 0) {
            return @("py", "-3")
        }
    } catch {
    }

    try {
        & python --version *> $null
        if ($LASTEXITCODE -eq 0) {
            return @("python")
        }
    } catch {
    }

    throw "Python interpreter not found."
}

function Invoke-CommandArray {
    param(
        [string[]]$Command,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = $PWD.Path
    )

    Push-Location $WorkingDirectory
    try {
        $prefix = @()
        if ($Command.Length -gt 1) {
            $prefix = $Command[1..($Command.Length - 1)]
        }

        & $Command[0] @prefix @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed: $($Command -join ' ') $($Arguments -join ' ')"
        }
    } finally {
        Pop-Location
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonCommand = Resolve-PythonCommand

Write-Step "Check Python"
Invoke-CommandArray -Command $pythonCommand -Arguments @("--version") -WorkingDirectory $repoRoot

Write-Step "Check Node.js"
& node --version
if ($LASTEXITCODE -ne 0) {
    throw "node is not available."
}

Write-Step "Check npm"
& npm.cmd --version
if ($LASTEXITCODE -ne 0) {
    throw "npm is not available."
}

Write-Step "Run backend tests"
Invoke-CommandArray -Command $pythonCommand -Arguments @("-m", "pytest", "tests", "-q") -WorkingDirectory $repoRoot

Write-Step "Build frontend"
Invoke-CommandArray -Command @("npm.cmd", "run", "build") -WorkingDirectory (Join-Path $repoRoot "frontend")

Write-Step "Check API endpoints"
$smokeScript = @'
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
checks = [
    ("/health", 200),
    ("/config", 200),
    ("/analytics/overview", 200),
    ("/api/v1/documents", 200),
    ("/api/v1/query/logs", 200),
]

for path, expected in checks:
    response = client.get(path)
    print(f"{path} -> {response.status_code}")
    if response.status_code != expected:
        raise SystemExit(f"Smoke check failed: {path} expected {expected}, got {response.status_code}")
'@

$tempScript = Join-Path ([System.IO.Path]::GetTempPath()) "rag_acceptance_smoke.py"
[System.IO.File]::WriteAllText($tempScript, $smokeScript, [System.Text.Encoding]::UTF8)
try {
    $previousPythonPath = $env:PYTHONPATH
    $env:PYTHONPATH = $repoRoot
    Invoke-CommandArray -Command $pythonCommand -Arguments @($tempScript) -WorkingDirectory $repoRoot
} finally {
    $env:PYTHONPATH = $previousPythonPath
    if (Test-Path $tempScript) {
        Remove-Item -LiteralPath $tempScript -Force
    }
}

Write-Step "Acceptance complete"
Write-Host "Base delivery checks passed." -ForegroundColor Green
