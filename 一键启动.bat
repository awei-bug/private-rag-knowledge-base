@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where powershell.exe >nul 2>&1 || goto no_powershell
where npm.cmd >nul 2>&1 || goto no_npm

if not exist ".venv\Scripts\python.exe" (
  where py.exe >nul 2>&1 || goto no_python
  echo [SETUP] Creating the backend virtual environment...
  py.exe -3 -m venv ".venv"
  if errorlevel 1 goto failed
  ".venv\Scripts\python.exe" -m pip install -e .
  if errorlevel 1 goto failed
)

if not exist "frontend\node_modules" (
  echo [SETUP] Installing frontend dependencies...
  pushd "frontend"
  call npm.cmd install
  if errorlevel 1 (popd & goto failed)
  popd
)

set "RAG_PYTHON=%~dp0.venv\Scripts\python.exe"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_local_production.ps1"
if errorlevel 1 goto failed

start "" "http://127.0.0.1:5212"
echo [OK] Knowledge base is running at http://127.0.0.1:5212
pause
exit /b 0

:no_powershell
echo [ERROR] PowerShell was not found.
pause
exit /b 1

:no_npm
echo [ERROR] npm was not found. Install Node.js and add it to PATH.
pause
exit /b 1

:no_python
echo [ERROR] Python launcher py.exe was not found.
pause
exit /b 1

:failed
echo [ERROR] Startup failed. Review the error output above.
pause
exit /b 1
