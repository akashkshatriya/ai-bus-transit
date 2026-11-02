$ErrorActionPreference = "Continue"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Starting Bus Tracker & ML Prediction Platform" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# Locate directories
$current = $PSScriptRoot
if (-not $current) { $current = (Get-Location).Path }

# Search for backend and frontend
$searchPaths = @(
    $current,
    (Join-Path $current "aaaa"),
    (Join-Path $current ".."),
    (Join-Path $current "..\..")
)

$backendDir = $null
$frontendDir = $null

foreach ($p in $searchPaths) {
    if ((Test-Path (Join-Path $p "backend")) -and (Test-Path (Join-Path $p "frontend"))) {
        $backendDir = (Resolve-Path (Join-Path $p "backend")).Path
        $frontendDir = (Resolve-Path (Join-Path $p "frontend")).Path
        break
    }
    if ((Test-Path (Join-Path $p "aaaa\backend")) -and (Test-Path (Join-Path $p "aaaa\frontend"))) {
        $backendDir = (Resolve-Path (Join-Path $p "aaaa\backend")).Path
        $frontendDir = (Resolve-Path (Join-Path $p "aaaa\frontend")).Path
        break
    }
}

if (-not $backendDir -or -not $frontendDir) {
    Write-Host "[ERROR] Could not find backend and frontend directories from $current" -ForegroundColor Red
    exit 1
}

Write-Host "Backend directory : $backendDir" -ForegroundColor Green
Write-Host "Frontend directory: $frontendDir" -ForegroundColor Green

$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"

# Start Backend
Write-Host "`nStarting FastAPI Backend on http://localhost:8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendDir'; Write-Host 'FastAPI Backend running on http://localhost:8000...' -ForegroundColor Green; & '$venvPython' -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

# Start Frontend
Write-Host "Starting Vite Frontend on http://localhost:5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; Write-Host 'Vite Frontend running on http://localhost:5173...' -ForegroundColor Green; npm.cmd run dev"

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  All services launched in separate windows!" -ForegroundColor Cyan
Write-Host "  Frontend Web UI : http://localhost:5173" -ForegroundColor White
Write-Host "  Backend API     : http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs        : http://localhost:8000/docs" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Cyan
