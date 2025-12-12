-- ==============================================
-- MIGRACIÓN 008: Agregar columnas faltantes a la tabla pets
-- ==============================================
-- Este script agrega las columnas que pueden faltar en la tabla pets
-- si fue creada con un esquema anterior

-- Verificar y agregar columna 'description' si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pets' AND column_name = 'description'
    ) THEN
        ALTER TABLE pets ADD COLUMN description TEXT;
        RAISE NOTICE 'Columna description agregada a pets';
    ELSE
        RAISE NOTICE 'Columna description ya existe';
    END IF;
END $$;

-- Verificar y agregar columna 'distinctive_features' si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pets' AND column_name = 'distinctive_features'
    ) THEN
        ALTER TABLE pets ADD COLUMN distinctive_features TEXT;
        RAISE NOTICE 'Columna distinctive_features agregada a pets';
    ELSE
        RAISE NOTICE 'Columna distinctive_features ya existe';
    END IF;
END $$;

-- Verificar y agregar columna 'photos' si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pets' AND column_name = 'photos'
    ) THEN
        ALTER TABLE pets ADD COLUMN photos TEXT[];
        RAISE NOTICE 'Columna photos agregada a pets';
    ELSE
        RAISE NOTICE 'Columna photos ya existe';
    END IF;
END $$;

-- Verificar y agregar columna 'is_lost' si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pets' AND column_name = 'is_lost'
    ) THEN
        ALTER TABLE pets ADD COLUMN is_lost BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Columna is_lost agregada a pets';
    ELSE
        RAISE NOTICE 'Columna is_lost ya existe';
    END IF;
END $$;

-- Verificar y agregar columna 'updated_at' si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pets' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE pets ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Columna updated_at agregada a pets';
    ELSE
        RAISE NOTICE 'Columna updated_at ya existe';
    END IF;
END $$;

-- Verificar y agregar columna 'created_at' si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pets' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE pets ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Columna created_at agregada a pets';
    ELSE
        RAISE NOTICE 'Columna created_at ya existe';
    END IF;
END $$;

-- Verificar constraint de species si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'pets_species_check'
    ) THEN
        ALTER TABLE pets ADD CONSTRAINT pets_species_check 
        CHECK (species IN ('dog', 'cat', 'bird', 'rabbit', 'other'));
        RAISE NOTICE 'Constraint pets_species_check agregado';
    ELSE
        RAISE NOTICE 'Constraint pets_species_check ya existe';
    END IF;
END $$;

-- Verificar constraint de size si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'pets_size_check'
    ) THEN
        ALTER TABLE pets ADD CONSTRAINT pets_size_check 
        CHECK (size IN ('small', 'medium', 'large') OR size IS NULL);
        RAISE NOTICE 'Constraint pets_size_check agregado';
    ELSE
        RAISE NOTICE 'Constraint pets_size_check ya existe';
    END IF;
END $$;

-- Verificar que existe el trigger para updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_pets_updated_at'
    ) THEN
        CREATE TRIGGER update_pets_updated_at 
        BEFORE UPDATE ON pets 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Trigger update_pets_updated_at creado';
    ELSE
        RAISE NOTICE 'Trigger update_pets_updated_at ya existe';
    END IF;
END $$;

-- Verificar índice en owner_id si no existe
CREATE INDEX IF NOT EXISTS idx_pets_owner ON pets(owner_id);

-- Verificar que RLS está habilitado
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

-- Verificar políticas RLS básicas
DO $$
BEGIN
    -- Política para ver todas las mascotas
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'pets' AND policyname = 'Users can view all pets'
    ) THEN
        CREATE POLICY "Users can view all pets" ON pets
        FOR SELECT USING (true);
        RAISE NOTICE 'Política "Users can view all pets" creada';
    ELSE
        RAISE NOTICE 'Política "Users can view all pets" ya existe';
    END IF;

    -- Política para gestionar propias mascotas
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'pets' AND policyname = 'Users can manage own pets'
    ) THEN
        CREATE POLICY "Users can manage own pets" ON pets
        FOR ALL USING (auth.uid() = owner_id);
        RAISE NOTICE 'Política "Users can manage own pets" creada';
    ELSE
        RAISE NOTICE 'Política "Users can manage own pets" ya existe';
    END IF;
END $$;

-- Mensaje final
DO $$
BEGIN
    RAISE NOTICE '✅ Migración completada. Verifica las columnas de pets:';
END $$;

-- Mostrar estructura final de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'pets'
ORDER BY ordinal_position;


