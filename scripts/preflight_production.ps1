$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env.production"
$composeFile = Join-Path $projectRoot "docker-compose.yml"

function Read-EnvFile {
    param([string]$Path)

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $trimmed = $line.Trim()
        if (!$trimmed -or $trimmed.StartsWith("#")) {
            continue
        }
        $index = $trimmed.IndexOf("=")
        if ($index -lt 1) {
            continue
        }
        $key = $trimmed.Substring(0, $index).Trim()
        $value = $trimmed.Substring($index + 1).Trim()
        $values[$key] = $value
    }
    return $values
}

function Assert-Command {
    param([string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "$Name is not available."
    }
}

Write-Host "== Production Preflight ==" -ForegroundColor Cyan

Assert-Command "docker"

if (!(Test-Path $composeFile)) {
    throw "docker-compose.yml not found."
}

if (!(Test-Path $envFile)) {
    throw ".env.production not found. Run scripts\\prepare_production_env.ps1 first."
}

$envValues = Read-EnvFile -Path $envFile
$requiredKeys = @(
    "RAG_DATABASE_URL",
    "RAG_STORAGE_LOCAL_ROOT",
    "RAG_BACKUP_LOCAL_ROOT",
    "RAG_AUTH_SECRET_KEY",
    "RAG_LOCAL_MODE_ENABLED",
    "RAG_EMBEDDING_PROVIDER",
    "RAG_LLM_PROVIDER"
)

foreach ($key in $requiredKeys) {
    if (-not $envValues.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envValues[$key])) {
        throw "Missing required key in .env.production: $key"
    }
}

if ($envValues["RAG_AUTH_SECRET_KEY"] -eq "replace_with_a_real_secret") {
    throw "RAG_AUTH_SECRET_KEY is still the example value."
}

if ($envValues["RAG_LOCAL_MODE_ENABLED"] -ne "false") {
    throw "RAG_LOCAL_MODE_ENABLED must be false for production deployment."
}

if ($envValues["RAG_EMBEDDING_PROVIDER"] -eq "openai-compatible" -and [string]::IsNullOrWhiteSpace($envValues["RAG_EMBEDDING_API_KEY"])) {
    throw "RAG_EMBEDDING_API_KEY is required for openai-compatible embedding."
}

if ($envValues["RAG_LLM_PROVIDER"] -eq "openai-compatible" -and [string]::IsNullOrWhiteSpace($envValues["RAG_LLM_API_KEY"])) {
    throw "RAG_LLM_API_KEY is required for openai-compatible llm."
}

Write-Host "[OK] .env.production required fields look valid" -ForegroundColor Green

docker compose config | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "docker compose config validation failed."
}

Write-Host "[OK] docker compose config validation passed" -ForegroundColor Green
Write-Host "Production preflight passed." -ForegroundColor Green
