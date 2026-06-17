$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $projectRoot "frontend"
$distRoot = Join-Path $frontendRoot "dist"
$port = 8080

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

if (!(Test-Path (Join-Path $frontendRoot "package.json"))) {
    throw "frontend\\package.json not found."
}

Set-Location $frontendRoot

Clear-ListenerPort -Port $port

Write-Host "Building frontend production assets..." -ForegroundColor Cyan
npm.cmd run build

if (!(Test-Path $distRoot)) {
    throw "frontend dist output not found."
}

$serverScript = @'
import http.server
import socketserver
from functools import partial
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
port = int(sys.argv[2])
handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
    print(f"Serving {root} on http://127.0.0.1:{port}")
    httpd.serve_forever()
'@

$tempScript = Join-Path ([System.IO.Path]::GetTempPath()) "rag_frontend_static_server.py"
[System.IO.File]::WriteAllText($tempScript, $serverScript, [System.Text.Encoding]::UTF8)
try {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) {
        & python $tempScript $distRoot $port
        return
    }
    & py -3 $tempScript $distRoot $port
} finally {
    if (Test-Path $tempScript) {
        Remove-Item -LiteralPath $tempScript -Force
    }
}
