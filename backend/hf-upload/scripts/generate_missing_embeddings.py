#!/usr/bin/env python3
"""
Script para generar embeddings para todos los reportes que no los tienen
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import asyncio
import httpx

# Cargar variables de entorno
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=False)

from supabase import create_client
import sys
from pathlib import Path

# Agregar el directorio backend al path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from services.embeddings import image_bytes_to_vec

def get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL o SUPABASE_SERVICE_KEY no configuradas")
    return create_client(url, key)

async def generate_and_save_embedding(sb, report_id: str, photo_url: str) -> bool:
    """Genera y guarda el embedding para un reporte"""
    try:
        print(f"  🔄 Generando embedding para reporte {report_id}...")
        
        # Descargar la imagen
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(photo_url)
            response.raise_for_status()
            image_bytes = response.content
        
        # Generar embedding
        vec = image_bytes_to_vec(image_bytes)
        vec_list = vec.tolist()
        
        # Guardar en Supabase usando RPC
        result = sb.rpc('update_report_embedding', {
            'report_id': report_id,
            'embedding_vector': vec_list
        }).execute()
        
        if result.data:
            print(f"  ✅ Embedding guardado exitosamente")
            return True
        else:
            print(f"  ⚠️ No se pudo guardar embedding")
            return False
            
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return False

async def main():
    print("=" * 60)
    print("🔄 GENERANDO EMBEDDINGS PARA REPORTES SIN EMBEDDING")
    print("=" * 60)
    
    try:
        sb = get_supabase()
    except Exception as e:
        print(f"❌ Error conectando con Supabase: {e}")
        sys.exit(1)
    
    # Obtener reportes sin embedding pero con fotos
    print("\n📥 Obteniendo reportes sin embedding...")
    try:
        result = sb.table("reports").select("id, photos").is_("embedding", "null").not_.is_("photos", "null").execute()
        reports = result.data
        
        if not reports:
            print("✅ No hay reportes sin embedding")
            return
        
        print(f"📋 Encontrados {len(reports)} reportes sin embedding")
        
        success_count = 0
        failed_count = 0
        
        for idx, report in enumerate(reports, 1):
            report_id = report["id"]
            photos = report.get("photos", [])
            
            if not photos or len(photos) == 0:
                print(f"\n[{idx}/{len(reports)}] ⚠️ Reporte {report_id} no tiene fotos, saltando...")
                continue
            
            first_photo = photos[0]
            print(f"\n[{idx}/{len(reports)}] 📸 Procesando reporte {report_id}...")
            
            success = await generate_and_save_embedding(sb, report_id, first_photo)
            
            if success:
                success_count += 1
            else:
                failed_count += 1
            
            # Pausa pequeña para no sobrecargar
            await asyncio.sleep(0.5)
        
        print("\n" + "=" * 60)
        print(f"✅ COMPLETADO")
        print(f"   Exitosos: {success_count}")
        print(f"   Fallidos: {failed_count}")
        print(f"   Total: {len(reports)}")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
