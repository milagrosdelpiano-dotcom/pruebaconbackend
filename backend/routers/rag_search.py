"""
Router de Búsqueda RAG (Retrieval Augmented Generation)
=======================================================

Este router implementa búsqueda semántica usando RAG (Retrieval Augmented Generation).
RAG combina búsqueda vectorial con embeddings para encontrar información relevante.

Funcionalidades:
- Búsqueda de reportes similares usando embeddings
- Búsqueda con filtros de ubicación
- Guardar y recuperar embeddings de reportes
- Estadísticas de embeddings

Los embeddings se almacenan en Supabase usando pgvector para búsquedas eficientes.
"""

# =========================
# Imports de FastAPI
# =========================
from fastapi import APIRouter, Body, HTTPException, Query

# =========================
# Imports de Python estándar
# =========================
import os  # Para variables de entorno
import sys  # Para manipular el path de Python

# =========================
# Imports de pathlib
# =========================
from pathlib import Path  # Para trabajar con rutas de forma multiplataforma

# =========================
# Imports de tipos
# =========================
from typing import Any, Dict, List, Optional  # Para type hints

# =========================
# Imports de NumPy
# =========================
import numpy as np  # Para operaciones con vectores

# =========================
# Imports de Supabase
# =========================
from supabase import Client  # Cliente de Supabase

# Agregar la carpeta parent al path para poder importar utils
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.supabase_client import get_supabase_client

# Crear el router con prefijo /rag
router = APIRouter(prefix="/rag", tags=["rag-search"])

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

@router.post("/search")
async def rag_search(
    embedding: List[float] = Body(..., description="Vector de embedding (512 dimensiones)"),
    match_threshold: float = Query(0.7, ge=0.0, le=1.0, description="Umbral mínimo de similitud"),
    match_count: int = Query(10, ge=1, le=50, description="Número máximo de resultados"),
    filter_species: Optional[str] = Query(None, description="Filtrar por especie"),
    filter_type: Optional[str] = Query(None, description="Filtrar por tipo (lost/found)")
):
    """
    Búsqueda RAG usando embeddings almacenados en Supabase.
    
    Este endpoint busca reportes similares basándose en similitud de embeddings.
    Usa la función SQL search_similar_reports que utiliza pgvector para búsqueda
    vectorial eficiente.
    
    Args:
        embedding: Vector de embedding de 512 dimensiones (debe ser exactamente 512)
        match_threshold: Umbral mínimo de similitud (0.0-1.0, default 0.7)
        match_count: Número máximo de resultados (1-50, default 10)
        filter_species: Filtrar por especie (opcional, ej: 'dog', 'cat')
        filter_type: Filtrar por tipo de reporte (opcional, 'lost' o 'found')
        
    Returns:
        dict: Resultados con lista de reportes similares, conteo y parámetros de búsqueda
        
    Raises:
        HTTPException 400: Si el embedding no tiene 512 dimensiones
        HTTPException 500: Si hay error en la búsqueda
    """
    try:
        # Validar que el embedding tenga 512 dimensiones
        if len(embedding) != 512:
            raise HTTPException(400, f"El embedding debe tener 512 dimensiones, se recibieron {len(embedding)}")
        
        sb = _sb()
        
        # Llamar a la función SQL de búsqueda
        result = sb.rpc('search_similar_reports', {
            'query_embedding': embedding,
            'match_threshold': match_threshold,
            'match_count': match_count,
            'filter_species': filter_species,
            'filter_type': filter_type
        }).execute()
        
        if not result.data:
            return {
                "results": [],
                "count": 0,
                "message": "No se encontraron reportes similares"
            }
        
        return {
            "results": result.data,
            "count": len(result.data),
            "search_params": {
                "match_threshold": match_threshold,
                "match_count": match_count,
                "filter_species": filter_species,
                "filter_type": filter_type
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error en búsqueda RAG: {str(e)}")

@router.post("/search-with-location")
async def rag_search_with_location(
    embedding: List[float] = Body(..., description="Vector de embedding (512 dimensiones)"),
    user_lat: float = Query(..., description="Latitud del usuario"),
    user_lng: float = Query(..., description="Longitud del usuario"),
    max_distance_km: float = Query(10.0, ge=0.1, le=100.0, description="Distancia máxima en km"),
    match_threshold: float = Query(0.7, ge=0.0, le=1.0, description="Umbral mínimo de similitud"),
    match_count: int = Query(10, ge=1, le=50, description="Número máximo de resultados"),
    filter_species: Optional[str] = Query(None, description="Filtrar por especie"),
    filter_type: Optional[str] = Query(None, description="Filtrar por tipo (lost/found)")
):
    """
    Búsqueda RAG con filtro geográfico.
    
    Este endpoint combina similitud de embeddings con proximidad geográfica.
    Busca reportes que sean visualmente similares Y estén dentro del radio especificado.
    
    Args:
        embedding: Vector de embedding de 512 dimensiones
        user_lat: Latitud del usuario (requerida)
        user_lng: Longitud del usuario (requerida)
        max_distance_km: Distancia máxima en kilómetros (0.1-100, default 10.0)
        match_threshold: Umbral mínimo de similitud (0.0-1.0, default 0.7)
        match_count: Número máximo de resultados (1-50, default 10)
        filter_species: Filtrar por especie (opcional)
        filter_type: Filtrar por tipo de reporte (opcional)
        
    Returns:
        dict: Resultados con lista de reportes similares dentro del radio, conteo y parámetros
        
    Raises:
        HTTPException 400: Si el embedding no tiene 512 dimensiones
        HTTPException 500: Si hay error en la búsqueda
    """
    try:
        # Validar que el embedding tenga 512 dimensiones
        if len(embedding) != 512:
            raise HTTPException(400, f"El embedding debe tener 512 dimensiones, se recibieron {len(embedding)}")
        
        sb = _sb()
        
        # Llamar a la función SQL de búsqueda con ubicación
        result = sb.rpc('search_similar_reports_with_location', {
            'query_embedding': embedding,
            'user_lat': user_lat,
            'user_lng': user_lng,
            'max_distance_km': max_distance_km,
            'match_threshold': match_threshold,
            'match_count': match_count,
            'filter_species': filter_species,
            'filter_type': filter_type
        }).execute()
        
        if not result.data:
            return {
                "results": [],
                "count": 0,
                "message": "No se encontraron reportes similares en el área especificada"
            }
        
        return {
            "results": result.data,
            "count": len(result.data),
            "search_params": {
                "user_location": {"lat": user_lat, "lng": user_lng},
                "max_distance_km": max_distance_km,
                "match_threshold": match_threshold,
                "match_count": match_count,
                "filter_species": filter_species,
                "filter_type": filter_type
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error en búsqueda RAG con ubicación: {str(e)}")

@router.post("/save-embedding/{report_id}")
async def save_embedding(
    report_id: str,
    embedding: List[float] = Body(..., description="Vector de embedding (512 dimensiones)")
):
    """
    Guarda un embedding en Supabase para un reporte específico.
    
    Este endpoint actualiza el campo embedding de un reporte en la base de datos.
    El embedding se almacena usando pgvector para permitir búsquedas vectoriales eficientes.
    
    Args:
        report_id: ID del reporte (UUID)
        embedding: Vector de embedding de 512 dimensiones
        
    Returns:
        dict: Confirmación de éxito con report_id y dimensiones
        
    Raises:
        HTTPException 400: Si el embedding no tiene 512 dimensiones
        HTTPException 404: Si el reporte no existe
        HTTPException 500: Si hay error guardando el embedding
    """
    try:
        # Validar que el embedding tenga 512 dimensiones
        if len(embedding) != 512:
            raise HTTPException(400, f"El embedding debe tener 512 dimensiones, se recibieron {len(embedding)}")
        
        sb = _sb()
        
        # Usar la función RPC para actualizar el embedding
        result = sb.rpc('update_report_embedding', {
            'report_id': report_id,
            'embedding_vector': embedding
        }).execute()
        
        if not result.data:
            raise HTTPException(404, f"Reporte {report_id} no encontrado")
        
        return {
            "success": True,
            "report_id": report_id,
            "message": "Embedding guardado exitosamente",
            "embedding_dimensions": len(embedding)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error guardando embedding: {str(e)}")

@router.get("/embedding/{report_id}")
async def get_embedding(report_id: str):
    """
    Obtiene el embedding de un reporte específico.
    
    Este endpoint recupera el embedding almacenado de un reporte desde Supabase.
    Útil para verificar si un reporte tiene embedding o para análisis.
    
    Args:
        report_id: ID del reporte (UUID)
        
    Returns:
        dict: Embedding del reporte con dimensiones
        
    Raises:
        HTTPException 404: Si el reporte no tiene embedding o no existe
        HTTPException 500: Si hay error obteniendo el embedding
    """
    try:
        sb = _sb()
        
        result = sb.rpc('get_report_embedding', {
            'report_id': report_id
        }).execute()
        
        if not result.data or result.data is None:
            raise HTTPException(404, f"Reporte {report_id} no tiene embedding o no existe")
        
        # El embedding viene como vector de pgvector
        embedding = result.data
        
        return {
            "report_id": report_id,
            "embedding": embedding if isinstance(embedding, list) else embedding.tolist() if hasattr(embedding, 'tolist') else list(embedding),
            "dimensions": len(embedding) if isinstance(embedding, (list, np.ndarray)) else 512
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo embedding: {str(e)}")

@router.get("/has-embedding/{report_id}")
async def check_has_embedding(report_id: str):
    """
    Verifica si un reporte tiene embedding.
    
    Este endpoint verifica rápidamente si un reporte tiene un embedding almacenado.
    Útil para determinar si se necesita generar un embedding para un reporte.
    
    Args:
        report_id: ID del reporte (UUID)
        
    Returns:
        dict: report_id y has_embedding (boolean)
        
    Raises:
        HTTPException 500: Si hay error verificando el embedding
    """
    try:
        sb = _sb()
        
        result = sb.rpc('has_embedding', {
            'report_id': report_id
        }).execute()
        
        return {
            "report_id": report_id,
            "has_embedding": result.data if isinstance(result.data, bool) else bool(result.data)
        }
        
    except Exception as e:
        raise HTTPException(500, f"Error verificando embedding: {str(e)}")

@router.get("/stats")
async def get_rag_stats():
    """
    Obtiene estadísticas sobre los embeddings en la base de datos.
    
    Este endpoint proporciona información sobre:
    - Total de reportes
    - Reportes con embedding
    - Reportes activos con embedding
    - Porcentaje de cobertura (reportes con embedding / total)
    
    Returns:
        dict: Estadísticas de embeddings con conteos y porcentajes
        
    Raises:
        HTTPException 500: Si hay error obteniendo las estadísticas
    """
    try:
        sb = _sb()
        
        # Contar total de reportes
        total_result = sb.table("reports").select("id", count="exact").execute()
        total_count = total_result.count if hasattr(total_result, 'count') else len(total_result.data)
        
        # Contar reportes con embedding
        with_embedding_result = sb.table("reports").select("id", count="exact").not_.is_("embedding", "null").execute()
        with_embedding_count = with_embedding_result.count if hasattr(with_embedding_result, 'count') else len(with_embedding_result.data)
        
        # Contar reportes activos con embedding
        active_with_embedding_result = sb.table("reports").select("id", count="exact").eq("status", "active").not_.is_("embedding", "null").execute()
        active_with_embedding_count = active_with_embedding_result.count if hasattr(active_with_embedding_result, 'count') else len(active_with_embedding_result.data)
        
        return {
            "total_reports": total_count,
            "reports_with_embedding": with_embedding_count,
            "active_reports_with_embedding": active_with_embedding_count,
            "coverage_percentage": round((with_embedding_count / total_count * 100) if total_count > 0 else 0, 2),
            "embedding_dimensions": 512
        }
        
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo estadísticas: {str(e)}")



