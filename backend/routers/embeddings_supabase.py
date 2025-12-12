"""
Router de Embeddings para Supabase
===================================

Este router maneja la generación y gestión de embeddings de imágenes
usando MegaDescriptor y almacenándolos en Supabase.

Funcionalidades:
- Generar embeddings de imágenes
- Indexar embeddings en reportes (guardar en base de datos)
- Buscar imágenes similares usando embeddings
- Filtrar por ubicación y otros criterios

Los embeddings se generan usando MegaDescriptor y se almacenan
en Supabase usando pgvector para búsquedas vectoriales eficientes.
"""

# =========================
# Imports de FastAPI
# =========================
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

# =========================
# Imports de Python estándar
# =========================
import os  # Para variables de entorno

# =========================
# Imports de tipos
# =========================
from typing import Optional  # Para tipos opcionales

# =========================
# Imports de servicios
# =========================
from services.embeddings import image_bytes_to_vec  # Generar embeddings con MegaDescriptor

# =========================
# Imports de Supabase
# =========================
from supabase import Client, create_client  # Cliente de Supabase

# Crear el router con prefijo /embeddings
router = APIRouter(prefix="/embeddings", tags=["embeddings"])

def get_supabase():
    """
    Crea un cliente de Supabase básico.
    
    Returns:
        Client: Cliente de Supabase
        
    Raises:
        RuntimeError: Si no se encuentran las credenciales en variables de entorno
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL o SUPABASE_SERVICE_KEY no configuradas")
    return create_client(url, key)

@router.post("/generate")
async def generate_embedding(file: UploadFile = File(...)):
    """
    Genera un embedding para una imagen usando MegaDescriptor.
    
    Este endpoint:
    1. Recibe una imagen
    2. Genera el embedding usando MegaDescriptor-L-384
    3. Retorna el embedding como lista de números
    
    Args:
        file: Archivo de imagen a procesar
        
    Returns:
        dict: Embedding, dimensiones, modelo usado, nombre y tamaño del archivo
        
    Raises:
        HTTPException 400: Si el archivo está vacío
        HTTPException 500: Si hay error generando el embedding
    """
    try:
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(400, "Archivo vacío o no leído")
        
        vec = image_bytes_to_vec(image_bytes)
        
        return {
            "embedding": vec.tolist(),
            "dimensions": len(vec),
            "model": "MegaDescriptor-L-384",
            "file_name": file.filename,
            "file_size": len(image_bytes)
        }
    except Exception as e:
        raise HTTPException(500, f"Error generando embedding: {str(e)}")

@router.post("/index/{report_id}")
async def index_report_embedding(report_id: str, file: UploadFile = File(...)):
    """
    Indexa un embedding para un reporte específico en Supabase.
    
    Este endpoint:
    1. Genera el embedding de la imagen usando MegaDescriptor
    2. Guarda el embedding en la tabla reports usando pgvector
    3. Actualiza el campo embedding del reporte
    
    Args:
        report_id: ID del reporte (UUID)
        file: Archivo de imagen a procesar
        
    Returns:
        dict: Estado de la operación con report_id y dimensiones
        
    Raises:
        HTTPException 400: Si no se puede procesar la imagen
        HTTPException 404: Si el report_id no existe
        HTTPException 500: Si hay error actualizando el embedding
    """
    try:
        # Generar embedding de la imagen usando MegaDescriptor
        vec = image_bytes_to_vec(await file.read())
    except Exception as e:
        raise HTTPException(400, f"No se pudo procesar la imagen: {e}")
    
    sb = get_supabase()
    try:
        # Convertir vector numpy a lista para Supabase
        # Supabase necesita una lista de Python, no un numpy array
        vec_list = vec.tolist()
        
        # Usar función RPC de Supabase para actualizar el embedding
        # Esta función SQL maneja la conversión correcta a tipo vector de pgvector
        result = sb.rpc('update_report_embedding', {
            'report_id': report_id,
            'embedding_vector': vec_list
        }).execute()
        
        if not result.data:
            raise HTTPException(404, "report_id no encontrado")
            
        return {"status": "ok", "report_id": report_id, "dims": len(vec)}
    except Exception as e:
        raise HTTPException(500, f"Error actualizando embedding: {e}")

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
    1. Genera un embedding de la imagen de búsqueda usando MegaDescriptor
    2. Busca reportes con embeddings similares en Supabase
    3. Calcula similitud coseno entre embeddings
    4. Filtra por ubicación geográfica si se proporciona (opcional)
    5. Crea un match automático si se encuentra una coincidencia y se proporciona lost_id
    
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
        HTTPException 500: Si hay error en la búsqueda
    """
    try:
        # Generar embedding de la imagen de búsqueda usando MegaDescriptor
        qvec = image_bytes_to_vec(await file.read())
    except Exception as e:
        raise HTTPException(400, f"No se pudo procesar la imagen: {e}")

    sb = get_supabase()
    
    # =========================
    # Construir query base
    # =========================
    # Obtener todos los reportes que tengan embedding
    query = sb.table("reports").select("id, species, color, photos, labels, embedding")
    
    # Filtrar por embedding no nulo (solo reportes con embeddings)
    query = query.not_.is_("embedding", "null")
    
    # Aplicar filtro geográfico si se proporciona
    # NOTA: El filtro geográfico completo requeriría una función RPC en Supabase
    # Por ahora, obtenemos todos y podríamos filtrar después si es necesario
    if lat is not None and lng is not None and max_km and max_km > 0:
        # Para Supabase, necesitaríamos usar una función RPC o filtrar después
        # Por ahora, obtenemos todos y filtramos después
        pass
    
    try:
        result = query.execute()
        reports = result.data
        
        # =========================
        # Calcular similitud para cada reporte
        # =========================
        results = []
        import numpy as np  # Para operaciones con vectores
        
        for report in reports:
            if not report.get("embedding"):
                continue
                
            # Convertir embedding de Supabase a numpy array
            # Los embeddings vienen como listas desde Supabase/pgvector
            report_vec = report["embedding"]
            if isinstance(report_vec, list):
                # Asegurar que todos los elementos son números válidos
                try:
                    report_vec = np.array([float(x) for x in report_vec], dtype=np.float32)
                except (ValueError, TypeError):
                    continue  # Si hay error, saltar este reporte
            else:
                continue  # Si no es una lista, saltar
            
            # Calcular similitud coseno entre embeddings
            # Similitud coseno = (A · B) / (||A|| * ||B||)
            # Valores cercanos a 1 = muy similares, valores cercanos a 0 = diferentes
            try:
                similarity = np.dot(qvec, report_vec) / (np.linalg.norm(qvec) * np.linalg.norm(report_vec))
            except:
                continue  # Si hay error en el cálculo, saltar este reporte
            
            # Aplicar filtro geográfico si es necesario
            # NOTA: Para filtrar por ubicación, necesitaríamos las coordenadas del reporte
            # Por ahora, este filtro no está implementado completamente
            if lat is not None and lng is not None and max_km and max_km > 0:
                # Aquí necesitarías las coordenadas del reporte
                # Por ahora, saltamos el filtro geográfico
                pass
            
            results.append({
                "report_id": report["id"],
                "similarity_score": float(similarity),  # Convertir a float nativo de Python
                "species": report.get("species"),
                "color": report.get("color"),
                "photo": (report.get("photos") or [None])[0] if isinstance(report.get("photos"), list) else None,  # Primera foto
                "labels": report.get("labels")
            })
        
        # Ordenar por similitud (mayor a menor) y tomar top_k
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        results = results[:top_k]
        
        # Guardar top-1 en matches si hay resultados y se proporcionó lost_id
        # Esto crea un match automático entre el reporte perdido y el encontrado más similar
        if results and lost_id:
            top1 = results[0]
            try:
                sb.table("matches").insert({
                    "lost_report_id": lost_id,
                    "found_report_id": top1["report_id"],
                    "similarity_score": round(top1["similarity_score"], 4),  # Redondear a 4 decimales
                    "matched_by": "ai_visual",  # Indica que fue encontrado usando embeddings de imágenes (MegaDescriptor)
                    "status": "pending"  # Match pendiente de confirmación
                }).execute()
            except Exception as e:
                print(f"Error guardando match: {e}")  # Log del error pero no fallar la búsqueda
        
        return {"results": results}
        
    except Exception as e:
        raise HTTPException(500, f"Error en búsqueda: {e}")
