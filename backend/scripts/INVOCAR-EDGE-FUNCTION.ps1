# 🔧 Script para invocar Edge Function manualmente

# Configuración
$PROJECT_REF = "eamsbroadstwkrkjcuvo"
$SERVICE_ROLE_KEY = "TU_SERVICE_ROLE_KEY"  # ⚠️ Reemplaza con tu Service Role Key

# URL de la Edge Function
$FUNCTION_URL = "https://$PROJECT_REF.supabase.co/functions/v1/send-geo-alerts"

# Headers
$headers = @{
    "Authorization" = "Bearer $SERVICE_ROLE_KEY"
    "Content-Type" = "application/json"
}

# Body (vacío, la función no necesita parámetros)
$body = @{} | ConvertTo-Json

Write-Host "🚀 Invocando Edge Function: $FUNCTION_URL" -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $FUNCTION_URL -Method POST -Headers $headers -Body $body
    
    Write-Host "✅ Función invocada exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Respuesta:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Error al invocar la función:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails) {
        Write-Host ""
        Write-Host "Detalles del error:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
    }
}

