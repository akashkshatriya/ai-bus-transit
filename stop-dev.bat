@echo off
echo ===================================================
echo   Stopping Bus Tracker Development Services
echo ===================================================
echo.

echo Stopping services on port 8000 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Terminating PID %%a on port 8000...
    taskkill /F /PID %%a >nul 2>&1
)

echo Stopping services on port 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo Terminating PID %%a on port 5173...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo All dev services on ports 8000 and 5173 stopped.
pause
