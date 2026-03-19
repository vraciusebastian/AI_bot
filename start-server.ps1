# Behavioral AI Bot - Windows Server Startup Script
# Run with: powershell -ExecutionPolicy Bypass -File start-server.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Behavioral AI Bot - Windows Server" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check Docker
try {
    docker info | Out-Null
} catch {
    Write-Host "[ERROR] Docker is not running. Start Docker Desktop first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Start MongoDB
Write-Host "[1/3] Starting MongoDB..." -ForegroundColor Yellow
docker compose -f (Join-Path $Root "docker-compose.yml") up -d mongodb
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to start MongoDB." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Wait
Write-Host "[2/3] Waiting for MongoDB (5s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Find python
$Python = if (Test-Path $VenvPython) {
    Write-Host "[3/3] Using venv: $VenvPython" -ForegroundColor Green
    $VenvPython
} else {
    Write-Host "[3/3] Using system python" -ForegroundColor Yellow
    "python"
}

# Show IP addresses so user knows what to enter in Ubuntu
Write-Host ""
Write-Host "Your machine's IP addresses:" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\." } |
    ForEach-Object { Write-Host "  http://$($_.IPAddress):8000" -ForegroundColor Green }

Write-Host ""
Write-Host "Enter one of the above URLs in the Ubuntu Electron app." -ForegroundColor Cyan
Write-Host "Starting backend now... (Ctrl+C to stop)" -ForegroundColor Yellow
Write-Host ""

# Start backend
Set-Location $BackendDir
& $Python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
