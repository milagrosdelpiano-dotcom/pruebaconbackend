-- 🔧 Procesar alertas manualmente

-- Opción 1: Invocar Edge Function directamente (si está configurada)
SELECT invoke_geo_alerts_edge_function();

-- Opción 2: Verificar si hay alertas pendientes
SELECT 
    COUNT(*) as alertas_pendientes,
    COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as procesadas,
    COUNT(*) FILTER (WHERE processed_at IS NULL) as sin_procesar
FROM geo_alert_notifications_queue
WHERE recipient_id IN (
    '5973ee88-8409-4be6-8884-36a4ad29ad7c',
    'b3b9d127-50e0-4217-8c6b-cc2936b326bb'
);

-- Opción 3: Ver detalles de alertas pendientes
SELECT 
    ganq.id,
    u.email,
    ganq.distance_meters,
    ganq.notification_data->>'pet_name' as mascota,
    ganq.processed_at,
    ganq.created_at,
    CASE 
        WHEN ganq.processed_at IS NULL THEN '⏳ PENDIENTE'
        ELSE '✅ PROCESADA'
    END as estado
FROM geo_alert_notifications_queue ganq
LEFT JOIN auth.users u ON u.id = ganq.recipient_id
WHERE ganq.recipient_id IN (
    '5973ee88-8409-4be6-8884-36a4ad29ad7c',
    'b3b9d127-50e0-4217-8c6b-cc2936b326bb'
)
ORDER BY ganq.created_at DESC;

