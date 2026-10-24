@echo off
cd /d "%~dp0"
:waitdocker
docker info >nul 2>&1
if errorlevel 1 (
  timeout /t 5 /nobreak >nul
  goto waitdocker
)
call npm run db:up >nul 2>&1
cd backend
:loop
node src/index.js >> backend-auto.log 2>&1
timeout /t 5 /nobreak >nul
goto loop
