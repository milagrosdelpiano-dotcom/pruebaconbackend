"""
Archivo principal del backend de PetAlert
==========================================
Este archivo configura y arranca el servidor FastAPI que maneja todas las peticiones
del frontend móvil. Incluye:
- Configuración de variables de entorno
- Conexión a Supabase (base de datos)
- Configuración de CORS para permitir peticiones del frontend
- Pre-carga del modelo MegaDescriptor para generar embeddings
- Registro de todos los routers (endpoints de la API)
"""

from pathlib import Path  # Para trabajar con rutas de archivos de forma multiplataforma
from dotenv import load_dotenv  # Para cargar variables de entorno desde archivo .env
import os, sys  # os para variables de entorno, sys para manipular el path de Python

# =========================
# Carga de Variables de Entorno
# =========================
# Carga las variables de entorno desde el archivo .env en la carpeta backend
# Esto permite configurar credenciales (Supabase, API keys, etc.) sin hardcodearlas en el código
# El archivo .env debe estar en backend/.env y contener variables como:
# SUPABASE_URL=https://xxxxx.supabase.co
# SUPABASE_SERVICE_KEY=xxxxx
# GENERATE_EMBEDDINGS_LOCALLY=true
ENV_PATH = Path(__file__).resolve().parent / ".env"  # Ruta al archivo .env
load_dotenv(dotenv_path=ENV_PATH, override=False)  # Cargar sin sobrescribir variables ya existentes

# Log mínimo para confirmar que las variables críticas están cargadas
# Si no están, el servidor puede funcionar pero con capacidades limitadas
if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_KEY"):
    print("WARNING: No se encontraron variables de Supabase en .env")
    print("         El servidor funcionará pero no podrá conectarse a la base de datos")
else:
    print("OK: Variables de Supabase cargadas desde", ENV_PATH)

# =========================
# Imports de FastAPI y dependencias
# =========================
from fastapi import FastAPI, File, UploadFile, HTTPException  # FastAPI framework
from fastapi.middleware.cors import CORSMiddleware  # Middleware para CORS (permitir peticiones del frontend)
from supabase import Client  # Cliente de Supabase para interactuar con la base de datos
import traceback, asyncio  # traceback para debugging, asyncio para operaciones asíncronas
from typing import List, Dict, Any  # Type hints para mejor documentación del código

# =========================
# Configuración del Path de Python
# =========================
# Agregar la carpeta backend al path de Python para poder importar módulos locales
# Esto permite usar imports como "from utils.supabase_client import ..."
sys.path.insert(0, str(Path(__file__).parent))

# =========================
# Imports de Utilidades
# =========================
# Importar función helper para crear cliente de Supabase con configuración optimizada
from utils.supabase_client import get_supabase_client

# =========================
# Imports de Routers (Endpoints de la API)
# =========================
# Cada router agrupa endpoints relacionados con una funcionalidad específica
# Los routers se registran más abajo con app.include_router()
from routers import reports as reports_router  # CRUD de reportes de mascotas perdidas/encontradas
from routers import reports_labels as reports_labels_router  # Gestión de etiquetas de reportes
from routers import matches as matches_router  # Coincidencias entre reportes (matches)
from routers import ai_search as ai_search_router  # Búsqueda inteligente con IA usando embeddings
from routers import embeddings_supabase as embeddings_router  # Generación y gestión de embeddings
from routers import rag_search as rag_router  # Búsqueda semántica usando RAG (Retrieval Augmented Generation)
from routers import direct_matches as direct_matches_router  # Búsqueda directa de matches sin IA
from routers import fix_embeddings as fix_embeddings_router  # Herramientas para corregir/regenerar embeddings
from routers import pets as pets_router  # Gestión de mascotas del usuario (perfil de mascotas)

# =========================
# Configuración Base
# =========================
# Directorio base del backend (carpeta donde está este archivo)
# Se usa para construir rutas relativas a otros archivos
BASE_DIR = Path(__file__).parent  # carpeta: .../backend

# =========================
# Configuración de Supabase
# =========================
# Obtener variables de entorno para conectar con Supabase
# SUPABASE_URL: URL de tu proyecto Supabase (ej: https://xxxxx.supabase.co)
# SUPABASE_SERVICE_KEY: Clave de servicio (tiene permisos completos, usar con cuidado)
# SUPABASE_ANON_KEY: Clave anónima (permisos limitados, más segura para frontend)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

# Intentar crear el cliente de Supabase
# Si no hay variables o falla la conexión, el servidor funcionará pero sin base de datos
if not SUPABASE_URL or not SUPABASE_KEY:
    print("WARNING: Variables de Supabase no encontradas en .env")
    print("         El servidor funcionará pero no podrá acceder a la base de datos")
    supabase_client = None
else:
    try:
        # Crear cliente de Supabase con configuración optimizada
        # get_supabase_client() configura timeouts y opciones de conexión
        supabase_client: Client = get_supabase_client()
        print("✅ Cliente de Supabase creado con configuración optimizada")
    except Exception as e:
        # Si falla la creación del cliente (error de conexión, credenciales inválidas, etc.)
        print(f"❌ Error creando cliente de Supabase: {e}")
        print("   El servidor funcionará pero no podrá acceder a la base de datos")
        supabase_client = None

# =========================
# Configuración de CORS (Cross-Origin Resource Sharing)
# =========================
# CORS permite que el frontend (que corre en un dominio diferente) haga peticiones al backend
# Sin CORS, los navegadores bloquean peticiones entre dominios diferentes por seguridad
# 
# Por defecto permite todos ("*"), pero en producción deberías especificar solo tu dominio
# para mayor seguridad.
# 
# Ejemplo en .env:
# ALLOWED_ORIGINS=http://localhost:8081,https://tudominio.com
# 
# Para desarrollo local con Expo Go, puedes usar "*" o especificar:
# ALLOWED_ORIGINS=http://localhost:8081,exp://192.168.1.100:8081
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

# =========================
# Crear Aplicación FastAPI
# =========================
# Crear la instancia principal de FastAPI
# title: Nombre de la API (aparece en la documentación automática)
# version: Versión de la API
app = FastAPI(title="PetAlert API", version="1.5.0")

# =========================
# Configurar Middleware CORS
# =========================
# Agregar middleware de CORS para permitir peticiones del frontend
app.add_middleware(
    CORSMiddleware,
    # Orígenes permitidos: dominios que pueden hacer peticiones
    # WARNING: En producción, especificar solo tus dominios, no usar "*"
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS else ["*"],
    # Permitir enviar cookies y headers de autenticación
    allow_credentials=True,
    # Métodos HTTP permitidos (GET, POST, PUT, DELETE, etc.)
    allow_methods=["*"],  # Permitir todos los métodos
    # Headers permitidos en las peticiones
    allow_headers=["*"],  # Permitir todos los headers
)

# =========================
# Startup: Pre-cargar MegaDescriptor
# =========================
@app.on_event("startup")
async def startup_event():
    """
    Evento que se ejecuta al iniciar el servidor
    Pre-carga el modelo MegaDescriptor para generar embeddings de imágenes más rápido
    
    MegaDescriptor es un modelo de IA especializado en reconocimiento de animales
    que convierte imágenes en vectores numéricos (embeddings) para buscar coincidencias
    visuales entre reportes de mascotas perdidas y encontradas.
    """
    # Verifica si la generación local de embeddings está habilitada
    generate_locally = os.getenv("GENERATE_EMBEDDINGS_LOCALLY", "false").lower() in ("1", "true", "yes")
    
    if generate_locally:
        print("🔄 Pre-cargando modelo MegaDescriptor...")
        try:
            # Importa y carga el modelo (esto puede tardar ~60 segundos la primera vez)
            from services.embeddings import _load_model
            _load_model()
            print("✅ MegaDescriptor pre-cargado. Los embeddings se generarán rápidamente.")
        except Exception as e:
            print(f"⚠️ Error pre-cargando MegaDescriptor: {e}")
            # Si falla, el modelo se cargará en la primera petición (más lento)
            print("   El modelo se cargará en la primera petición (puede tardar ~60s)")
    else:
        print("ℹ️ Generación local de embeddings desactivada (GENERATE_EMBEDDINGS_LOCALLY=false)")

# =========================
# Registrar todos los routers (endpoints de la API)
# =========================
# Cada router agrupa endpoints relacionados:
app.include_router(reports_router.router)              # /reports - CRUD de reportes de mascotas
app.include_router(reports_labels_router.router)       # /reports-labels - Etiquetas de reportes
app.include_router(matches_router.router)              # /matches - Coincidencias entre reportes
app.include_router(ai_search_router.router)            # /ai-search - Búsqueda inteligente con IA
app.include_router(embeddings_router.router)           # /embeddings-supabase - Generación de embeddings
app.include_router(rag_router.router)                  # /rag-search - Búsqueda semántica (RAG)
app.include_router(direct_matches_router.router)       # /direct-matches - Búsqueda directa de matches
app.include_router(fix_embeddings_router.router)       # /fix-embeddings - Herramientas para corregir embeddings
app.include_router(pets_router.router)                 # /pets - Gestión de mascotas del usuario

# =========================
# Helpers
# =========================
async def _save_to_supabase(data: Dict[str, Any]) -> bool:
    """
    Guarda datos en Supabase si está configurado.
    Retorna True si se guardó exitosamente, False en caso contrario.
    """
    if not supabase_client:
        return False
    
    try:
        # Aquí puedes agregar la lógica para guardar en Supabase
        # Por ejemplo, guardar análisis de imágenes en una tabla
        result = supabase_client.table("image_analyses").insert(data).execute()
        return True
    except Exception as e:
        print(f"Error guardando en Supabase: {e}")
        return False

# =========================
# Endpoints
# =========================
@app.get("/health")
async def health():
    """
    Endpoint de salud - verifica que la API está funcionando
    Útil para monitoreo y verificar que el servidor responde
    """
    supabase_status = "conectado" if supabase_client else "no configurado"
    return {
        "status": "ok", 
        "message": "PetAlert API activa",
        "supabase": supabase_status  # Indica si Supabase está configurado
    }

@app.get("/version")
async def version():
    """Endpoint para obtener información de la versión."""
    return {
        "version": app.version, 
        "allowed_origins": ALLOWED_ORIGINS or ["*"],
        "features": ["embeddings", "supabase" if supabase_client else "no_supabase"]
    }

# =========================
# Endpoint adicional para Supabase
# =========================
@app.get("/supabase/status")
async def supabase_status():
    """
    Verifica el estado de la conexión con Supabase
    Hace una consulta de prueba para confirmar que la base de datos responde
    """
    if not supabase_client:
        return {"status": "no_configurado", "message": "Variables de Supabase no encontradas"}
    
    try:
        # Hace una consulta simple (solo 1 registro) para verificar la conexión
        # Si esta consulta funciona, significa que Supabase está accesible
        result = supabase_client.table("image_analyses").select("id").limit(1).execute()
        return {"status": "conectado", "message": "Conexión exitosa con Supabase"}
    except Exception as e:
        return {"status": "error", "message": f"Error conectando con Supabase: {e}"}

# =========================
# Punto de entrada cuando se ejecuta este archivo directamente
# =========================
if __name__ == "__main__":
    import uvicorn
    # Inicia el servidor FastAPI en el puerto 8003
    # host="0.0.0.0" permite que acepte conexiones desde cualquier IP
    uvicorn.run(app, host="0.0.0.0", port=8003)