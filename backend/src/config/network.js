/**
 * Configuración de Red para Desarrollo
 * =====================================
 * 
 * Este módulo contiene la configuración de red local para desarrollo.
 * Permite conectar el frontend móvil con el backend que corre en la computadora local.
 * 
 * IMPORTANTE: Cambia la IP según tu configuración de red local.
 * 
 * Para encontrar tu IP:
 * - Windows: ejecuta 'ipconfig' en PowerShell/CMD y busca "IPv4 Address"
 * - Mac/Linux: ejecuta 'ifconfig' o 'ip addr' y busca la IP de tu interfaz de red
 * 
 * La IP debe ser la de tu computadora en la red local (no localhost/127.0.0.1)
 * porque el dispositivo móvil necesita acceder a través de la red.
 */

// =========================
// Configuración de Red
// =========================
// IP de tu computadora en la red local
// Para encontrar tu IP: ejecuta 'ipconfig' en Windows o 'ifconfig' en Mac/Linux
// Ejemplo: '192.168.1.100' o '192.168.0.204'
export const NETWORK_CONFIG = {
  // Cambia esta IP por la IP de tu computadora en la red local
  // Esta IP debe ser accesible desde el dispositivo móvil en la misma red WiFi
  BACKEND_IP: '192.168.0.204',
  
  // Puerto del backend (FastAPI corre en el puerto 8003 por defecto)
  BACKEND_PORT: 8003,
  
  // URLs completas (getters para construir URLs dinámicamente)
  get BACKEND_URL() {
    // Construir URL completa: http://IP:PUERTO
    return `http://${this.BACKEND_IP}:${this.BACKEND_PORT}`;
  },
  
  get EMBEDDINGS_URL() {
    // URL del endpoint de embeddings
    return `${this.BACKEND_URL}/embeddings`;
  }
};

/**
 * Obtiene la IP local automáticamente (solo para desarrollo web)
 * 
 * @returns {string} IP local o la IP configurada en NETWORK_CONFIG
 * 
 * Esta función intenta detectar la IP automáticamente cuando se ejecuta
 * en un navegador web. Para React Native, siempre usa NETWORK_CONFIG.BACKEND_IP.
 */
export const getLocalIP = () => {
  // Solo funciona en navegador web (no en React Native)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    // Si el hostname no es localhost, usarlo como IP
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return hostname;
    }
  }
  // Fallback: usar la IP configurada en NETWORK_CONFIG
  return NETWORK_CONFIG.BACKEND_IP;
};
