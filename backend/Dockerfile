# Dockerfile para PetAlert Backend
FROM python:3.11-slim

# Instalar dependencias del sistema necesarias para PyTorch y otras librerías
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar requirements y instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del backend
COPY . .

# Crear directorio para logs
RUN mkdir -p /app/logs

# Exponer el puerto (Fly.io usa 8003)
EXPOSE 8003

# Variable de entorno para producción
ENV PYTHONUNBUFFERED=1
ENV GENERATE_EMBEDDINGS_LOCALLY=true
ENV PORT=8003

# Comando para iniciar el servidor
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8003}





