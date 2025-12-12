"""
Router de Búsqueda con IA
==========================

Este router maneja búsquedas inteligentes de mascotas usando inteligencia artificial.
Utiliza MegaDescriptor para generar embeddings de imágenes y busca coincidencias
visuales entre reportes de mascotas perdidas y encontradas.

Funcionalidades principales:
- Búsqueda por imagen usando embeddings de MegaDescriptor
- Cálculo de similitud visual entre imágenes
- Filtrado por ubicación geográfica (Haversine)
- Cálculo de scores combinados (visual, color, ubicación, tiempo)
- Búsqueda de matches automáticos entre reportes

Flujo de búsqueda:
1. Usuario sube una imagen de una mascota
2. Se genera embedding usando MegaDescriptor
3. Se buscan reportes similares usando búsqueda vectorial (pgvector)
4. Se calculan scores de similitud (visual, color, ubicación, tiempo)
5. Se ordenan y filtran los resultados
6. Se retornan los mejores matches

El sistema usa embeddings de 1536 dimensiones generados por MegaDescriptor-L-384.
"""

# =========================
# Imports de FastAPI
# =========================
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

# =========================
# Imports de Python estándar
# =========================
import math  # Para cálculos matemáticos (Haversine)
import os  # Para variables de entorno
import sys  # Para manipular el path de Python
import traceback  # Para debugging

# =========================
# Imports de pathlib
# =========================
from pathlib import Path  # Para trabajar con rutas de forma multiplataforma

# =========================
# Imports de tipos
# =========================
from typing import Any, Dict, List, Optional  # Para type hints

# =========================
# Imports de Supabase
# =========================
from supabase import Client  # Cliente de Supabase

# Agregar la carpeta parent al path para poder importar utils
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.supabase_client import get_supabase_client

# =========================
# Imports de servicios
# =========================
from services.embeddings import image_bytes_to_vec  # Generar embeddings con MegaDescriptor

# Crear el router con prefijo /ai-search
router = APIRouter(prefix="/ai-search", tags=["ai-search"])

def _sb() -> Client:
    """Crea un cliente de Supabase con configuración optimizada de timeouts"""
    try:
        return get_supabase_client()
    except Exception as e:
        raise HTTPException(500, f"Error conectando a Supabase: {str(e)}")

def _coords(loc: Optional[dict]) -> Optional[tuple]:
    """
    Extrae coordenadas de un objeto de ubicación en formato GeoJSON.
    
    GeoJSON usa el formato: {"type": "Point", "coordinates": [longitud, latitud]}
    Esta función extrae las coordenadas y las retorna como tupla (lat, lon).
    
    Args:
        loc: Objeto de ubicación GeoJSON o None
        
    Returns:
        Tupla (latitud, longitud) o None si no se pueden extraer
        
    Ejemplo:
        >>> _coords({"type": "Point", "coordinates": [-58.3816, -34.6037]})
        (-34.6037, -58.3816)  # (lat, lon)
    """
    # Verificar que sea un diccionario con la clave "coordinates"
    if isinstance(loc, dict) and "coordinates" in loc:
        # GeoJSON usa [lon, lat], pero retornamos (lat, lon) para consistencia
        lon, lat = loc["coordinates"]
        return (lat, lon)  # Retornar como (latitud, longitud)
    return None  # Si no es un formato válido, retornar None

def haversine_km(lat1, lon1, lat2, lon2):
    """
    Calcula la distancia en kilómetros entre dos puntos geográficos usando la fórmula de Haversine.
    
    La fórmula de Haversine calcula la distancia del círculo máximo (great circle distance)
    entre dos puntos en una esfera, considerando que la Tierra es una esfera perfecta.
    Es más precisa que calcular distancia euclidiana simple para coordenadas geográficas.
    
    Args:
        lat1, lon1: Latitud y longitud del primer punto (en grados)
        lat2, lon2: Latitud y longitud del segundo punto (en grados)
        
    Returns:
        Distancia en kilómetros entre los dos puntos
        
    Ejemplo:
        >>> # Distancia entre Buenos Aires y Córdoba (Argentina)
        >>> haversine_km(-34.6037, -58.3816, -31.4201, -64.1888)
        ~700 km
    """
    R = 6371.0  # Radio de la Tierra en kilómetros
    # Convertir diferencias de latitud y longitud a radianes
    dlat = math.radians(lat2 - lat1)  # Diferencia de latitud en radianes
    dlon = math.radians(lon2 - lon1)  # Diferencia de longitud en radianes
    # Aplicar la fórmula de Haversine
    # a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    # Distancia = 2 * R * arcsin(√a)
    return 2 * R * math.asin(math.sqrt(a))

def label_set(labels_json) -> set:
    """
    Convierte etiquetas JSON a un conjunto de strings normalizados.
    
    Las etiquetas pueden venir en diferentes formatos JSON.
    Esta función normaliza y extrae las etiquetas como un set de strings en minúsculas.
    
    Args:
        labels_json: Objeto JSON con etiquetas (puede ser dict con "labels" o lista)
        
    Returns:
        Set de strings en minúsculas con las etiquetas
        
    Ejemplo:
        >>> label_set({"labels": [{"label": "Perro"}, {"description": "Golden Retriever"}]})
        {"perro", "golden retriever"}
    """
    # Si no hay etiquetas, retornar set vacío
    if not labels_json:
        return set()
    
    # Intentar obtener la lista de etiquetas del objeto JSON
    # Puede venir como {"labels": [...]} o directamente como lista
    items = labels_json.get("labels") if isinstance(labels_json, dict) else None
    
    # Si no es una lista válida, retornar set vacío
    if not isinstance(items, list):
        return set()
    
    # Extraer etiquetas: buscar "label" o "description" en cada item
    # Convertir a minúsculas para comparaciones case-insensitive
    # Filtrar items vacíos o None
    return {(it.get("label") or it.get("description") or "").lower() for it in items if it}

def color_set(colors_json) -> set:
    """Convierte colores JSON a un conjunto de strings."""
    if not colors_json:
        return set()
    if isinstance(colors_json, list):
        return set(color.lower() for color in colors_json if color)
    return set()

def calculate_visual_similarity(analysis_labels, candidate_labels):
    """
    Calcula similitud visual entre dos conjuntos de etiquetas usando el coeficiente de Jaccard.
    
    El coeficiente de Jaccard mide la similitud entre dos conjuntos:
    J(A,B) = |A ∩ B| / |A ∪ B|
    
    Esto da un valor entre 0 (sin similitud) y 1 (idénticos).
    Se multiplica por 100 para obtener un porcentaje.
    
    Args:
        analysis_labels: Etiquetas de la imagen de búsqueda (JSON)
        candidate_labels: Etiquetas del reporte candidato (JSON)
        
    Returns:
        Porcentaje de similitud (0-100)
        
    Ejemplo:
        >>> calculate_visual_similarity(
        ...     {"labels": [{"label": "Perro"}, {"label": "Dorado"}]},
        ...     {"labels": [{"label": "Perro"}, {"label": "Labrador"}]}
        ... )
        33.33  # 1 etiqueta en común de 3 totales (perro, dorado, labrador)
    """
    # Si alguno de los conjuntos está vacío, no hay similitud
    if not analysis_labels or not candidate_labels:
        return 0
    
    # Convertir a sets de strings normalizados
    set1 = label_set(analysis_labels)  # Etiquetas de la imagen de búsqueda
    set2 = label_set(candidate_labels)  # Etiquetas del candidato
    
    # Si alguno de los sets está vacío después de la conversión, no hay similitud
    if not set1 or not set2:
        return 0
    
    # Calcular intersección (etiquetas en común) y unión (todas las etiquetas)
    intersection = len(set1 & set2)  # Etiquetas que aparecen en ambos
    union = len(set1 | set2)  # Todas las etiquetas únicas (sin duplicados)
    
    # Evitar división por cero
    if union == 0:
        return 0
    
    # Coeficiente de Jaccard multiplicado por 100 para obtener porcentaje
    return (intersection / union) * 100

def calculate_color_similarity(analysis_colors, candidate_colors):
    """Calcula similitud de colores entre dos conjuntos."""
    if not analysis_colors or not candidate_colors:
        return 0
    
    set1 = color_set(analysis_colors)
    set2 = color_set(candidate_colors)
    
    if not set1 or not set2:
        return 0
    
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    
    if union == 0:
        return 0
    
    return (intersection / union) * 100

def calculate_location_score(distance_km, max_distance_km=50):
    """Calcula puntuación de ubicación basada en distancia."""
    if distance_km <= 0:
        return 100
    if distance_km >= max_distance_km:
        return 0
    
    # Puntuación decrece linealmente con la distancia
    return max(0, 100 - (distance_km / max_distance_km) * 100)

def calculate_time_score(created_at):
    """Calcula puntuación basada en la antigüedad del reporte."""
    from datetime import datetime, timezone
    
    try:
        if isinstance(created_at, str):
            report_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        else:
            report_date = created_at
        
        now = datetime.now(timezone.utc)
        days_old = (now - report_date).days
        
        # Reportes más recientes tienen mayor puntuación
        if days_old <= 1:
            return 100
        elif days_old <= 7:
            return 80
        elif days_old <= 30:
            return 60
        else:
            return 40
    except:
        return 50  # Puntuación neutral si hay error

@router.post("/")
async def ai_search(
    file: UploadFile = File(...),  # Archivo de imagen subido por el usuario
    user_lat: float = Query(...),  # Latitud del usuario (requerida)
    user_lng: float = Query(...),  # Longitud del usuario (requerida)
    radius_km: float = Query(10.0),  # Radio de búsqueda en kilómetros (default: 10km)
    search_type: str = Query("both")  # Tipo de búsqueda: 'lost', 'found', o 'both' (default: 'both')
):
    """
    Endpoint principal de búsqueda con IA.
    
    Este endpoint permite buscar mascotas similares subiendo una imagen.
    El proceso es:
    1. Recibe una imagen del usuario
    2. Genera un embedding usando MegaDescriptor
    3. Busca reportes similares usando búsqueda vectorial en Supabase
    4. Calcula scores de similitud (visual, ubicación, tiempo)
    5. Filtra por radio geográfico
    6. Retorna los mejores matches ordenados por score total
    
    Args:
        file: Imagen de la mascota a buscar (JPEG, PNG, etc.)
        user_lat: Latitud del usuario (para filtrar por distancia)
        user_lng: Longitud del usuario (para filtrar por distancia)
        radius_km: Radio máximo de búsqueda en kilómetros (default: 10km)
        search_type: Tipo de reportes a buscar:
            - 'lost': Solo reportes de mascotas perdidas
            - 'found': Solo reportes de mascotas encontradas
            - 'both': Ambos tipos (default)
    
    Returns:
        JSON con:
        - analysis: Datos del análisis de la imagen
        - matches: Lista de reportes similares ordenados por score
        - total_matches: Número total de matches encontrados
    
    Raises:
        HTTPException 400: Si los parámetros son inválidos
        HTTPException 500: Si hay error procesando la imagen o buscando
    """
    try:
        # =========================
        # Validación de parámetros
        # =========================
        # Validar que el tipo de búsqueda sea uno de los valores permitidos
        if search_type not in ['lost', 'found', 'both']:
            raise HTTPException(400, "search_type debe ser 'lost', 'found' o 'both'")
        
        # =========================
        # Procesar la imagen
        # =========================
        # Leer el contenido del archivo subido
        # UploadFile.read() retorna los bytes de la imagen
        content = await file.read()
        
        # Validar que el archivo no esté vacío
        if not content:
            raise HTTPException(400, "Archivo vacío o no leído")
        
        # =========================
        # Generar embedding con MegaDescriptor
        # =========================
        # Importar la función para generar embeddings
        # MegaDescriptor convierte la imagen en un vector numérico de 1536 dimensiones
        from services.embeddings import image_bytes_to_vec
        
        # Generar el embedding de la imagen de búsqueda
        # Esto puede tardar 1-3 segundos dependiendo del hardware
        query_embedding = image_bytes_to_vec(content)
        
        # =========================
        # Buscar reportes similares
        # =========================
        # Obtener cliente de Supabase
        sb = _sb()
        
        # Convertir el embedding de numpy array a lista de Python
        # Supabase RPC requiere una lista, no un numpy array
        query_vector = query_embedding.tolist()
        
        # Buscar reportes similares usando la función RPC de Supabase
        # search_similar_reports es una función PostgreSQL que usa pgvector
        # para buscar vectores similares usando distancia coseno
        try:
            similar_reports = sb.rpc(
                'search_similar_reports',  # Nombre de la función RPC en Supabase
                {
                    'query_embedding': query_vector,  # Embedding de la imagen de búsqueda
                    'match_threshold': 0.6,  # Umbral mínimo de similitud (60%)
                    'match_count': 50  # Máximo de candidatos a retornar
                }
            ).execute()
            
            # Extraer los datos de la respuesta
            # Si no hay datos, usar lista vacía
            candidates = similar_reports.data if similar_reports.data else []
        except Exception as e:
            # Si falla la búsqueda por embedding (error en RPC, base de datos, etc.)
            # Hacer una búsqueda simple sin embeddings como fallback
            # Esto asegura que siempre haya resultados, aunque sean menos precisos
            candidates = []
        
        # =========================
        # Preparar datos de análisis
        # =========================
        # Crear objeto con información del análisis
        # Nota: Ya no usamos Google Vision, así que labels y colors están vacíos
        analysis_data = {
            "labels": [],  # Etiquetas detectadas (vacío, ya no usamos Google Vision)
            "colors": [],  # Colores detectados (vacío, ya no usamos Google Vision)
            "species": "other",  # Especie detectada (se actualizará con los candidatos)
            "file_name": file.filename,  # Nombre del archivo subido
            "file_size": len(content),  # Tamaño del archivo en bytes
            "method": "embedding_similarity"  # Método usado: búsqueda por embeddings
        }
        
        # =========================
        # Filtrar candidatos
        # =========================
        # Filtrar candidatos por tipo de búsqueda si no es "both"
        # Si el usuario busca solo "lost", excluir reportes "found" y viceversa
        if search_type != "both":
            candidates = [c for c in candidates if c.get("type") == search_type]
        
        # =========================
        # Fallback: búsqueda simple
        # =========================
        # Si no hay candidatos por embedding (falló la búsqueda vectorial o no hay matches)
        # Hacer una búsqueda simple por tipo de reporte
        # Esto asegura que siempre haya resultados para mostrar
        if not candidates:
            # Construir query para obtener reportes activos
            query = sb.table("reports").select("*").eq("status", "active")
            
            # Si el tipo de búsqueda no es "both", filtrar por tipo
            if search_type != "both":
                query = query.eq("type", search_type)
            
            # Ejecutar la query y obtener los resultados
            candidates = query.execute().data
        
        # =========================
        # Detectar especie
        # =========================
        # Intentar detectar la especie del primer candidato más similar
        # Esto ayuda a mejorar los filtros posteriores
        detected_species = None
        if candidates:
            # Obtener la especie del primer candidato (el más similar)
            # Si no tiene especie, usar "other" por defecto
            detected_species = candidates[0].get("species", "other")
        
        # Actualizar análisis con la especie detectada
        analysis_data["species"] = detected_species or "other"
        
        # Filtrar por distancia y calcular puntuaciones
        results = []
        for candidate in candidates:
            candidate_coords = _coords(candidate.get("location"))
            if not candidate_coords:
                continue
            
            cand_lat, cand_lng = candidate_coords
            distance_km = haversine_km(user_lat, user_lng, cand_lat, cand_lng)
            
            if distance_km > radius_km:
                continue
            
            # Calcular puntuaciones basadas en similitud de embedding
            # Si el candidato viene de la búsqueda por embedding, ya tiene similitud
            if "similarity" in candidate:
                visual_score = candidate["similarity"] * 100
            else:
                # Calcular similitud de embedding si está disponible
                visual_score = 50  # Puntuación neutral si no hay embedding
            
            # Similitud de colores (usar colores guardados en el reporte si existen)
            candidate_colors = candidate.get("colors", [])
            color_score = calculate_color_similarity(
                [],  # No tenemos colores de la imagen de búsqueda
                candidate_colors
            ) if candidate_colors else 0
            
            location_score = calculate_location_score(distance_km, radius_km)
            time_score = calculate_time_score(candidate.get("created_at"))
            
            # Puntuación total ponderada
            total_score = (
                visual_score * 0.4 +      # 40% similitud visual
                color_score * 0.3 +       # 30% similitud de colores
                location_score * 0.2 +    # 20% proximidad geográfica
                time_score * 0.1          # 10% relevancia temporal
            )
            
            # Solo incluir resultados con puntuación mínima
            if total_score >= 30:  # Umbral mínimo de relevancia
                results.append({
                    "candidate": {
                        "id": candidate["id"],
                        "pet_name": candidate.get("pet_name"),
                        "species": candidate.get("species"),
                        "breed": candidate.get("breed"),
                        "color": candidate.get("color"),
                        "size": candidate.get("size"),
                        "description": candidate.get("description"),
                        "location": candidate.get("location"),
                        "photos": candidate.get("photos", []),
                        "labels": candidate.get("labels"),
                        "reporter_id": candidate.get("reporter_id"),
                        "created_at": candidate.get("created_at"),
                    },
                    "distance_km": round(distance_km, 2),
                    "visual_similarity": round(visual_score, 1),
                    "color_similarity": round(color_score, 1),
                    "location_score": round(location_score, 1),
                    "time_score": round(time_score, 1),
                    "total_score": round(total_score, 1),
                    "match_confidence": "Alta" if total_score >= 70 else "Media" if total_score >= 50 else "Baja"
                })
        
        # Ordenar por puntuación total
        results.sort(key=lambda x: x["total_score"], reverse=True)
        
        # Limitar resultados a los mejores 20
        top_results = results[:20]
        
        return {
            "analysis": analysis_data,
            "matches": top_results,
            "search_metadata": {
                "total_candidates": len(candidates),
                "filtered_results": len(results),
                "returned_results": len(top_results),
                "search_type": search_type,
                "radius_km": radius_km,
                "user_location": {"lat": user_lat, "lng": user_lng},
                "detected_species": detected_species,
                "analysis_confidence": "Alta" if len(candidates) > 0 else "Baja"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Error en búsqueda IA: {str(e)}")

@router.get("/health")
async def ai_search_health():
    """Verifica el estado del servicio de búsqueda IA."""
    try:
        # Verificar conexión a Supabase
        sb = _sb()
        test_query = sb.table("reports").select("id").limit(1).execute()
        
        return {
            "status": "ok",
            "message": "Servicio de búsqueda IA funcionando",
            "supabase": "conectado" if test_query.data is not None else "error",
            "method": "embedding_similarity",
            "endpoints": {
                "ai_search": "/ai-search/",
                "health": "/ai-search/health"
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error en servicio IA: {str(e)}",
            "supabase": "error"
        }

@router.post("/similarity")
async def calculate_similarity(
    labels1: List[Dict[str, Any]] = None,
    labels2: List[Dict[str, Any]] = None,
    colors1: List[str] = None,
    colors2: List[str] = None
):
    """
    Calcula similitud entre dos conjuntos de etiquetas y colores.
    Útil para testing y debugging.
    """
    try:
        visual_similarity = calculate_visual_similarity(
            {"labels": labels1 or []}, 
            {"labels": labels2 or []}
        )
        
        color_similarity = calculate_color_similarity(
            colors1 or [], 
            colors2 or []
        )
        
        return {
            "visual_similarity": round(visual_similarity, 1),
            "color_similarity": round(color_similarity, 1),
            "combined_score": round((visual_similarity + color_similarity) / 2, 1),
            "inputs": {
                "labels1": labels1,
                "labels2": labels2,
                "colors1": colors1,
                "colors2": colors2
            }
        }
    except Exception as e:
        raise HTTPException(500, f"Error calculando similitud: {str(e)}")

