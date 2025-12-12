# Script para desinstalar e instalar APK rápidamente
# Uso: .\reinstalar-apk.ps1 ruta\al\archivo.apk

param(
    [string]$ApkPath
)

$ADB = "C:\Users\Usuario\Downloads\platform-tools\adb.exe"
$PACKAGE = "com.petalert.app"

Write-Host "🗑️ Desinstalando versión anterior..." -ForegroundColor Yellow
& $ADB uninstall $PACKAGE 2>$null

Write-Host "📦 Instalando nueva versión..." -ForegroundColor Cyan
& $ADB install $ApkPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ APK instalado exitosamente" -ForegroundColor Green
    Write-Host "🚀 Abriendo app..." -ForegroundColor Cyan
    & $ADB shell am start -n "$PACKAGE/.MainActivity"
} else {
    Write-Host "❌ Error instalando APK" -ForegroundColor Red
}
