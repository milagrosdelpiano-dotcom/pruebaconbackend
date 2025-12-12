@echo off
echo.
echo ========================================
echo   REINICIANDO BACKEND CON OPTIMIZACIONES
echo ========================================
echo.

cd backend

echo Deteniendo procesos Python existentes...
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Iniciando backend optimizado...
echo.
echo IMPORTANTE: 
echo - Busca el mensaje: "MegaDescriptor cargado exitosamente"
echo - Primera busqueda puede tardar 60 segundos
echo - Busquedas subsecuentes: 5-15 segundos
echo.

python -m uvicorn main:app --reload --port 8003 --host 0.0.0.0





