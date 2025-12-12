-- Funciones SQL para RAG (Retrieval Augmented Generation) con embeddings de imágenes

-- Función para búsqueda por similitud usando pgvector
-- Retorna los reportes más similares a un embedding dado
CREATE OR REPLACE FUNCTION search_similar_reports(
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

-- Función para búsqueda híbrida: embedding + filtros geográficos
CREATE OR REPLACE FUNCTION search_similar_reports_with_location(
    query_embedding vector(512),
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

-- Función para obtener el embedding de un reporte
CREATE OR REPLACE FUNCTION get_report_embedding(report_id uuid)
RETURNS vector(512) AS $$
DECLARE
    result vector(512);
BEGIN
    SELECT embedding INTO result
    FROM public.reports
    WHERE id = report_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar si un reporte tiene embedding
CREATE OR REPLACE FUNCTION has_embedding(report_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.reports 
        WHERE id = report_id AND embedding IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Índice para mejorar búsquedas geográficas (si no existe)
CREATE INDEX IF NOT EXISTS idx_reports_location 
ON public.reports USING GIST (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Índice compuesto para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_reports_embedding_status 
ON public.reports (status) 
WHERE embedding IS NOT NULL AND status = 'active';



