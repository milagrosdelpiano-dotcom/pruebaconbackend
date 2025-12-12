# PettAlert - Sistema de Búsqueda de Mascotas con IA

App móvil para reportar mascotas perdidas/encontradas con búsqueda inteligente por similitud visual usando MegaDescriptor.

**Desarrollado por:** Milagros Elles + [Nombre compañero]  
**Tesis:** [Universidad/Carrera]  
**Fecha:** Diciembre 2025

---

## 🚀 Stack Tecnológico

- **Frontend:** React Native + Expo SDK 54
- **Backend:** FastAPI (Python 3.11)
- **Base de Datos:** Supabase (PostgreSQL + pgvector)
- **IA:** MegaDescriptor-L-384 via Hugging Face Inference API
- **Hosting:** Fly.io (backend) + EAS Build (APK)

---

## 📦 Instalación Local

### Requisitos

- Node.js 18+
- Python 3.11+
- Expo CLI (`npm install -g expo-cli eas-cli`)
- Android Studio (para emulador) o dispositivo Android

### 1. Clonar el repositorio

```bash
git clone https://github.com/[tu-usuario]/petalert.git
cd petalert
```

### 2. Configurar Frontend

```bash
# Instalar dependencias
npm install

# Copiar archivo de ejemplo
cp env.example .env

# Editar .env con las credenciales de Supabase
# EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
# EXPO_PUBLIC_BACKEND_URL=https://petalert-backend.fly.dev
```

### 3. Configurar Backend

```bash
cd backend

# Crear entorno virtual
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt

# Copiar archivo de ejemplo
cp env.example .env

# Editar backend/.env con credenciales
# SUPABASE_URL=https://tu-proyecto.supabase.co
# SUPABASE_SERVICE_KEY=tu-service-role-key
# USE_HF_INFERENCE_API=true
```

### 4. Ejecutar localmente

**Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8003
# API en http://localhost:8003/docs
```

**Frontend:**
```bash
# En otra terminal
npx expo start

# Opciones:
# - Presionar 'a' para abrir en emulador Android
# - Escanear QR con Expo Go app en dispositivo físico
```

---

## 🌐 Deployment

### Backend en Fly.io

```bash
# Instalar Fly CLI
# https://fly.io/docs/hands-on/install-flyctl/

# Login
flyctl auth login

# Deploy
cd backend
flyctl deploy -a petalert-backend

# Ver logs
flyctl logs -a petalert-backend
```

### Build APK con EAS

```bash
# Login en Expo
eas login

# Build para Android
$env:EAS_NO_VCS=1  # Windows PowerShell
eas build --platform android --profile preview --non-interactive

# Descargar APK del link que proporciona
```

---

## 🗂️ Estructura del Proyecto

```
PettAlert-main/
├── app/                      # Pantallas de la app (Expo Router)
│   ├── (auth)/              # Login, registro
│   ├── (tabs)/              # Home, reportes, mascotas, perfil
│   └── report/              # Crear/editar reportes
├── src/
│   ├── components/          # Componentes reutilizables
│   ├── services/            # Clientes de Supabase, APIs
│   └── stores/              # Estado global (Zustand)
├── backend/
│   ├── main.py             # FastAPI app principal
│   ├── routers/            # Endpoints REST
│   ├── services/           # Lógica de negocio
│   │   ├── embeddings_hf_api.py  # Hugging Face API (NUEVO)
│   │   └── embeddings.py         # Modelo local (legacy)
│   ├── utils/              # Helpers
│   └── migrations/         # Scripts SQL para Supabase
└── scripts/                # Automatización
```

---

## 🤖 Solución MegaDescriptor

### Problema Original

MegaDescriptor-L-384 (1.5GB) excede el límite de RAM de Fly.io free tier (512MB).

### Solución Implementada

En lugar de cargar el modelo localmente, usamos **Hugging Face Inference API**:

**Ventajas:**
- ✅ 0 RAM usado (procesamiento en servidores de HF)
- ✅ Gratis (1000 requests/hora)
- ✅ Embeddings idénticos (1536 dimensiones)

**Código:**

```python
# backend/services/embeddings_hf_api.py
import httpx

HF_API_URL = "https://api-inference.huggingface.co/models/BVRA/MegaDescriptor-L-384"

async def generate_embedding_from_bytes(image_bytes):
    response = await httpx.AsyncClient().post(HF_API_URL, content=image_bytes)
    return np.array(response.json())
```

**Activar en `.env`:**
```bash
USE_HF_INFERENCE_API=true
```

---

## ⚠️ Problemas Conocidos

### 1. Google Maps API Key (CRÍTICO)

**Problema:** La app crashea al abrir pantalla Home porque `react-native-maps` requiere API key de Google Cloud.

**Error:**
```
java.lang.IllegalStateException: API key not found
```

**Solución temporal:** Mapas deshabilitados (código comentado).

**Solución definitiva:** 
1. Crear cuenta en Google Cloud Platform
2. Habilitar Maps SDK for Android
3. Crear API key
4. Pegar en `app.config.js` → `android.config.googleMaps.apiKey`
5. Descomentar código en:
   - `app/(tabs)/index.jsx` (línea 56)
   - `app/report/create-lost.jsx`
   - `app/report/create-found.jsx`

Ver instrucciones completas en: [INSTRUCCIONES-API-KEY.md](./INSTRUCCIONES-API-KEY.md)

### 2. Push Notifications

**Estado:** Deshabilitado (falta configuración completa de Firebase).

---

## 📊 Credenciales Necesarias

**NO INCLUIR EN GIT.** Crear archivo `.env` basado en `env.example`:

### Frontend (.env)
```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_BACKEND_URL=https://petalert-backend.fly.dev
```

### Backend (backend/.env)
```bash
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
USE_HF_INFERENCE_API=true
GENERATE_EMBEDDINGS_LOCALLY=true
```

---

## 🛠️ Scripts Útiles

### Reinstalar APK rápidamente

```powershell
# Windows
.\scripts\reinstalar-apk.ps1 "C:\ruta\al\archivo.apk"
```

Desinstala la app anterior, instala la nueva y la abre automáticamente.

### Ver logs del backend

```bash
flyctl logs -a petalert-backend
```

---

## 📝 Comandos Frecuentes

```bash
# Desarrollo frontend
npm start                    # Expo dev server
npx expo start --clear       # Limpiar caché

# Desarrollo backend
cd backend
uvicorn main:app --reload

# Build producción
eas build --platform android --profile preview

# Deploy backend
cd backend
flyctl deploy -a petalert-backend
```

---

## 📧 Contacto

**Desarrolladores:**
- Milagros Elles - [email]
- [Compañero] - [email]

**Repositorio:** https://github.com/[usuario]/petalert  
**Backend API:** https://petalert-backend.fly.dev/docs  
**Supabase:** https://eamsbroadstwkrkjcuvo.supabase.co

---

## 📄 Licencia

[Definir licencia - MIT, GPL, etc.]
