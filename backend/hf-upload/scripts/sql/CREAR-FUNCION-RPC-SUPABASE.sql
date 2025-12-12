-- Crear función RPC search_similar_reports en Supabase
-- Ejecuta este script completo en el SQL Editor de Supabase

-- Primero, asegúrate de que la extensión pgvector esté habilitada
CREATE EXTENSION IF NOT EXISTS vector;

-- Crear la función de búsqueda por similitud
CREATE OR REPLACE FUNCTION public.search_similar_reports(
    query_embedding vector(512),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    filter_species text DEFAULT NULL,
    filter_type text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    similarity_score float,
    species text,
    type text,
    photos text[],
    description text,
    location jsonb,
    created_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        1 - (r.embedding <#> query_embedding) as similarity_score,
        r.species,
        r.type,
        r.photos,
        r.description,
        r.location,
        r.created_at
    FROM public.reports r
    WHERE 
        r.embedding IS NOT NULL
        AND r.status = 'active'
        AND (1 - (r.embedding <#> query_embedding)) >= match_threshold
        AND (filter_species IS NULL OR r.species = filter_species)
        AND (filter_type IS NULL OR r.type = filter_type)
    ORDER BY r.embedding <#> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.search_similar_reports TO anon;
GRANT EXECUTE ON FUNCTION public.search_similar_reports TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_similar_reports TO service_role;

-- Verificar que se creó correctamente
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'search_similar_reports';











