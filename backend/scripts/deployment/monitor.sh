#!/bin/bash

# Script de monitoreo para el backend de PetAlert

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📊 PetAlert Backend - Status Monitor${NC}\n"

# 1. Estado del contenedor
echo -e "${YELLOW}🐳 Estado de Docker:${NC}"
docker-compose ps
echo ""

# 2. Health check
echo -e "${YELLOW}💚 Health Check:${NC}"
if curl -s http://localhost:8003/health > /dev/null; then
    echo -e "${GREEN}✅ Backend responde correctamente${NC}"
    curl -s http://localhost:8003/health | python3 -m json.tool
else
    echo -e "${RED}❌ Backend NO responde${NC}"
fi
echo ""

# 3. Uso de recursos
echo -e "${YELLOW}📈 Uso de recursos:${NC}"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
echo ""

# 4. Espacio en disco
echo -e "${YELLOW}💾 Espacio en disco:${NC}"
df -h / | tail -n 1
echo ""

# 5. Memoria del sistema
echo -e "${YELLOW}🧠 Memoria del sistema:${NC}"
free -h
echo ""

# 6. Últimas 10 líneas del log
echo -e "${YELLOW}📋 Últimas líneas del log:${NC}"
docker-compose logs --tail=10 backend
echo ""

# 7. Conexiones activas
echo -e "${YELLOW}🔌 Conexiones al puerto 8003:${NC}"
netstat -an | grep :8003 | wc -l
echo "conexiones activas"





