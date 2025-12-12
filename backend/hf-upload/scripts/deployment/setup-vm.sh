#!/bin/bash

# Script de configuración inicial para la VM de Google Cloud
# Ejecuta este script la primera vez que configures la VM

set -e

echo "🔧 Configurando VM para PetAlert Backend..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Actualizar sistema
echo -e "${YELLOW}📦 Actualizando sistema...${NC}"
sudo apt-get update
sudo apt-get upgrade -y

# 2. Instalar dependencias básicas
echo -e "${YELLOW}📦 Instalando dependencias...${NC}"
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    htop \
    vim

# 3. Instalar Docker
echo -e "${YELLOW}🐳 Instalando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    
    echo -e "${GREEN}✅ Docker instalado${NC}"
else
    echo -e "${GREEN}✅ Docker ya está instalado${NC}"
fi

# 4. Instalar Docker Compose
echo -e "${YELLOW}🐳 Instalando Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose instalado${NC}"
else
    echo -e "${GREEN}✅ Docker Compose ya está instalado${NC}"
fi

# 5. Configurar usuario para Docker
echo -e "${YELLOW}👤 Configurando permisos de Docker...${NC}"
sudo usermod -aG docker $USER

# 6. Configurar swap (útil para modelos ML)
echo -e "${YELLOW}💾 Configurando swap...${NC}"
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo -e "${GREEN}✅ Swap de 2GB configurado${NC}"
else
    echo -e "${GREEN}✅ Swap ya está configurado${NC}"
fi

# 7. Configurar firewall (ufw)
echo -e "${YELLOW}🔥 Configurando firewall...${NC}"
sudo ufw --force enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8003/tcp  # Backend
sudo ufw status

# 8. Mostrar versiones instaladas
echo -e "\n${GREEN}✅ Configuración completada!${NC}\n"
echo "Versiones instaladas:"
echo "- Docker: $(docker --version)"
echo "- Docker Compose: $(docker-compose --version)"
echo "- Git: $(git --version)"

echo -e "\n${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "Cierra sesión y vuelve a conectarte para que los cambios de Docker surtan efecto:"
echo "  exit"
echo "  (luego vuelve a conectarte por SSH)"

echo -e "\n${YELLOW}Próximos pasos:${NC}"
echo "1. Vuelve a conectarte por SSH"
echo "2. Clona o sube tu proyecto"
echo "3. Configura el archivo .env"
echo "4. Ejecuta ./deploy-vm.sh"





