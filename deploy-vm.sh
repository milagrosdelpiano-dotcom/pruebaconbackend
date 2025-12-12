#!/bin/bash

# Script de deploy para VM de Google Cloud
# Este script automatiza el despliegue del backend de PetAlert

set -e  # Detener en caso de error

echo "🚀 Iniciando deploy de PetAlert Backend..."

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.yml no encontrado${NC}"
    echo "Asegúrate de ejecutar este script desde el directorio raíz del proyecto"
    exit 1
fi

# 2. Verificar que existen los archivos de configuración necesarios
echo -e "${YELLOW}📋 Verificando archivos de configuración...${NC}"

if [ ! -f "backend/.env" ]; then
    echo -e "${RED}❌ Error: backend/.env no encontrado${NC}"
    echo "Copia backend/env.example a backend/.env y configura tus credenciales"
    exit 1
fi

# Google Vision ya no se usa - se eliminó en favor de MegaDescriptor embeddings
fi

# 3. Detener contenedores existentes
echo -e "${YELLOW}🛑 Deteniendo contenedores existentes...${NC}"
docker-compose down || true

# 4. Construir la imagen
echo -e "${YELLOW}🔨 Construyendo imagen Docker...${NC}"
docker-compose build --no-cache

# 5. Iniciar los servicios
echo -e "${YELLOW}▶️  Iniciando servicios...${NC}"
docker-compose up -d

# 6. Esperar a que el servicio esté listo
echo -e "${YELLOW}⏳ Esperando a que el servicio esté listo...${NC}"
sleep 10

# 7. Verificar el estado
echo -e "${YELLOW}🔍 Verificando estado del servicio...${NC}"
if curl -f http://localhost:8003/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend deployado exitosamente!${NC}"
    echo -e "${GREEN}🌐 API disponible en: http://localhost:8003${NC}"
    echo -e "${GREEN}📊 Health check: http://localhost:8003/health${NC}"
    echo -e "${GREEN}📝 Docs: http://localhost:8003/docs${NC}"
else
    echo -e "${RED}❌ Error: El servicio no responde correctamente${NC}"
    echo "Revisando logs..."
    docker-compose logs --tail=50 backend
    exit 1
fi

# 8. Mostrar logs
echo -e "\n${YELLOW}📋 Últimas líneas del log:${NC}"
docker-compose logs --tail=20 backend

echo -e "\n${GREEN}✅ Deploy completado!${NC}"
echo -e "\n${YELLOW}Comandos útiles:${NC}"
echo "  Ver logs en tiempo real: docker-compose logs -f backend"
echo "  Detener servicio: docker-compose down"
echo "  Reiniciar servicio: docker-compose restart backend"
echo "  Ver estado: docker-compose ps"





