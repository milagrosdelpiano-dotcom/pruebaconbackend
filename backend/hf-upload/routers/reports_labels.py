"""
Router de Etiquetas de Reportes
================================

Este router maneja la gestión de etiquetas (labels) de los reportes.
Las etiquetas son metadatos adicionales que se pueden asociar a un reporte
para mejorar la búsqueda y categorización.

Funcionalidades:
- Guardar etiquetas para un reporte
- Actualizar etiquetas existentes

Las etiquetas se almacenan como JSON en la columna 'labels' de la tabla 'reports'.
"""

from fastapi import APIRouter, HTTPException, Path, Body
from typing import Any, Dict
import os, sys
from pathlib import Path as PathLib
from supabase import Client

# Agregar la carpeta parent al path para poder importar utils
sys.path.insert(0, str(PathLib(__file__).parent.parent))
from utils.supabase_client import get_supabase_client

# Crear el router con prefijo /reports (comparte el mismo prefijo que reports.py)
router = APIRouter(prefix="/reports", tags=["reports"])

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

@router.post("/{report_id}/labels")
def save_labels(report_id: str = Path(...), payload: Dict[str, Any] = Body(...)):
    if "labels" not in payload or not isinstance(payload["labels"], list):
        raise HTTPException(400, "Se espera {'labels': [...]}")

    sb = _sb()
    res = sb.table("reports").update({"labels": payload}).eq("id", report_id).execute()
    if not res.data:
        raise HTTPException(404, "Reporte no encontrado")
    return {"ok": True, "updated": res.data[0]["id"]}