# Test Backend - Script de Prueba
Write-Host "`n=== Testing Backend ===" -ForegroundColor Cyan

# Test 1: Health
Write-Host "`n1. Testing /health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri http://127.0.0.1:8003/health -Method GET
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor White
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: RAG Stats
Write-Host "`n2. Testing /rag/stats..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri http://127.0.0.1:8003/rag/stats -Method GET
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor White
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Tests Completed ===" -ForegroundColor Cyan



