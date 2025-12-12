"""
Servicio de Generación de Embeddings con MegaDescriptor
=======================================================

Este módulo se encarga de generar embeddings (vectores numéricos) de imágenes
usando el modelo MegaDescriptor, especializado en reconocimiento de animales.

MegaDescriptor es un modelo de deep learning que convierte imágenes en vectores
de alta dimensión (1536 dimensiones) que capturan características visuales.
Estos vectores se usan para buscar coincidencias visuales entre reportes de
mascotas perdidas y encontradas.

Flujo:
1. Recibe bytes de una imagen
2. Preprocesa la imagen (redimensiona a 384x384, normaliza)
3. Pasa la imagen por el modelo MegaDescriptor
4. Obtiene el embedding (vector de características)
5. Normaliza el vector (L2 normalization)
6. Retorna el vector como numpy array

El modelo se carga una sola vez y se reutiliza para todas las peticiones.
"""

# backend/services/embeddings.py
import io  # Para trabajar con bytes en memoria
import asyncio  # Para operaciones asíncronas
from typing import Optional  # Para type hints
import numpy as np  # Para arrays numéricos
from PIL import Image  # Para procesar imágenes
import torch  # PyTorch para deep learning
import torchvision.transforms as T  # Transformaciones de imágenes
import timm  # Biblioteca para cargar modelos pre-entrenados

# =========================
# Configuración del Modelo MegaDescriptor
# =========================
# Detectar si hay GPU disponible (CUDA), si no usa CPU
# GPU es mucho más rápido pero CPU también funciona
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Nombre del modelo en Hugging Face Hub
# MegaDescriptor-L-384 es la versión Large que procesa imágenes de 384x384 píxeles
MODEL_NAME = "hf-hub:BVRA/MegaDescriptor-L-384"

# La dimensión del embedding se detectará automáticamente al cargar el modelo
# MegaDescriptor-L-384 genera embeddings de 1536 dimensiones
EMBEDDING_DIM = None

# Variables globales para cachear el modelo cargado
# Esto evita cargar el modelo múltiples veces (es costoso en tiempo y memoria)
_model = None  # El modelo de PyTorch
_transforms = None  # Las transformaciones de preprocesamiento
_actual_dim = None  # La dimensión real del embedding (se detecta al cargar)

# Semáforo para limitar concurrencia
# Permite máximo 2 inferencias simultáneas para evitar saturar la GPU/memoria
# Si hay más peticiones, esperan su turno
_inference_semaphore = asyncio.Semaphore(2)

def _load_model():
    """
    Carga el modelo MegaDescriptor y sus transformaciones de preprocesamiento.
    
    Esta función usa el patrón "lazy loading" - solo carga el modelo la primera vez
    que se llama. Las siguientes llamadas retornan el modelo ya cargado (cacheado).
    
    El modelo se descarga automáticamente desde Hugging Face Hub la primera vez.
    Puede tardar varios minutos dependiendo de la conexión a internet.
    
    Returns:
        Tupla con (modelo, transformaciones, dimensión_del_embedding)
    """
    global _model, _transforms, _actual_dim
    
    # Solo cargar si no está cargado ya (singleton pattern)
    if _model is None:
        print(f"🔄 Cargando MegaDescriptor en {DEVICE}...")
        
        # Cargar modelo desde Hugging Face Hub usando timm
        # num_classes=0 significa que queremos solo las features (sin capa de clasificación)
        # Esto nos da el embedding directamente sin pasar por una capa de salida
        _model = timm.create_model(MODEL_NAME, pretrained=True, num_classes=0)
        
        # Mover el modelo a la GPU si está disponible, si no queda en CPU
        _model = _model.to(DEVICE)
        
        # Poner el modelo en modo evaluación (desactiva dropout, batch norm, etc.)
        # Esto es importante para obtener resultados consistentes
        _model.eval()
        
        # Verificar la dimensión real del embedding haciendo una inferencia de prueba
        # Creamos una imagen dummy (aleatoria) y vemos qué tamaño de vector produce
        with torch.no_grad():  # No calcular gradientes (ahorra memoria)
            # Crear imagen dummy: 1 batch, 3 canales RGB, 384x384 píxeles
            dummy_input = torch.randn(1, 3, 384, 384).to(DEVICE)
            dummy_output = _model(dummy_input)  # Pasar por el modelo
            _actual_dim = dummy_output.shape[-1]  # Obtener la última dimensión (tamaño del vector)
            print(f"📊 Dimensión del modelo: {_actual_dim}")
        
        # Configurar transformaciones de preprocesamiento para las imágenes
        # Estas transformaciones deben coincidir EXACTAMENTE con las que usó el modelo durante el entrenamiento
        # MegaDescriptor-L-384 usa normalización [0.5, 0.5, 0.5] que convierte [0, 1] a [-1, 1]
        _transforms = T.Compose([
            T.Resize(size=(384, 384)),  # Redimensionar a 384x384 (tamaño que espera MegaDescriptor)
            T.ToTensor(),  # Convertir PIL Image a tensor de PyTorch (0-255 -> 0-1)
            # Normalizar: mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]
            # Esto convierte el rango de [0, 1] a [-1, 1] (estándar para MegaDescriptor)
            T.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
        ])
        print(f"✅ MegaDescriptor cargado exitosamente")
    
    # Retornar el modelo, transformaciones y dimensión (ya cargados o recién cargados)
    return _model, _transforms, _actual_dim

async def image_bytes_to_vec_async(image_bytes: bytes) -> np.ndarray:
    """
    Genera embedding de forma asíncrona con control de concurrencia.
    
    Esta es la versión asíncrona recomendada para usar en endpoints FastAPI.
    Usa un semáforo para limitar cuántas inferencias se ejecutan simultáneamente,
    evitando saturar la GPU o la memoria del sistema.
    
    Args:
        image_bytes: Bytes de la imagen (formato JPEG, PNG, etc.)
        
    Returns:
        numpy array float32 normalizado con el embedding (vector de características)
        
    Nota: La inferencia se ejecuta en un thread pool para no bloquear el event loop
    de asyncio, permitiendo que el servidor siga procesando otras peticiones.
    """
    # Adquirir el semáforo (espera si ya hay 2 inferencias en curso)
    async with _inference_semaphore:
        # Ejecutar la generación del embedding en un thread separado
        # Esto evita bloquear el event loop de asyncio mientras se procesa la imagen
        return await asyncio.to_thread(_generate_embedding, image_bytes)

def _generate_embedding(image_bytes: bytes) -> np.ndarray:
    """
    Genera el embedding de una imagen (función interna, no usar directamente).
    
    Esta función hace el trabajo real de generar el embedding:
    1. Carga el modelo si no está cargado
    2. Convierte los bytes de la imagen a un objeto PIL Image
    3. Aplica las transformaciones de preprocesamiento
    4. Pasa la imagen por el modelo MegaDescriptor
    5. Normaliza el vector resultante (L2 normalization)
    6. Convierte a numpy array y limpia la memoria
    
    Args:
        image_bytes: Bytes de la imagen en cualquier formato (JPEG, PNG, etc.)
        
    Returns:
        numpy array float32 normalizado con el embedding
        
    Nota: Esta función es síncrona. Para uso asíncrono, usar image_bytes_to_vec_async.
    """
    # Cargar el modelo (o obtener el ya cargado)
    model, transforms, actual_dim = _load_model()
    
    # Convertir bytes a imagen PIL
    # io.BytesIO crea un objeto file-like en memoria desde los bytes
    # Image.open() lee la imagen desde ese objeto
    # .convert("RGB") asegura que la imagen tenga 3 canales (rojo, verde, azul)
    # incluso si originalmente era escala de grises o tenía transparencia
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    # Aplicar transformaciones y generar embedding
    # torch.inference_mode() es más eficiente que torch.no_grad() para inferencia
    # Desactiva el cálculo de gradientes completamente (ahorra memoria y tiempo)
    with torch.inference_mode():
        # Aplicar transformaciones: resize, to tensor, normalize
        # unsqueeze(0) agrega una dimensión de batch al inicio: [3, 384, 384] -> [1, 3, 384, 384]
        # .to(DEVICE) mueve el tensor a GPU si está disponible
        img_tensor = transforms(img).unsqueeze(0).to(DEVICE)
        
        # Pasar la imagen por el modelo para obtener el embedding
        # El modelo procesa la imagen y extrae características visuales
        feats = model(img_tensor)
        
        # Normalización L2: divide cada elemento por la norma del vector
        # Esto hace que todos los embeddings tengan la misma "magnitud"
        # Es importante para comparar embeddings usando producto punto o coseno
        # feats.norm(dim=-1, keepdim=True) calcula la norma de cada vector en el batch
        feats = feats / feats.norm(dim=-1, keepdim=True)
        
        # Convertir de tensor de PyTorch a numpy array
        # squeeze(0) elimina la dimensión de batch: [1, 1536] -> [1536]
        # detach() desvincula del grafo computacional
        # cpu() mueve a CPU (necesario antes de convertir a numpy)
        # numpy() convierte a numpy array
        # astype("float32") asegura que sea float32 (más eficiente que float64)
        vec = feats.squeeze(0).detach().cpu().numpy().astype("float32")
    
    # Limpiar memoria explícitamente para liberar RAM/VRAM
    # Esto es importante cuando se procesan muchas imágenes
    del img, img_tensor, feats
    
    # Si estamos usando GPU, limpiar la caché de CUDA
    # Esto libera memoria de GPU que PyTorch puede haber reservado
    if DEVICE == "cuda":
        torch.cuda.empty_cache()
    
    print(f"🔍 Embedding generado: {vec.shape[-1]} dimensiones")
    
    return vec

def image_bytes_to_vec(image_bytes: bytes) -> np.ndarray:
    """
    Genera embedding L2-normalizado usando MegaDescriptor (versión síncrona).
    
    Esta es la función principal para generar embeddings de forma síncrona.
    Es un wrapper simple de _generate_embedding() para mantener compatibilidad
    con código existente que no usa asyncio.
    
    Para nuevos código, preferir image_bytes_to_vec_async() que es más eficiente
    en servidores asíncronos como FastAPI.
    
    Args:
        image_bytes: Bytes de la imagen en cualquier formato (JPEG, PNG, etc.)
        
    Returns:
        numpy array float32 normalizado con el embedding
        La dimensión depende del modelo (MegaDescriptor-L-384 genera 1536 dimensiones)
        
    Ejemplo:
        >>> with open("foto_perro.jpg", "rb") as f:
        ...     image_bytes = f.read()
        >>> embedding = image_bytes_to_vec(image_bytes)
        >>> print(embedding.shape)  # (1536,)
        >>> print(embedding.dtype)  # float32
    """
    # Versión síncrona simple para mantener compatibilidad con código existente
    # Llama directamente a la función interna que hace el trabajo
    return _generate_embedding(image_bytes)
