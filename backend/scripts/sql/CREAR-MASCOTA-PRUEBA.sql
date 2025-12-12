-- ==============================================
-- Script para crear una mascota de prueba
-- ==============================================
-- Ejecuta este script en Supabase SQL Editor
-- Reemplaza el owner_id con tu ID de usuario

-- Tu ID de usuario (del log):
-- b3b9d127-50e0-4217-8c6b-cc2936b326bb

-- Crear una mascota de prueba
INSERT INTO pets (
  owner_id,
  name,
  species,
  breed,
  color,
  size,
  description,
  distinctive_features,
  photos,
  is_lost,
  created_at,
  updated_at
) VALUES (
  'b3b9d127-50e0-4217-8c6b-cc2936b326bb',  -- Tu ID de usuario
  'Firulais',
  'dog',
  'Labrador Retriever',
  'Dorado',
  'large',
  'Perro muy amigable y juguetón. Le encanta jugar en el parque.',
  'Tiene una mancha blanca en el pecho y la punta de la cola blanca',
  ARRAY[]::TEXT[],  -- Sin fotos por ahora
  false,
  NOW(),
  NOW()
);

-- Verificar que se creó correctamente
SELECT * FROM pets 
WHERE owner_id = 'b3b9d127-50e0-4217-8c6b-cc2936b326bb';

-- Opcional: Crear algunos datos de salud de ejemplo
-- (Solo funciona si ya ejecutaste la migración 007_pet_health_tracking.sql)

-- Obtener el ID de la mascota recién creada
DO $$
DECLARE
  pet_id_var UUID;
BEGIN
  SELECT id INTO pet_id_var 
  FROM pets 
  WHERE owner_id = 'b3b9d127-50e0-4217-8c6b-cc2936b326bb' 
  ORDER BY created_at DESC 
  LIMIT 1;

  -- Agregar un indicador de bienestar (peso)
  INSERT INTO indicador_bienestar (
    id_mascota,
    fecha,
    peso,
    notas
  ) VALUES (
    pet_id_var,
    CURRENT_DATE,
    25.5,
    'Peso registrado en chequeo anual'
  );

  -- Agregar una vacunación
  INSERT INTO vacunacion_tratamiento (
    id_mascota,
    tipo,
    nombre,
    fecha_inicio,
    proxima_fecha,
    observaciones
  ) VALUES (
    pet_id_var,
    'vacuna',
    'Antirrábica',
    CURRENT_DATE - INTERVAL '6 months',
    CURRENT_DATE + INTERVAL '6 months',
    'Vacunación anual aplicada correctamente'
  );

  -- Crear un recordatorio
  INSERT INTO recordatorio (
    id_mascota,
    tipo,
    titulo,
    descripcion,
    fecha_programada,
    repeticion,
    activo
  ) VALUES (
    pet_id_var,
    'chequeo',
    'Chequeo anual',
    'Revisión general de salud y vacunaciones',
    CURRENT_DATE + INTERVAL '6 months',
    'anual',
    true
  );

  RAISE NOTICE 'Mascota y datos de salud creados correctamente. ID: %', pet_id_var;
END $$;


