-- ==============================================
-- MIGRACIÓN 004: Mejoras sistema de mensajería
-- ==============================================

-- Asegurar columnas de control de fechas en conversations y messages
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Función utilitaria para mantener actualizado el campo updated_at en conversaciones
CREATE OR REPLACE FUNCTION bump_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bump_conversation_updated_at ON messages;
CREATE TRIGGER bump_conversation_updated_at
AFTER INSERT OR UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION bump_conversation_updated_at();

-- Política RLS para permitir actualizar mensajes (marcar como leído)
DROP POLICY IF EXISTS "Users can update messages in own conversations" ON messages;
CREATE POLICY "Users can update messages in own conversations" ON messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND (conversations.participant_1 = auth.uid() OR conversations.participant_2 = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND (conversations.participant_1 = auth.uid() OR conversations.participant_2 = auth.uid())
    )
  );

-- Función: obtener conversaciones de un usuario con último mensaje y contador de no leídos
CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  report_id UUID,
  report_type TEXT,
  report_status TEXT,
  report_pet_name TEXT,
  report_photos JSONB,
  report_reporter_id UUID,
  other_user_id UUID,
  other_user_name TEXT,
  other_user_avatar TEXT,
  other_user_phone TEXT,
  last_message_id UUID,
  last_message_content TEXT,
  last_message_image_url TEXT,
  last_message_created_at TIMESTAMP WITH TIME ZONE,
  last_message_sender_id UUID,
  last_message_read_at TIMESTAMP WITH TIME ZONE,
  unread_count BIGINT,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
WITH base AS (
  SELECT
    c.*,
    CASE
      WHEN c.participant_1 = p_user_id THEN c.participant_2
      ELSE c.participant_1
    END AS other_user_id
  FROM conversations c
  WHERE c.participant_1 = p_user_id OR c.participant_2 = p_user_id
),
last_msg AS (
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.id,
    m.content,
    m.image_url,
    m.created_at,
    m.sender_id,
    m.read_at
  FROM messages m
  ORDER BY m.conversation_id, m.created_at DESC
),
unread AS (
  SELECT
    m.conversation_id,
    COUNT(*) AS unread_count
  FROM messages m
  WHERE m.sender_id <> p_user_id
    AND m.read_at IS NULL
  GROUP BY m.conversation_id
)
SELECT
  b.id AS conversation_id,
  b.report_id,
  r.type AS report_type,
  r.status AS report_status,
  r.pet_name AS report_pet_name,
  r.photos AS report_photos,
  r.reporter_id AS report_reporter_id,
  p.id AS other_user_id,
  COALESCE(p.full_name, 'Usuario') AS other_user_name,
  p.avatar_url AS other_user_avatar,
  p.phone AS other_user_phone,
  lm.id AS last_message_id,
  lm.content AS last_message_content,
  lm.image_url AS last_message_image_url,
  lm.created_at AS last_message_created_at,
  lm.sender_id AS last_message_sender_id,
  lm.read_at AS last_message_read_at,
  COALESCE(u.unread_count, 0) AS unread_count,
  b.updated_at
FROM base b
LEFT JOIN reports r ON r.id = b.report_id
LEFT JOIN profiles p ON p.id = b.other_user_id
LEFT JOIN last_msg lm ON lm.conversation_id = b.id
LEFT JOIN unread u ON u.conversation_id = b.id
ORDER BY b.updated_at DESC;
$$ LANGUAGE sql STABLE;

-- Función: detalle puntual de conversación
CREATE OR REPLACE FUNCTION get_conversation_detail(p_conversation_id UUID, p_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  report_id UUID,
  report_type TEXT,
  report_status TEXT,
  report_pet_name TEXT,
  report_photos JSONB,
  report_reporter_id UUID,
  other_user_id UUID,
  other_user_name TEXT,
  other_user_avatar TEXT,
  other_user_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
SELECT
  c.id AS conversation_id,
  c.report_id,
  r.type AS report_type,
  r.status AS report_status,
  r.pet_name AS report_pet_name,
  r.photos AS report_photos,
  r.reporter_id AS report_reporter_id,
  CASE
    WHEN c.participant_1 = p_user_id THEN c.participant_2
    ELSE c.participant_1
  END AS other_user_id,
  COALESCE(p.full_name, 'Usuario') AS other_user_name,
  p.avatar_url AS other_user_avatar,
  p.phone AS other_user_phone,
  c.created_at,
  c.updated_at
FROM conversations c
LEFT JOIN reports r ON r.id = c.report_id
LEFT JOIN profiles p ON p.id = CASE
  WHEN c.participant_1 = p_user_id THEN c.participant_2
  ELSE c.participant_1
END
WHERE c.id = p_conversation_id
  AND (c.participant_1 = p_user_id OR c.participant_2 = p_user_id);
$$ LANGUAGE sql STABLE;

-- Función: obtener mensajes (paginado por cursor)
CREATE OR REPLACE FUNCTION get_conversation_messages(
  p_conversation_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_cursor TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  sender_id UUID,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE
) AS $$
SELECT
  m.id,
  m.conversation_id,
  m.sender_id,
  m.content,
  m.image_url,
  m.created_at,
  m.read_at
FROM messages m
WHERE m.conversation_id = p_conversation_id
  AND (p_cursor IS NULL OR m.created_at < p_cursor)
ORDER BY m.created_at DESC
LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$ LANGUAGE sql STABLE;

-- Función: marcar mensajes como leídos
CREATE OR REPLACE FUNCTION mark_conversation_messages_read(
  p_conversation_id UUID,
  p_user_id UUID
) RETURNS INTEGER AS $$
WITH updated AS (
  UPDATE messages
  SET read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND sender_id <> p_user_id
    AND read_at IS NULL
  RETURNING 1
)
SELECT COUNT(*) FROM updated;
$$ LANGUAGE sql VOLATILE;

-- Tabla para almacenar tokens de notificaciones push
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expo_token TEXT NOT NULL,
  platform TEXT,
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, expo_token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can manage own push tokens" ON push_tokens;

CREATE POLICY "Users can view own push tokens" ON push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own push tokens" ON push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_push_tokens_updated_at ON push_tokens;
CREATE TRIGGER update_push_tokens_updated_at
BEFORE UPDATE ON push_tokens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Función utilitaria para registrar tokens de push
CREATE OR REPLACE FUNCTION register_push_token(
  p_user_id UUID,
  p_expo_token TEXT,
  p_platform TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL
)
RETURNS push_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_user UUID;
  result push_tokens;
BEGIN
  effective_user := COALESCE(p_user_id, auth.uid());

  IF effective_user IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Se requiere un usuario autenticado';
  END IF;

  IF effective_user <> auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No puedes registrar tokens para otro usuario';
  END IF;

  INSERT INTO push_tokens (user_id, expo_token, platform, device_id)
  VALUES (effective_user, p_expo_token, p_platform, p_device_id)
  ON CONFLICT (user_id, expo_token) DO UPDATE
    SET platform = COALESCE(EXCLUDED.platform, push_tokens.platform),
        device_id = COALESCE(EXCLUDED.device_id, push_tokens.device_id),
        updated_at = NOW()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- Cola de notificaciones para enviar push asíncronamente
CREATE TABLE IF NOT EXISTS message_notifications_queue (
  id BIGSERIAL PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE message_notifications_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to notification queue" ON message_notifications_queue;
CREATE POLICY "No direct access to notification queue" ON message_notifications_queue
  FOR ALL
  USING (false);

-- Trigger para encolar notificaciones cuando se crea un mensaje
CREATE OR REPLACE FUNCTION enqueue_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient UUID;
BEGIN
  SELECT CASE
           WHEN c.participant_1 = NEW.sender_id THEN c.participant_2
           ELSE c.participant_1
         END
    INTO recipient
  FROM conversations c
  WHERE c.id = NEW.conversation_id;

  IF recipient IS NULL OR recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO message_notifications_queue (
    message_id,
    conversation_id,
    recipient_id,
    payload
  )
  VALUES (
    NEW.id,
    NEW.conversation_id,
    recipient,
    jsonb_build_object(
      'message_id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'content', NEW.content,
      'image_url', NEW.image_url,
      'created_at', NEW.created_at
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enqueue_message_notification_trigger ON messages;
CREATE TRIGGER enqueue_message_notification_trigger
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION enqueue_message_notification();



