-- =====================================================
-- QUERIES PARA VERIFICAR SI SE CREARON ALERTAS
-- =====================================================
-- Ejecuta estas queries en Supabase Dashboard → SQL Editor
-- para verificar qué pasó cuando creaste el reporte
-- =====================================================

-- 1. Ver el reporte que acabas de crear
SELECT 
    id,
    type,
    pet_name,
    reporter_id,
    location,
    ST_Y(location::geometry) as latitude,
    ST_X(location::geometry) as longitude,
    status,
    created_at
FROM reports
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Ver tu ubicación registrada
SELECT 
    user_id,
    latitude,
    longitude,
    accuracy,
    updated_at,
    ST_Distance(
        location,
        (SELECT location FROM reports WHERE created_at > NOW() - INTERVAL '10 minutes' ORDER BY created_at DESC LIMIT 1)
    ) as distancia_metros
FROM user_locations
WHERE user_id = auth.uid();

-- 3. Ver si se crearon alertas para ti
SELECT 
    id,
    recipient_id,
    report_id,
    distance_meters,
    notification_data->>'pet_name' as mascota,
    notification_data->>'type' as tipo,
    processed_at,
    created_at
FROM geo_alert_notifications_queue
WHERE recipient_id = auth.uid()
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- 4. Ver todas las alertas recientes (últimos 10 minutos)
SELECT 
    ganq.id,
    ganq.recipient_id,
    p.full_name as destinatario,
    ganq.report_id,
    r.pet_name,
    ganq.distance_meters,
    ganq.processed_at,
    ganq.created_at
FROM geo_alert_notifications_queue ganq
LEFT JOIN profiles p ON p.id = ganq.recipient_id
LEFT JOIN reports r ON r.id = ganq.report_id
WHERE ganq.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY ganq.created_at DESC;

-- 5. Verificar que tienes tokens push registrados
SELECT 
    user_id,
    expo_token,
    platform,
    created_at
FROM push_tokens
WHERE user_id = auth.uid();

-- 6. Verificar tus preferencias de alertas
SELECT 
    user_id,
    enabled,
    radius_meters,
    alert_types,
    species_filter
FROM user_alert_preferences
WHERE user_id = auth.uid();

-- 7. Calcular distancia manualmente entre tu ubicación y el reporte
SELECT 
    ul.user_id,
    ul.latitude as tu_lat,
    ul.longitude as tu_lng,
    ST_Y(r.location::geometry) as reporte_lat,
    ST_X(r.location::geometry) as reporte_lng,
    ST_Distance(ul.location, r.location) as distancia_metros,
    r.pet_name,
    r.type as tipo_reporte
FROM user_locations ul
CROSS JOIN reports r
WHERE ul.user_id = auth.uid()
  AND r.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY r.created_at DESC
LIMIT 5;

