@echo off
:: Change drive and directory to where THIS .bat file is located
:: This ensures all relative paths work no matter where the user double-clicks from
cd /d "%~dp0"

title AuraFinance Desktop Launcher
echo =====================================================================
echo   AuraFinance - Starting Local Finance Dashboard...
echo   Working folder: %cd%
echo =====================================================================
echo.

:: 1. Verify Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found! Install Python 3.8+ from https://www.python.org/
    echo Check the "Add Python to PATH" option during install.
    pause
    exit /b 1
)
echo Python found. OK.

:: 2. Install Flask
echo Installing Flask dependencies...
python -m pip install Flask Werkzeug -q
echo Flask ready. OK.

:: 3. Launch server in NEW window using absolute path
echo Launching server...
start "AuraFinance Server" python "%~dp0backend\app.py"

:: 4. Wait for server to boot (3 seconds via ping)
ping 127.0.0.1 -n 4 >nul

:: 5. Open browser
echo Opening browser at http://127.0.0.1:8085/
start "" "http://127.0.0.1:8085/"

echo.
echo AuraFinance is running!
echo Keep the "AuraFinance Server" window open.
echo.
pause
