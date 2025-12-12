-- ==============================================
-- ESQUEMA DE BASE DE DATOS PARA PETALERT (VERSIÓN MEJORADA)
-- ==============================================
-- Esta versión maneja los errores de elementos que ya existen

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ==============================================
-- TABLA: profiles (Perfiles de usuarios)
-- ==============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    location GEOMETRY(POINT, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- TABLA: pets (Mascotas)
-- ==============================================
CREATE TABLE IF NOT EXISTS pets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    species TEXT NOT NULL CHECK (species IN ('dog', 'cat', 'bird', 'rabbit', 'other')),
    breed TEXT,
    color TEXT,
    size TEXT CHECK (size IN ('small', 'medium', 'large')),
    description TEXT,
    distinctive_features TEXT,
    photos TEXT[],
    is_lost BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- TABLA: reports (Reportes de mascotas perdidas/encontradas)
-- ==============================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('lost', 'found')),
    reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
    pet_name TEXT,
    species TEXT NOT NULL CHECK (species IN ('dog', 'cat', 'bird', 'rabbit', 'other')),
    breed TEXT,
    color TEXT,
    size TEXT CHECK (size IN ('small', 'medium', 'large')),
    description TEXT NOT NULL,
    distinctive_features TEXT,
    photos TEXT[],
    location GEOMETRY(POINT, 4326),
    address TEXT,
    location_details TEXT,
    incident_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'closed')),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- TABLA: conversations (Conversaciones entre usuarios)
-- ==============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    participant_1 UUID REFERENCES profiles(id) ON DELETE CASCADE,
    participant_2 UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(report_id, participant_1, participant_2)
);

-- ==============================================
-- TABLA: messages (Mensajes)
-- ==============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- ==============================================

-- Índices espaciales para búsquedas geográficas
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles USING GIST (location);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_reports_type_status ON reports (type, status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_species ON reports (species);
CREATE INDEX IF NOT EXISTS idx_pets_owner ON pets (owner_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_report ON conversations (report_id);

-- ==============================================
-- POLÍTICAS DE SEGURIDAD (RLS) - CON MANEJO DE ERRORES
-- ==============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes antes de recrearlas
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view all pets" ON pets;
DROP POLICY IF EXISTS "Users can manage own pets" ON pets;

DROP POLICY IF EXISTS "Users can view all active reports" ON reports;
DROP POLICY IF EXISTS "Users can view own reports" ON reports;
DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Users can update own reports" ON reports;

DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages in own conversations" ON messages;

-- Recrear políticas para profiles
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Recrear políticas para pets
CREATE POLICY "Users can view all pets" ON pets FOR SELECT USING (true);
CREATE POLICY "Users can manage own pets" ON pets FOR ALL USING (auth.uid() = owner_id);

-- Recrear políticas para reports
CREATE POLICY "Users can view all active reports" ON reports FOR SELECT USING (status = 'active');
CREATE POLICY "Users can view own reports" ON reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can update own reports" ON reports FOR UPDATE USING (auth.uid() = reporter_id);

-- Recrear políticas para conversations
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT USING (
    auth.uid() = participant_1 OR auth.uid() = participant_2
);
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT WITH CHECK (
    auth.uid() = participant_1 OR auth.uid() = participant_2
);

-- Recrear políticas para messages
CREATE POLICY "Users can view messages in own conversations" ON messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = messages.conversation_id 
        AND (conversations.participant_1 = auth.uid() OR conversations.participant_2 = auth.uid())
    )
);
CREATE POLICY "Users can send messages in own conversations" ON messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = messages.conversation_id 
        AND (conversations.participant_1 = auth.uid() OR conversations.participant_2 = auth.uid())
    )
);

-- ==============================================
-- FUNCIONES AUXILIARES - CON MANEJO DE ERRORES
-- ==============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Eliminar triggers existentes antes de recrearlos
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_pets_updated_at ON pets;
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;

-- Recrear triggers para updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pets_updated_at BEFORE UPDATE ON pets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- CONFIGURAR STORAGE PARA FOTOS - CON MANEJO DE ERRORES
-- ==============================================

-- Crear buckets para almacenar fotos
INSERT INTO storage.buckets (id, name, public) VALUES 
    ('avatars', 'avatars', true),
    ('pet-photos', 'pet-photos', true),
    ('report-photos', 'report-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Eliminar políticas de storage existentes
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Pet photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Report photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatar images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload pet photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload report photos" ON storage.objects;

-- Recrear políticas para storage
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Pet photos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'pet-photos');
CREATE POLICY "Report photos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'report-photos');

CREATE POLICY "Users can upload avatar images" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload pet photos" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'pet-photos' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload report photos" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'report-photos' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ==============================================
-- DATOS DE PRUEBA (OPCIONAL)
-- ==============================================

-- Insertar algunos datos de ejemplo para probar
INSERT INTO profiles (id, full_name) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Usuario Demo')
ON CONFLICT (id) DO NOTHING;

-- ==============================================
-- VERIFICACIÓN FINAL
-- ==============================================

-- Verificar que todo se creó correctamente
SELECT 
    'profiles' as tabla, 
    COUNT(*) as registros 
FROM profiles
UNION ALL
SELECT 
    'pets' as tabla, 
    COUNT(*) as registros 
FROM pets
UNION ALL
SELECT 
    'reports' as tabla, 
    COUNT(*) as registros 
FROM reports
UNION ALL
SELECT 
    'conversations' as tabla, 
    COUNT(*) as registros 
FROM conversations
UNION ALL
SELECT 
    'messages' as tabla, 
    COUNT(*) as registros 
FROM messages;

-- Mostrar mensaje de éxito
SELECT '✅ Base de datos configurada correctamente!' as mensaje;
