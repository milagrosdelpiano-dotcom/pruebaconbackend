"""
Router de Matches (Coincidencias)
==================================

Este router maneja todas las operaciones relacionadas con matches (coincidencias)
entre reportes de mascotas perdidas y encontradas.

Un match es una posible coincidencia entre:
- Un reporte de mascota perdida y un reporte de mascota encontrada, o viceversa
- Se calculan usando similitud visual (embeddings), ubicación geográfica, y etiquetas

Funcionalidades principales:
- Búsqueda automática de matches para un reporte
- Obtener matches pendientes de un usuario o reporte
- Aceptar o rechazar matches
- Calcular scores de similitud entre reportes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import os, math, sys
from pathlib import Path
from supabase import Client

# Agregar la carpeta parent al path para poder importar utils
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.supabase_client import get_supabase_client

# Crear el router con prefijo /matches
router = APIRouter(prefix="/matches", tags=["matches"])

def _sb() -> Client:
    """
    Crea un cliente de Supabase con configuración optimizada de timeouts.
    
    Returns:
        Client: Cliente de Supabase configurado
        
    Raises:
        HTTPException: Si no se puede conectar a Supabase
    """
    try:
        return get_supabase_client()
    except Exception as e:
        raise HTTPException(500, f"Error conectando a Supabase: {str(e)}")

def _coords(loc: Optional[dict]) -> Optional[tuple]:
    """
    Extrae coordenadas de un objeto de ubicación en formato GeoJSON.
    
    Args:
        loc: Objeto GeoJSON con formato {"type":"Point","coordinates":[lon,lat]}
        
    Returns:
        Tupla (latitud, longitud) o None si no se pueden extraer
    """
    # GeoJSON usa formato {"type":"Point","coordinates":[lon,lat]}
    if isinstance(loc, dict) and "coordinates" in loc:
        lon, lat = loc["coordinates"]
        return (lat, lon)  # Retornar como (lat, lon) para consistencia
    return None

def haversine_km(lat1, lon1, lat2, lon2):
    """
    Calcula la distancia en kilómetros entre dos puntos geográficos usando la fórmula de Haversine.
    
    Args:
        lat1, lon1: Latitud y longitud del primer punto (en grados)
        lat2, lon2: Latitud y longitud del segundo punto (en grados)
        
    Returns:
        Distancia en kilómetros entre los dos puntos
    """
    R = 6371.0  # Radio de la Tierra en kilómetros
    # Convertir diferencias a radianes
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    # Aplicar fórmula de Haversine
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def label_set(labels_json) -> set:
    """
    Convierte etiquetas JSON a un conjunto de strings normalizados.
    
    Args:
        labels_json: Objeto JSON con etiquetas (puede ser dict con "labels" o lista)
        
    Returns:
        Set de strings en minúsculas con las etiquetas
    """
    # Si no hay etiquetas, retornar set vacío
    if not labels_json:
        return set()
    
    # Intentar obtener la lista de etiquetas
    items = labels_json.get("labels") if isinstance(labels_json, dict) else None
    
    # Si no es una lista válida, retornar set vacío
    if not isinstance(items, list):
        return set()
    
    # Extraer etiquetas y normalizar a minúsculas
    return {(it.get("label") or it.get("description") or "").lower() for it in items if it}

@router.get("/auto-match")
def auto_match(
    report_id: str = Query(..., description="ID del reporte base para buscar matches"),
    radius_km: float = Query(10.0, description="Radio de búsqueda en kilómetros"),
    top_k: int = Query(5, description="Número máximo de matches a retornar")
):
    """
    Busca automáticamente matches (coincidencias) para un reporte.
    
    Este endpoint busca reportes del tipo opuesto (si es "lost" busca "found" y viceversa)
    que estén dentro del radio especificado y tengan la misma especie.
    
    El algoritmo de scoring considera:
    - Overlap de etiquetas (más etiquetas en común = mayor score)
    - Distancia geográfica (más cerca = mayor score)
    
    Args:
        report_id: ID del reporte base (debe existir en la base de datos)
        radius_km: Radio máximo de búsqueda en kilómetros (default: 10km)
        top_k: Número máximo de matches a retornar (default: 5)
    
    Returns:
        JSON con:
        - report_id: ID del reporte base
        - radius_km: Radio usado
        - total_candidates: Total de candidatos encontrados
        - top_k: Lista de los mejores matches ordenados por score
    """
    sb = _sb()
    
    # =========================
    # Obtener reporte base
    # =========================
    # Buscar el reporte base en la base de datos
    base = sb.table("reports").select("*").eq("id", report_id).single().execute().data
    
    # Verificar que el reporte existe
    if not base:
        raise HTTPException(404, "Reporte base no encontrado")
    
    # =========================
    # Extraer datos del reporte base
    # =========================
    # Extraer coordenadas de la ubicación
    base_pt = _coords(base.get("location"))
    if not base_pt:
        raise HTTPException(400, "El reporte base no tiene location válido (GeoJSON Point)")
    
    base_lat, base_lon = base_pt  # Desempaquetar coordenadas
    base_labels = label_set(base.get("labels"))  # Extraer etiquetas como set
    
    # Determinar el tipo opuesto de reporte a buscar
    # Si el reporte base es "lost", buscar "found" y viceversa
    target_type = "found" if base.get("type") == "lost" else "lost"
    
    # =========================
    # Buscar candidatos
    # =========================
    # Buscar reportes que:
    # - Sean del tipo opuesto (lost/found)
    # - Estén activos (status = "active")
    # - Tengan la misma especie
    candidates = sb.table("reports").select("*") \
        .eq("type", target_type) \
        .eq("status", "active") \
        .eq("species", base.get("species")) \
        .execute().data
    
    # =========================
    # Filtrar y calcular scores
    # =========================
    results: List[Dict[str, Any]] = []
    
    # Aproximación rápida: 1 grado ≈ 111 km
    # Usar esto para un filtro rápido antes de calcular la distancia exacta
    lat_pad = radius_km / 111.0  # Padding en latitud
    lon_pad = radius_km / 111.0  # Padding en longitud
    
    # Iterar sobre cada candidato
    for c in candidates:
        # Extraer coordenadas del candidato
        pt = _coords(c.get("location"))
        if not pt:
            continue  # Saltar si no tiene coordenadas válidas
        
        lat, lon = pt
        
        # Filtro rápido: verificar si está dentro del rectángulo aproximado
        # Esto evita calcular la distancia exacta para candidatos muy lejanos
        if not (base_lat - lat_pad <= lat <= base_lat + lat_pad and 
                base_lon - lon_pad <= lon <= base_lon + lon_pad):
            continue  # Está fuera del área aproximada, saltar
        
        # Calcular distancia exacta usando Haversine
        d = haversine_km(base_lat, base_lon, lat, lon)
        
        # Filtrar por radio exacto
        if d > radius_km:
            continue  # Está fuera del radio, saltar
        
        # =========================
        # Calcular score
        # =========================
        # Calcular overlap de etiquetas (intersección de sets)
        # Más etiquetas en común = mayor score
        overlap = len(base_labels & label_set(c.get("labels")))
        
        # Score = (overlap * 10) - (distancia * 0.2)
        # - Cada etiqueta en común suma 10 puntos
        # - Cada kilómetro resta 0.2 puntos
        # Esto prioriza matches cercanos con muchas etiquetas en común
        score = overlap * 10 - d * 0.2
        
        # Agregar a resultados
        results.append({
            "candidate": {
                "id": c["id"],  # ID del candidato
                "pet_name": c.get("pet_name"),  # Nombre de la mascota
                "species": c.get("species"),  # Especie
                "color": c.get("color"),  # Color
                "location": c.get("location"),  # Ubicación
                # Primera foto del array, o None si no hay fotos
                "photo": (c.get("photos") or [None])[0] if isinstance(c.get("photos"), list) else None,
                "labels": c.get("labels"),  # Etiquetas
            },
            "distance_km": round(d, 2),  # Distancia redondeada a 2 decimales
            "label_overlap": overlap,  # Número de etiquetas en común
            "score": round(score, 3)  # Score redondeado a 3 decimales
        })
    
    # =========================
    # Ordenar y retornar
    # =========================
    # Ordenar por score descendente (mejores matches primero)
    results.sort(key=lambda x: x["score"], reverse=True)
    
    # Retornar solo los top_k mejores matches
    return {
        "report_id": report_id,
        "radius_km": radius_km,
        "total_candidates": len(results),
        "top_k": results[:top_k]  # Retornar solo los mejores
    }


@router.get("/pending")
async def get_pending_matches(
    user_id: Optional[str] = Query(None, description="ID del usuario para filtrar matches de sus reportes"),
    report_id: Optional[str] = Query(None, description="ID del reporte específico para obtener sus matches"),
    status: str = Query("pending", description="Estado de los matches (pending, accepted, rejected)")
):
    """
    Obtiene matches pendientes (o con otro estado) para un usuario o un reporte específico.
    
    Este endpoint permite obtener matches de dos formas:
    1. Por usuario: Retorna todos los matches de todos los reportes del usuario
    2. Por reporte: Retorna todos los matches de un reporte específico
    
    Un match puede estar en tres estados:
    - pending: Match encontrado pero aún no aceptado/rechazado
    - accepted: Match aceptado por el usuario
    - rejected: Match rechazado por el usuario
    
    Args:
        user_id: ID del usuario (opcional, filtra por reportes del usuario)
        report_id: ID del reporte (opcional, filtra por matches de ese reporte)
        status: Estado de los matches a buscar (default: "pending")
    
    Returns:
        Lista de matches con información completa de ambos reportes
    """
    try:
        sb = _sb()
        
        if report_id:
            # =========================
            # Obtener matches de un reporte específico
            # =========================
            # Un match puede tener el reporte como lost_report_id o found_report_id
            # Necesitamos buscar en ambas columnas
            matches_lost = sb.table("matches").select("*").eq("lost_report_id", report_id).eq("status", status).execute()
            matches_found = sb.table("matches").select("*").eq("found_report_id", report_id).eq("status", status).execute()
            
            all_matches = (matches_lost.data or []) + (matches_found.data or [])
            
            # Enriquecer con información de los reportes relacionados
            enriched_matches = []
            for match in all_matches:
                lost_id = match.get("lost_report_id")
                found_id = match.get("found_report_id")
                
                # Obtener reporte perdido
                lost_report = None
                if lost_id:
                    lost_result = sb.table("reports").select("id, type, pet_name, species, photos, description, location, created_at").eq("id", lost_id).single().execute()
                    lost_report = lost_result.data if lost_result.data else None
                
                # Obtener reporte encontrado
                found_report = None
                if found_id:
                    found_result = sb.table("reports").select("id, type, pet_name, species, photos, description, location, created_at").eq("id", found_id).single().execute()
                    found_report = found_result.data if found_result.data else None
                
                enriched_matches.append({
                    "match_id": match.get("id"),
                    "similarity_score": match.get("similarity_score"),
                    "matched_by": match.get("matched_by"),
                    "status": match.get("status"),
                    "created_at": match.get("created_at"),
                    "lost_report": lost_report,
                    "found_report": found_report
                })
            
            return {
                "matches": enriched_matches,
                "count": len(enriched_matches),
                "report_id": report_id
            }
        
        elif user_id:
            # Obtener matches de todos los reportes del usuario
            # Primero obtener todos los reportes del usuario
            user_reports = sb.table("reports").select("id").eq("reporter_id", user_id).execute()
            report_ids = [r["id"] for r in (user_reports.data or [])]
            
            if not report_ids:
                return {"matches": [], "count": 0, "user_id": user_id}
            
            # Obtener matches donde los reportes del usuario están involucrados
            matches_lost = sb.table("matches").select("*").in_("lost_report_id", report_ids).eq("status", status).execute()
            matches_found = sb.table("matches").select("*").in_("found_report_id", report_ids).eq("status", status).execute()
            
            all_matches = (matches_lost.data or []) + (matches_found.data or [])
            
            # Enriquecer con información de los reportes (similar al caso anterior)
            enriched_matches = []
            for match in all_matches:
                lost_id = match.get("lost_report_id")
                found_id = match.get("found_report_id")
                
                lost_report = None
                if lost_id:
                    lost_result = sb.table("reports").select("id, type, pet_name, species, photos, description, location, created_at").eq("id", lost_id).single().execute()
                    lost_report = lost_result.data if lost_result.data else None
                
                found_report = None
                if found_id:
                    found_result = sb.table("reports").select("id, type, pet_name, species, photos, description, location, created_at").eq("id", found_id).single().execute()
                    found_report = found_result.data if found_result.data else None
                
                enriched_matches.append({
                    "match_id": match.get("id"),
                    "similarity_score": match.get("similarity_score"),
                    "matched_by": match.get("matched_by"),
                    "status": match.get("status"),
                    "created_at": match.get("created_at"),
                    "lost_report": lost_report,
                    "found_report": found_report
                })
            
            return {
                "matches": enriched_matches,
                "count": len(enriched_matches),
                "user_id": user_id
            }
        else:
            raise HTTPException(400, "Debe proporcionar user_id o report_id")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo matches pendientes: {str(e)}")


@router.put("/{match_id}/status")
async def update_match_status(
    match_id: str,
    status: str = Query(..., description="Nuevo estado del match (accepted, rejected)")
):
    """
    Actualiza el estado de un match (aceptado o rechazado).
    """
    try:
        if status not in ["accepted", "rejected"]:
            raise HTTPException(400, "El estado debe ser 'accepted' o 'rejected'")
        
        sb = _sb()
        
        result = sb.table("matches").update({"status": status}).eq("id", match_id).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(404, f"Match {match_id} no encontrado")
        
        return {
            "success": True,
            "match_id": match_id,
            "status": status,
            "message": f"Match {status} exitosamente"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error actualizando estado del match: {str(e)}")