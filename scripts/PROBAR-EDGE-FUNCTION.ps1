# 🔧 Script para probar la Edge Function manualmente

# Configuración
$PROJECT_REF = "eamsbroadstwkrkjcuvo"
$FUNCTION_URL = "https://$PROJECT_REF.supabase.co/functions/v1/send-geo-alerts"

Write-Host "🚀 Invocando Edge Function: $FUNCTION_URL" -ForegroundColor Cyan
Write-Host ""

# Obtener Service Role Key
Write-Host "⚠️  Necesitas tu Service Role Key:" -ForegroundColor Yellow
Write-Host "   1. Ve a Supabase Dashboard → Settings → API" -ForegroundColor Gray
Write-Host "   2. Copia el 'service_role' key (el que dice 'secret')" -ForegroundColor Gray
Write-Host ""

$SERVICE_ROLE_KEY = Read-Host "Pega tu Service Role Key aquí"

if ([string]::IsNullOrWhiteSpace($SERVICE_ROLE_KEY)) {
    Write-Host "❌ No se proporcionó el Service Role Key" -ForegroundColor Red
    exit 1
}

# Headers
$headers = @{
    "Authorization" = "Bearer $SERVICE_ROLE_KEY"
    "Content-Type" = "application/json"
}

# Body vacío
$body = "{}"

Write-Host ""
Write-Host "📤 Enviando petición..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $FUNCTION_URL -Method POST -Headers $headers -Body $body
    
    Write-Host ""
    Write-Host "✅ Función invocada exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Respuesta:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host ""
    Write-Host "❌ Error al invocar la función:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails) {
        Write-Host ""
        Write-Host "Detalles del error:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
    }
    
    if ($_.Response) {
        Write-Host ""
        Write-Host "Status Code: $($_.Response.StatusCode)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "💡 Ahora verifica en SQL si las alertas se procesaron:" -ForegroundColor Cyan
Write-Host "   SELECT * FROM geo_alert_notifications_queue WHERE processed_at IS NOT NULL;" -ForegroundColor Gray

