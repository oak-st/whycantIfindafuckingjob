@echo off
echo Starting Job Hunter...
echo.

start "Job Hunter - Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --reload --port 8000"
start "Job Hunter - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo   Backend:  http://localhost:8000
echo   App:      http://localhost:5173
echo.
echo   Close the Backend and Frontend windows to stop.
echo.
pause
