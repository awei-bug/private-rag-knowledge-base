$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $projectRoot "frontend"
$envFile = Join-Path $projectRoot ".env.production"

function Assert-Command {
    param([string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "$Name is not available."
    }
}

Write-Host "== Local Production Preflight ==" -ForegroundColor Cyan

Assert-Command "node"
Assert-Command "npm.cmd"

if (!(Test-Path $envFile)) {
    throw ".env.production not found."
}

if (!(Test-Path (Join-Path $frontendRoot "package.json"))) {
    throw "frontend package.json not found."
}

Write-Host "[OK] Required files exist" -ForegroundColor Green

Push-Location $projectRoot
try {
    py -3 -m pytest tests -q
    if ($LASTEXITCODE -ne 0) {
        throw "Backend tests failed."
    }
} finally {
    Pop-Location
}

Push-Location $frontendRoot
try {
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed."
    }
} finally {
    Pop-Location
}

Write-Host "[OK] Local production preflight passed" -ForegroundColor Green
