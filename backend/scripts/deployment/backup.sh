#!/bin/bash

# Script de backup para configuración del backend
# Guarda .env y credenciales en un directorio de backup

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKUP_DIR="$HOME/petalert-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"

echo -e "${YELLOW}💾 Creando backup de configuración...${NC}"

# Crear directorio de backup
mkdir -p "$BACKUP_PATH"

# Backup de .env
if [ -f backend/.env ]; then
    cp backend/.env "$BACKUP_PATH/.env"
    echo -e "${GREEN}✅ .env respaldado${NC}"
fi

# Backup de google-vision-key.json
if [ -f backend/google-vision-key.json ]; then
    cp backend/google-vision-key.json "$BACKUP_PATH/google-vision-key.json"
    echo -e "${GREEN}✅ google-vision-key.json respaldado${NC}"
fi

# Backup de docker-compose.yml
if [ -f docker-compose.yml ]; then
    cp docker-compose.yml "$BACKUP_PATH/docker-compose.yml"
    echo -e "${GREEN}✅ docker-compose.yml respaldado${NC}"
fi

# Comprimir backup
cd "$BACKUP_DIR"
tar -czf "backup_$TIMESTAMP.tar.gz" "backup_$TIMESTAMP"
rm -rf "backup_$TIMESTAMP"

echo -e "${GREEN}✅ Backup completado: $BACKUP_DIR/backup_$TIMESTAMP.tar.gz${NC}"

# Limpiar backups antiguos (mantener solo los últimos 5)
cd "$BACKUP_DIR"
ls -t backup_*.tar.gz | tail -n +6 | xargs -r rm

echo -e "${GREEN}📦 Backups disponibles:${NC}"
ls -lh "$BACKUP_DIR"/backup_*.tar.gz





