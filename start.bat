@echo off
echo Starting Job Hunter...
echo.

:: Start backend in a new window with auto-restart
start "Job Hunter - Backend" cmd /k "cd /d "%~dp0backend" && :loop && python -m uvicorn main:app --reload --port 8000 && goto loop"

:: Start frontend in a new window with auto-restart
start "Job Hunter - Frontend" cmd /k "cd /d "%~dp0frontend" && :loop && npm run dev && goto loop"

echo   Backend:  http://localhost:8000
echo   App:      http://localhost:5173
echo.
echo   Close the Backend and Frontend windows to stop.
echo.
pause
