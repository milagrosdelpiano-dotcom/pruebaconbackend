/**
 * Servicio de API para comunicarse con el backend
 * ================================================
 * 
 * Este servicio centraliza todas las peticiones HTTP al backend FastAPI.
 * Proporciona métodos para hacer peticiones GET, POST, PUT, DELETE con:
 * - Manejo de errores consistente
 * - Timeouts configurables
 * - Logging de peticiones y respuestas
 * - Soporte para URLs de túnel (Cloudflare)
 * - Validación de respuestas JSON
 * 
 * El backend está en FastAPI y corre en el puerto 8003 por defecto.
 * Se puede configurar la URL en las variables de entorno o en config/backend.js
 */

import { BACKEND_URL, ENDPOINTS, buildUrl } from '../config/backend';

/**
 * Clase principal del servicio de API
 * 
 * Esta clase encapsula toda la lógica de comunicación con el backend.
 * Usa fetch() nativo de JavaScript para hacer peticiones HTTP.
 */
class ApiService {
  /**
   * Constructor - inicializa el servicio con la URL del backend
   */
  constructor() {
    // URL base del backend (ej: http://localhost:8003 o https://tunel.trycloudflare.com)
    this.baseUrl = BACKEND_URL;
    console.log('🔧 Backend URL configurada:', this.baseUrl);
  }

  /**
   * Realiza una petición HTTP al backend
   * 
   * Este es el método principal que todas las demás funciones usan.
   * Maneja la construcción de URLs, headers, timeouts, y parsing de respuestas.
   * 
   * @param {string|object} endpoint - Endpoint como string o objeto con endpoint y params
   * @param {object} options - Opciones de fetch (method, body, headers, etc.)
   * @returns {Promise<{data: any, error: Error|null}>}
   * 
   * Ejemplo:
   * ```javascript
   * const { data, error } = await apiService.request('/reports', {
   *   method: 'POST',
   *   body: JSON.stringify({ pet_name: 'Max' })
   * });
   * ```
   */
  async request(endpoint, options = {}) {
    let url;
    
    // Construir la URL completa
    if (typeof endpoint === 'string') {
      // Si es una cadena simple (ej: '/reports')
      // Verificar si ya es una URL completa (empieza con http:// o https://)
      if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        url = endpoint;  // Usar tal cual si ya es completa
      } else {
        // Agregar la URL base del backend
        url = `${this.baseUrl}${endpoint}`;
      }
    } else {
      // Si es un objeto con endpoint y params, usar buildUrl para construir la URL
      // buildUrl maneja query parameters, path parameters, etc.
      url = buildUrl(endpoint.endpoint, endpoint.params);
    }
    
    // Detectar si estamos usando un túnel de Cloudflare
    // Los túneles tienen URLs como: https://xxxx.trycloudflare.com
    const isTunnel = url.includes('trycloudflare.com');
    
    // Preparar headers base
    // Cloudflare Tunnel no requiere headers especiales, pero podríamos agregarlos aquí
    const baseHeaders = {
      // Cloudflare Tunnel no requiere headers especiales
    };
    
    // Configurar Content-Type automáticamente si no se especificó
    // Solo para JSON, no para FormData (que se usa para subir archivos)
    if (!options.headers || !options.headers['Content-Type']) {
      // Solo agregar Content-Type si el body es JSON (no FormData)
      // FormData establece su propio Content-Type con boundary
      if (options.body && typeof options.body === 'string' && !options.body.includes('FormData')) {
        baseHeaders['Content-Type'] = 'application/json';
      }
    }
    
    // Combinar headers: primero los base, luego los del usuario (estos sobrescriben)
    // Esto permite que el usuario especifique headers personalizados
    const finalHeaders = {
      ...baseHeaders,
      ...(options.headers || {})
    };
    
    // Combinar todas las opciones finales
    const finalOptions = {
      ...options,
      headers: finalHeaders
    };

    try {
      console.log(`🌐 API Request: ${finalOptions.method || 'GET'} ${url}`);
      console.log(`🔗 URL completa: ${url}`);
      console.log(`📦 Body:`, finalOptions.body ? finalOptions.body.substring(0, 200) : 'No body');
      
      // Timeout de 60 segundos para requests normales
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      let response;
      try {
        response = await fetch(url, {
          ...finalOptions,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('La solicitud tardó demasiado. Por favor intenta de nuevo.');
        }
        throw error;
      }
      
      // Verificar el Content-Type antes de parsear JSON
      const contentType = response.headers.get('content-type');
      let responseText = await response.text();
      
      if (!response.ok) {
        // Si es HTML, es probablemente una página de error
        if (contentType && contentType.includes('text/html')) {
          throw new Error(`HTTP ${response.status}: El backend devolvió HTML en lugar de JSON. Verifica que el endpoint esté correcto y que el backend esté corriendo.`);
        }
        throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`);
      }

      // Verificar que sea JSON antes de parsear
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Respuesta no es JSON (Content-Type: ${contentType}). Respuesta: ${responseText.substring(0, 200)}`);
      }

      const data = JSON.parse(responseText);
      console.log(`✅ API Response: ${url}`, data);
      
      return { data, error: null };
    } catch (error) {
      console.error(`❌ API Error: ${url}`, error);
      return { data: null, error };
    }
  }

  /**
   * Verifica el estado del backend
   */
  async health() {
    return this.request(ENDPOINTS.HEALTH);
  }

  /**
   * Obtiene información de la versión
   */
  async version() {
    return this.request(ENDPOINTS.VERSION);
  }

  /**
   * Verifica el estado de Supabase
   */
  async supabaseStatus() {
    return this.request(ENDPOINTS.SUPABASE_STATUS);
  }

  /**
   * Obtiene todos los reportes
   */
  async getAllReports() {
    return this.request(ENDPOINTS.REPORTS);
  }

  /**
   * Obtiene reportes cercanos
   */
  async getNearbyReports(latitude, longitude, radiusKm = 10) {
    const url = `${buildUrl(ENDPOINTS.REPORTS_NEARBY)}?lat=${latitude}&lng=${longitude}&radius_km=${radiusKm}`;
    return this.request(url);
  }

  /**
   * Obtiene un reporte por ID
   */
  async getReportById(reportId) {
    return this.request({
      endpoint: ENDPOINTS.REPORTS_BY_ID,
      params: { report_id: reportId }
    });
  }

  /**
   * Crea un nuevo reporte
   */
  async createReport(reportData) {
    return this.request(ENDPOINTS.REPORTS, {
      method: 'POST',
      body: JSON.stringify(reportData)
    });
  }

  /**
   * Actualiza un reporte
   */
  async updateReport(reportId, updates) {
    return this.request({
      endpoint: ENDPOINTS.REPORTS_BY_ID,
      params: { report_id: reportId }
    }, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  /**
   * Resuelve un reporte
   */
  async resolveReport(reportId) {
    return this.request({
      endpoint: ENDPOINTS.REPORTS_RESOLVE,
      params: { report_id: reportId }
    }, {
      method: 'POST'
    });
  }

  /**
   * Elimina un reporte
   */
  async deleteReport(reportId) {
    return this.request({
      endpoint: ENDPOINTS.REPORTS_BY_ID,
      params: { report_id: reportId }
    }, {
      method: 'DELETE'
    });
  }

  /**
   * Auto-matching de reportes
   */
  async autoMatch(reportId, radiusKm = 10, topK = 5) {
    const url = `${buildUrl('AUTO_MATCH')}?report_id=${reportId}&radius_km=${radiusKm}&top_k=${topK}`;
    return this.request(url);
  }

  /**
   * Obtiene coincidencias pendientes para un reporte
   */
  async getMatchesForReport(reportId) {
    const url = `${buildUrl('MATCHES_PENDING')}?report_id=${reportId}`;
    return this.request(url);
  }

  /**
   * Busca coincidencias directamente usando embeddings
   */
  async findDirectMatches(reportId, matchThreshold = 0.7, topK = 10) {
    const url = `${this.baseUrl}/direct-matches/find/${reportId}?match_threshold=${matchThreshold}&top_k=${topK}`;
    return this.request(url, {
      method: 'POST'
    });
  }

  /**
   * Guarda etiquetas de un reporte
   */
  async saveLabels(reportId, labels) {
    return this.request({
      endpoint: ENDPOINTS.SAVE_LABELS,
      params: { report_id: reportId }
    }, {
      method: 'POST',
      body: JSON.stringify({ labels })
    });
  }
}

// Crear instancia singleton
const apiService = new ApiService();

export default apiService;
