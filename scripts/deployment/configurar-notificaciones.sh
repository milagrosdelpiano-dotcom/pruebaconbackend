#!/bin/bash

# Script de configuración rápida para sistema de notificaciones push
# Para Linux/Mac

set -e

echo "========================================"
echo "CONFIGURACIÓN RÁPIDA - NOTIFICACIONES PUSH"
echo "========================================"
echo ""

# Verificar que Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "[ERROR] Supabase CLI no está instalado"
    echo ""
    echo "Instalar con: npm install -g supabase"
    echo ""
    exit 1
fi

echo "[OK] Supabase CLI instalado"
echo ""

# Verificar que el usuario está autenticado
if ! supabase projects list &> /dev/null; then
    echo "[ERROR] No estás autenticado en Supabase"
    echo ""
    echo "Ejecuta primero: supabase login"
    echo ""
    exit 1
fi

echo "[OK] Autenticado en Supabase"
echo ""

# Verificar que el proyecto está vinculado
if [ ! -f ".git/supabase-project-ref" ]; then
    echo "[INFO] Proyecto no vinculado. Ingresa tu Project Reference ID"
    echo "       Lo puedes encontrar en: Supabase Dashboard > Settings > General"
    echo ""
    read -p "Project Reference ID: " PROJECT_REF
    
    supabase link --project-ref "$PROJECT_REF"
    echo "[OK] Proyecto vinculado"
    echo ""
fi

echo "========================================"
echo "PASO 1: Habilitar extensión pg_net"
echo "========================================"
echo ""
echo "Ejecuta esto en el SQL Editor de Supabase Dashboard:"
echo ""
echo "CREATE EXTENSION IF NOT EXISTS pg_net;"
echo ""
read -p "Presiona Enter cuando lo hayas ejecutado..."

echo ""
echo "========================================"
echo "PASO 2: Ejecutar migración SQL"
echo "========================================"
echo ""
echo "Copia y pega el contenido de este archivo en SQL Editor:"
echo "backend/migrations/009_notification_system.sql"
echo ""
read -p "Presiona Enter cuando lo hayas ejecutado..."

echo ""
echo "========================================"
echo "PASO 3: Desplegar Edge Function"
echo "========================================"
echo ""
echo "Desplegando send-push-notification..."
echo ""

supabase functions deploy send-push-notification

echo "[OK] Edge Function desplegada"
echo ""

echo "========================================"
echo "PASO 4: Configurar variables en Supabase"
echo "========================================"
echo ""
echo "Ve a: Supabase Dashboard > Settings > Database > Custom PostgreSQL Configuration"
echo ""
echo "Agrega estas variables:"
echo ""
echo "app.supabase_url = https://TU_PROJECT_REF.supabase.co"
echo "app.supabase_service_role_key = TU_SERVICE_ROLE_KEY"
echo ""
echo "El service_role_key está en: Dashboard > Settings > API"
echo ""
read -p "Presiona Enter cuando lo hayas configurado..."

echo ""
echo "========================================"
echo "VERIFICACIÓN"
echo "========================================"
echo ""
echo "Ejecuta esta query en SQL Editor para verificar:"
echo "SELECT * FROM check_notification_system_status();"
echo ""

echo "========================================"
echo "CONFIGURACIÓN COMPLETADA"
echo "========================================"
echo ""
echo "El sistema de notificaciones está listo!"
echo ""
echo "Comandos útiles:"
echo "- Ver logs: supabase functions logs send-push-notification --follow"
echo "- Listar funciones: supabase functions list"
echo "- Verificar estado: SELECT * FROM check_notification_system_status();"
echo ""
echo "Documentación completa en: CONFIGURAR-NOTIFICACIONES-PUSH.md"
echo ""



