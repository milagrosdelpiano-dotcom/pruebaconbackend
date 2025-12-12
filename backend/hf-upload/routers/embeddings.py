"""
Router de Embeddings (Legacy)
=============================

Este router maneja operaciones de embeddings usando conexión directa a PostgreSQL.
NOTA: Este router es legacy y puede estar en desuso. La funcionalidad principal
de embeddings está en embeddings_supabase.py que usa Supabase.

Funcionalidades:
- Indexar embeddings de reportes directamente en PostgreSQL
- Buscar imágenes similares usando búsqueda vectorial con pgvector
- Filtrar por ubicación geográfica (opcional)
- Crear matches automáticamente cuando se encuentra una coincidencia

Este router usa psycopg para conexión directa a PostgreSQL en lugar de Supabase.
"""

# =========================
# Imports de FastAPI
# =========================
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

# =========================
# Imports de Python estándar
# =========================
import os  # Para variables de entorno
import psycopg  # Cliente PostgreSQL directo

# =========================
# Imports de tipos
# =========================
from typing import Optional  # Para tipos opcionales

# =========================
# Imports de servicios
# =========================
from services.embeddings import image_bytes_to_vec  # Generar embeddings de imágenes
from supabase import Client, create_client  # Cliente de Supabase (no usado en este router)

# Crear el router con prefijo /embeddings
router = APIRouter(prefix="/embeddings", tags=["embeddings"])

def get_conn():
    """
    Obtiene una conexión directa a PostgreSQL usando psycopg.
    
    Returns:
        psycopg.Connection: Conexión a PostgreSQL con autocommit habilitado
        
    Raises:
        RuntimeError: Si DATABASE_URL no está configurada
        
    Esta función usa conexión directa a PostgreSQL en lugar de Supabase.
    Útil para operaciones que requieren acceso directo a pgvector.
    """
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL no configurada")
    return psycopg.connect(dsn, autocommit=True)

def get_supabase():
    """
    Obtiene un cliente de Supabase (no usado en este router, pero disponible).
    
    Returns:
        Client: Cliente de Supabase configurado
        
    Raises:
        RuntimeError: Si SUPABASE_URL o SUPABASE_SERVICE_KEY no están configuradas
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL o SUPABASE_SERVICE_KEY no configuradas")
    return create_client(url, key)

@router.post("/index/{report_id}")
async def index_report_embedding(report_id: str, file: UploadFile = File(...)):
    """
    Indexa un embedding para un reporte específico.
    
    Este endpoint:
    1. Recibe una imagen del reporte
    2. Genera el embedding usando MegaDescriptor
    3. Actualiza el campo embedding en la tabla reports
    
    Args:
        report_id: ID del reporte (UUID)
        file: Archivo de imagen a procesar
        
    Returns:
        dict: Estado de la operación con report_id y dimensiones del embedding
        
    Raises:
        HTTPException 400: Si no se puede procesar la imagen
        HTTPException 404: Si el report_id no existe
    """
    try:
        # Generar embedding de la imagen usando MegaDescriptor
        vec = image_bytes_to_vec(await file.read())
    except Exception as e:
        raise HTTPException(400, f"No se pudo procesar la imagen: {e}")
    
    # Actualizar el embedding en PostgreSQL directamente
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("""
            update public.reports
               set embedding = %s
             where id = %s::uuid
        """, (vec, report_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "report_id no encontrado")
    return {"status": "ok", "report_id": report_id, "dims": len(vec)}

@router.post("/search_image")
async def search_image(
    file: UploadFile = File(...),
    top_k: int = Query(10, ge=1, le=50),
    lost_id: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    max_km: Optional[float] = Query(None, description="Radio máximo en km")
):
    """
    Busca reportes similares usando búsqueda vectorial por imagen.
    
    Este endpoint:
    1. Genera un embedding de la imagen de búsqueda
    2. Busca reportes similares usando pgvector (operador <#> para cosine distance)
    3. Filtra por ubicación geográfica si se proporciona (opcional)
    4. Crea un match automático si se encuentra una coincidencia y se proporciona lost_id
    
    Args:
        file: Imagen de búsqueda
        top_k: Número máximo de resultados (1-50, por defecto 10)
        lost_id: ID del reporte perdido (opcional, para crear match automático)
        lat: Latitud para filtrar por ubicación (opcional)
        lng: Longitud para filtrar por ubicación (opcional)
        max_km: Radio máximo en kilómetros para filtrar (opcional)
        
    Returns:
        dict: Lista de resultados con report_id, similarity_score, species, color, photo, labels
        
    Raises:
        HTTPException 400: Si no se puede procesar la imagen
    """
    try:
        # Generar embedding de la imagen de búsqueda
        qvec = image_bytes_to_vec(await file.read())
    except Exception as e:
        raise HTTPException(400, f"No se pudo procesar la imagen: {e}")

    # Construir consulta SQL base para búsqueda vectorial
    # Usa el operador <#> de pgvector para cosine distance
    # (1 - cosine_distance) = similarity_score
    base_sql = """
        select r.id,
               (1 - (r.embedding <#> %(qvec)s)) as similarity_score,
               r.species, r.color, r.photos, r.labels
         from public.reports r
    """
    where = ["r.embedding is not null"]  # Solo reportes con embeddings
    params = {"qvec": qvec, "qvec2": qvec, "top_k": top_k}

    # Si se proporciona ubicación, agregar filtro geográfico usando Haversine
    if lat is not None and lng is not None and max_km and max_km > 0:
        base_sql += """
          join public.reports_with_coords rc on rc.id = r.id
        """
        # Fórmula de Haversine en SQL para calcular distancia en kilómetros
        # 6371 es el radio de la Tierra en km
        where.append("""
          ( 6371 * acos(
              cos(radians(%(lat)s)) * cos(radians(rc.latitude))
              * cos(radians(rc.longitude) - radians(%(lng)s))
              + sin(radians(%(lat)s)) * sin(radians(rc.latitude))
            ) ) <= %(max_km)s
        """)
        params.update({"lat": lat, "lng": lng, "max_km": max_km})

    # Construir SQL final con ordenamiento por similitud
    sql = f"""
      {base_sql}
      {" where " + " and ".join(where) if where else ""}
      order by r.embedding <#> %(qvec2)s  -- Ordenar por cosine distance (menor = más similar)
      limit %(top_k)s
    """

    # Ejecutar búsqueda y procesar resultados
    results = []
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        for rid, sim, species, color, photos, labels in cur.fetchall():
            results.append({
                "report_id": rid,
                "similarity_score": float(sim) if sim is not None else None,
                "species": species,
                "color": color,
                "photo": (photos or [None])[0] if isinstance(photos, list) else None,  # Primera foto
                "labels": labels
            })
        
        # Si hay resultados y se proporcionó lost_id, crear match automático
        if results:
            top1 = results[0]
            cur.execute("""
                insert into public.matches
                    (lost_report_id, found_report_id, similarity_score, matched_by, status)
                values (%s::uuid, %s::uuid, %s, 'ai_visual', 'pending')
            """, (lost_id if lost_id else None, top1["report_id"],
                  round(top1["similarity_score"], 4) if top1["similarity_score"] is not None else None))
    return {"results": results}
