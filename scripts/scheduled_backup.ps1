$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not $env:RAG_DATABASE_URL) {
    $env:RAG_DATABASE_URL = "sqlite:///./rag.db"
}

$python = "py"
$pythonArgs = @("-3")

$script = @'
from app.db.session import init_db
from app.dependencies import get_maintenance_service

init_db()
result = get_maintenance_service().create_backup_file()
print(f"backup={result.filename} valid={result.valid} documents={result.document_count} logs={result.query_log_count}")
if not result.valid:
    raise SystemExit(result.message)
'@

$tempScript = Join-Path ([System.IO.Path]::GetTempPath()) "rag_scheduled_backup.py"
[System.IO.File]::WriteAllText($tempScript, $script, [System.Text.UTF8Encoding]::new($false))
try {
    $previousPythonPath = $env:PYTHONPATH
    $env:PYTHONPATH = $projectRoot
    & $python @pythonArgs $tempScript
    if ($LASTEXITCODE -ne 0) {
        throw "Scheduled backup failed."
    }
} finally {
    $env:PYTHONPATH = $previousPythonPath
    if (Test-Path $tempScript) {
        Remove-Item -LiteralPath $tempScript -Force
    }
}
