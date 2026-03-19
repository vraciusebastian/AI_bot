# Behavioral AI Bot - Windows Server Startup Script
# Run with: powershell -ExecutionPolicy Bypass -File start-server.ps1

$ErrorActionPreference = "Stop"
$Root       = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Behavioral AI Bot - Windows Server" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Ensure MongoDB service is running ─────────────────────────────────────
$mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($null -eq $mongoService) {
    Write-Host "[ERROR] MongoDB service not found." -ForegroundColor Red
    Write-Host "        Install MongoDB Community Server and enable it as a Windows service." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
if ($mongoService.Status -ne "Running") {
    Write-Host "[1/2] Starting MongoDB service..." -ForegroundColor Yellow
    Start-Service -Name "MongoDB"
    Write-Host "[1/2] MongoDB started." -ForegroundColor Green
} else {
    Write-Host "[1/2] MongoDB is already running." -ForegroundColor Green
}

# ── Show IP addresses for Ubuntu client ──────────────────────────────────────
Write-Host ""
Write-Host "Your machine's IP addresses (enter one of these in the Ubuntu app):" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\." } |
    ForEach-Object { Write-Host "  http://$($_.IPAddress):8000" -ForegroundColor Green }

Write-Host ""
Write-Host "[2/2] Starting backend on port 8000... (Ctrl+C to stop)" -ForegroundColor Yellow
Write-Host ""

# ── Start Node.js backend ─────────────────────────────────────────────────────
Set-Location $BackendDir
node server.js
