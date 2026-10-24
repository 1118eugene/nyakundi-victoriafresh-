@echo off
cd /d "%~dp0"
echo [1/5] Checking Docker...
docker info >nul 2>&1
if not errorlevel 1 goto dockerok
echo Docker is not running. Starting Docker Desktop...
start "" "C:\Users\Admin\AppData\Local\Programs\DockerDesktop\frontend\Docker Desktop.exe"
set tries=0
:waitdocker
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if not errorlevel 1 goto dockerok
set /a tries+=1
if %tries% LSS 36 goto waitdocker
echo FAILED: Docker did not start within 3 minutes. Open Docker Desktop manually and run this again.
exit /b 1
:dockerok
echo Docker OK.
echo [2/5] Starting database...
call npm run db:up
if errorlevel 1 (
  echo FAILED: database did not start. Check the error above.
  exit /b 1
)
echo [3/5] Freeing port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
echo [4/5] Starting backend in its own window...
start "Victoria Fish Backend" /d "%~dp0backend" cmd /k npm run dev
echo [5/5] Waiting for the backend...
set tries=0
:waitapi
timeout /t 3 /nobreak >nul
curl -s -f -m 5 -o nul http://127.0.0.1:5000/api/health
if not errorlevel 1 goto apiok
set /a tries+=1
if %tries% LSS 30 goto waitapi
echo FAILED: backend did not answer within 90 seconds. Read the Backend window for the error.
exit /b 1
:apiok
echo.
echo ===== LOCAL HEALTH =====
curl -s -m 20 http://127.0.0.1:5000/api/health
echo.
echo ===== LOCAL PRODUCT TOTAL =====
curl -s -m 20 "http://127.0.0.1:5000/api/products?limit=100" | findstr /C:"total"
echo.
echo ===== LIVE RENDER HEALTH =====
curl -s -m 60 https://nyakundi-victoriafresh-2.onrender.com/api/health
echo.
echo DONE. Local health should say "connected". Keep the Backend window open.
