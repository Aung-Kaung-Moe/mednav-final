@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 20.19+ or Node.js 22.12+ from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (echo Installation failed. & pause & exit /b 1)
)
echo Starting MEDNAV dashboard...
call npm run dev
pause
