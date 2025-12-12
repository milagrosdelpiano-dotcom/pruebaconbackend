-- Migración: Agregar reporter_name a las funciones RPC de reportes
-- Este script actualiza las funciones que devuelven reportes para incluir el nombre del reportero
-- desde la tabla profiles

-- Eliminar funciones existentes si existen (necesario para cambiar el tipo de retorno)
DROP FUNCTION IF EXISTS get_reports_with_coords() CASCADE;
DROP FUNCTION IF EXISTS get_report_by_id_with_coords(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_user_reports_with_coords(uuid) CASCADE;

-- Función: Obtener todos los reportes activos con coordenadas y nombre del reportero
CREATE OR REPLACE FUNCTION get_reports_with_coords()
RETURNS TABLE (
    id uuid,
    type text,
    reporter_id uuid,
    reporter_name text,
    pet_id uuid,
    pet_name text,
    species text,
    breed text,
    color text,
    size text,
    description text,
    distinctive_features text,
    photos text[],
    location geography(point, 4326),
    address text,
    location_details text,
    incident_date timestamptz,
    status text,
    resolved_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    latitude double precision,
    longitude double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.type,
        r.reporter_id,
        COALESCE(p.full_name, 'Usuario') AS reporter_name,
        r.pet_id,
        r.pet_name,
        r.species,
        r.breed,
        r.color,
        r.size,
        r.description,
        r.distinctive_features,
        r.photos,
        r.location,
        r.address,
        r.location_details,
        r.incident_date,
        r.status,
        r.resolved_at,
        r.created_at,
        r.updated_at,
        CASE 
            WHEN r.location IS NOT NULL THEN ST_Y(r.location::geometry)::double precision
            ELSE NULL
        END AS latitude,
        CASE 
            WHEN r.location IS NOT NULL THEN ST_X(r.location::geometry)::double precision
            ELSE NULL
        END AS longitude
    FROM public.reports r
    LEFT JOIN public.profiles p ON p.id = r.reporter_id
    WHERE r.status = 'active'
    ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Función: Obtener un reporte por ID con coordenadas y nombre del reportero
CREATE OR REPLACE FUNCTION get_report_by_id_with_coords(report_id uuid)
RETURNS TABLE (
    id uuid,
    type text,
    reporter_id uuid,
    reporter_name text,
    pet_id uuid,
    pet_name text,
    species text,
    breed text,
    color text,
    size text,
    description text,
    distinctive_features text,
    photos text[],
    location geography(point, 4326),
    address text,
    location_details text,
    incident_date timestamptz,
    status text,
    resolved_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    latitude double precision,
    longitude double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.type,
        r.reporter_id,
        COALESCE(p.full_name, 'Usuario') AS reporter_name,
        r.pet_id,
        r.pet_name,
        r.species,
        r.breed,
        r.color,
        r.size,
        r.description,
        r.distinctive_features,
        r.photos,
        r.location,
        r.address,
        r.location_details,
        r.incident_date,
        r.status,
        r.resolved_at,
        r.created_at,
        r.updated_at,
        CASE 
            WHEN r.location IS NOT NULL THEN ST_Y(r.location::geometry)::double precision
            ELSE NULL
        END AS latitude,
        CASE 
            WHEN r.location IS NOT NULL THEN ST_X(r.location::geometry)::double precision
            ELSE NULL
        END AS longitude
    FROM public.reports r
    LEFT JOIN public.profiles p ON p.id = r.reporter_id
    WHERE r.id = report_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Función: Obtener reportes de un usuario con coordenadas y nombre del reportero
CREATE OR REPLACE FUNCTION get_user_reports_with_coords(user_id uuid)
RETURNS TABLE (
    id uuid,
    type text,
    reporter_id uuid,
    reporter_name text,
    pet_id uuid,
    pet_name text,
    species text,
    breed text,
    color text,
    size text,
    description text,
    distinctive_features text,
    photos text[],
    location geography(point, 4326),
    address text,
    location_details text,
    incident_date timestamptz,
    status text,
    resolved_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    latitude double precision,
    longitude double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.type,
        r.reporter_id,
        COALESCE(p.full_name, 'Usuario') AS reporter_name,
        r.pet_id,
        r.pet_name,
        r.species,
        r.breed,
        r.color,
        r.size,
        r.description,
        r.distinctive_features,
        r.photos,
        r.location,
        r.address,
        r.location_details,
        r.incident_date,
        r.status,
        r.resolved_at,
        r.created_at,
        r.updated_at,
        CASE 
            WHEN r.location IS NOT NULL THEN ST_Y(r.location::geometry)::double precision
            ELSE NULL
        END AS latitude,
        CASE 
            WHEN r.location IS NOT NULL THEN ST_X(r.location::geometry)::double precision
            ELSE NULL
        END AS longitude
    FROM public.reports r
    LEFT JOIN public.profiles p ON p.id = r.reporter_id
    WHERE r.reporter_id = user_id
    ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Dar permisos de ejecución a las funciones
GRANT EXECUTE ON FUNCTION get_reports_with_coords() TO anon;
GRANT EXECUTE ON FUNCTION get_reports_with_coords() TO authenticated;
GRANT EXECUTE ON FUNCTION get_reports_with_coords() TO service_role;

GRANT EXECUTE ON FUNCTION get_report_by_id_with_coords(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_report_by_id_with_coords(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_report_by_id_with_coords(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION get_user_reports_with_coords(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_user_reports_with_coords(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_reports_with_coords(uuid) TO service_role;

-- Comentarios para documentación
COMMENT ON FUNCTION get_reports_with_coords() IS 
'Devuelve todos los reportes activos con coordenadas extraídas del campo location y el nombre del reportero desde profiles';

COMMENT ON FUNCTION get_report_by_id_with_coords(uuid) IS 
'Devuelve un reporte específico por ID con coordenadas y el nombre del reportero desde profiles';

COMMENT ON FUNCTION get_user_reports_with_coords(uuid) IS 
'Devuelve todos los reportes de un usuario específico con coordenadas y el nombre del reportero desde profiles';

