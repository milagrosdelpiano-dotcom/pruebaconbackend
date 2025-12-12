@echo off
REM =====================================================
REM Script de Despliegue: Sistema de Alertas Geográficas
REM =====================================================
REM Este script automatiza el despliegue completo del
REM sistema de alertas geográficas en PetAlert (Windows)
REM =====================================================

chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║   Sistema de Alertas Geográficas - PetAlert          ║
echo ║   Despliegue Completo (Windows)                       ║
echo ╚═══════════════════════════════════════════════════════╝
echo.

REM Paso 1: Verificar dependencias
echo 📍 Verificando dependencias...

where supabase >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Supabase CLI no está instalado
    echo Instálalo con: npm install -g supabase
    pause
    exit /b 1
)

echo ✅ Dependencias verificadas
echo.

REM Paso 2: Verificar conexión con Supabase
echo 📍 Verificando conexión con Supabase...

supabase projects list >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ No estás autenticado en Supabase
    echo Ejecuta: supabase login
    pause
    exit /b 1
)

echo ✅ Conexión con Supabase OK
echo.

REM Paso 3: Obtener información del proyecto
echo 📍 Obteniendo información del proyecto...

set /p PROJECT_REF="Ingresa tu Supabase Project Ref: "

if "%PROJECT_REF%"=="" (
    echo ❌ Project Ref es requerido
    pause
    exit /b 1
)

echo ✅ Project Ref: %PROJECT_REF%
echo.

REM Paso 4: Verificar migración SQL
echo 📍 Verificando archivo de migración...

if not exist "backend\migrations\011_geo_alerts_system.sql" (
    echo ❌ Archivo de migración no encontrado: backend\migrations\011_geo_alerts_system.sql
    pause
    exit /b 1
)

echo ✅ Archivo de migración encontrado
echo.

REM Paso 5: Ejecutar migración
echo 📍 Ejecutando migración SQL...
echo.
echo ⚠️  Esto creará las siguientes tablas y funciones:
echo    - user_locations
echo    - user_alert_preferences
echo    - geo_alert_notifications_queue
echo    - Funciones y triggers necesarios
echo.

set /p CONTINUE="¿Continuar? (s/n): "
if /i not "%CONTINUE%"=="s" (
    echo ⚠️  Migración cancelada
    pause
    exit /b 0
)

echo.
echo ⚠️  Ejecuta manualmente la migración:
echo    1. Ve a Supabase Dashboard → SQL Editor
echo    2. Crea una nueva query
echo    3. Copia el contenido de: backend\migrations\011_geo_alerts_system.sql
echo    4. Ejecuta
echo.
pause
echo.

REM Paso 6: Desplegar Edge Function
echo 📍 Desplegando Edge Function...

if not exist "supabase\functions\send-geo-alerts" (
    echo ❌ Directorio de Edge Function no encontrado: supabase\functions\send-geo-alerts
    pause
    exit /b 1
)

supabase functions deploy send-geo-alerts --project-ref %PROJECT_REF%

if %errorlevel% neq 0 (
    echo ❌ Error desplegando Edge Function
    pause
    exit /b 1
)

echo ✅ Edge Function desplegada correctamente
echo.

REM Paso 7: Configurar Webhook
echo 📍 Configurando Database Webhook...
echo.
echo ⚠️  Configura el webhook manualmente:
echo.
echo    1. Ve a: https://app.supabase.com/project/%PROJECT_REF%/database/webhooks
echo    2. Click en 'Create a new hook'
echo    3. Configura:
echo       - Name: process-geo-alerts-immediately
echo       - Table: geo_alert_notifications_queue
echo       - Events: INSERT
echo       - Type: HTTP Request
echo       - Method: POST
echo       - URL: https://%PROJECT_REF%.supabase.co/functions/v1/send-geo-alerts
echo       - Headers:
echo         Authorization: Bearer [TU_SERVICE_ROLE_KEY]
echo         Content-Type: application/json
echo       - Timeout: 25000
echo.
pause
echo.

REM Paso 8: Configurar variables de PostgreSQL
echo 📍 Configurando variables de PostgreSQL...
echo.
echo ⚠️  Configura las variables manualmente:
echo.
echo    1. Ve a: https://app.supabase.com/project/%PROJECT_REF%/settings/database
echo    2. Scroll hasta 'Custom PostgreSQL Configuration'
echo    3. Agrega:
echo       app.supabase_url = https://%PROJECT_REF%.supabase.co
echo       app.supabase_service_role_key = [TU_SERVICE_ROLE_KEY]
echo.
pause
echo.

REM Paso 9: Verificar instalación
echo 📍 Verificando instalación...
echo.
echo Ejecuta esta query en SQL Editor para verificar:
echo.
echo SELECT * FROM get_geo_alerts_stats();
echo.
echo Debería retornar estadísticas del sistema.
echo.

REM Paso 10: Instrucciones finales
echo ✅ ¡Despliegue completado!
echo.
echo ═══════════════════════════════════════════════════════
echo 📱 SIGUIENTES PASOS EN EL FRONTEND
echo ═══════════════════════════════════════════════════════
echo.
echo 1. Regenerar configuración nativa:
echo    npx expo prebuild --clean
echo.
echo 2. Compilar para Android:
echo    npx expo run:android
echo.
echo 3. Agregar botón en el perfil (app\(tabs)\profile.jsx):
echo    ^<TouchableOpacity onPress={()  =^> router.push('/geo-alerts-settings')^}^>
echo      ^<Text^>Alertas Geográficas^</Text^>
echo    ^</TouchableOpacity^>
echo.
echo ═══════════════════════════════════════════════════════
echo 🧪 TESTING
echo ═══════════════════════════════════════════════════════
echo.
echo 1. En la app:
echo    - Ve a Perfil → Alertas Geográficas
echo    - Activa 'Rastreo de ubicación'
echo    - Acepta permisos
echo.
echo 2. Crea un reporte de prueba con ubicación cercana
echo.
echo 3. Verifica que recibes la notificación push
echo.
echo 4. Ver logs en tiempo real:
echo    supabase functions logs send-geo-alerts --follow
echo.
echo ═══════════════════════════════════════════════════════
echo 📚 DOCUMENTACIÓN COMPLETA
echo ═══════════════════════════════════════════════════════
echo.
echo Lee: GUIA-ALERTAS-GEOGRAFICAS.md
echo.
echo ✨ ¡Listo para recibir alertas de mascotas cercanas!
echo.
pause


