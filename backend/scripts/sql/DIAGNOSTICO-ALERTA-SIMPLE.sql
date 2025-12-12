-- 🔍 Diagnóstico: ¿Por qué solo se creó 1 alerta?

-- 1. Verificar que ambas cuentas tienen preferencias activas
SELECT 
    u.email,
    uap.enabled,
    uap.radius_meters,
    uap.alert_types
FROM user_alert_preferences uap
LEFT JOIN auth.users u ON u.id = uap.user_id
WHERE uap.user_id IN (
    '5973ee88-8409-4be6-8884-36a4ad29ad7c',
    'b3b9d127-50e0-4217-8c6b-cc2936b326bb'
);

-- 2. Verificar que ambas tienen ubicación
SELECT 
    u.email,
    ul.latitude,
    ul.longitude,
    ul.updated_at
FROM user_locations ul
LEFT JOIN auth.users u ON u.id = ul.user_id
WHERE ul.user_id IN (
    '5973ee88-8409-4be6-8884-36a4ad29ad7c',
    'b3b9d127-50e0-4217-8c6b-cc2936b326bb'
);

-- 3. Verificar quién es el reportero del reporte de "Dogo"
SELECT 
    r.id,
    r.reporter_id,
    u.email as reporter_email,
    r.pet_name
FROM reports r
LEFT JOIN auth.users u ON u.id = r.reporter_id
WHERE r.id = '5e2bf154-e75d-4823-aa2a-fb9b74f2a94c';

-- 4. Simular la función find_nearby_users manualmente
SELECT 
    ul.user_id,
    u.email,
    ROUND(ST_Distance(
        ul.location,
        (SELECT location FROM reports WHERE id = '5e2bf154-e75d-4823-aa2a-fb9b74f2a94c')
    )) as distancia_metros,
    uap.enabled,
    uap.radius_meters,
    uap.alert_types,
    r.reporter_id as report_reporter_id,
    CASE 
        WHEN ul.user_id = r.reporter_id THEN 'ES EL REPORTERO (se excluye)'
        ELSE 'NO es el reportero'
    END as es_reportero
FROM user_locations ul
LEFT JOIN auth.users u ON u.id = ul.user_id
LEFT JOIN user_alert_preferences uap ON uap.user_id = ul.user_id
LEFT JOIN reports r ON r.id = '5e2bf154-e75d-4823-aa2a-fb9b74f2a94c'
WHERE ul.user_id IN (
    '5973ee88-8409-4be6-8884-36a4ad29ad7c',
    'b3b9d127-50e0-4217-8c6b-cc2936b326bb'
)
AND uap.enabled = true
AND ST_DWithin(
    ul.location,
    (SELECT location FROM reports WHERE id = '5e2bf154-e75d-4823-aa2a-fb9b74f2a94c'),
    COALESCE(uap.radius_meters, 1000)
);

