-- Script para verificar la restricción de status en la tabla reports
-- Ejecuta esto en el SQL Editor de Supabase

-- 1. Ver la definición completa de la tabla
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'reports'
AND column_name = 'status';

-- 2. Ver todas las restricciones CHECK en la tabla reports
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.reports'::regclass
AND contype = 'c'
ORDER BY conname;

-- 3. Ver qué valores de status existen actualmente
SELECT DISTINCT status, COUNT(*) as cantidad
FROM reports 
GROUP BY status
ORDER BY status;

-- 4. Si necesitas agregar 'closed' a la restricción, primero elimina la restricción actual
-- y luego crea una nueva (NO EJECUTES ESTO AÚN, primero verifica con las consultas anteriores)
/*
ALTER TABLE reports 
DROP CONSTRAINT IF EXISTS reports_status_check;

ALTER TABLE reports 
ADD CONSTRAINT reports_status_check 
CHECK (status IN ('active', 'resolved', 'closed'));
*/













