@echo off
title Behavioral AI Bot - Server Setup
echo ============================================
echo  Behavioral AI Bot - Windows Server Setup
echo ============================================
echo.

set BACKEND_DIR=%~dp0backend

echo Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install Node.js 20+ from https://nodejs.org
    pause
    exit /b 1
)

echo Installing backend dependencies...
cd /d "%BACKEND_DIR%"
npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Setup complete!
echo  Make sure MongoDB is installed as a Windows service.
echo  Then run start-server.bat to launch the server.
echo ============================================
pause
