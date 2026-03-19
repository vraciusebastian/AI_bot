@echo off
title Behavioral AI Bot - Server Setup
echo ============================================
echo  Behavioral AI Bot - Windows Server Setup
echo ============================================
echo.

set BACKEND_DIR=%~dp0backend

echo [1/3] Creating Python virtual environment...
python -m venv "%BACKEND_DIR%\.venv"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create venv. Is Python 3.10+ installed?
    pause
    exit /b 1
)

echo [2/3] Installing Python dependencies...
"%BACKEND_DIR%\.venv\Scripts\pip" install --upgrade pip
"%BACKEND_DIR%\.venv\Scripts\pip" install -r "%BACKEND_DIR%\requirements.txt"
if %errorlevel% neq 0 (
    echo [ERROR] pip install failed.
    pause
    exit /b 1
)

echo [3/3] Pulling MongoDB Docker image...
docker pull mongo:7

echo.
echo ============================================
echo  Setup complete!
echo  Run start-server.bat to launch the server.
echo ============================================
pause
