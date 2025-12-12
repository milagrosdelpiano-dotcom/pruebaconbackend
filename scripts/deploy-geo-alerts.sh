#!/bin/bash

# =====================================================
# Script de Despliegue: Sistema de Alertas Geográficas
# =====================================================
# Este script automatiza el despliegue completo del
# sistema de alertas geográficas en PetAlert
# =====================================================

set -e  # Salir si hay algún error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_step() {
    echo -e "${BLUE}📍 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Banner
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Sistema de Alertas Geográficas - PetAlert          ║"
echo "║   Despliegue Completo                                 ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Paso 1: Verificar dependencias
print_step "Verificando dependencias..."

if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI no está instalado"
    echo "Instálalo con: npm install -g supabase"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL client (psql) no está instalado. Algunas verificaciones no estarán disponibles."
fi

print_success "Dependencias verificadas"
echo ""

# Paso 2: Verificar conexión con Supabase
print_step "Verificando conexión con Supabase..."

if ! supabase projects list &> /dev/null; then
    print_error "No estás autenticado en Supabase"
    echo "Ejecuta: supabase login"
    exit 1
fi

print_success "Conexión con Supabase OK"
echo ""

# Paso 3: Obtener información del proyecto
print_step "Obteniendo información del proyecto..."

# Leer project ref del .env o solicitar al usuario
if [ -f ".env" ] && grep -q "SUPABASE_PROJECT_REF" .env; then
    PROJECT_REF=$(grep SUPABASE_PROJECT_REF .env | cut -d '=' -f2 | tr -d '"' | tr -d ' ')
else
    read -p "Ingresa tu Supabase Project Ref: " PROJECT_REF
fi

if [ -z "$PROJECT_REF" ]; then
    print_error "Project Ref es requerido"
    exit 1
fi

print_success "Project Ref: $PROJECT_REF"
echo ""

# Paso 4: Verificar migración SQL
print_step "Verificando archivo de migración..."

if [ ! -f "backend/migrations/011_geo_alerts_system.sql" ]; then
    print_error "Archivo de migración no encontrado: backend/migrations/011_geo_alerts_system.sql"
    exit 1
fi

print_success "Archivo de migración encontrado"
echo ""

# Paso 5: Ejecutar migración
print_step "Ejecutando migración SQL..."

echo "⚠️  Esto creará las siguientes tablas y funciones:"
echo "   - user_locations"
echo "   - user_alert_preferences"
echo "   - geo_alert_notifications_queue"
echo "   - Funciones y triggers necesarios"
echo ""

read -p "¿Continuar? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_warning "Migración cancelada"
    exit 0
fi

# Intentar ejecutar con supabase db push
if supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres" backend/migrations/011_geo_alerts_system.sql 2>/dev/null; then
    print_success "Migración ejecutada correctamente"
else
    print_warning "No se pudo ejecutar automáticamente. Ejecuta manualmente:"
    echo "   1. Ve a Supabase Dashboard → SQL Editor"
    echo "   2. Crea una nueva query"
    echo "   3. Copia el contenido de: backend/migrations/011_geo_alerts_system.sql"
    echo "   4. Ejecuta"
    echo ""
    read -p "Presiona ENTER cuando hayas ejecutado la migración..."
fi

echo ""

# Paso 6: Verificar instalación de PostGIS
print_step "Verificando PostGIS..."

# Esta verificación requeriría conexión directa a la DB
print_warning "Verifica manualmente que PostGIS esté habilitado:"
echo "   SELECT PostGIS_Version();"
echo ""

# Paso 7: Desplegar Edge Function
print_step "Desplegando Edge Function..."

if [ ! -d "supabase/functions/send-geo-alerts" ]; then
    print_error "Directorio de Edge Function no encontrado: supabase/functions/send-geo-alerts"
    exit 1
fi

supabase functions deploy send-geo-alerts --project-ref $PROJECT_REF

if [ $? -eq 0 ]; then
    print_success "Edge Function desplegada correctamente"
else
    print_error "Error desplegando Edge Function"
    exit 1
fi

echo ""

# Paso 8: Configurar Webhook
print_step "Configurando Database Webhook..."

echo "⚠️  Configura el webhook manualmente:"
echo ""
echo "   1. Ve a: https://app.supabase.com/project/$PROJECT_REF/database/webhooks"
echo "   2. Click en 'Create a new hook'"
echo "   3. Configura:"
echo "      - Name: process-geo-alerts-immediately"
echo "      - Table: geo_alert_notifications_queue"
echo "      - Events: INSERT"
echo "      - Type: HTTP Request"
echo "      - Method: POST"
echo "      - URL: https://$PROJECT_REF.supabase.co/functions/v1/send-geo-alerts"
echo "      - Headers:"
echo "        Authorization: Bearer [TU_SERVICE_ROLE_KEY]"
echo "        Content-Type: application/json"
echo "      - Timeout: 25000"
echo ""

read -p "Presiona ENTER cuando hayas configurado el webhook..."
echo ""

# Paso 9: Configurar variables de PostgreSQL
print_step "Configurando variables de PostgreSQL..."

echo "⚠️  Configura las variables manualmente:"
echo ""
echo "   1. Ve a: https://app.supabase.com/project/$PROJECT_REF/settings/database"
echo "   2. Scroll hasta 'Custom PostgreSQL Configuration'"
echo "   3. Agrega:"
echo "      app.supabase_url = https://$PROJECT_REF.supabase.co"
echo "      app.supabase_service_role_key = [TU_SERVICE_ROLE_KEY]"
echo ""

read -p "Presiona ENTER cuando hayas configurado las variables..."
echo ""

# Paso 10: Verificar instalación
print_step "Verificando instalación..."

echo "Ejecuta esta query en SQL Editor para verificar:"
echo ""
echo "SELECT * FROM get_geo_alerts_stats();"
echo ""
echo "Debería retornar estadísticas del sistema."
echo ""

# Paso 11: Instrucciones finales
print_success "¡Despliegue completado!"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "📱 SIGUIENTES PASOS EN EL FRONTEND"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "1. Regenerar configuración nativa:"
echo "   npx expo prebuild --clean"
echo ""
echo "2. Compilar para Android:"
echo "   npx expo run:android"
echo ""
echo "3. O compilar para iOS:"
echo "   npx expo run:ios"
echo ""
echo "4. Agregar botón en el perfil (app/(tabs)/profile.jsx):"
echo "   <TouchableOpacity onPress={() => router.push('/geo-alerts-settings')}>"
echo "     <Text>Alertas Geográficas</Text>"
echo "   </TouchableOpacity>"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "🧪 TESTING"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "1. En la app:"
echo "   - Ve a Perfil → Alertas Geográficas"
echo "   - Activa 'Rastreo de ubicación'"
echo "   - Acepta permisos"
echo ""
echo "2. Crea un reporte de prueba con ubicación cercana"
echo ""
echo "3. Verifica que recibes la notificación push"
echo ""
echo "4. Ver logs en tiempo real:"
echo "   supabase functions logs send-geo-alerts --follow"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "📚 DOCUMENTACIÓN COMPLETA"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Lee: GUIA-ALERTAS-GEOGRAFICAS.md"
echo ""
echo "✨ ¡Listo para recibir alertas de mascotas cercanas!"
echo ""


