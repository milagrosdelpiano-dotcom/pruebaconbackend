"""
Router para Búsqueda Directa de Coincidencias usando Embeddings
================================================================

Este router permite buscar coincidencias directamente usando los embeddings
ya almacenados en Supabase, sin necesidad de generar nuevos embeddings.

A diferencia de /ai-search que genera embeddings de una imagen nueva,
este router usa embeddings pre-existentes para buscar matches más rápido.

Funcionalidades:
- Buscar matches para un reporte usando su embedding existente
- Búsqueda vectorial usando distancia coseno
- Filtrado por tipo (lost/found) y especie
- Configuración de umbral de similitud y número de resultados
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import os
from supabase import Client
import numpy as np  # Para operaciones con vectores
import sys
from pathlib import Path

# Agregar la carpeta parent al path para poder importar utils
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.supabase_client import get_supabase_client

# Crear el router con prefijo /direct-matches
router = APIRouter(prefix="/direct-matches", tags=["direct-matches"])

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

@router.post("/find/{report_id}")
async def find_matches_for_report(
    report_id: str,  # ID del reporte para buscar matches
    match_threshold: float = Query(0.1, ge=0.0, le=1.0, description="Umbral mínimo de similitud (0.0-1.0)"),
    top_k: int = Query(10, ge=1, le=50, description="Número máximo de resultados a retornar")
):
    """
    Busca coincidencias para un reporte específico usando su embedding existente.
    
    Este endpoint es más rápido que /ai-search porque usa embeddings ya generados
    en lugar de generar uno nuevo desde una imagen.
    
    El proceso es:
    1. Obtiene el embedding del reporte base
    2. Busca reportes del tipo opuesto (lost/found) con embeddings
    3. Calcula similitud usando distancia coseno
    4. Filtra por umbral de similitud y especie
    5. Retorna los mejores matches ordenados por similitud
    
    Args:
        report_id: ID del reporte para buscar matches
        match_threshold: Umbral mínimo de similitud (0.0 = cualquier similitud, 1.0 = idéntico)
        top_k: Número máximo de matches a retornar
        
    Returns:
        JSON con:
        - report_id: ID del reporte base
        - matches: Lista de matches encontrados ordenados por similitud
        - total_candidates: Número total de candidatos evaluados
        - message: Mensaje informativo
    """
    try:
        sb = _sb()
        
        # =========================
        # Obtener reporte base
        # =========================
        # Obtener el reporte base con su embedding y datos relevantes
        base_result = sb.table("reports")\
            .select("id, embedding, type, species, photos, pet_name, description, color")\
            .eq("id", report_id)\
            .single()\
            .execute()
        
        # Verificar que el reporte existe
        if not base_result.data:
            raise HTTPException(404, f"Reporte {report_id} no encontrado")
        
        base_report = base_result.data
        base_embedding = base_report.get("embedding")
        
        # Verificar que el reporte tiene embedding
        if not base_embedding:
            raise HTTPException(400, f"El reporte {report_id} no tiene embedding generado")
        
        # =========================
        # Parsear embedding
        # =========================
        # Postgrest devuelve vectores como strings JSON, necesitamos parsearlos
        # Esto es necesario porque pgvector almacena los vectores como JSON en Supabase
        if isinstance(base_embedding, str):
            import json
            try:
                base_embedding = json.loads(base_embedding)
            except:
                raise HTTPException(400, f"El reporte {report_id} tiene un embedding inválido")
        
        # Extraer datos del reporte base
        base_type = base_report.get("type")  # "lost" o "found"
        base_species = base_report.get("species")  # "dog", "cat", etc.
        
        # Determinar el tipo opuesto para buscar
        # Si el reporte base es "lost", buscar "found" y viceversa
        target_type = "found" if base_type == "lost" else "lost"
        
        # Log para debugging
        print(f"🔍 [direct-match] Buscando coincidencias para reporte {report_id}")
        print(f"   Tipo base: {base_type}, buscando: {target_type}")
        print(f"   Especie: {base_species}")
        print(f"   Dimensiones embedding: {len(base_embedding)}")
        
        # =========================
        # Buscar candidatos
        # =========================
        # Obtener todos los reportes del tipo opuesto que tengan embeddings
        candidates_result = sb.table("reports")\
            .select("id, embedding, species, type, photos, pet_name, description, color, created_at")\
            .eq("type", target_type)\
            .eq("status", "active")\
            .not_.is_("embedding", "null")\
            .execute()
        
        # Si no hay candidatos, retornar respuesta vacía
        if not candidates_result.data:
            return {
                "report_id": report_id,
                "matches": [],
                "total_candidates": 0,
                "message": f"No hay reportes de tipo '{target_type}' con embeddings"
            }
        
        candidates = candidates_result.data
        print(f"   Candidatos encontrados: {len(candidates)}")
        
        # =========================
        # Filtrar por especie
        # =========================
        # Filtrar candidatos por especie si el reporte base tiene especie
        # Esto mejora la precisión de los matches
        if base_species:
            candidates = [c for c in candidates if c.get("species") == base_species]
            print(f"   Candidatos después de filtrar por especie: {len(candidates)}")
        
        # =========================
        # Calcular similitudes
        # =========================
        # Convertir embedding base a numpy array para cálculos vectoriales
        base_vec = np.array(base_embedding, dtype=np.float32)
        base_norm = np.linalg.norm(base_vec)  # Norma del vector (para normalización)
        
        # Calcular similitud con cada candidato
        matches = []
        for candidate in candidates:
            # Evitar comparar consigo mismo
            if candidate["id"] == report_id:
                continue
            
            candidate_embedding = candidate.get("embedding")
            if not candidate_embedding:
                continue
            
            # Parsear si es string JSON
            if isinstance(candidate_embedding, str):
                import json
                try:
                    candidate_embedding = json.loads(candidate_embedding)
                except:
                    continue
            
            try:
                # Convertir embedding del candidato a numpy
                candidate_vec = np.array(candidate_embedding, dtype=np.float32)
                
                # Verificar que las dimensiones coincidan
                if len(candidate_vec) != len(base_vec):
                    print(f"   ⚠️ Dimensiones no coinciden: {len(candidate_vec)} vs {len(base_vec)}")
                    continue
                
                # Calcular similitud coseno
                candidate_norm = np.linalg.norm(candidate_vec)
                similarity = float(np.dot(base_vec, candidate_vec) / (base_norm * candidate_norm))
                
                # Filtrar por umbral
                if similarity >= match_threshold:
                    matches.append({
                        "report_id": candidate["id"],
                        "similarity_score": round(similarity, 4),
                        "pet_name": candidate.get("pet_name"),
                        "species": candidate.get("species"),
                        "color": candidate.get("color"),
                        "type": candidate.get("type"),
                        "photo": (candidate.get("photos") or [None])[0] if isinstance(candidate.get("photos"), list) else None,
                        "description": candidate.get("description"),
                        "created_at": candidate.get("created_at")
                    })
            except Exception as e:
                print(f"   ⚠️ Error calculando similitud con {candidate['id']}: {str(e)}")
                continue
        
        # Ordenar por similitud descendente
        matches.sort(key=lambda x: x["similarity_score"], reverse=True)
        
        # Limitar resultados
        top_matches = matches[:top_k]
        
        print(f"   ✅ Encontradas {len(top_matches)} coincidencias (de {len(matches)} sobre umbral)")
        
        # Guardar matches en la tabla matches
        if top_matches:
            await _save_matches_to_db(sb, report_id, base_type, top_matches)
        
        return {
            "report_id": report_id,
            "matches": top_matches,
            "total_candidates": len(candidates),
            "total_above_threshold": len(matches),
            "returned": len(top_matches),
            "search_params": {
                "match_threshold": match_threshold,
                "top_k": top_k,
                "base_type": base_type,
                "target_type": target_type,
                "species_filter": base_species
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [direct-match] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error buscando coincidencias: {str(e)}")

async def _save_matches_to_db(sb: Client, report_id: str, report_type: str, matches: List[Dict[str, Any]]):
    """Guarda los matches en la tabla matches"""
    try:
        saved_count = 0
        for match in matches:
            match_report_id = match["report_id"]
            similarity_score = match["similarity_score"]
            
            # Determinar qué es lost y qué es found
            if report_type == "lost":
                lost_report_id = report_id
                found_report_id = match_report_id
            else:
                lost_report_id = match_report_id
                found_report_id = report_id
            
            # Verificar si ya existe este match
            existing = sb.table("matches")\
                .select("id, similarity_score")\
                .eq("lost_report_id", lost_report_id)\
                .eq("found_report_id", found_report_id)\
                .execute()
            
            if existing.data:
                # Actualizar si la similitud es mayor
                existing_match = existing.data[0]
                if similarity_score > existing_match.get("similarity_score", 0):
                    sb.table("matches").update({
                        "similarity_score": similarity_score,
                        "matched_by": "ai_visual",
                        "status": "pending"
                    }).eq("id", existing_match["id"]).execute()
                    saved_count += 1
            else:
                # Crear nuevo match
                sb.table("matches").insert({
                    "lost_report_id": lost_report_id,
                    "found_report_id": found_report_id,
                    "similarity_score": similarity_score,
                    "matched_by": "ai_visual",
                    "status": "pending"
                }).execute()
                saved_count += 1
        
        print(f"   💾 Guardados {saved_count} matches en la base de datos")
    except Exception as e:
        print(f"   ⚠️ Error guardando matches: {str(e)}")
        # No lanzar excepción, solo loguear

