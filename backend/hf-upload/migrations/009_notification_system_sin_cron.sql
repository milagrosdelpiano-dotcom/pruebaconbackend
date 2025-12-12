-- =====================================================
-- SISTEMA DE NOTIFICACIONES PUSH - SIN PG_CRON
-- =====================================================
-- Este archivo configura:
-- 1. Función para invocar Edge Function de notificaciones
-- 2. Índices para optimizar rendimiento
-- 3. Funciones de monitoreo y utilidad
--
-- NOTA: El trigger de tiempo real se configura mediante
--       Database Webhook nativo de Supabase (ver CONFIGURAR-WEBHOOK.md)
-- =====================================================

-- =====================================================
-- 1. FUNCIÓN PARA INVOCAR EDGE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION invoke_push_notification_edge_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url TEXT;
  service_role_key TEXT;
  result TEXT;
BEGIN
  -- Obtener URL del proyecto desde configuración
  -- IMPORTANTE: Configurar estas variables en Supabase Dashboard
  -- Settings > Database > Custom PostgreSQL Configuration
  function_url := current_setting('app.supabase_url', true) || '/functions/v1/send-push-notification';
  service_role_key := current_setting('app.supabase_service_role_key', true);

  -- Invocar la Edge Function usando http extension
  -- NOTA: Requiere la extensión pg_net
  PERFORM
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := '{}'::jsonb
    );

  -- Log para debugging
  RAISE NOTICE 'Edge function invocada: %', function_url;

EXCEPTION WHEN OTHERS THEN
  -- No fallar si hay error, solo loguear
  RAISE WARNING 'Error invocando edge function: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION invoke_push_notification_edge_function IS 
'Invoca la Edge Function para procesar notificaciones push pendientes';


-- =====================================================
-- 2. ÍNDICES PARA OPTIMIZAR CONSULTAS
-- =====================================================

-- Índice para buscar notificaciones pendientes eficientemente
CREATE INDEX IF NOT EXISTS idx_notifications_queue_pending 
ON message_notifications_queue(created_at) 
WHERE processed_at IS NULL;

-- Índice para limpiezas de notificaciones antiguas
CREATE INDEX IF NOT EXISTS idx_notifications_queue_processed 
ON message_notifications_queue(processed_at) 
WHERE processed_at IS NOT NULL;

-- Índice para buscar por destinatario
CREATE INDEX IF NOT EXISTS idx_notifications_queue_recipient 
ON message_notifications_queue(recipient_id, processed_at);


-- =====================================================
-- 3. FUNCIÓN PARA VERIFICAR ESTADO DEL SISTEMA
-- =====================================================

CREATE OR REPLACE FUNCTION check_notification_system_status()
RETURNS TABLE(
  status_item TEXT,
  status_value TEXT,
  details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notificaciones pendientes
  RETURN QUERY
  SELECT 
    'Pendientes'::TEXT,
    COUNT(*)::TEXT,
    'Notificaciones en cola sin procesar'::TEXT
  FROM message_notifications_queue
  WHERE processed_at IS NULL;

  -- Notificaciones procesadas hoy
  RETURN QUERY
  SELECT 
    'Procesadas hoy'::TEXT,
    COUNT(*)::TEXT,
    'Notificaciones enviadas en las últimas 24h'::TEXT
  FROM message_notifications_queue
  WHERE processed_at >= NOW() - INTERVAL '24 hours';

  -- Usuarios con tokens activos
  RETURN QUERY
  SELECT 
    'Usuarios con tokens'::TEXT,
    COUNT(DISTINCT user_id)::TEXT,
    'Usuarios que pueden recibir notificaciones'::TEXT
  FROM push_tokens;

  -- Última notificación procesada
  RETURN QUERY
  SELECT 
    'Última procesada'::TEXT,
    COALESCE(
      TO_CHAR(MAX(processed_at), 'YYYY-MM-DD HH24:MI:SS'),
      'Nunca'
    )::TEXT,
    'Timestamp de última notificación enviada'::TEXT
  FROM message_notifications_queue
  WHERE processed_at IS NOT NULL;

END;
$$;

COMMENT ON FUNCTION check_notification_system_status IS 
'Función para verificar el estado del sistema de notificaciones';


-- =====================================================
-- 4. FUNCIÓN PARA REPROCESAR NOTIFICACIONES FALLIDAS
-- =====================================================

CREATE OR REPLACE FUNCTION retry_failed_notifications(
  older_than_minutes INTEGER DEFAULT 10
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Contar notificaciones antiguas sin procesar
  SELECT COUNT(*) INTO affected_rows
  FROM message_notifications_queue
  WHERE processed_at IS NULL
    AND created_at < NOW() - (older_than_minutes || ' minutes')::INTERVAL;

  -- Invocar procesamiento si hay notificaciones pendientes
  IF affected_rows > 0 THEN
    PERFORM invoke_push_notification_edge_function();
  END IF;

  RETURN affected_rows;
END;
$$;

COMMENT ON FUNCTION retry_failed_notifications IS 
'Reintenta enviar notificaciones que llevan más de X minutos sin procesarse';


-- =====================================================
-- 5. FUNCIÓN PARA LIMPIAR NOTIFICACIONES ANTIGUAS
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_notifications(
  days_old INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Eliminar notificaciones procesadas antiguas
  DELETE FROM message_notifications_queue
  WHERE processed_at IS NOT NULL
    AND processed_at < NOW() - (days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_notifications IS 
'Elimina notificaciones procesadas mayores a X días';


-- =====================================================
-- 6. GRANTS Y PERMISOS
-- =====================================================

-- Permitir a usuarios autenticados consultar el estado
GRANT EXECUTE ON FUNCTION check_notification_system_status() TO authenticated;

-- Solo service_role puede invocar funciones de procesamiento
REVOKE EXECUTE ON FUNCTION invoke_push_notification_edge_function() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION retry_failed_notifications(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cleanup_old_notifications(INTEGER) FROM PUBLIC;


-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SISTEMA DE NOTIFICACIONES CONFIGURADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Ejecuta esta query para verificar:';
  RAISE NOTICE 'SELECT * FROM check_notification_system_status();';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  SIGUIENTES PASOS:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Configura variables en Supabase Dashboard:';
  RAISE NOTICE '   Settings > Database > Custom PostgreSQL Configuration';
  RAISE NOTICE '   app.supabase_url = https://TU_PROJECT_REF.supabase.co';
  RAISE NOTICE '   app.supabase_service_role_key = TU_SERVICE_ROLE_KEY';
  RAISE NOTICE '';
  RAISE NOTICE '2. Desplegar Edge Function';
  RAISE NOTICE '';
  RAISE NOTICE '3. Configura Database Webhook:';
  RAISE NOTICE '   Ver instrucciones en: CONFIGURAR-WEBHOOK.md';
  RAISE NOTICE '   Dashboard > Database > Webhooks > Enable and create a new hook';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTA: pg_cron no está disponible en tu plan.';
  RAISE NOTICE 'El sistema funcionará perfectamente con solo el webhook.';
END $$;



