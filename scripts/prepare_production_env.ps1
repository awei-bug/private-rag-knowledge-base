$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $projectRoot ".env.production.example"
$target = Join-Path $projectRoot ".env.production"

if (!(Test-Path $source)) {
    throw ".env.production.example not found."
}

if (Test-Path $target) {
    Write-Host ".env.production already exists: $target" -ForegroundColor Yellow
    Write-Host "Review and update secrets before deployment." -ForegroundColor Yellow
    exit 0
}

Copy-Item -LiteralPath $source -Destination $target

Write-Host "Created .env.production from .env.production.example" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Replace API keys and auth secret."
Write-Host "2. Confirm RAG_DATABASE_URL, RAG_STORAGE_LOCAL_ROOT, and RAG_BACKUP_LOCAL_ROOT."
Write-Host "3. Run scripts\\preflight_production.ps1 before docker compose up -d --build."
