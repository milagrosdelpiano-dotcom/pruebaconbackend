-- ==============================================
-- MIGRACIÓN: CLIP (512 dims) → MegaDescriptor (1536 dims)
-- ==============================================
-- Esta migración actualiza la base de datos para usar MegaDescriptor-L-384
-- que genera embeddings de 1536 dimensiones en lugar de 512.

-- PASO 1: Eliminar el índice viejo (necesario antes de modificar la columna)
DROP INDEX IF EXISTS idx_reports_embedding_ivf;

-- PASO 2: Modificar la columna embedding de vector(512) a vector(1536)
-- NOTA: Esto eliminará todos los embeddings existentes (deben regenerarse)
ALTER TABLE public.reports 
  DROP COLUMN IF EXISTS embedding;

ALTER TABLE public.reports
  ADD COLUMN embedding vector(1536);

-- PASO 3: Índice para 1536 dimensiones
-- Como 1536 < 2000, podemos usar IVFFlat o HNSW sin problemas
CREATE INDEX IF NOT EXISTS idx_reports_embedding_hnsw
  ON public.reports USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- PASO 4: Actualizar función RPC para aceptar 1536 dimensiones
CREATE OR REPLACE FUNCTION update_report_embedding(
    report_id uuid,
    embedding_vector float[]
) RETURNS boolean AS $$
BEGIN
    UPDATE public.reports 
    SET embedding = embedding_vector::vector(1536)
    WHERE id = report_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 5: Actualizar funciones RAG para usar vector(1536)
-- Primero eliminar las funciones antiguas (con vector(512))
DROP FUNCTION IF EXISTS search_similar_reports(vector, float, int, text, text);
DROP FUNCTION IF EXISTS search_similar_reports_with_location(vector, float, float, float, float, int, text, text);
DROP FUNCTION IF EXISTS get_report_embedding(uuid);

-- Recrear con vector(1536)
CREATE OR REPLACE FUNCTION search_similar_reports(
    query_embedding vector(1536),
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

CREATE OR REPLACE FUNCTION search_similar_reports_with_location(
    query_embedding vector(1536),
    user_lat float,
    user_lng float,
    max_distance_km float DEFAULT 10.0,
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    filter_species text DEFAULT NULL,
    filter_type text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    similarity_score float,
    distance_km float,
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
        -- Calcular distancia usando Haversine (aproximado)
        CASE 
            WHEN r.latitude IS NOT NULL AND r.longitude IS NOT NULL THEN
                6371 * acos(
                    cos(radians(user_lat)) * cos(radians(r.latitude)) *
                    cos(radians(r.longitude) - radians(user_lng)) +
                    sin(radians(user_lat)) * sin(radians(r.latitude))
                )
            ELSE NULL
        END as distance_km,
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
        AND (
            r.latitude IS NULL OR r.longitude IS NULL OR
            6371 * acos(
                cos(radians(user_lat)) * cos(radians(r.latitude)) *
                cos(radians(r.longitude) - radians(user_lng)) +
                sin(radians(user_lat)) * sin(radians(r.latitude))
            ) <= max_distance_km
        )
    ORDER BY 
        (1 - (r.embedding <#> query_embedding)) DESC,
        distance_km ASC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_report_embedding(report_id uuid)
RETURNS vector(1536) AS $$
DECLARE
    result vector(1536);
BEGIN
    SELECT embedding INTO result
    FROM public.reports
    WHERE id = report_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- PASO 6: Mantener permisos de seguridad
REVOKE UPDATE (embedding) ON public.reports FROM anon, authenticated;

-- ==============================================
-- NOTAS IMPORTANTES:
-- ==============================================
-- 1. Esta migración ELIMINA todos los embeddings existentes (512 dims)
-- 2. Debes regenerar los embeddings usando el script:
--    python -m scripts.regenerate_embeddings_mega
-- 3. El índice HNSW (m=16, ef_construction=64) funciona perfectamente con 1536 dims
-- 4. 1536 < 2000, por lo que podemos usar índices sin problemas de límite
-- 5. Todas las funciones RAG han sido actualizadas a vector(1536)

