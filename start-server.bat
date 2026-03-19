@echo off
title Behavioral AI Bot - Server
echo ============================================
echo  Behavioral AI Bot - Windows Server
echo ============================================
echo.

REM ── 1. Ensure MongoDB service is running ─────────────────────────────────────
sc query MongoDB | find "RUNNING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/2] Starting MongoDB service...
    net start MongoDB
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to start MongoDB service.
        echo         Install MongoDB Community Server and enable it as a Windows service.
        pause
        exit /b 1
    )
) else (
    echo [1/2] MongoDB is already running.
)

REM ── 2. Start Node.js backend ──────────────────────────────────────────────────
echo [2/2] Starting backend on port 8000...
echo.

cd /d "%~dp0backend"
node server.js

pause
