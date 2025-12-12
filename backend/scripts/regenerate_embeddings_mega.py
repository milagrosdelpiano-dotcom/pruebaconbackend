#!/usr/bin/env python3
"""
Script para regenerar TODOS los embeddings usando MegaDescriptor
Después de migrar de CLIP (512 dims) a MegaDescriptor (1536 dims)
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

async def regenerate_embedding(sb, report_id: str, photo_url: str, max_retries: int = 3) -> bool:
    """Regenera el embedding para un reporte usando MegaDescriptor"""
    
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                print(f"  🔄 Reintento {attempt + 1}/{max_retries}...")
            else:
                print(f"  🔄 Regenerando embedding con MegaDescriptor...")
            
            # Descargar la imagen con timeout más largo
            timeout = httpx.Timeout(60.0, connect=10.0)  # 60s total, 10s para conectar
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(photo_url)
                response.raise_for_status()
                image_bytes = response.content
            
            print(f"  📥 Imagen descargada ({len(image_bytes)} bytes)")
            
            # Generar embedding con MegaDescriptor (1536 dims)
            vec = image_bytes_to_vec(image_bytes)
            vec_list = vec.tolist()
            
            print(f"  📊 Embedding generado: {len(vec_list)} dimensiones")
            
            # Guardar en Supabase directamente (pgvector acepta arrays de Python)
            result = sb.table('reports').update({
                'embedding': vec_list
            }).eq('id', report_id).execute()
            
            if result.data:
                print(f"  ✅ Embedding de {len(vec_list)} dims guardado exitosamente")
                return True
            else:
                print(f"  ⚠️ No se pudo guardar embedding")
                return False
                
        except httpx.TimeoutException as e:
            print(f"  ⏱️ Timeout al descargar imagen (intento {attempt + 1}/{max_retries})")
            if attempt == max_retries - 1:
                print(f"  ❌ Error después de {max_retries} intentos: Timeout")
                return False
            await asyncio.sleep(2)  # Esperar antes de reintentar
            
        except httpx.HTTPError as e:
            print(f"  ❌ Error HTTP: {str(e)}")
            return False
            
        except Exception as e:
            print(f"  ❌ Error inesperado: {str(e)}")
            if attempt == max_retries - 1:
                import traceback
                traceback.print_exc()
            return False
    
    return False

async def main():
    # Configurar encoding para Windows
    import sys
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    
    print("=" * 70)
    print("REGENERACION DE EMBEDDINGS CON MEGADESCRIPTOR")
    print("=" * 70)
    print("ADVERTENCIA: Este script regenerara TODOS los embeddings existentes")
    print("             usando MegaDescriptor (1536 dimensiones)")
    print("=" * 70)
    
    try:
        sb = get_supabase()
    except Exception as e:
        print(f"❌ Error conectando con Supabase: {e}")
        sys.exit(1)
    
    # Obtener TODOS los reportes con fotos (tengan o no embedding)
    print("\n📥 Obteniendo reportes con fotos...")
    try:
        result = sb.table("reports")\
            .select("id, photos")\
            .not_.is_("photos", "null")\
            .execute()
        reports = result.data
        
        if not reports:
            print("⚠️ No hay reportes con fotos")
            return
        
        print(f"📋 Encontrados {len(reports)} reportes con fotos")
        
        # Confirmar antes de continuar
        print("\n⚠️  ADVERTENCIA: Esto regenerará embeddings para TODOS los reportes")
        print("   Esto puede tardar mucho tiempo dependiendo de la cantidad.")
        respuesta = input("\n¿Continuar? (s/n): ").strip().lower()
        
        if respuesta not in ['s', 'si', 'sí', 'y', 'yes']:
            print("❌ Operación cancelada")
            return
        
        success_count = 0
        failed_count = 0
        skipped_count = 0
        
        for idx, report in enumerate(reports, 1):
            report_id = report["id"]
            photos = report.get("photos", [])
            
            if not photos or len(photos) == 0:
                print(f"\n[{idx}/{len(reports)}] ⚠️ Reporte {report_id} no tiene fotos, saltando...")
                skipped_count += 1
                continue
            
            first_photo = photos[0]
            print(f"\n[{idx}/{len(reports)}] 📸 Procesando reporte {report_id}...")
            print(f"    URL: {first_photo[:80]}...")
            
            success = await regenerate_embedding(sb, report_id, first_photo)
            
            if success:
                success_count += 1
            else:
                failed_count += 1
            
            # Pausa pequeña para no sobrecargar el servidor
            await asyncio.sleep(0.5)
        
        print("\n" + "=" * 70)
        print("✅ REGENERACIÓN COMPLETADA")
        print("=" * 70)
        print(f"   ✅ Exitosos: {success_count}")
        print(f"   ❌ Fallidos: {failed_count}")
        print(f"   ⏭️  Omitidos: {skipped_count}")
        print(f"   📊 Total procesados: {len(reports)}")
        print("=" * 70)
        
        if failed_count > 0:
            print("\n⚠️  Algunos embeddings fallaron. Revisa los errores arriba.")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Operación interrumpida por el usuario")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

