-- ==============================================
-- FIX: Crear perfiles para usuarios existentes sin perfil
-- ==============================================

-- Crear perfiles para todos los usuarios de auth.users que no tienen perfil
INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1),
    'Usuario'
  ) as full_name,
  u.created_at,
  NOW() as updated_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Verificar cuántos perfiles se crearon
SELECT 
  COUNT(*) as perfiles_creados,
  'Perfiles creados para usuarios existentes' as mensaje
FROM public.profiles;

