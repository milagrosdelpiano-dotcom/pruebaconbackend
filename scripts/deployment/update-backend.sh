#!/bin/bash

# Script para actualizar el backend después de cambios en el código
# Ejecuta este script cuando hagas cambios en el código

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔄 Actualizando backend de PetAlert...${NC}"

# Si usas Git
if [ -d .git ]; then
    echo -e "${YELLOW}📥 Descargando últimos cambios...${NC}"
    git pull origin main || git pull origin master
fi

# Reconstruir y reiniciar
echo -e "${YELLOW}🔨 Reconstruyendo imagen...${NC}"
docker-compose build --no-cache backend

echo -e "${YELLOW}♻️  Reiniciando servicio...${NC}"
docker-compose up -d backend

echo -e "${YELLOW}⏳ Esperando a que el servicio esté listo...${NC}"
sleep 10

# Verificar
if curl -f http://localhost:8003/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend actualizado exitosamente!${NC}"
else
    echo -e "${YELLOW}⚠️  El servicio puede estar iniciando todavía...${NC}"
    echo "Ver logs: docker-compose logs -f backend"
fi

# Mostrar últimas líneas del log
echo -e "\n${YELLOW}📋 Últimas líneas del log:${NC}"
docker-compose logs --tail=20 backend





