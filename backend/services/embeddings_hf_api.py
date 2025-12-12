"""
Servicio de Generación de Embeddings usando Hugging Face Inference API
=======================================================================

SOLUCIÓN PARA LIMITACIONES DE RAM:
En lugar de cargar el modelo MegaDescriptor localmente (1.5GB de RAM),
este servicio usa la Inference API de Hugging Face que ya tiene el modelo
cargado en sus servidores.

VENTAJAS:
- ✅ NO requiere 1.5GB de RAM en tu servidor
- ✅ GRATIS (rate limit: 1000 requests/hora)
- ✅ Funciona en servidores con solo 512MB RAM
- ✅ Mismo modelo MegaDescriptor que usarías localmente
- ✅ Mismo formato de embeddings (compatible con tu código existente)

DESVENTAJAS:
- Depende de conexión a internet
- Rate limit de 1000 requests/hora (suficiente para demo/tesis)
"""

import io
import asyncio
import os
from typing import Optional
import numpy as np
from PIL import Image
import httpx  # Cliente HTTP asíncrono

# Configuración de Hugging Face API
HF_API_URL = "https://api-inference.huggingface.co/models/BVRA/MegaDescriptor-L-384"
HF_API_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN", "")  # Token opcional pero recomendado

# Headers para la API
HEADERS = {}
if HF_API_TOKEN:
    HEADERS["Authorization"] = f"Bearer {HF_API_TOKEN}"

# Dimensión del embedding de MegaDescriptor-L-384
EMBEDDING_DIM = 1536

# Cliente HTTP reutilizable
_http_client = None

# Semáforo para limitar concurrencia (máximo 3 requests simultáneos)
_inference_semaphore = None


def _get_http_client():
    """Obtiene o crea el cliente HTTP."""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=30.0)
    return _http_client


def _get_semaphore():
    """Obtiene o crea el semáforo (lazy initialization para evitar problemas con event loop)."""
    global _inference_semaphore
    if _inference_semaphore is None:
        _inference_semaphore = asyncio.Semaphore(3)
    return _inference_semaphore


async def generate_embedding_from_bytes(image_bytes: bytes) -> Optional[np.ndarray]:
    """
    Genera un embedding de una imagen usando Hugging Face Inference API.
    
    Args:
        image_bytes: Bytes de la imagen (JPEG, PNG, etc.)
        
    Returns:
        numpy array con el embedding de 1536 dimensiones, o None si falla
    """
    try:
        # Verificar que la imagen sea válida antes de enviarla
        try:
            img = Image.open(io.BytesIO(image_bytes))
            img.verify()
        except Exception as e:
            print(f"❌ Imagen inválida: {e}")
            return None
        
        # Reabrir la imagen después de verify() (verify() cierra el archivo)
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convertir a RGB si es necesario
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Redimensionar a 384x384 (tamaño esperado por MegaDescriptor)
        img = img.resize((384, 384), Image.Resampling.LANCZOS)
        
        # Guardar imagen procesada en bytes
        img_io = io.BytesIO()
        img.save(img_io, format='JPEG', quality=95)
        processed_bytes = img_io.getvalue()
        
        # Llamar a la API de Hugging Face con semáforo para limitar concurrencia
        async with _get_semaphore():
            client = _get_http_client()
            
            print(f"🔄 Enviando imagen a Hugging Face API...")
            
            response = await client.post(
                HF_API_URL,
                headers=HEADERS,
                content=processed_bytes,
                timeout=30.0
            )
            
            # Verificar respuesta
            if response.status_code == 503:
                # Modelo cargándose en el servidor de HF
                print("⏳ Modelo cargándose en Hugging Face, reintentando en 20s...")
                await asyncio.sleep(20)
                
                # Reintentar
                response = await client.post(
                    HF_API_URL,
                    headers=HEADERS,
                    content=processed_bytes,
                    timeout=30.0
                )
            
            if response.status_code != 200:
                print(f"❌ Error en Hugging Face API: {response.status_code}")
                print(f"   Respuesta: {response.text}")
                return None
            
            # La API devuelve el embedding como lista de floats
            embedding = response.json()
            
            # Convertir a numpy array
            embedding_array = np.array(embedding, dtype=np.float32)
            
            # Normalizar el embedding (L2 normalization)
            norm = np.linalg.norm(embedding_array)
            if norm > 0:
                embedding_array = embedding_array / norm
            
            print(f"✅ Embedding generado: dimensión {len(embedding_array)}")
            
            return embedding_array
            
    except Exception as e:
        print(f"❌ Error generando embedding: {e}")
        import traceback
        traceback.print_exc()
        return None


async def generate_embeddings_batch(images_bytes: list[bytes]) -> list[Optional[np.ndarray]]:
    """
    Genera embeddings para múltiples imágenes en paralelo.
    
    Args:
        images_bytes: Lista de bytes de imágenes
        
    Returns:
        Lista de embeddings (numpy arrays) o None para las que fallen
    """
    if not images_bytes:
        return []
    
    print(f"🔄 Generando {len(images_bytes)} embeddings en batch...")
    
    # Generar embeddings en paralelo
    tasks = [generate_embedding_from_bytes(img_bytes) for img_bytes in images_bytes]
    embeddings = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Convertir excepciones a None
    result = []
    for emb in embeddings:
        if isinstance(emb, Exception):
            print(f"❌ Error en batch: {emb}")
            result.append(None)
        else:
            result.append(emb)
    
    successful = sum(1 for e in result if e is not None)
    print(f"✅ Batch completado: {successful}/{len(images_bytes)} exitosos")
    
    return result


def get_embedding_dim() -> int:
    """Retorna la dimensión del embedding."""
    return EMBEDDING_DIM


async def cleanup():
    """Limpia recursos al cerrar la aplicación."""
    global _http_client
    if _http_client:
        await _http_client.aclose()
        _http_client = None
