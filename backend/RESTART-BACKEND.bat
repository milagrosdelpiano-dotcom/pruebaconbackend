@echo off
echo ================================================
echo REINICIANDO BACKEND con FIX de Embeddings
echo ================================================
echo.
echo Asegurate de haber aplicado la migracion SQL en Supabase!
echo.
echo Presiona Ctrl+C en la ventana del backend actual para detenerlo
echo Luego ejecuta:
echo.
echo    python -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload
echo.
echo El modelo MegaDescriptor se pre-cargara (~60 segundos)
echo.
echo ================================================
pause





