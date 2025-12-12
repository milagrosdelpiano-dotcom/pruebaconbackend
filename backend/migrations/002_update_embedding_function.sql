-- Función SQL para actualizar embedding correctamente
CREATE OR REPLACE FUNCTION update_report_embedding(
    report_id uuid,
    embedding_vector float[]
) RETURNS boolean AS $$
BEGIN
    UPDATE public.reports 
    SET embedding = embedding_vector::vector(512)
    WHERE id = report_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
