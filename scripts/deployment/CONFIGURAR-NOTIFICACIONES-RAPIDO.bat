@echo off
echo ========================================
echo CONFIGURACION RAPIDA - NOTIFICACIONES PUSH
echo ========================================
echo.

REM Verificar que Supabase CLI esta instalado
where supabase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Supabase CLI no esta instalado
    echo.
    echo Instalar con: npm install -g supabase
    echo.
    pause
    exit /b 1
)

echo [OK] Supabase CLI instalado
echo.

REM Verificar que el usuario esta autenticado
supabase projects list >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] No estas autenticado en Supabase
    echo.
    echo Ejecuta primero: supabase login
    echo.
    pause
    exit /b 1
)

echo [OK] Autenticado en Supabase
echo.

REM Verificar que el proyecto esta vinculado
if not exist ".\.git\supabase-project-ref" (
    echo [INFO] Proyecto no vinculado. Ingresa tu Project Reference ID
    echo        Lo puedes encontrar en: Supabase Dashboard ^> Settings ^> General
    echo.
    set /p PROJECT_REF="Project Reference ID: "
    
    supabase link --project-ref %PROJECT_REF%
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] No se pudo vincular el proyecto
        pause
        exit /b 1
    )
    echo [OK] Proyecto vinculado
    echo.
)

echo ========================================
echo PASO 1: Habilitar extension pg_net
echo ========================================
echo.
echo Ejecuta esto en el SQL Editor de Supabase Dashboard:
echo.
echo CREATE EXTENSION IF NOT EXISTS pg_net;
echo.
set /p CONTINUE="Presiona Enter cuando lo hayas ejecutado..."

echo.
echo ========================================
echo PASO 2: Ejecutar migracion SQL
echo ========================================
echo.
echo Copia y pega el contenido de este archivo en SQL Editor:
echo backend\migrations\009_notification_system.sql
echo.
set /p CONTINUE="Presiona Enter cuando lo hayas ejecutado..."

echo.
echo ========================================
echo PASO 3: Desplegar Edge Function
echo ========================================
echo.
echo Desplegando send-push-notification...
echo.

supabase functions deploy send-push-notification
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] No se pudo desplegar la Edge Function
    pause
    exit /b 1
)

echo [OK] Edge Function desplegada
echo.

echo ========================================
echo PASO 4: Configurar variables en Supabase
echo ========================================
echo.
echo Ve a: Supabase Dashboard ^> Settings ^> Database ^> Custom PostgreSQL Configuration
echo.
echo Agrega estas variables:
echo.
echo app.supabase_url = https://TU_PROJECT_REF.supabase.co
echo app.supabase_service_role_key = TU_SERVICE_ROLE_KEY
echo.
echo El service_role_key esta en: Dashboard ^> Settings ^> API
echo.
set /p CONTINUE="Presiona Enter cuando lo hayas configurado..."

echo.
echo ========================================
echo VERIFICACION
echo ========================================
echo.
echo Probando sistema...
echo.

echo Ejecuta esta query en SQL Editor para verificar:
echo SELECT * FROM check_notification_system_status();
echo.

echo ========================================
echo CONFIGURACION COMPLETADA
echo ========================================
echo.
echo El sistema de notificaciones esta listo!
echo.
echo Comandos utiles:
echo - Ver logs: supabase functions logs send-push-notification --follow
echo - Listar funciones: supabase functions list
echo - Verificar estado: SELECT * FROM check_notification_system_status();
echo.
echo Documentacion completa en: CONFIGURAR-NOTIFICACIONES-PUSH.md
echo.
pause



