-- ==============================================
-- FIX: Trigger para crear perfil automáticamente
-- ==============================================

-- Eliminar trigger y función existentes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Crear función mejorada con mejor manejo de errores
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  user_full_name TEXT;
BEGIN
  -- Obtener el nombre del usuario desde metadata o email
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'Usuario'
  );
  
  -- Insertar el perfil con email (si la columna existe)
  -- Verificar si la columna email existe antes de insertar
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    user_full_name,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN undefined_column THEN
    -- Si la columna email no existe, insertar sin ella
    INSERT INTO public.profiles (id, full_name, created_at, updated_at)
    VALUES (
      NEW.id,
      user_full_name,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      updated_at = NOW();
    RETURN NEW;
  WHEN OTHERS THEN
    -- Si hay algún error, registrarlo pero no fallar el registro del usuario
    RAISE WARNING 'Error creando perfil para usuario %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Crear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verificar que se creó correctamente
SELECT 
  'Trigger creado correctamente' as status,
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

