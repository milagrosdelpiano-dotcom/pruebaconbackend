# Script para actualizar el archivo .env con las configuraciones de MegaDescriptor
$envFile = Join-Path $PSScriptRoot ".env"

# Configuraciones a agregar
$configToAdd = @"

# ============================================
# CONFIGURACIÓN DE EMBEDDINGS CON MEGADESCRIPTOR
# ============================================
# Generar embeddings automáticamente al crear/actualizar reportes
GENERATE_EMBEDDINGS_LOCALLY=true

# N8N ya no se usa - el backend procesa todo localmente con MegaDescriptor
"@

# Verificar si el archivo .env existe
if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    
    # Verificar si ya tiene la configuración
    if ($content -match "GENERATE_EMBEDDINGS_LOCALLY") {
        Write-Host "✅ La configuración ya existe en .env" -ForegroundColor Green
        Write-Host "   Verificando valor..." -ForegroundColor Yellow
        
        # Actualizar el valor si está en false
        $newContent = $content -replace "GENERATE_EMBEDDINGS_LOCALLY=false", "GENERATE_EMBEDDINGS_LOCALLY=true"
        if ($newContent -ne $content) {
            Set-Content -Path $envFile -Value $newContent -NoNewline
            Write-Host "✅ Actualizado GENERATE_EMBEDDINGS_LOCALLY a true" -ForegroundColor Green
        } else {
            Write-Host "✅ GENERATE_EMBEDDINGS_LOCALLY ya está en true" -ForegroundColor Green
        }
    } else {
        # Agregar la configuración al final
        Add-Content -Path $envFile -Value $configToAdd
        Write-Host "✅ Configuración agregada a .env" -ForegroundColor Green
    }
} else {
    Write-Host "❌ No se encontró el archivo .env" -ForegroundColor Red
    Write-Host "   Creando .env desde env.example..." -ForegroundColor Yellow
    
    if (Test-Path (Join-Path $PSScriptRoot "env.example")) {
        Copy-Item (Join-Path $PSScriptRoot "env.example") $envFile
        Write-Host "✅ Archivo .env creado" -ForegroundColor Green
        Write-Host "⚠️  IMPORTANTE: Edita .env y agrega tus credenciales reales" -ForegroundColor Yellow
    } else {
        Write-Host "❌ No se encontró env.example" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "CONFIGURACIÓN ACTUALIZADA" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. Reinicia el backend si está corriendo" -ForegroundColor White
Write-Host "2. Ejecuta: uvicorn main:app --reload --port 8010" -ForegroundColor White
Write-Host "3. Los nuevos reportes generarán embeddings automáticamente" -ForegroundColor White
Write-Host ""
Write-Host "Para reportes existentes sin embedding:" -ForegroundColor Yellow
Write-Host "python -m scripts.regenerate_embeddings_mega" -ForegroundColor White
Write-Host ""

