# =====================================================
# Script de Verificación: Sistema de Alertas Geográficas
# =====================================================
# PowerShell script para verificar la instalación y
# estado del sistema de alertas geográficas
# =====================================================

# Colores
$Green = 'Green'
$Red = 'Red'
$Yellow = 'Yellow'
$Blue = 'Cyan'

function Write-Step {
    param([string]$Message)
    Write-Host "📍 $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $Green
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor $Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $Red
}

# Banner
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗"
Write-Host "║   Verificación: Sistema de Alertas Geográficas        ║"
Write-Host "╚═══════════════════════════════════════════════════════╝"
Write-Host ""

# Verificar archivos del sistema
Write-Step "Verificando archivos del sistema..."

$files = @(
    "backend\migrations\011_geo_alerts_system.sql",
    "supabase\functions\send-geo-alerts\index.ts",
    "supabase\functions\send-geo-alerts\README.md",
    "hooks\useGeoAlerts.js",
    "components\GeoAlerts\GeoAlertsSettings.jsx",
    "app\geo-alerts-settings.jsx",
    "GUIA-ALERTAS-GEOGRAFICAS.md"
)

$allFilesExist = $true
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  ✓ $file" -ForegroundColor $Green
    } else {
        Write-Host "  ✗ $file" -ForegroundColor $Red
        $allFilesExist = $false
    }
}

Write-Host ""

if ($allFilesExist) {
    Write-Success "Todos los archivos están presentes"
} else {
    Write-Error-Custom "Faltan archivos del sistema"
    Write-Host ""
    exit 1
}

Write-Host ""

# Verificar configuración en app.json
Write-Step "Verificando configuración en app.json..."

if (Test-Path "app.json") {
    $appJson = Get-Content "app.json" -Raw | ConvertFrom-Json
    
    $hasLocationPlugin = $false
    $hasNotificationPlugin = $false
    $hasBackgroundLocation = $false
    
    foreach ($plugin in $appJson.expo.plugins) {
        if ($plugin -is [array]) {
            if ($plugin[0] -eq "expo-location") {
                $hasLocationPlugin = $true
                if ($plugin[1].isAndroidBackgroundLocationEnabled) {
                    $hasBackgroundLocation = $true
                }
            }
            if ($plugin[0] -eq "expo-notifications") {
                $hasNotificationPlugin = $true
            }
        }
    }
    
    if ($hasLocationPlugin) {
        Write-Host "  ✓ Plugin expo-location configurado" -ForegroundColor $Green
    } else {
        Write-Host "  ✗ Plugin expo-location no encontrado" -ForegroundColor $Red
    }
    
    if ($hasBackgroundLocation) {
        Write-Host "  ✓ Ubicación en background habilitada" -ForegroundColor $Green
    } else {
        Write-Host "  ⚠  Ubicación en background no habilitada" -ForegroundColor $Yellow
    }
    
    if ($hasNotificationPlugin) {
        Write-Host "  ✓ Plugin expo-notifications configurado" -ForegroundColor $Green
    } else {
        Write-Host "  ✗ Plugin expo-notifications no encontrado" -ForegroundColor $Red
    }
    
    # Verificar permisos Android
    if ($appJson.expo.android.permissions) {
        $hasBackgroundPerm = $appJson.expo.android.permissions -contains "ACCESS_BACKGROUND_LOCATION"
        if ($hasBackgroundPerm) {
            Write-Host "  ✓ Permiso ACCESS_BACKGROUND_LOCATION configurado" -ForegroundColor $Green
        } else {
            Write-Host "  ⚠  Permiso ACCESS_BACKGROUND_LOCATION no encontrado" -ForegroundColor $Yellow
        }
    }
    
    Write-Host ""
    Write-Success "Configuración de app.json verificada"
} else {
    Write-Error-Custom "Archivo app.json no encontrado"
}

Write-Host ""

# Verificar Supabase CLI
Write-Step "Verificando Supabase CLI..."

try {
    $supabaseVersion = supabase --version 2>$null
    if ($supabaseVersion) {
        Write-Success "Supabase CLI instalado: $supabaseVersion"
    }
} catch {
    Write-Error-Custom "Supabase CLI no está instalado"
    Write-Host "Instálalo con: npm install -g supabase"
    Write-Host ""
}

Write-Host ""

# Verificar Edge Function
Write-Step "Verificando Edge Function..."

if (Test-Path "supabase\functions\send-geo-alerts\index.ts") {
    $functionCode = Get-Content "supabase\functions\send-geo-alerts\index.ts" -Raw
    
    if ($functionCode -match "geo_alert_notifications_queue") {
        Write-Host "  ✓ Edge Function lee de la tabla correcta" -ForegroundColor $Green
    }
    
    if ($functionCode -match "EXPO_PUSH_ENDPOINT") {
        Write-Host "  ✓ Edge Function tiene configurado Expo Push API" -ForegroundColor $Green
    }
    
    if ($functionCode -match "distance_meters") {
        Write-Host "  ✓ Edge Function incluye distancia en notificaciones" -ForegroundColor $Green
    }
    
    Write-Host ""
    Write-Success "Edge Function verificada"
} else {
    Write-Error-Custom "Edge Function no encontrada"
}

Write-Host ""

# Generar SQL de verificación
Write-Step "Generando queries de verificación SQL..."

$sqlQueries = @"
-- =====================================================
-- QUERIES DE VERIFICACIÓN DEL SISTEMA
-- =====================================================
-- Copia estas queries en Supabase SQL Editor para
-- verificar que el sistema está funcionando correctamente
-- =====================================================

-- 1. Verificar que las tablas existen
SELECT 
    tablename,
    schemaname
FROM pg_tables
WHERE tablename IN (
    'user_locations',
    'user_alert_preferences',
    'geo_alert_notifications_queue'
)
ORDER BY tablename;
-- Debe retornar 3 filas

-- 2. Verificar que las funciones existen
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_name IN (
    'upsert_user_location',
    'find_nearby_users',
    'enqueue_geo_alerts',
    'get_geo_alerts_stats',
    'invoke_geo_alerts_edge_function'
)
ORDER BY routine_name;
-- Debe retornar 5 filas

-- 3. Verificar que los triggers existen
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_name IN (
    'trigger_geo_alerts_on_new_report',
    'trigger_process_geo_alert_immediately'
)
ORDER BY trigger_name;
-- Debe retornar 2 filas

-- 4. Verificar que PostGIS está instalado
SELECT PostGIS_Version();
-- Debe retornar versión de PostGIS

-- 5. Ver estadísticas del sistema
SELECT * FROM get_geo_alerts_stats();
-- Debe retornar 5 filas con estadísticas

-- 6. Verificar índices geográficos
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'user_locations'
  AND indexdef LIKE '%GIST%';
-- Debe retornar al menos 1 índice GIST

-- =====================================================
-- QUERIES DE PRUEBA (después de la instalación)
-- =====================================================

-- 7. Registrar tu ubicación de prueba
-- Reemplaza USER_ID con tu UUID de auth.users
SELECT * FROM upsert_user_location(
    'USER_ID'::uuid,
    -34.603722,  -- latitud (reemplaza con tu ubicación)
    -58.381592,  -- longitud (reemplaza con tu ubicación)
    10.0
);

-- 8. Verificar que se guardó
SELECT 
    user_id,
    latitude,
    longitude,
    accuracy,
    updated_at
FROM user_locations
WHERE user_id = 'USER_ID'::uuid;

-- 9. Crear reporte de prueba cercano (500m)
-- Reemplaza REPORTER_ID con otro usuario (no el tuyo)
INSERT INTO reports (
    type,
    reporter_id,
    pet_name,
    species,
    breed,
    color,
    size,
    description,
    location,
    address,
    status,
    incident_date
) VALUES (
    'lost',
    'REPORTER_ID'::uuid,
    'Max',
    'dog',
    'Golden Retriever',
    'Dorado',
    'large',
    'Perro muy amigable',
    ST_SetSRID(ST_MakePoint(-58.382000, -34.604000), 4326)::geography,
    'Av. de Prueba 123',
    'active',
    NOW()
) RETURNING id;

-- 10. Verificar que se crearon alertas
SELECT 
    id,
    recipient_id,
    report_id,
    distance_meters,
    processed_at,
    created_at
FROM geo_alert_notifications_queue
ORDER BY created_at DESC
LIMIT 10;

-- 11. Ver notificaciones pendientes
SELECT COUNT(*) as pendientes
FROM geo_alert_notifications_queue
WHERE processed_at IS NULL;

-- 12. Ver notificaciones procesadas
SELECT COUNT(*) as procesadas
FROM geo_alert_notifications_queue
WHERE processed_at IS NOT NULL;

-- =====================================================
-- QUERIES DE LIMPIEZA (si necesitas reiniciar pruebas)
-- =====================================================

-- Limpiar notificaciones
DELETE FROM geo_alert_notifications_queue WHERE recipient_id = 'USER_ID'::uuid;

-- Limpiar ubicación
DELETE FROM user_locations WHERE user_id = 'USER_ID'::uuid;

-- Limpiar preferencias
DELETE FROM user_alert_preferences WHERE user_id = 'USER_ID'::uuid;
"@

$sqlQueries | Out-File -FilePath "VERIFICACION-GEO-ALERTS.sql" -Encoding UTF8

Write-Success "Archivo generado: VERIFICACION-GEO-ALERTS.sql"
Write-Host "  Copia y ejecuta estas queries en Supabase SQL Editor" -ForegroundColor $Yellow

Write-Host ""

# Resumen final
Write-Host "═══════════════════════════════════════════════════════"
Write-Host "RESUMEN DE VERIFICACIÓN"
Write-Host "═══════════════════════════════════════════════════════"
Write-Host ""

if ($allFilesExist) {
    Write-Host "✅ Archivos del sistema: OK" -ForegroundColor $Green
} else {
    Write-Host "❌ Archivos del sistema: FALTA ALGUNO" -ForegroundColor $Red
}

Write-Host ""
Write-Host "PRÓXIMOS PASOS:"
Write-Host ""
Write-Host "1. Ejecuta el script de despliegue:"
Write-Host "   .\scripts\deploy-geo-alerts.bat"
Write-Host ""
Write-Host "2. Ejecuta las queries de verificación:"
Write-Host "   Abre: VERIFICACION-GEO-ALERTS.sql"
Write-Host "   Copia en: Supabase Dashboard → SQL Editor"
Write-Host ""
Write-Host "3. Compila la app con los nuevos permisos:"
Write-Host "   npx expo prebuild --clean"
Write-Host "   npx expo run:android"
Write-Host ""
Write-Host "4. Lee la documentación completa:"
Write-Host "   GUIA-ALERTAS-GEOGRAFICAS.md"
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════"
Write-Host ""


