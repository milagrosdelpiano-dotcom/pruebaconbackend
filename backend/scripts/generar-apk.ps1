# Script para generar APK de PetAlert
# Uso: .\generar-apk.ps1 [preview|production|development|local]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('preview', 'production', 'development', 'local')]
    [string]$Perfil = 'preview'
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Generador de APK - PetAlert App" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si EAS CLI está instalado
$easInstalled = Get-Command eas -ErrorAction SilentlyContinue

if (-not $easInstalled) {
    Write-Host "❌ EAS CLI no está instalado." -ForegroundColor Red
    Write-Host ""
    $install = Read-Host "¿Deseas instalar EAS CLI ahora? (s/n)"
    
    if ($install -eq 's' -or $install -eq 'S') {
        Write-Host "📦 Instalando EAS CLI..." -ForegroundColor Yellow
        npm install -g eas-cli
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ EAS CLI instalado correctamente" -ForegroundColor Green
        } else {
            Write-Host "❌ Error al instalar EAS CLI" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⚠️  Necesitas EAS CLI para continuar. Ejecuta: npm install -g eas-cli" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✅ EAS CLI detectado" -ForegroundColor Green
Write-Host ""

# Verificar login
Write-Host "🔐 Verificando sesión de Expo..." -ForegroundColor Yellow
$whoami = eas whoami 2>&1

if ($whoami -like "*Not logged in*" -or $whoami -like "*not logged in*") {
    Write-Host "❌ No has iniciado sesión en Expo" -ForegroundColor Red
    Write-Host ""
    $login = Read-Host "¿Deseas iniciar sesión ahora? (s/n)"
    
    if ($login -eq 's' -or $login -eq 'S') {
        eas login
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Error al iniciar sesión" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⚠️  Necesitas iniciar sesión. Ejecuta: eas login" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✅ Sesión activa" -ForegroundColor Green
Write-Host ""

# Mostrar información del perfil seleccionado
Write-Host "📋 Información del Build:" -ForegroundColor Cyan
Write-Host "   Perfil: $Perfil" -ForegroundColor White

switch ($Perfil) {
    'preview' {
        Write-Host "   Tipo: APK para pruebas" -ForegroundColor White
        Write-Host "   Uso: Testing y distribución manual" -ForegroundColor Gray
    }
    'production' {
        Write-Host "   Tipo: AAB para producción" -ForegroundColor White
        Write-Host "   Uso: Google Play Store" -ForegroundColor Gray
    }
    'development' {
        Write-Host "   Tipo: APK de desarrollo" -ForegroundColor White
        Write-Host "   Uso: Desarrollo con hot reload" -ForegroundColor Gray
    }
    'local' {
        Write-Host "   Tipo: Build local (preview)" -ForegroundColor White
        Write-Host "   Uso: Build en tu computadora" -ForegroundColor Gray
    }
}

Write-Host ""

# Verificar archivo de configuración
if (-not (Test-Path "eas.json")) {
    Write-Host "⚠️  Advertencia: No se encontró eas.json" -ForegroundColor Yellow
    Write-Host "   Ejecutando configuración..." -ForegroundColor Yellow
    eas build:configure
}

Write-Host ""
Write-Host "🚀 Iniciando build..." -ForegroundColor Green
Write-Host ""

# Ejecutar el build según el perfil
if ($Perfil -eq 'local') {
    Write-Host "⚠️  Build local seleccionado. Asegúrate de tener:" -ForegroundColor Yellow
    Write-Host "   - Android Studio instalado" -ForegroundColor Gray
    Write-Host "   - ANDROID_HOME configurado" -ForegroundColor Gray
    Write-Host "   - Docker instalado (opcional)" -ForegroundColor Gray
    Write-Host ""
    
    $continue = Read-Host "¿Continuar con build local? (s/n)"
    if ($continue -ne 's' -and $continue -ne 'S') {
        Write-Host "❌ Build cancelado" -ForegroundColor Red
        exit 0
    }
    
    eas build --platform android --profile preview --local
} elseif ($Perfil -eq 'development') {
    Write-Host "🔨 Ejecutando build de desarrollo rápido..." -ForegroundColor Yellow
    npx expo run:android
} else {
    eas build --platform android --profile $Perfil
}

# Verificar resultado
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "  ✅ Build completado exitosamente!" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    
    if ($Perfil -ne 'development') {
        Write-Host "📥 Para ver y descargar tu build:" -ForegroundColor Cyan
        Write-Host "   1. Ejecuta: eas build:list" -ForegroundColor White
        Write-Host "   2. O visita: https://expo.dev" -ForegroundColor White
        Write-Host ""
        
        $openList = Read-Host "¿Deseas ver la lista de builds ahora? (s/n)"
        if ($openList -eq 's' -or $openList -eq 'S') {
            eas build:list
        }
    }
} else {
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host "  ❌ Error en el build" -ForegroundColor Red
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Consejos:" -ForegroundColor Yellow
    Write-Host "   - Revisa los logs arriba para más detalles" -ForegroundColor Gray
    Write-Host "   - Verifica que todas las dependencias estén instaladas" -ForegroundColor Gray
    Write-Host "   - Consulta GUIA-GENERAR-APK.md para solución de problemas" -ForegroundColor Gray
    Write-Host ""
}


