/**
 * Configuración del Backend
 * =========================
 * 
 * Este módulo centraliza toda la configuración relacionada con el backend:
 * - URL base del backend (con prioridad de variables de entorno)
 * - Endpoints disponibles de la API
 * - Funciones helper para construir URLs
 * - Headers para túneles (Cloudflare, etc.)
 * 
 * La URL del backend se determina con esta prioridad:
 * 1. EXPO_PUBLIC_BACKEND_URL (variable de entorno explícita)
 * 2. EXPO_PUBLIC_TUNNEL_URL (URL de túnel si está configurada)
 * 3. NETWORK_CONFIG.BACKEND_URL (configuración de red local)
 * 4. http://127.0.0.1:8003 (localhost por defecto)
 */

import { NETWORK_CONFIG } from './network';  // Configuración de red local

// =========================
// URL Base del Backend
// =========================
// URL base del backend - prioridad: variable de entorno > red local > localhost
// Esta URL se usa como prefijo para todos los endpoints de la API
const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||  // Variable de entorno explícita (máxima prioridad)
  process.env.EXPO_PUBLIC_TUNNEL_URL ||  // URL de túnel (Cloudflare, etc.)
  NETWORK_CONFIG?.BACKEND_URL ||  // Configuración de red local detectada automáticamente
  'http://127.0.0.1:8003';  // Localhost por defecto (puerto 8003 es el default de FastAPI)

// Log de depuración para ver qué URL se está usando
console.log('🔧 [BACKEND CONFIG]');
console.log('   EXPO_PUBLIC_BACKEND_URL:', process.env.EXPO_PUBLIC_BACKEND_URL || '(no definida)');
console.log('   EXPO_PUBLIC_TUNNEL_URL:', process.env.EXPO_PUBLIC_TUNNEL_URL || '(no definida)');
console.log('   NETWORK_CONFIG.BACKEND_URL:', NETWORK_CONFIG?.BACKEND_URL || '(no definida)');
console.log('   BACKEND_URL final:', BACKEND_URL);

// Endpoints disponibles
const ENDPOINTS = {
  HEALTH: '/health',
  AI_SEARCH: '/ai-search',
  AI_SEARCH_HEALTH: '/ai-search/health',
  AUTO_MATCH: '/reports/auto-match',
  SAVE_LABELS: '/reports/{report_id}/labels',
  REPORTS: '/reports/',
  REPORTS_BY_ID: '/reports/{report_id}',
  REPORTS_RESOLVE: '/reports/{report_id}/resolve',
  MATCHES_PENDING: '/matches/pending',
  MATCHES_UPDATE: '/matches/{match_id}/status',
  // Embeddings
  EMBEDDINGS_GENERATE: '/embeddings/generate',
  EMBEDDINGS_INDEX: '/embeddings/index/{report_id}',
  EMBEDDINGS_SEARCH: '/embeddings/search_image',
  // RAG (Retrieval Augmented Generation)
  RAG_SEARCH: '/rag/search',
  RAG_SEARCH_WITH_LOCATION: '/rag/search-with-location',
  RAG_SAVE_EMBEDDING: '/rag/save-embedding/{report_id}',
  RAG_GET_EMBEDDING: '/rag/embedding/{report_id}',
  RAG_HAS_EMBEDDING: '/rag/has-embedding/{report_id}',
  RAG_STATS: '/rag/stats'
};

/**
 * Construye la URL completa para un endpoint
 * @param {string} endpoint - Nombre del endpoint
 * @param {Object} params - Parámetros para reemplazar en la URL
 * @returns {string} URL completa
 */
const buildUrl = (endpoint, params = {}) => {
  const endpointPath = ENDPOINTS[endpoint] ?? endpoint;

  let url;
  if (endpointPath.startsWith('http://') || endpointPath.startsWith('https://')) {
    url = endpointPath;
  } else {
    url = `${BACKEND_URL}${endpointPath}`;
  }
  
  // Sufstituir parámetros en la URL
  Object.keys(params).forEach(key => {
    url = url.replace(`{${key}}`, params[key]);
  });
  
  return url;
};

/**
 * Agrega headers necesarios para túneles (Cloudflare, etc)
 * @param {Object} headers - Headers existentes (opcional)
 * @returns {Object} Headers con configuración de túnel si es necesario
 */
const getTunnelHeaders = (headers = {}) => {
  const isTunnel = BACKEND_URL.includes('trycloudflare.com');
  
  // Cloudflare Tunnel no requiere headers especiales
  // Esta función se mantiene para compatibilidad futura
  return headers;
};

export {
  BACKEND_URL, buildUrl, ENDPOINTS, getTunnelHeaders
};

