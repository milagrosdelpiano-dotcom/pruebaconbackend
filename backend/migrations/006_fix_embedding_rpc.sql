-- Migración: Arreglar función RPC para guardar embeddings correctamente como vector
--
-- Problema: La conversión float[]::vector(1536) no funciona correctamente 
-- con la librería postgrest-py de Supabase
--
-- Solución: Aceptar como text y convertir explícitamente a vector

DROP FUNCTION IF EXISTS update_report_embedding(uuid, float[]);

CREATE OR REPLACE FUNCTION update_report_embedding(
    report_id uuid,
    embedding_vector text  -- Cambiado de float[] a text
) RETURNS boolean AS $$
BEGIN
    -- Convertir el texto JSON array a vector
    -- Formato esperado: '[1.0,2.0,3.0,...]'
    UPDATE public.reports 
    SET embedding = embedding_vector::vector(1536)
    WHERE id = report_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario
COMMENT ON FUNCTION update_report_embedding IS 
'Actualiza el embedding de un reporte. Acepta un string en formato JSON array y lo convierte a vector(1536)';

