@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   Starting Bus Tracker & ML Prediction Platform
echo ===================================================
echo.

:: Detect directories
set "ROOT_DIR=%~dp0"
if exist "%ROOT_DIR%aaaa\backend" (
    set "BACKEND_DIR=%ROOT_DIR%aaaa\backend"
    set "FRONTEND_DIR=%ROOT_DIR%aaaa\frontend"
) else if exist "%ROOT_DIR%backend" (
    set "BACKEND_DIR=%ROOT_DIR%backend"
    set "FRONTEND_DIR=%ROOT_DIR%frontend"
) else (
    echo [ERROR] Could not find backend and frontend directories!
    pause
    exit /b 1
)

:: Check for virtual environment
if not exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
    echo [WARNING] Backend virtualenv not found at %BACKEND_DIR%\.venv
    echo Creating virtualenv and installing dependencies...
    python -m venv "%BACKEND_DIR%\.venv"
    "%BACKEND_DIR%\.venv\Scripts\python.exe" -m pip install -r "%BACKEND_DIR%\requirements.txt"
)

:: Check for node_modules
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [WARNING] Frontend node_modules not found.
    echo Running npm install...
    cd /d "%FRONTEND_DIR%"
    call npm.cmd install
)

echo.
echo Starting Backend (FastAPI + Uvicorn on http://localhost:8000)...
start "Bus Tracker - Backend API" cmd /k "cd /d "%BACKEND_DIR%" && echo Starting FastAPI Backend on port 8000... && .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

echo Starting Frontend (Vite + React on http://localhost:5173)...
start "Bus Tracker - Frontend UI" cmd /k "cd /d "%FRONTEND_DIR%" && echo Starting Vite React Frontend on port 5173... && npm.cmd run dev"

echo.
echo ===================================================
echo   All services have been launched!
echo.
echo   Frontend Web App : http://localhost:5173
echo   Backend REST API : http://localhost:8000
echo   Interactive Docs : http://localhost:8000/docs
echo   Health Check     : http://localhost:8000/health
echo ===================================================
echo.
echo Leave the opened terminal windows running while developing.
echo To stop services, close the terminal windows or run stop-dev.bat.
pause
