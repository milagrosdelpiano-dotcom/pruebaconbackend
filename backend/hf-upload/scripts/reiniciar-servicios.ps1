# Script para reiniciar todos los servicios de PetFind
# Ejecutar desde la raíz del proyecto: .\reiniciar-servicios.ps1

Write-Host "🔄 Reiniciando servicios de PetFind..." -ForegroundColor Cyan
Write-Host ""

# Función para mostrar mensajes con colores
function Write-Step {
    param($Message)
    Write-Host "▶ $Message" -ForegroundColor Yellow
}

function Write-Success {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param($Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "backend") -or -not (Test-Path "src")) {
    Write-Error "Este script debe ejecutarse desde la raíz del proyecto petFindnoborres"
    exit 1
}

Write-Success "Directorio correcto detectado"
Write-Host ""

# ============================================
# PASO 1: Verificar .env del backend
# ============================================
Write-Step "Verificando configuración del backend..."

if (-not (Test-Path "backend\.env")) {
    Write-Error "No se encontró backend\.env"
    Write-Info "Copia backend\env.example a backend\.env y configura tus credenciales"
    exit 1
}

Write-Success "Archivo .env encontrado"
Write-Host ""

# ============================================
# PASO 2: Activar entorno virtual
# ============================================
Write-Step "Activando entorno virtual de Python..."

$venvPath = ".venv\Scripts\Activate.ps1"
if (-not (Test-Path $venvPath)) {
    Write-Error "No se encontró el entorno virtual en .venv"
    Write-Info "Crea el entorno virtual con: python -m venv .venv"
    exit 1
}

Write-Success "Entorno virtual encontrado"
Write-Host ""

# ============================================
# INSTRUCCIONES PARA EL USUARIO
# ============================================
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  INSTRUCCIONES PARA INICIAR LOS SERVICIOS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "Necesitas abrir 3 TERMINALES de PowerShell:" -ForegroundColor Yellow
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host " TERMINAL 1: BACKEND (Uvicorn)" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host ""
Write-Host "cd $PWD" -ForegroundColor Gray
Write-Host "& $PWD\.venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "cd backend" -ForegroundColor Gray
Write-Host "uvicorn main:app --reload --port 8003 --host 0.0.0.0" -ForegroundColor Cyan
Write-Host ""
Write-Host "Espera a ver: '✅ MegaDescriptor pre-cargado'" -ForegroundColor Yellow
Write-Host "             'INFO: Uvicorn running on http://0.0.0.0:8003'" -ForegroundColor Yellow
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host " TERMINAL 2: CLOUDFLARED (Tunnel)" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host ""
Write-Host "cd $PWD" -ForegroundColor Gray
Write-Host "cloudflared tunnel --url http://localhost:8003" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Copia la URL del tunnel que aparece" -ForegroundColor Yellow
Write-Host "    Algo como: https://xxx-yyy-zzz.trycloudflare.com" -ForegroundColor Yellow
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host " TERMINAL 3: FRONTEND (Expo)" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host ""
Write-Host "cd $PWD" -ForegroundColor Gray
Write-Host "npm start" -ForegroundColor Cyan
Write-Host ""
Write-Host "Escanea el código QR con Expo Go en tu celular" -ForegroundColor Yellow
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ============================================
# VERIFICACIONES OPCIONALES
# ============================================
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  VERIFICACIONES OPCIONALES" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Step "¿Verificar health del backend? (S/N)"
$verify = Read-Host

if ($verify -eq "S" -or $verify -eq "s") {
    Write-Info "Esperando a que el backend inicie..."
    Write-Info "Una vez iniciado, puedes verificar:"
    Write-Host ""
    Write-Host "curl http://localhost:8003/health" -ForegroundColor Cyan
    Write-Host "curl http://localhost:8003/supabase/status" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  NOTAS IMPORTANTES" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Info "1. El backend tarda ~30-60 segundos en cargar el modelo MegaDescriptor"
Write-Info "2. Actualiza EXPO_PUBLIC_BACKEND_URL con la URL de cloudflared"
Write-Info "3. Si hay errores de timeout, revisa backend\SOLUCION-TIMEOUT-SUPABASE.md"
Write-Info "4. Presiona Ctrl+C en cada terminal para detener los servicios"
Write-Host ""

Write-Success "¡Listo! Sigue las instrucciones arriba para iniciar los servicios"





