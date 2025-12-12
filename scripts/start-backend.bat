@echo off
echo Iniciando backend de PetAlert...
echo.
echo Verificando dependencias...

cd backend

echo Verificando Python...
python --version
if %errorlevel% neq 0 (
    echo ERROR: Python no encontrado. Instala Python 3.8+ desde https://python.org
    pause
    exit /b 1
)

echo Verificando dependencias de Python...
pip list | findstr "fastapi uvicorn" >nul
if %errorlevel% neq 0 (
    echo Instalando dependencias...
    pip install -r requirements.txt
)

echo.
echo Iniciando servidor backend en http://0.0.0.0:8003
echo Accesible desde:
echo   - http://localhost:8003
echo   - http://127.0.0.1:8003
echo   - http://192.168.0.204:8003 (red local)
echo Presiona Ctrl+C para detener el servidor
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload

pause
