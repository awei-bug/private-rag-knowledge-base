$ErrorActionPreference = "Stop"

$backendOut = Join-Path $env:TEMP "rag_backend_prod.out.log"
$backendErr = Join-Path $env:TEMP "rag_backend_prod.err.log"
$frontendOut = Join-Path $env:TEMP "rag_frontend_prod.out.log"
$frontendErr = Join-Path $env:TEMP "rag_frontend_prod.err.log"
$backendScript = Join-Path $PSScriptRoot "start_backend_prod.ps1"
$frontendScript = Join-Path $PSScriptRoot "start_frontend_prod.ps1"

function Wait-HttpReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [Parameter(Mandatory = $true)]
        [int]$TimeoutSeconds,
        [System.Diagnostics.Process]$Process
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if ($Process -and $Process.HasExited) {
            return $false
        }

        try {
            $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {}

        Start-Sleep -Milliseconds 500
    }

    return $false
}

Remove-Item $backendOut, $backendErr, $frontendOut, $frontendErr -ErrorAction SilentlyContinue

$backend = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoProfile -ExecutionPolicy Bypass -File `"$backendScript`""
) -WorkingDirectory (Split-Path -Parent $PSScriptRoot) -WindowStyle Hidden -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr -PassThru

if (-not (Wait-HttpReady -Url "http://127.0.0.1:8000/health" -TimeoutSeconds 20 -Process $backend)) {
    Write-Host "Backend failed to become ready." -ForegroundColor Red
    if (Test-Path $backendOut) {
        Write-Host "--- backend stdout ---" -ForegroundColor Yellow
        Get-Content $backendOut
    }
    if (Test-Path $backendErr) {
        Write-Host "--- backend stderr ---" -ForegroundColor Yellow
        Get-Content $backendErr
    }
    throw "Backend startup failed."
}

$frontend = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoProfile -ExecutionPolicy Bypass -File `"$frontendScript`""
) -WorkingDirectory (Split-Path -Parent $PSScriptRoot) -WindowStyle Hidden -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendErr -PassThru

if (-not (Wait-HttpReady -Url "http://127.0.0.1:8080" -TimeoutSeconds 30 -Process $frontend)) {
    Write-Host "Frontend failed to become ready." -ForegroundColor Red
    if (Test-Path $frontendOut) {
        Write-Host "--- frontend stdout ---" -ForegroundColor Yellow
        Get-Content $frontendOut
    }
    if (Test-Path $frontendErr) {
        Write-Host "--- frontend stderr ---" -ForegroundColor Yellow
        Get-Content $frontendErr
    }
    throw "Frontend startup failed."
}

Write-Host "Backend PID: $($backend.Id)" -ForegroundColor Green
Write-Host "Frontend PID: $($frontend.Id)" -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:8080" -ForegroundColor Cyan
Write-Host "Backend:   http://127.0.0.1:8000" -ForegroundColor Cyan
