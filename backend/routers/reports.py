"""
Router de Reportes
==================

Este router maneja todas las operaciones CRUD (Create, Read, Update, Delete) 
relacionadas con reportes de mascotas perdidas y encontradas.

Funcionalidades principales:
- Crear reportes nuevos (con generación automática de embeddings)
- Obtener reportes (todos, por usuario, por ID, cercanos)
- Actualizar reportes existentes
- Eliminar/cancelar reportes
- Subir fotos de mascotas
- Generar embeddings de imágenes en segundo plano

Los embeddings se generan automáticamente cuando se crea un reporte con fotos,
permitiendo búsquedas visuales inteligentes más adelante.
"""

from fastapi import APIRouter, HTTPException, Query, Body, BackgroundTasks
from typing import List, Dict, Any, Optional
import os, math, sys
from pathlib import Path
from supabase import Client
import httpx  # Para hacer peticiones HTTP (descargar imágenes)
import asyncio  # Para operaciones asíncronas

# Importar servicio de embeddings según configuración
USE_HF_API = os.getenv("USE_HF_INFERENCE_API", "true").lower() in ("1", "true", "yes")

if USE_HF_API:
    # Usar Hugging Face Inference API (sin necesidad de RAM para el modelo)
    print("🌐 Usando Hugging Face Inference API para embeddings")
    from services.embeddings_hf_api import generate_embedding_from_bytes as image_bytes_to_vec
else:
    # Usar modelo local (requiere 1.5GB de RAM)
    print("💻 Usando modelo local para embeddings")
    from services.embeddings import image_bytes_to_vec

# Agregar la carpeta parent al path para poder importar utils
# Esto permite usar imports como "from utils.supabase_client import ..."
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.supabase_client import get_supabase_client

# =========================
# Configuración
# =========================
# Verificar si la generación local de embeddings está habilitada
# Si está habilitada, los embeddings se generan en el servidor usando MegaDescriptor
# Si no, se espera que se generen externamente
GENERATE_EMBEDDINGS_LOCALLY = (
    os.getenv("GENERATE_EMBEDDINGS_LOCALLY", "false").lower() in ("1", "true", "yes")
)

# Crear el router con prefijo /reports
# Todas las rutas de este archivo empezarán con /reports
router = APIRouter(prefix="/reports", tags=["reports"])

def _sb() -> Client:
    """
    Crea un cliente de Supabase con configuración optimizada de timeouts.
    
    Esta función es un helper que crea y retorna un cliente de Supabase.
    Si falla la conexión, lanza una excepción HTTP 500.
    
    Returns:
        Client: Cliente de Supabase configurado
        
    Raises:
        HTTPException: Si no se puede conectar a Supabase
    """
    try:
        return get_supabase_client()
    except Exception as e:
        raise HTTPException(500, f"Error conectando a Supabase: {str(e)}")

def _extract_coords(location_data) -> Optional[tuple]:
    """
    Extrae coordenadas de diferentes formatos de ubicación.
    
    Esta función maneja múltiples formatos de datos geográficos:
    - PostGIS: String con formato "SRID=4326;POINT(lon lat)"
    - GeoJSON: Objeto con formato {"type":"Point","coordinates":[lon,lat]}
    
    Args:
        location_data: Datos de ubicación en cualquier formato soportado
        
    Returns:
        Tupla (latitud, longitud) o None si no se pueden extraer
        
    Ejemplo:
        >>> _extract_coords("SRID=4326;POINT(-58.3816 -34.6037)")
        (-34.6037, -58.3816)
        >>> _extract_coords({"type":"Point","coordinates":[-58.3816, -34.6037]})
        (-34.6037, -58.3816)
    """
    # Si no hay datos, retornar None
    if not location_data:
        return None
    
    # =========================
    # Formato PostGIS
    # =========================
    # PostGIS es una extensión de PostgreSQL para datos geográficos
    # Formato: "SRID=4326;POINT(lon lat)"
    # SRID 4326 es el sistema de coordenadas WGS84 (lat/lon estándar)
    if isinstance(location_data, str) and "POINT(" in location_data:
        try:
            # Extraer la parte del string que contiene las coordenadas
            # Ejemplo: "SRID=4326;POINT(-58.3816 -34.6037)" -> "-58.3816 -34.6037"
            coords_str = location_data.split("POINT(")[1].split(")")[0]
            # Convertir a float y extraer lon y lat
            lon, lat = map(float, coords_str.split())
            # Retornar como (lat, lon) para consistencia
            return (lat, lon)
        except:
            # Si falla el parsing, retornar None
            return None
    
    # =========================
    # Formato GeoJSON
    # =========================
    # GeoJSON es un formato estándar para datos geográficos
    # Formato: {"type":"Point","coordinates":[lon,lat]}
    # Nota: GeoJSON usa [lon, lat] pero retornamos (lat, lon) para consistencia
    if isinstance(location_data, dict) and "coordinates" in location_data:
        try:
            # Extraer coordenadas del array
            lon, lat = location_data["coordinates"]
            # Retornar como (lat, lon) para consistencia
            return (lat, lon)
        except:
            # Si falla el parsing, retornar None
            return None
    
    # Si no coincide con ningún formato conocido, retornar None
    return None

def haversine_km(lat1, lon1, lat2, lon2):
    """
    Calcula la distancia en kilómetros entre dos puntos geográficos usando la fórmula de Haversine.
    
    La fórmula de Haversine calcula la distancia del círculo máximo entre dos puntos
    en una esfera (la Tierra), considerando que es una esfera perfecta.
    
    Args:
        lat1, lon1: Latitud y longitud del primer punto (en grados)
        lat2, lon2: Latitud y longitud del segundo punto (en grados)
    
    Returns:
        Distancia en kilómetros entre los dos puntos
    """
    R = 6371.0  # Radio de la Tierra en kilómetros
    # Convertir diferencias de latitud y longitud a radianes
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    # Aplicar la fórmula de Haversine
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

async def generate_and_save_embedding(report_id: str, photo_url: str):
    """
    Genera y guarda el embedding de una imagen para un reporte.
    
    Esta función se ejecuta en segundo plano (background task) para no bloquear
    la respuesta HTTP al crear un reporte. El proceso completo es:
    1. Descarga la imagen desde Supabase Storage
    2. Genera un embedding usando MegaDescriptor (vector numérico de 1536 dimensiones)
    3. Guarda el embedding en la columna 'embedding' de la tabla 'reports'
    4. Opcionalmente busca automáticamente matches (coincidencias) con otros reportes
    
    Los embeddings permiten búsquedas visuales inteligentes: cuando un usuario
    sube una foto de una mascota, el sistema puede encontrar reportes con fotos
    visualmente similares usando búsqueda vectorial.
    
    Args:
        report_id: ID del reporte en la base de datos (UUID)
        photo_url: URL completa de la imagen en Supabase Storage
                  Ejemplo: https://xxxxx.supabase.co/storage/v1/object/public/photos/xxx.jpg
    
    Nota: 
    - Si falla, no lanza excepción para no afectar la creación del reporte
    - Usa reintentos automáticos (hasta 3 intentos) para manejar errores temporales
    - Si la generación local de embeddings está desactivada, esta función no hace nada
    """
    max_retries = 3  # Número máximo de intentos si falla (para manejar errores temporales de red)
    
    # Intentar hasta max_retries veces
    for attempt in range(max_retries):
        try:
            # Log del intento (diferente mensaje si es reintento)
            if attempt > 0:
                print(f"🔄 [embedding] Reintento {attempt + 1}/{max_retries} para reporte {report_id}")
            else:
                print(f"🔄 [embedding] Generando embedding para reporte {report_id} desde {photo_url}")
            
            # =========================
            # Descargar la imagen
            # =========================
            # Descargar la imagen desde Supabase Storage usando httpx
            # Timeout aumentado para Windows que puede tener problemas de red
            timeout = httpx.Timeout(60.0, connect=60.0)  # 60 segundos total y para conectar
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(photo_url)
                response.raise_for_status()  # Lanza error si el status code no es 2xx
                image_bytes = response.content  # Obtener los bytes de la imagen
            
            print(f"🔍 Imagen descargada: {len(image_bytes)} bytes")
            
            # Generar embedding usando MegaDescriptor
            # image_bytes_to_vec convierte la imagen en un vector numérico
            vec = image_bytes_to_vec(image_bytes)
            vec_list = vec.tolist()  # Convertir numpy array a lista de Python
            
            print(f"🔍 Embedding generado: {len(vec_list)} dimensiones")
            
            # Guardar el embedding en la columna 'embedding' del reporte
            # pgvector (extensión de PostgreSQL) acepta arrays de Python directamente
            sb = _sb()
            result = sb.table('reports').update({
                'embedding': vec_list
            }).eq('id', report_id).execute()
            
            if result.data:
                print(f"✅ [embedding] Embedding guardado exitosamente para reporte {report_id}")
                
                # Buscar matches automáticamente después de generar el embedding
                # Esto permite encontrar coincidencias inmediatamente sin esperar
                try:
                    await find_and_save_matches(report_id)
                except Exception as match_error:
                    # Si falla la búsqueda de matches, no es crítico, solo logueamos
                    print(f"⚠️ [matches] Error buscando matches (no crítico): {str(match_error)}")
                
                return  # Éxito, salir de la función
            else:
                print(f"⚠️ [embedding] No se pudo guardar embedding para reporte {report_id}")
                
        except httpx.TimeoutException as e:
            # Si hay timeout (la descarga tarda mucho), reintentamos
            print(f"⏱️ [embedding] Timeout al procesar imagen (intento {attempt + 1}/{max_retries})")
            if attempt == max_retries - 1:
                print(f"❌ [embedding] Error después de {max_retries} intentos: Timeout")
            else:
                # Backoff exponencial: esperamos 1s, 2s, 4s entre intentos
                await asyncio.sleep(2 ** attempt)
                
        except Exception as e:
            # Cualquier otro error, logueamos y reintentamos
            print(f"❌ [embedding] Error generando embedding para reporte {report_id}: {str(e)}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # Backoff exponencial
            # No lanzar excepción para no afectar la creación del reporte


async def find_and_save_matches(report_id: str, threshold: float = 0.1, max_matches: int = 10):
    """
    Busca matches (coincidencias) similares para un reporte y los guarda automáticamente.
    
    Esta función:
    1. Obtiene el embedding del reporte base
    2. Busca reportes del tipo opuesto (lost ↔ found) con embeddings
    3. Calcula la similitud coseno entre embeddings
    4. Filtra por umbral de similitud (threshold)
    5. Guarda los matches en la tabla 'matches' de la base de datos
    
    Args:
        report_id: ID del reporte para el cual buscar matches
        threshold: Umbral mínimo de similitud (0.0 a 1.0). Default: 0.1 (10% de similitud)
        max_matches: Número máximo de matches a guardar. Default: 10
    
    Nota: Si el reporte no tiene embedding, la función retorna sin hacer nada.
    """
    try:
        print(f"🔍 [matches] Buscando coincidencias para reporte {report_id}...")
        
        sb = _sb()
        
        # Obtener el reporte con su embedding
        report_result = sb.table("reports")\
            .select("id, embedding, type, species")\
            .eq("id", report_id)\
            .execute()
        
        if not report_result.data:
            print(f"⚠️ [matches] Reporte {report_id} no encontrado")
            return
        
        report = report_result.data[0]
        report_embedding = report.get("embedding")
        report_type = report.get("type")
        
        if not report_embedding:
            print(f"⚠️ [matches] Reporte {report_id} no tiene embedding")
            return
        
        # Postgrest devuelve vectores como strings JSON, parsearlos
        if isinstance(report_embedding, str):
            import json
            try:
                report_embedding = json.loads(report_embedding)
            except Exception as e:
                print(f"⚠️ [matches] Error parseando embedding: {e}")
                return
        
        # Determinar tipo opuesto para buscar matches
        opposite_type = "found" if report_type == "lost" else "lost"
        
        # Buscar reportes del tipo opuesto con embeddings
        candidates = sb.table("reports")\
            .select("id, embedding, species")\
            .eq("type", opposite_type)\
            .eq("status", "active")\
            .not_.is_("embedding", "null")\
            .execute()
        
        if not candidates.data:
            print(f"ℹ️ [matches] No hay reportes de tipo '{opposite_type}' para comparar")
            return
        
        # Calcular similitud con todos los candidatos
        import numpy as np
        base_vec = np.array(report_embedding, dtype=np.float32)
        
        matches_found = []
        for candidate in candidates.data:
            try:
                candidate_embedding = candidate.get("embedding")
                if not candidate_embedding:
                    continue
                
                # Parsear si es string JSON
                if isinstance(candidate_embedding, str):
                    try:
                        candidate_embedding = json.loads(candidate_embedding)
                    except:
                        continue
                
                candidate_vec = np.array(candidate_embedding, dtype=np.float32)
                
                # Similitud coseno (embeddings ya están normalizados)
                similarity = float(np.dot(base_vec, candidate_vec))
                
                if similarity >= threshold:
                    matches_found.append({
                        "candidate_id": candidate["id"],
                        "similarity": similarity,
                        "species": candidate.get("species")
                    })
            except Exception as e:
                print(f"⚠️ [matches] Error procesando candidato: {e}")
                continue
        
        # Ordenar por similitud descendente y tomar los mejores
        matches_found.sort(key=lambda x: x["similarity"], reverse=True)
        matches_found = matches_found[:max_matches]
        
        if not matches_found:
            print(f"ℹ️ [matches] No se encontraron coincidencias con similitud >= {threshold}")
            return
        
        # Guardar matches en la base de datos
        matches_saved = 0
        for match in matches_found:
            try:
                match_data = {
                    "similarity_score": round(match["similarity"], 4),
                    "matched_by": "ai_visual",
                    "status": "pending"
                }
                
                # Configurar IDs según el tipo de reporte
                if report_type == "lost":
                    match_data["lost_report_id"] = report_id
                    match_data["found_report_id"] = match["candidate_id"]
                else:
                    match_data["lost_report_id"] = match["candidate_id"]
                    match_data["found_report_id"] = report_id
                
                # Verificar si ya existe el match
                if report_type == "lost":
                    existing = sb.table("matches")\
                        .select("id, similarity_score")\
                        .eq("lost_report_id", report_id)\
                        .eq("found_report_id", match["candidate_id"])\
                        .execute()
                else:
                    existing = sb.table("matches")\
                        .select("id, similarity_score")\
                        .eq("lost_report_id", match["candidate_id"])\
                        .eq("found_report_id", report_id)\
                        .execute()
                
                if existing.data:
                    # Actualizar si la nueva similitud es mejor
                    existing_match = existing.data[0]
                    if match["similarity"] > (existing_match.get("similarity_score") or 0):
                        sb.table("matches")\
                            .update(match_data)\
                            .eq("id", existing_match["id"])\
                            .execute()
                        matches_saved += 1
                        print(f"  ✅ [matches] Match actualizado: {match['candidate_id']} (similitud: {match['similarity']:.3f})")
                else:
                    # Crear nuevo match
                    sb.table("matches").insert(match_data).execute()
                    matches_saved += 1
                    print(f"  ✅ [matches] Match creado: {match['candidate_id']} (similitud: {match['similarity']:.3f})")
                    
            except Exception as e:
                print(f"⚠️ [matches] Error guardando match: {e}")
                continue
        
        print(f"✅ [matches] {matches_saved} coincidencias guardadas para reporte {report_id}")
        
    except Exception as e:
        print(f"❌ [matches] Error en búsqueda de matches: {str(e)}")
        # No lanzar excepción, solo loguear el error

@router.get("/")
async def get_all_reports():
    """Obtiene todos los reportes activos"""
    try:
        sb = _sb()
        result = sb.table("reports").select("*").eq("status", "active").order("created_at", desc=True).execute()
        return {"reports": result.data, "count": len(result.data)}
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo reportes: {str(e)}")

@router.get("/nearby")
async def get_nearby_reports(
    lat: float = Query(..., description="Latitud"),
    lng: float = Query(..., description="Longitud"),
    radius_km: float = Query(10.0, description="Radio en kilómetros")
):
    """Obtiene reportes cercanos a una ubicación"""
    try:
        sb = _sb()
        result = sb.table("reports").select("*").eq("status", "active").execute()
        
        nearby_reports = []
        for report in result.data:
            coords = _extract_coords(report.get("location"))
            if coords:
                report_lat, report_lon = coords
                distance = haversine_km(lat, lng, report_lat, report_lon)
                if distance <= radius_km:
                    report["distance_km"] = round(distance, 2)
                    nearby_reports.append(report)
        
        # Ordenar por distancia
        nearby_reports.sort(key=lambda x: x["distance_km"])
        
        return {"reports": nearby_reports, "count": len(nearby_reports)}
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo reportes cercanos: {str(e)}")

@router.get("/{report_id}")
async def get_report_by_id(report_id: str):
    """Obtiene un reporte por ID"""
    try:
        sb = _sb()
        result = sb.table("reports").select("*").eq("id", report_id).execute()
        report_data = result.data[0] if result.data else None
        
        if not report_data:
            raise HTTPException(404, "Reporte no encontrado")
        
        return {"report": report_data}
    except Exception as e:
        if "404" in str(e):
            raise e
        raise HTTPException(500, f"Error obteniendo reporte: {str(e)}")

@router.post("/")
async def create_report(
    report_data: Dict[str, Any] = Body(...),
    background_tasks: BackgroundTasks = None
):
    """Crea un nuevo reporte y genera embeddings automáticamente si hay fotos"""
    try:
        sb = _sb()
        
        # Validar datos requeridos
        required_fields = ["type", "reporter_id", "species", "description", "location"]
        for field in required_fields:
            if field not in report_data:
                raise HTTPException(400, f"Campo requerido faltante: {field}")
        
        # Crear reporte
        result = sb.table("reports").insert(report_data).execute()
        
        if not result.data:
            raise HTTPException(500, "Error creando reporte")
        
        created_report = result.data[0]
        report_id = created_report.get("id")
        
        # Generar embedding automáticamente si hay fotos (de forma síncrona para asegurar que se guarde)
        photos = created_report.get("photos") or report_data.get("photos", [])
        if GENERATE_EMBEDDINGS_LOCALLY and photos and isinstance(photos, list) and len(photos) > 0:
            first_photo = photos[0]
            if first_photo:
                print(f"📸 [embedding] Reporte creado con fotos. Generando embedding para reporte {report_id}...")
                # Generar embedding de forma síncrona para asegurar que se guarde antes de retornar
                try:
                    await generate_and_save_embedding(report_id, first_photo)
                    print(f"✅ [embedding] Embedding generado y guardado para reporte {report_id}")
                except Exception as e:
                    print(f"⚠️ [embedding] Error generando embedding (no crítico): {str(e)}")
                    # No fallar la creación del reporte si falla el embedding
        elif photos and isinstance(photos, list) and len(photos) > 0:
            print("ℹ️ [embedding] Generación local desactivada. La IA externa se encargará del embedding.")
        
        return {"report": created_report, "message": "Reporte creado exitosamente"}
    except Exception as e:
        if "400" in str(e) or "500" in str(e):
            raise e
        raise HTTPException(500, f"Error creando reporte: {str(e)}")

@router.put("/{report_id}")
async def update_report(
    report_id: str,
    updates: Dict[str, Any] = Body(...),
    background_tasks: BackgroundTasks = None
):
    """Actualiza un reporte existente y genera embeddings si hay nuevas fotos"""
    try:
        sb = _sb()
        
        # Obtener el reporte actual para verificar si tiene embedding
        current_result = sb.table("reports").select("id, photos, embedding").eq("id", report_id).execute()
        current_report = current_result.data[0] if current_result.data else None
        
        if not current_report:
            raise HTTPException(404, "Reporte no encontrado")
        
        # Actualizar reporte
        result = sb.table("reports").update(updates).eq("id", report_id).execute()
        
        if not result.data:
            raise HTTPException(404, "Reporte no encontrado")
        
        updated_report = result.data[0]
        
        # Generar embedding si:
        # 1. Hay fotos nuevas o actualizadas
        # 2. El reporte no tiene embedding aún
        photos = updated_report.get("photos") or updates.get("photos", [])
        has_embedding = current_report.get("embedding") is not None
        
        if GENERATE_EMBEDDINGS_LOCALLY and photos and isinstance(photos, list) and len(photos) > 0:
            first_photo = photos[0]
            if first_photo and (not has_embedding or "photos" in updates):
                print(f"📸 [embedding] Reporte actualizado con fotos. Generando embedding para reporte {report_id}...")
                # Generar embedding de forma síncrona para asegurar que se guarde
                try:
                    await generate_and_save_embedding(report_id, first_photo)
                    print(f"✅ [embedding] Embedding generado y guardado para reporte {report_id}")
                except Exception as e:
                    print(f"⚠️ [embedding] Error generando embedding (no crítico): {str(e)}")
                    # No fallar la actualización del reporte si falla el embedding
        elif photos and isinstance(photos, list) and len(photos) > 0 and (not has_embedding or "photos" in updates):
            print("ℹ️ [embedding] Generación local desactivada. La IA externa actualizará el embedding si corresponde.")
        
        return {"report": updated_report, "message": "Reporte actualizado exitosamente"}
    except Exception as e:
        if "404" in str(e):
            raise e
        raise HTTPException(500, f"Error actualizando reporte: {str(e)}")

@router.delete("/{report_id}")
async def delete_report(report_id: str):
    """Elimina un reporte (soft delete cambiando status a cancelled)"""
    try:
        sb = _sb()
        result = sb.table("reports").update({"status": "cancelled"}).eq("id", report_id).execute()
        
        if not result.data:
            raise HTTPException(404, "Reporte no encontrado")
        
        return {"message": "Reporte eliminado exitosamente"}
    except Exception as e:
        if "404" in str(e):
            raise e
        raise HTTPException(500, f"Error eliminando reporte: {str(e)}")

@router.post("/{report_id}/resolve")
async def resolve_report(report_id: str):
    """Marca un reporte como resuelto"""
    try:
        sb = _sb()
        result = sb.table("reports").update({
            "status": "resolved",
            "resolved_at": "now()"
        }).eq("id", report_id).execute()
        
        if not result.data:
            raise HTTPException(404, "Reporte no encontrado")
        
        return {"report": result.data[0], "message": "Reporte marcado como resuelto"}
    except Exception as e:
        if "404" in str(e):
            raise e
        raise HTTPException(500, f"Error resolviendo reporte: {str(e)}")
