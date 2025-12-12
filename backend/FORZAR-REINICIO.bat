@echo off
echo ================================================
echo FORZAR REINICIO DEL BACKEND
echo ================================================
echo.
echo Matando procesos de Python/Uvicorn...
taskkill /F /IM python.exe /T 2>nul
timeout /t 2 /nobreak >nul

cd /d "%~dp0"
echo.
echo Iniciando backend limpio...
echo.
python -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload





