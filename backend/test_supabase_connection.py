"""
Script de prueba para verificar la conexión a Supabase con la nueva configuración.
Ejecutar desde la carpeta backend: python test_supabase_connection.py
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=False)

print("=" * 70)
print("  TEST DE CONEXIÓN A SUPABASE CON CONFIGURACIÓN OPTIMIZADA")
print("=" * 70)
print()

# Verificar variables de entorno
print("📋 Verificando variables de entorno...")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL:
    print("❌ SUPABASE_URL no encontrada en .env")
    sys.exit(1)
    
if not SUPABASE_KEY:
    print("❌ SUPABASE_SERVICE_KEY no encontrada en .env")
    sys.exit(1)

print(f"✅ SUPABASE_URL: {SUPABASE_URL[:30]}...")
print(f"✅ SUPABASE_SERVICE_KEY: {SUPABASE_KEY[:20]}...")
print()

# Importar el nuevo cliente optimizado
print("📦 Importando cliente optimizado de Supabase...")
try:
    from utils.supabase_client import get_supabase_client, create_supabase_client
    print("✅ Módulo importado correctamente")
except Exception as e:
    print(f"❌ Error importando módulo: {e}")
    sys.exit(1)
print()

# Test 1: Crear cliente con configuración por defecto
print("=" * 70)
print("TEST 1: Cliente con configuración por defecto")
print("=" * 70)
print()

try:
    print("🔄 Creando cliente de Supabase...")
    client = get_supabase_client()
    print("✅ Cliente creado exitosamente")
    print()
    
    # Intentar una consulta simple
    print("🔄 Ejecutando query de prueba (select * from reports limit 1)...")
    result = client.table("reports").select("id").limit(1).execute()
    
    if result.data:
        print(f"✅ Query exitoso! Encontrados {len(result.data)} reportes")
        print(f"   Primer reporte ID: {result.data[0]['id']}")
    else:
        print("⚠️  Query exitoso pero no hay datos en la tabla")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print()

# Test 2: Cliente con timeout personalizado
print("=" * 70)
print("TEST 2: Cliente con timeout de 60 segundos")
print("=" * 70)
print()

try:
    print("🔄 Creando cliente con timeout=60s, max_retries=5...")
    client_custom = create_supabase_client(timeout=60.0, max_retries=5)
    print("✅ Cliente personalizado creado exitosamente")
    print()
    
    # Probar una consulta más compleja
    print("🔄 Ejecutando query más compleja...")
    result = client_custom.table("reports").select(
        "id, type, species, created_at"
    ).limit(5).execute()
    
    if result.data:
        print(f"✅ Query exitoso! Encontrados {len(result.data)} reportes")
        for report in result.data:
            print(f"   - ID: {report['id'][:20]}... | Tipo: {report['type']} | Especie: {report.get('species', 'N/A')}")
    else:
        print("⚠️  Query exitoso pero no hay datos")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print()

# Test 3: Verificar embeddings
print("=" * 70)
print("TEST 3: Verificar reportes con embeddings")
print("=" * 70)
print()

try:
    print("🔄 Consultando reportes con embeddings...")
    client = get_supabase_client()
    
    result = client.table("reports")\
        .select("id, type, species")\
        .not_.is_("embedding", "null")\
        .limit(5)\
        .execute()
    
    if result.data:
        print(f"✅ Encontrados {len(result.data)} reportes con embeddings:")
        for report in result.data:
            print(f"   - ID: {report['id'][:20]}... | Tipo: {report['type']} | Especie: {report.get('species', 'N/A')}")
    else:
        print("⚠️  No se encontraron reportes con embeddings")
        print("   Ejecuta: python regenerar_embeddings_ahora.py")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print()

# Test 4: Medir latencia
print("=" * 70)
print("TEST 4: Medir latencia de conexión")
print("=" * 70)
print()

try:
    import time
    
    print("🔄 Midiendo latencia de 5 consultas...")
    client = get_supabase_client()
    
    latencies = []
    for i in range(5):
        start = time.time()
        result = client.table("reports").select("id").limit(1).execute()
        end = time.time()
        latency = (end - start) * 1000  # ms
        latencies.append(latency)
        print(f"   Query {i+1}: {latency:.2f} ms")
    
    avg_latency = sum(latencies) / len(latencies)
    print()
    print(f"📊 Latencia promedio: {avg_latency:.2f} ms")
    
    if avg_latency < 100:
        print("✅ Excelente latencia!")
    elif avg_latency < 500:
        print("✅ Buena latencia")
    elif avg_latency < 1000:
        print("⚠️  Latencia aceptable pero mejorable")
    else:
        print("❌ Latencia alta - considera revisar tu conexión")
    
except Exception as e:
    print(f"❌ Error: {e}")

print()
print("=" * 70)
print("  TESTS COMPLETADOS")
print("=" * 70)
print()
print("📝 Si todos los tests pasaron, la conexión a Supabase está funcionando correctamente")
print("📝 Si hay errores, revisa backend/SOLUCION-TIMEOUT-SUPABASE.md")





