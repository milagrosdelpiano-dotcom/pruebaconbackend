-- =====================================================
-- DIAGNÓSTICO SIMPLE: Por qué no se crearon alertas
-- =====================================================
-- Ejecuta esta query para ver todos los factores
-- =====================================================

-- 1. Verificar distancia
SELECT 
    'Distancia al reporte' as item,
    ROUND(ST_Distance(
        (SELECT location FROM user_locations WHERE user_id = auth.uid()),
        (SELECT location FROM reports WHERE id = '5e2bf154-e75d-4823-aa2a-fb9b74f2a94c')
    ))::text || ' metros' as valor,
    'Distancia entre tu ubicación y el reporte' as descripcion;

-- 2. Verificar radio configurado
SELECT 
    'Radio configurado' as item,
    COALESCE(radius_meters::text, '1000') || ' metros' as valor,
    'Radio máximo para recibir alertas' as descripcion
FROM user_alert_preferences
WHERE user_id = auth.uid();

-- 3. Verificar si estás dentro del radio
SELECT 
    '¿Dentro del radio?' as item,
    CASE 
        WHEN ST_Distance(
            (SELECT location FROM user_locations WHERE user_id = auth.uid()),
            (SELECT location FROM reports WHERE id = '5e2bf154-e75d-4823-aa2a-fb9b74f2a94c')
        ) <= COALESCE(
            (SELECT radius_meters FROM user_alert_preferences WHERE user_id = auth.uid()),
            1000
        )
        THEN 'SÍ ✅'
        ELSE 'NO ❌ (distancia mayor al radio)'
    END as valor,
    'Si la distancia es menor al radio configurado' as descripcion;

-- 4. Verificar si alertas están habilitadas
SELECT 
    'Alertas habilitadas' as item,
    CASE 
        WHEN COALESCE(enabled, true) THEN 'SÍ ✅'
        ELSE 'NO ❌'
    END as valor,
    'Si tienes alertas activas' as descripcion
FROM user_alert_preferences
WHERE user_id = auth.uid();

-- 5. Verificar si el tipo está permitido
SELECT 
    'Tipo permitido' as item,
    CASE 
        WHEN (SELECT type FROM reports WHERE id = '5e2bf154-e75d-4823-aa2a-fb9b74f2a94c') = ANY(
            COALESCE(
                (SELECT alert_types FROM user_alert_preferences WHERE user_id = auth.uid()),
                ARRAY['lost']::text[]
            )
        )
        THEN 'SÍ ✅'
        ELSE 'NO ❌'
    END as valor,
    'Si el tipo del reporte está en tus preferencias' as descripcion;

-- 6. Intentar crear alertas manualmente
SELECT 
    'Crear alertas manualmente' as item,
    enqueue_geo_alerts('5e2bf154-e75d-4823-aa2a-fb9b74f2a94c')::text || ' alertas creadas' as valor,
    'Cantidad de alertas que se pueden crear para este reporte' as descripcion;

-- 7. Verificar si tienes ubicación registrada
SELECT 
    'Ubicación registrada' as item,
    CASE 
        WHEN EXISTS (SELECT 1 FROM user_locations WHERE user_id = auth.uid()) 
        THEN 'SÍ ✅'
        ELSE 'NO ❌'
    END as valor,
    'Si tienes ubicación en la base de datos' as descripcion;

