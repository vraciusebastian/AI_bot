@echo off
title Behavioral AI Bot - Server
echo ============================================
echo  Behavioral AI Bot - Windows Server
echo ============================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

echo [1/3] Starting MongoDB...
docker compose up -d mongodb
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start MongoDB.
    pause
    exit /b 1
)

echo [2/3] Waiting for MongoDB to be ready...
timeout /t 5 /nobreak >nul

echo [3/3] Starting Python backend on port 8000...
echo.

REM Check if venv exists, otherwise use system python
set BACKEND_DIR=%~dp0backend
set VENV_PYTHON=%BACKEND_DIR%\.venv\Scripts\python.exe

if exist "%VENV_PYTHON%" (
    echo Using virtual environment: %VENV_PYTHON%
    "%VENV_PYTHON%" -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
) else (
    echo Using system python3
    python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
)

pause
