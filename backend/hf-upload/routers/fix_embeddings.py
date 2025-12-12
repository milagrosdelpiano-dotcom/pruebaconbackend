"""
Router para Regenerar Embeddings
=================================

Este router proporciona herramientas administrativas para regenerar embeddings
de reportes que no los tienen o que tienen embeddings incorrectos.

Funcionalidades:
- Regenerar embedding para un reporte específico
- Regenerar embeddings para múltiples reportes
- Regenerar embeddings para todos los reportes sin embedding
- Verificar estado de embeddings

Útil para:
- Migración de reportes antiguos que no tienen embeddings
- Corrección de embeddings corruptos
- Regeneración masiva después de actualizar el modelo
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict
import os, sys
from pathlib import Path
from supabase import Client
import httpx  # Para descargar imágenes desde URLs
from services.embeddings import image_bytes_to_vec  # Función para generar embeddings

# Agregar la carpeta parent al path para poder importar utils
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.supabase_client import get_supabase_client

# Crear el router con prefijo /fix-embeddings
router = APIRouter(prefix="/fix-embeddings", tags=["fix-embeddings"])

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

@router.post("/regenerate/{report_id}")
async def regenerate_embedding_for_report(report_id: str):
    """
    Regenera el embedding para un reporte específico que tiene foto pero no embedding.
    """
    try:
        sb = _sb()
        
        # Obtener el reporte
        result = sb.table("reports")\
            .select("id, photos, embedding")\
            .eq("id", report_id)\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(404, f"Reporte {report_id} no encontrado")
        
        report = result.data
        photos = report.get("photos", [])
        
        if not photos or len(photos) == 0:
            raise HTTPException(400, f"El reporte {report_id} no tiene fotos")
        
        first_photo = photos[0]
        
        print(f"🔄 Generando embedding para reporte {report_id}")
        print(f"   Foto: {first_photo}")
        
        # Descargar la imagen
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(first_photo)
            response.raise_for_status()
            image_bytes = response.content
        
        # Generar embedding
        vec = image_bytes_to_vec(image_bytes)
        vec_list = vec.tolist()
        
        print(f"   Dimensiones del embedding: {len(vec_list)}")
        
        # Guardar en Supabase
        update_result = sb.table('reports').update({
            'embedding': vec_list
        }).eq('id', report_id).execute()
        
        if update_result.data:
            print(f"✅ Embedding regenerado exitosamente para reporte {report_id}")
            return {
                "success": True,
                "report_id": report_id,
                "message": "Embedding regenerado exitosamente",
                "embedding_dimensions": len(vec_list)
            }
        else:
            raise HTTPException(500, "No se pudo guardar el embedding")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error regenerando embedding: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error regenerando embedding: {str(e)}")

@router.post("/regenerate-all")
async def regenerate_all_missing_embeddings():
    """
    Regenera embeddings para todos los reportes que tienen fotos pero no tienen embedding.
    """
    try:
        sb = _sb()
        
        # Obtener reportes sin embedding pero con fotos
        result = sb.table("reports")\
            .select("id, photos")\
            .is_("embedding", "null")\
            .execute()
        
        if not result.data:
            return {
                "success": True,
                "message": "No hay reportes sin embeddings",
                "processed": 0
            }
        
        reports = result.data
        reports_with_photos = [r for r in reports if r.get("photos") and len(r.get("photos", [])) > 0]
        
        if not reports_with_photos:
            return {
                "success": True,
                "message": "No hay reportes con fotos sin embeddings",
                "processed": 0
            }
        
        print(f"🔄 Regenerando embeddings para {len(reports_with_photos)} reportes...")
        
        success_count = 0
        errors: List[Dict] = []
        
        for report in reports_with_photos:
            report_id = report["id"]
            photos = report["photos"]
            first_photo = photos[0]
            
            try:
                # Descargar la imagen
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(first_photo)
                    response.raise_for_status()
                    image_bytes = response.content
                
                # Generar embedding
                vec = image_bytes_to_vec(image_bytes)
                vec_list = vec.tolist()
                
                # Guardar en Supabase
                sb.table('reports').update({
                    'embedding': vec_list
                }).eq('id', report_id).execute()
                
                success_count += 1
                print(f"   ✅ {success_count}/{len(reports_with_photos)}: {report_id}")
                
            except Exception as e:
                error_msg = str(e)
                errors.append({"report_id": report_id, "error": error_msg})
                print(f"   ❌ Error con {report_id}: {error_msg}")
        
        return {
            "success": True,
            "message": f"Procesados {success_count} reportes exitosamente",
            "total_processed": success_count,
            "total_errors": len(errors),
            "errors": errors[:10]  # Mostrar solo los primeros 10 errores
        }
        
    except Exception as e:
        print(f"❌ Error en regeneración masiva: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error en regeneración masiva: {str(e)}")

@router.get("/check-missing")
async def check_missing_embeddings():
    """
    Verifica cuántos reportes no tienen embeddings.
    """
    try:
        sb = _sb()
        
        # Total de reportes
        all_result = sb.table("reports")\
            .select("id", count="exact")\
            .execute()
        total_reports = all_result.count or 0
        
        # Reportes sin embedding
        no_embedding_result = sb.table("reports")\
            .select("id", count="exact")\
            .is_("embedding", "null")\
            .execute()
        no_embedding_count = no_embedding_result.count or 0
        
        # Reportes sin embedding pero con fotos
        with_photos_result = sb.table("reports")\
            .select("id, photos")\
            .is_("embedding", "null")\
            .execute()
        
        reports_with_photos = 0
        if with_photos_result.data:
            reports_with_photos = len([
                r for r in with_photos_result.data 
                if r.get("photos") and len(r.get("photos", [])) > 0
            ])
        
        return {
            "total_reports": total_reports,
            "reports_without_embedding": no_embedding_count,
            "reports_with_photos_without_embedding": reports_with_photos,
            "percentage_missing": round((no_embedding_count / total_reports * 100), 2) if total_reports > 0 else 0
        }
        
    except Exception as e:
        raise HTTPException(500, f"Error verificando embeddings: {str(e)}")

