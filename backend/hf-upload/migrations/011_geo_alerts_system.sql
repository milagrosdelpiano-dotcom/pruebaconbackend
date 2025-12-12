-- =====================================================
-- SISTEMA DE ALERTAS GEOGRÁFICAS PARA MASCOTAS PERDIDAS
-- =====================================================
-- Este archivo configura:
-- 1. Tabla para almacenar ubicaciones de usuarios
-- 2. Tabla para configuración de alertas
-- 3. Tabla para notificaciones de alertas geográficas
-- 4. Función para calcular distancia entre dos puntos
-- 5. Función para encontrar usuarios cercanos
-- 6. Función para enviar alertas geográficas
-- 7. Trigger que se activa al crear nuevo reporte
-- =====================================================

-- Habilitar extensión PostGIS si no está habilitada
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================
-- 1. TABLA: user_locations
-- Almacena la última ubicación conocida de cada usuario
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    location geography(POINT, 4326) NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy double precision, -- precisión en metros
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    
    -- Un usuario solo puede tener una ubicación activa
    UNIQUE(user_id)
);

-- Índices para optimizar búsquedas geográficas
CREATE INDEX IF NOT EXISTS idx_user_locations_location 
ON public.user_locations USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_user_locations_user_id 
ON public.user_locations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_locations_updated_at 
ON public.user_locations(updated_at DESC);

COMMENT ON TABLE public.user_locations IS 
'Almacena la última ubicación conocida de cada usuario para alertas geográficas';


-- =====================================================
-- 2. TABLA: user_alert_preferences
-- Configuración de alertas de cada usuario
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_alert_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled boolean DEFAULT true,
    radius_meters integer DEFAULT 1000, -- radio de alerta en metros (1km por defecto)
    alert_types text[] DEFAULT ARRAY['lost'], -- tipos de reportes: 'lost', 'found'
    species_filter text[], -- NULL = todas las especies, o ['dog', 'cat', etc.]
    quiet_hours_start time, -- hora de inicio de horario silencioso
    quiet_hours_end time, -- hora de fin de horario silencioso
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    
    -- Un usuario solo puede tener una configuración
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_preferences_user_id 
ON public.user_alert_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_alert_preferences_enabled 
ON public.user_alert_preferences(enabled) WHERE enabled = true;

COMMENT ON TABLE public.user_alert_preferences IS 
'Configuración de preferencias de alertas geográficas por usuario';


-- =====================================================
-- 3. TABLA: geo_alert_notifications_queue
-- Cola de notificaciones de alertas geográficas
-- =====================================================

CREATE TABLE IF NOT EXISTS public.geo_alert_notifications_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    distance_meters double precision NOT NULL, -- distancia entre usuario y reporte
    notification_data jsonb NOT NULL, -- datos del reporte para la notificación
    processed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Índices para optimizar procesamiento
CREATE INDEX IF NOT EXISTS idx_geo_alerts_queue_pending 
ON public.geo_alert_notifications_queue(created_at) 
WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_geo_alerts_queue_recipient 
ON public.geo_alert_notifications_queue(recipient_id, processed_at);

CREATE INDEX IF NOT EXISTS idx_geo_alerts_queue_report 
ON public.geo_alert_notifications_queue(report_id);

COMMENT ON TABLE public.geo_alert_notifications_queue IS 
'Cola de notificaciones de alertas geográficas pendientes de enviar';


-- =====================================================
-- 4. FUNCIÓN: Actualizar o crear ubicación de usuario
-- =====================================================

CREATE OR REPLACE FUNCTION upsert_user_location(
    p_user_id uuid,
    p_latitude double precision,
    p_longitude double precision,
    p_accuracy double precision DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_location_id uuid;
BEGIN
    INSERT INTO public.user_locations (
        user_id,
        location,
        latitude,
        longitude,
        accuracy,
        updated_at
    )
    VALUES (
        p_user_id,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        p_latitude,
        p_longitude,
        p_accuracy,
        now()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        location = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        latitude = p_latitude,
        longitude = p_longitude,
        accuracy = p_accuracy,
        updated_at = now()
    RETURNING id INTO v_location_id;
    
    RETURN v_location_id;
END;
$$;

COMMENT ON FUNCTION upsert_user_location IS 
'Actualiza o crea la ubicación de un usuario para alertas geográficas';


-- =====================================================
-- 5. FUNCIÓN: Encontrar usuarios cercanos a un punto
-- =====================================================

CREATE OR REPLACE FUNCTION find_nearby_users(
    p_latitude double precision,
    p_longitude double precision,
    p_radius_meters integer DEFAULT 1000
)
RETURNS TABLE(
    user_id uuid,
    distance_meters double precision,
    alert_radius_meters integer,
    alert_types text[],
    species_filter text[]
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_point geography;
BEGIN
    -- Crear punto geográfico
    v_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;
    
    RETURN QUERY
    SELECT 
        ul.user_id,
        ST_Distance(ul.location, v_point)::double precision AS distance_meters,
        COALESCE(uap.radius_meters, 1000) AS alert_radius_meters,
        COALESCE(uap.alert_types, ARRAY['lost']::text[]) AS alert_types,
        uap.species_filter
    FROM public.user_locations ul
    LEFT JOIN public.user_alert_preferences uap ON uap.user_id = ul.user_id
    WHERE 
        -- Usuario tiene alertas habilitadas (o no tiene preferencias = habilitado por defecto)
        (uap.enabled IS NULL OR uap.enabled = true)
        -- La ubicación del usuario es reciente (últimas 24 horas)
        AND ul.updated_at > now() - INTERVAL '24 hours'
        -- El usuario está dentro del radio especificado
        AND ST_DWithin(ul.location, v_point, COALESCE(uap.radius_meters, p_radius_meters))
        -- No estamos en horario silencioso
        AND (
            uap.quiet_hours_start IS NULL 
            OR uap.quiet_hours_end IS NULL
            OR NOT (CURRENT_TIME BETWEEN uap.quiet_hours_start AND uap.quiet_hours_end)
        );
END;
$$;

COMMENT ON FUNCTION find_nearby_users IS 
'Encuentra usuarios con alertas habilitadas dentro del radio especificado';


-- =====================================================
-- 6. FUNCIÓN: Encolar alertas geográficas
-- =====================================================

CREATE OR REPLACE FUNCTION enqueue_geo_alerts(
    p_report_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_report RECORD;
    v_nearby_user RECORD;
    v_notification_data jsonb;
    v_count integer := 0;
BEGIN
    -- Obtener información del reporte
    SELECT 
        r.id,
        r.type,
        r.reporter_id,
        r.pet_name,
        r.species,
        r.breed,
        r.color,
        r.size,
        r.description,
        r.address,
        r.photos,
        CASE 
            WHEN r.location IS NOT NULL THEN ST_Y(r.location::geometry)::double precision
            ELSE NULL
        END AS latitude,
        CASE 
            WHEN r.location IS NOT NULL THEN ST_X(r.location::geometry)::double precision
            ELSE NULL
        END AS longitude,
        COALESCE(p.full_name, 'Usuario') AS reporter_name
    INTO v_report
    FROM public.reports r
    LEFT JOIN public.profiles p ON p.id = r.reporter_id
    WHERE r.id = p_report_id;
    
    -- Si no hay reporte o no tiene ubicación, salir
    IF v_report.id IS NULL OR v_report.latitude IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Preparar datos de notificación
    v_notification_data := jsonb_build_object(
        'report_id', v_report.id,
        'type', v_report.type,
        'pet_name', v_report.pet_name,
        'species', v_report.species,
        'breed', v_report.breed,
        'color', v_report.color,
        'size', v_report.size,
        'description', v_report.description,
        'address', v_report.address,
        'reporter_name', v_report.reporter_name,
        'photo', CASE WHEN array_length(v_report.photos, 1) > 0 THEN v_report.photos[1] ELSE NULL END,
        'latitude', v_report.latitude,
        'longitude', v_report.longitude
    );
    
    -- Encontrar usuarios cercanos y encolar notificaciones
    FOR v_nearby_user IN 
        SELECT * FROM find_nearby_users(v_report.latitude, v_report.longitude, 5000) -- buscar hasta 5km
    LOOP
        -- Verificar que el usuario no sea el reportero
        IF v_nearby_user.user_id != v_report.reporter_id THEN
            -- Verificar filtros de tipo de reporte
            IF v_report.type = ANY(v_nearby_user.alert_types) THEN
                -- Verificar filtros de especie (NULL = todas)
                IF v_nearby_user.species_filter IS NULL 
                   OR v_report.species = ANY(v_nearby_user.species_filter) THEN
                    
                    -- Encolar notificación
                    INSERT INTO public.geo_alert_notifications_queue (
                        recipient_id,
                        report_id,
                        distance_meters,
                        notification_data
                    )
                    VALUES (
                        v_nearby_user.user_id,
                        v_report.id,
                        v_nearby_user.distance_meters,
                        v_notification_data
                    );
                    
                    v_count := v_count + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;
    
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION enqueue_geo_alerts IS 
'Encola notificaciones de alerta geográfica para usuarios cercanos a un nuevo reporte';


-- =====================================================
-- 7. TRIGGER: Enviar alertas al crear reporte
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_geo_alerts_on_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Solo para reportes activos con ubicación
    IF NEW.status = 'active' AND NEW.location IS NOT NULL THEN
        -- Encolar alertas de forma asíncrona
        PERFORM enqueue_geo_alerts(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_geo_alerts_on_new_report ON public.reports;

CREATE TRIGGER trigger_geo_alerts_on_new_report
    AFTER INSERT ON public.reports
    FOR EACH ROW
    EXECUTE FUNCTION trigger_geo_alerts_on_report();

COMMENT ON FUNCTION trigger_geo_alerts_on_report IS 
'Trigger que encola alertas geográficas cuando se crea un nuevo reporte';


-- =====================================================
-- 8. FUNCIÓN: Procesar cola de alertas geográficas
-- =====================================================

CREATE OR REPLACE FUNCTION invoke_geo_alerts_edge_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Obtener URL del proyecto desde configuración
  function_url := current_setting('app.supabase_url', true) || '/functions/v1/send-geo-alerts';
  service_role_key := current_setting('app.supabase_service_role_key', true);

  -- Invocar la Edge Function usando http extension
  PERFORM
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := '{}'::jsonb
    );

  RAISE NOTICE 'Geo alerts edge function invocada: %', function_url;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error invocando geo alerts edge function: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION invoke_geo_alerts_edge_function IS 
'Invoca la Edge Function para procesar alertas geográficas pendientes';


-- =====================================================
-- 9. TRIGGER: Procesar alertas inmediatamente
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_process_geo_alert_immediately()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Invocar Edge Function inmediatamente
    PERFORM invoke_geo_alerts_edge_function();
    
    -- Enviar notificación de canal también
    PERFORM pg_notify('new_geo_alert', NEW.id::text);
    
    RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_process_geo_alert_immediately ON public.geo_alert_notifications_queue;

CREATE TRIGGER trigger_process_geo_alert_immediately
    AFTER INSERT ON public.geo_alert_notifications_queue
    FOR EACH ROW
    EXECUTE FUNCTION trigger_process_geo_alert_immediately();


-- =====================================================
-- 10. FUNCIONES UTILITARIAS
-- =====================================================

-- Función para obtener estadísticas del sistema
CREATE OR REPLACE FUNCTION get_geo_alerts_stats()
RETURNS TABLE(
    stat_name TEXT,
    stat_value TEXT,
    description TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- Usuarios con ubicación activa
    RETURN QUERY
    SELECT 
        'Usuarios con ubicación'::TEXT,
        COUNT(*)::TEXT,
        'Usuarios que han compartido su ubicación en las últimas 24h'::TEXT
    FROM public.user_locations
    WHERE updated_at > now() - INTERVAL '24 hours';
    
    -- Usuarios con alertas habilitadas
    RETURN QUERY
    SELECT 
        'Usuarios con alertas activas'::TEXT,
        COUNT(*)::TEXT,
        'Usuarios que tienen alertas geográficas habilitadas'::TEXT
    FROM public.user_alert_preferences
    WHERE enabled = true;
    
    -- Alertas pendientes
    RETURN QUERY
    SELECT 
        'Alertas pendientes'::TEXT,
        COUNT(*)::TEXT,
        'Alertas geográficas en cola sin procesar'::TEXT
    FROM public.geo_alert_notifications_queue
    WHERE processed_at IS NULL;
    
    -- Alertas enviadas hoy
    RETURN QUERY
    SELECT 
        'Alertas enviadas hoy'::TEXT,
        COUNT(*)::TEXT,
        'Alertas procesadas en las últimas 24h'::TEXT
    FROM public.geo_alert_notifications_queue
    WHERE processed_at > now() - INTERVAL '24 hours';
    
    -- Radio promedio de alertas
    RETURN QUERY
    SELECT 
        'Radio promedio'::TEXT,
        COALESCE(ROUND(AVG(radius_meters))::TEXT, '1000') || ' metros'::TEXT,
        'Radio promedio configurado por usuarios'::TEXT
    FROM public.user_alert_preferences
    WHERE enabled = true;
END;
$$;

COMMENT ON FUNCTION get_geo_alerts_stats IS 
'Obtiene estadísticas del sistema de alertas geográficas';


-- Función para limpiar alertas antiguas
CREATE OR REPLACE FUNCTION cleanup_old_geo_alerts(
    days_old INTEGER DEFAULT 7
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.geo_alert_notifications_queue
    WHERE processed_at IS NOT NULL
      AND processed_at < now() - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_geo_alerts IS 
'Elimina alertas geográficas procesadas mayores a X días';


-- =====================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_alert_notifications_queue ENABLE ROW LEVEL SECURITY;

-- Políticas para user_locations
CREATE POLICY "Los usuarios pueden ver su propia ubicación"
    ON public.user_locations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar su propia ubicación"
    ON public.user_locations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden modificar su propia ubicación"
    ON public.user_locations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar su propia ubicación"
    ON public.user_locations FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para user_alert_preferences
CREATE POLICY "Los usuarios pueden ver sus preferencias"
    ON public.user_alert_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus preferencias"
    ON public.user_alert_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus preferencias"
    ON public.user_alert_preferences FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus preferencias"
    ON public.user_alert_preferences FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para geo_alert_notifications_queue
-- Solo service_role y triggers pueden escribir
CREATE POLICY "Usuarios no pueden acceder directamente a la cola"
    ON public.geo_alert_notifications_queue FOR ALL
    USING (false);


-- =====================================================
-- 12. GRANTS Y PERMISOS
-- =====================================================

-- Permisos para funciones
GRANT EXECUTE ON FUNCTION upsert_user_location TO authenticated;
GRANT EXECUTE ON FUNCTION find_nearby_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_geo_alerts_stats TO authenticated;

-- Solo service_role para funciones de procesamiento
REVOKE EXECUTE ON FUNCTION enqueue_geo_alerts FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION invoke_geo_alerts_edge_function FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cleanup_old_geo_alerts FROM PUBLIC;


-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SISTEMA DE ALERTAS GEOGRÁFICAS INSTALADO';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Tablas creadas:';
    RAISE NOTICE '   - user_locations';
    RAISE NOTICE '   - user_alert_preferences';
    RAISE NOTICE '   - geo_alert_notifications_queue';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Funciones creadas:';
    RAISE NOTICE '   - upsert_user_location()';
    RAISE NOTICE '   - find_nearby_users()';
    RAISE NOTICE '   - enqueue_geo_alerts()';
    RAISE NOTICE '   - get_geo_alerts_stats()';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Triggers configurados:';
    RAISE NOTICE '   - Al crear reporte → enviar alertas';
    RAISE NOTICE '   - Al encolar alerta → procesar inmediatamente';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Verificar estado:';
    RAISE NOTICE '   SELECT * FROM get_geo_alerts_stats();';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  SIGUIENTES PASOS:';
    RAISE NOTICE '1. Desplegar Edge Function: send-geo-alerts';
    RAISE NOTICE '2. Implementar frontend para rastreo de ubicación';
    RAISE NOTICE '3. Configurar permisos de ubicación en app.json';
    RAISE NOTICE '';
END $$;


