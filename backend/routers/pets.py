"""
Router de Mascotas
==================

Este router maneja todas las operaciones relacionadas con las mascotas de los usuarios.
Permite gestionar el perfil de las mascotas, incluyendo información de salud,
vacunaciones, medicamentos, recordatorios y eventos de salud.

Funcionalidades principales:
- CRUD de mascotas (crear, leer, actualizar, eliminar)
- Gestión de salud (vacunaciones, medicamentos, recordatorios)
- Eventos de salud (wellness, health events)
- Resumen de salud de la mascota
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Dict, Any, Optional
from datetime import date, datetime
import sys
from pathlib import Path

# Agregar la carpeta parent al path para poder importar utils
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.supabase_client import get_supabase_client

# Crear el router con prefijo /pets
router = APIRouter(prefix="/pets", tags=["pets"])

def _sb():
    """
    Crea un cliente de Supabase con configuración optimizada.
    
    Returns:
        Client: Cliente de Supabase configurado
        
    Raises:
        HTTPException: Si no se puede conectar a Supabase
    """
    try:
        return get_supabase_client()
    except Exception as e:
        raise HTTPException(500, f"Error conectando a Supabase: {str(e)}")

# ==============================================
# ENDPOINTS BÁSICOS DE MASCOTAS
# ==============================================

@router.get("/")
async def get_user_pets(owner_id: str = Query(..., description="ID del dueño")):
    """
    Obtiene todas las mascotas de un usuario.
    
    Args:
        owner_id: ID del usuario dueño de las mascotas
        
    Returns:
        JSON con:
        - pets: Lista de mascotas del usuario
        - count: Número total de mascotas
        
    Las mascotas se ordenan por fecha de creación (más recientes primero).
    """
    try:
        sb = _sb()
        # Consultar todas las mascotas del usuario
        result = sb.table("pets")\
            .select("*")\
            .eq("owner_id", owner_id)\
            .order("created_at", desc=True)\
            .execute()
        return {"pets": result.data, "count": len(result.data)}
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo mascotas: {str(e)}")

@router.get("/{pet_id}")
async def get_pet_by_id(pet_id: str):
    """Obtiene una mascota por ID con su resumen de salud"""
    try:
        sb = _sb()
        
        # Obtener la mascota
        pet_result = sb.table("pets").select("*").eq("id", pet_id).execute()
        if not pet_result.data:
            raise HTTPException(404, "Mascota no encontrada")
        
        pet = pet_result.data[0]
        
        # Obtener resumen de salud usando la función SQL
        try:
            health_summary = sb.rpc("obtener_resumen_salud_mascota", {"pet_id": pet_id}).execute()
            pet["health_summary"] = health_summary.data[0] if health_summary.data else {}
        except:
            pet["health_summary"] = {}
        
        return {"pet": pet}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo mascota: {str(e)}")

@router.post("/")
async def create_pet(pet_data: Dict[str, Any] = Body(...)):
    """Crea una nueva mascota"""
    try:
        sb = _sb()
        
        required_fields = ["owner_id", "name", "species"]
        for field in required_fields:
            if field not in pet_data:
                raise HTTPException(400, f"Campo requerido faltante: {field}")
        
        result = sb.table("pets").insert(pet_data).execute()
        
        if not result.data:
            raise HTTPException(500, "Error creando mascota")
        
        return {"pet": result.data[0], "message": "Mascota creada exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error creando mascota: {str(e)}")

@router.put("/{pet_id}")
async def update_pet(pet_id: str, updates: Dict[str, Any] = Body(...)):
    """Actualiza una mascota existente"""
    try:
        sb = _sb()
        result = sb.table("pets").update(updates).eq("id", pet_id).execute()
        
        if not result.data:
            raise HTTPException(404, "Mascota no encontrada")
        
        return {"pet": result.data[0], "message": "Mascota actualizada exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error actualizando mascota: {str(e)}")

@router.delete("/{pet_id}")
async def delete_pet(pet_id: str):
    """Elimina una mascota (y todos sus datos relacionados por CASCADE)"""
    try:
        sb = _sb()
        result = sb.table("pets").delete().eq("id", pet_id).execute()
        return {"message": "Mascota eliminada exitosamente"}
    except Exception as e:
        raise HTTPException(500, f"Error eliminando mascota: {str(e)}")

# ==============================================
# ENDPOINTS DE HISTORIAL DE SALUD
# ==============================================

@router.get("/{pet_id}/health-history")
async def get_health_history(
    pet_id: str,
    limit: int = Query(50, description="Límite de resultados"),
    offset: int = Query(0, description="Offset para paginación")
):
    """Obtiene el historial de salud de una mascota"""
    try:
        sb = _sb()
        result = sb.table("historial_salud")\
            .select("*")\
            .eq("id_mascota", pet_id)\
            .order("fecha", desc=True)\
            .limit(limit)\
            .offset(offset)\
            .execute()
        return {"history": result.data, "count": len(result.data)}
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo historial: {str(e)}")

@router.post("/{pet_id}/health-history")
async def add_health_event(
    pet_id: str,
    event_data: Dict[str, Any] = Body(...)
):
    """Agrega un evento al historial de salud"""
    try:
        sb = _sb()
        event_data["id_mascota"] = pet_id
        
        required_fields = ["tipo_evento", "descripcion"]
        for field in required_fields:
            if field not in event_data:
                raise HTTPException(400, f"Campo requerido faltante: {field}")
        
        result = sb.table("historial_salud").insert(event_data).execute()
        
        if not result.data:
            raise HTTPException(500, "Error creando evento de salud")
        
        return {"event": result.data[0], "message": "Evento agregado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error agregando evento: {str(e)}")

# ==============================================
# ENDPOINTS DE VACUNACIONES Y TRATAMIENTOS
# ==============================================

@router.get("/{pet_id}/vaccinations")
async def get_vaccinations(pet_id: str):
    """Obtiene todas las vacunaciones y tratamientos de una mascota"""
    try:
        sb = _sb()
        result = sb.table("vacunacion_tratamiento")\
            .select("*")\
            .eq("id_mascota", pet_id)\
            .order("fecha_inicio", desc=True)\
            .execute()
        return {"vaccinations": result.data, "count": len(result.data)}
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo vacunaciones: {str(e)}")

@router.post("/{pet_id}/vaccinations")
async def add_vaccination(
    pet_id: str,
    vaccination_data: Dict[str, Any] = Body(...)
):
    """Agrega una vacunación o tratamiento"""
    try:
        sb = _sb()
        vaccination_data["id_mascota"] = pet_id
        
        required_fields = ["tipo", "nombre", "fecha_inicio"]
        for field in required_fields:
            if field not in vaccination_data:
                raise HTTPException(400, f"Campo requerido faltante: {field}")
        
        result = sb.table("vacunacion_tratamiento").insert(vaccination_data).execute()
        
        if not result.data:
            raise HTTPException(500, "Error creando vacunación")
        
        return {"vaccination": result.data[0], "message": "Vacunación agregada exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error agregando vacunación: {str(e)}")

@router.put("/vaccinations/{vaccination_id}")
async def update_vaccination(
    vaccination_id: str,
    updates: Dict[str, Any] = Body(...)
):
    """Actualiza una vacunación existente"""
    try:
        sb = _sb()
        result = sb.table("vacunacion_tratamiento")\
            .update(updates)\
            .eq("id", vaccination_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(404, "Vacunación no encontrada")
        
        return {"vaccination": result.data[0], "message": "Vacunación actualizada exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error actualizando vacunación: {str(e)}")

# ==============================================
# ENDPOINTS DE MEDICAMENTOS
# ==============================================

@router.get("/{pet_id}/medications")
async def get_medications(pet_id: str, active_only: bool = Query(False)):
    """Obtiene los medicamentos de una mascota"""
    try:
        sb = _sb()
        query = sb.table("medicamentos_activos")\
            .select("*")\
            .eq("id_mascota", pet_id)
        
        if active_only:
            query = query.eq("activo", True)
        
        result = query.order("fecha_inicio", desc=True).execute()
        return {"medications": result.data, "count": len(result.data)}
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo medicamentos: {str(e)}")

@router.post("/{pet_id}/medications")
async def add_medication(
    pet_id: str,
    medication_data: Dict[str, Any] = Body(...)
):
    """Agrega un medicamento activo"""
    try:
        sb = _sb()
        medication_data["id_mascota"] = pet_id
        
        required_fields = ["nombre", "dosis", "frecuencia", "fecha_inicio"]
        for field in required_fields:
            if field not in medication_data:
                raise HTTPException(400, f"Campo requerido faltante: {field}")
        
        result = sb.table("medicamentos_activos").insert(medication_data).execute()
        
        if not result.data:
            raise HTTPException(500, "Error creando medicamento")
        
        return {"medication": result.data[0], "message": "Medicamento agregado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error agregando medicamento: {str(e)}")

@router.put("/medications/{medication_id}")
async def update_medication(
    medication_id: str,
    updates: Dict[str, Any] = Body(...)
):
    """Actualiza un medicamento (puede desactivarlo)"""
    try:
        sb = _sb()
        result = sb.table("medicamentos_activos")\
            .update(updates)\
            .eq("id", medication_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(404, "Medicamento no encontrado")
        
        return {"medication": result.data[0], "message": "Medicamento actualizado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error actualizando medicamento: {str(e)}")

# ==============================================
# ENDPOINTS DE INDICADORES DE BIENESTAR
# ==============================================

@router.get("/{pet_id}/wellness")
async def get_wellness_indicators(
    pet_id: str,
    limit: int = Query(30, description="Límite de resultados (últimos N registros)")
):
    """Obtiene los indicadores de bienestar de una mascota"""
    try:
        sb = _sb()
        result = sb.table("indicador_bienestar")\
            .select("*")\
            .eq("id_mascota", pet_id)\
            .order("fecha", desc=True)\
            .limit(limit)\
            .execute()
        return {"indicators": result.data, "count": len(result.data)}
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo indicadores: {str(e)}")

@router.post("/{pet_id}/wellness")
async def add_wellness_indicator(
    pet_id: str,
    indicator_data: Dict[str, Any] = Body(...)
):
    """Agrega un indicador de bienestar (peso, actividad, etc.)"""
    try:
        sb = _sb()
        indicator_data["id_mascota"] = pet_id
        
        result = sb.table("indicador_bienestar").insert(indicator_data).execute()
        
        if not result.data:
            raise HTTPException(500, "Error creando indicador")
        
        return {"indicator": result.data[0], "message": "Indicador agregado exitosamente"}
    except Exception as e:
        raise HTTPException(500, f"Error agregando indicador: {str(e)}")

# ==============================================
# ENDPOINTS DE RECORDATORIOS
# ==============================================

@router.get("/{pet_id}/reminders")
async def get_reminders(
    pet_id: str,
    active_only: bool = Query(True),
    upcoming_only: bool = Query(False)
):
    """Obtiene los recordatorios de una mascota"""
    try:
        sb = _sb()
        query = sb.table("recordatorio")\
            .select("*")\
            .eq("id_mascota", pet_id)
        
        if active_only:
            query = query.eq("activo", True)
        
        if upcoming_only:
            query = query.gte("fecha_programada", date.today().isoformat())
        
        result = query.order("fecha_programada", desc=False).execute()
        return {"reminders": result.data, "count": len(result.data)}
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo recordatorios: {str(e)}")

@router.post("/{pet_id}/reminders")
async def create_reminder(
    pet_id: str,
    reminder_data: Dict[str, Any] = Body(...)
):
    """Crea un nuevo recordatorio"""
    try:
        sb = _sb()
        reminder_data["id_mascota"] = pet_id
        
        required_fields = ["tipo", "titulo", "fecha_programada"]
        for field in required_fields:
            if field not in reminder_data:
                raise HTTPException(400, f"Campo requerido faltante: {field}")
        
        result = sb.table("recordatorio").insert(reminder_data).execute()
        
        if not result.data:
            raise HTTPException(500, "Error creando recordatorio")
        
        return {"reminder": result.data[0], "message": "Recordatorio creado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error creando recordatorio: {str(e)}")

@router.put("/reminders/{reminder_id}/complete")
async def complete_reminder(reminder_id: str):
    """Marca un recordatorio como cumplido"""
    try:
        sb = _sb()
        result = sb.table("recordatorio")\
            .update({
                "cumplido": True,
                "fecha_cumplido": datetime.now().isoformat()
            })\
            .eq("id", reminder_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(404, "Recordatorio no encontrado")
        
        return {"reminder": result.data[0], "message": "Recordatorio marcado como cumplido"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error actualizando recordatorio: {str(e)}")

# ==============================================
# ENDPOINTS DE DOCUMENTOS MÉDICOS
# ==============================================

@router.get("/{pet_id}/documents")
async def get_medical_documents(pet_id: str):
    """Obtiene todos los documentos médicos de una mascota"""
    try:
        sb = _sb()
        result = sb.table("documento_medico")\
            .select("*")\
            .eq("id_mascota", pet_id)\
            .order("fecha_documento", desc=True)\
            .execute()
        return {"documents": result.data, "count": len(result.data)}
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo documentos: {str(e)}")

@router.post("/{pet_id}/documents")
async def add_medical_document(
    pet_id: str,
    document_data: Dict[str, Any] = Body(...)
):
    """Agrega un documento médico"""
    try:
        sb = _sb()
        document_data["id_mascota"] = pet_id
        
        required_fields = ["tipo_documento", "nombre", "archivo_url"]
        for field in required_fields:
            if field not in document_data:
                raise HTTPException(400, f"Campo requerido faltante: {field}")
        
        result = sb.table("documento_medico").insert(document_data).execute()
        
        if not result.data:
            raise HTTPException(500, "Error creando documento")
        
        return {"document": result.data[0], "message": "Documento agregado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error agregando documento: {str(e)}")

# ==============================================
# ENDPOINTS DE PLANES DE CUIDADO
# ==============================================

@router.get("/{pet_id}/care-plans")
async def get_care_plans(pet_id: str, active_only: bool = Query(False)):
    """Obtiene los planes de cuidado de una mascota"""
    try:
        sb = _sb()
        query = sb.table("plan_cuidado")\
            .select("*, checklist_cuidado(*)")\
            .eq("id_mascota", pet_id)
        
        if active_only:
            query = query.eq("activo", True)
        
        result = query.order("fecha_inicio", desc=True).execute()
        return {"care_plans": result.data, "count": len(result.data)}
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo planes de cuidado: {str(e)}")

@router.post("/{pet_id}/care-plans")
async def create_care_plan(
    pet_id: str,
    plan_data: Dict[str, Any] = Body(...)
):
    """Crea un nuevo plan de cuidado"""
    try:
        sb = _sb()
        plan_data["id_mascota"] = pet_id
        
        required_fields = ["nombre", "fecha_inicio"]
        for field in required_fields:
            if field not in plan_data:
                raise HTTPException(400, f"Campo requerido faltante: {field}")
        
        # Extraer checklist si existe
        checklist_items = plan_data.pop("checklist", [])
        
        result = sb.table("plan_cuidado").insert(plan_data).execute()
        
        if not result.data:
            raise HTTPException(500, "Error creando plan de cuidado")
        
        plan_id = result.data[0]["id"]
        
        # Agregar items del checklist si existen
        if checklist_items:
            checklist_data = [
                {**item, "id_plan": plan_id} for item in checklist_items
            ]
            sb.table("checklist_cuidado").insert(checklist_data).execute()
        
        return {"care_plan": result.data[0], "message": "Plan de cuidado creado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error creando plan de cuidado: {str(e)}")

@router.put("/care-plans/{plan_id}/checklist/{item_id}")
async def update_checklist_item(
    plan_id: str,
    item_id: str,
    updates: Dict[str, Any] = Body(...)
):
    """Actualiza un item del checklist (marcar como completado, etc.)"""
    try:
        sb = _sb()
        result = sb.table("checklist_cuidado")\
            .update(updates)\
            .eq("id", item_id)\
            .eq("id_plan", plan_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(404, "Item del checklist no encontrado")
        
        return {"item": result.data[0], "message": "Item actualizado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error actualizando item: {str(e)}")


