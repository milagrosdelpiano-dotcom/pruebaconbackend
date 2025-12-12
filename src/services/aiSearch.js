/**
 * Servicio de Búsqueda con IA
 * ============================
 * 
 * Este servicio maneja las búsquedas inteligentes de mascotas usando IA.
 * Permite buscar coincidencias visuales subiendo una imagen de una mascota.
 * 
 * El proceso es:
 * 1. Usuario sube una imagen
 * 2. Se envía al backend con coordenadas del usuario
 * 3. El backend genera un embedding con MegaDescriptor
 * 4. Busca reportes similares usando búsqueda vectorial
 * 5. Retorna los mejores matches ordenados por score
 */

import { buildUrl, getTunnelHeaders } from '../config/backend.js';

/**
 * Servicio de búsqueda con IA para encontrar mascotas
 * 
 * Este servicio se comunica con el endpoint /ai-search del backend
 * para realizar búsquedas visuales inteligentes.
 */
const aiSearchService = {
  /**
   * Busca coincidencias usando IA basada en una imagen
   * 
   * @param {Object} searchParams - Parámetros de búsqueda
   * @param {string} searchParams.imageUri - URI de la imagen a buscar (local o remota)
   * @param {number} searchParams.userLatitude - Latitud del usuario
   * @param {number} searchParams.userLongitude - Longitud del usuario
   * @param {number} searchParams.radiusKm - Radio de búsqueda en kilómetros (default: 10)
   * @param {string} searchParams.searchType - Tipo de búsqueda: 'lost', 'found', o 'both' (default: 'both')
   * @param {Object} searchParams.analysisData - Datos de análisis previos (opcional)
   * 
   * @returns {Promise<Object>} Resultados de la búsqueda con:
   *   - success: boolean indicando si fue exitoso
   *   - data: { analysis, matches, searchMetadata, totalResults }
   *   - error: mensaje de error si falló
   * 
   * Flujo:
   * 1. Prepara FormData con la imagen y parámetros
   * 2. Envía petición POST al backend /ai-search
   * 3. El backend genera embedding y busca matches
   * 4. Retorna los resultados ordenados por score
   */
  searchMatches: async (searchParams) => {
    try {
      // Extraer parámetros con valores por defecto
      const {
        imageUri,  // URI de la imagen (requerida)
        userLatitude,  // Latitud del usuario (requerida)
        userLongitude,  // Longitud del usuario (requerida)
        radiusKm = 10,  // Radio de búsqueda en km (default: 10km)
        searchType = 'both',  // Tipo: 'lost', 'found', o 'both' (default: 'both')
        analysisData = null  // Datos de análisis previos (opcional)
      } = searchParams;

      // Los embeddings se generan automáticamente en el backend
      // No necesitamos enviar análisis previo, el backend lo hace todo
      const analysis = analysisData || {};

      // =========================
      // Preparar FormData
      // =========================
      // FormData es necesario para enviar archivos (imágenes)
      const searchData = new FormData();
      
      // Agregar la imagen al FormData
      // En React Native, FormData acepta objetos con uri, type, y name
      searchData.append("file", {
        uri: imageUri,  // URI de la imagen (puede ser local file:// o remota https://)
        type: "image/jpeg",  // Tipo MIME de la imagen
        name: "search.jpg",  // Nombre del archivo
      });
      
      // Agregar parámetros de búsqueda como strings
      searchData.append("user_lat", userLatitude.toString());
      searchData.append("user_lng", userLongitude.toString());
      searchData.append("radius_km", radiusKm.toString());
      searchData.append("search_type", searchType);

      // =========================
      // Configurar timeout
      // =========================
      // Timeout de 90 segundos para búsquedas con IA
      // Las búsquedas con IA pueden tardar porque:
      // - Generar embedding puede tardar 1-3 segundos
      // - Búsqueda vectorial puede tardar varios segundos
      // - Procesar múltiples candidatos puede tardar
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);  // 90 segundos
      
      // =========================
      // Enviar petición
      // =========================
      let response;
      try {
        // Hacer petición POST al endpoint /ai-search
        response = await fetch(buildUrl('AI_SEARCH'), {
          method: "POST",
          body: searchData,  // FormData con imagen y parámetros
          headers: getTunnelHeaders(),  // Headers para túnel (si aplica)
          signal: controller.signal  // Para poder cancelar si hay timeout
          // No especificar Content-Type para FormData en React Native
          // El navegador/React Native lo establece automáticamente con boundary
        });
        clearTimeout(timeoutId);  // Limpiar timeout si la petición completó
      } catch (error) {
        clearTimeout(timeoutId);  // Limpiar timeout en caso de error
        // Si el error es por timeout, dar mensaje más amigable
        if (error.name === 'AbortError') {
          throw new Error('La búsqueda tardó demasiado. Por favor intenta de nuevo.');
        }
        // Re-lanzar otros errores (red, DNS, etc.)
        throw error;
      }

      // =========================
      // Procesar respuesta
      // =========================
      // Verificar que la respuesta sea exitosa
      if (!response.ok) {
        // Intentar leer el mensaje de error del backend
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      // Parsear la respuesta JSON
      const data = await response.json();
      
      // Retornar resultados en formato estructurado
      return {
        success: true,
        data: {
          analysis: analysis,  // Datos de análisis (si se proporcionaron)
          matches: data.matches || [],  // Lista de matches encontrados
          searchMetadata: data.search_metadata || {},  // Metadatos de la búsqueda
          totalResults: data.matches ? data.matches.length : 0  // Total de resultados
        },
        error: null
      };
    } catch (error) {
      // Capturar cualquier error y retornar en formato estructurado
      console.error('Error en búsqueda IA:', error);
      return {
        success: false,
        data: null,
        error: error.message  // Mensaje de error
      };
    }
  },

  /**
   * Busca matches automáticos para un reporte específico
   * @param {string} reportId - ID del reporte
   * @param {number} radiusKm - Radio de búsqueda en km
   * @param {number} topK - Número máximo de resultados
   * @returns {Promise<Object>} Resultados del auto-match
   */
  getAutoMatches: async (reportId, radiusKm = 10, topK = 5) => {
    try {
      const response = await fetch(
        `${buildUrl('AUTO_MATCH')}?report_id=${reportId}&radius_km=${radiusKm}&top_k=${topK}`,
        {
          method: "GET",
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data,
        error: null
      };
    } catch (error) {
      console.error('Error obteniendo auto-matches:', error);
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  },

  /**
   * Guarda etiquetas de IA para un reporte
   * @param {string} reportId - ID del reporte
   * @param {Object} labelsData - Datos de etiquetas
   * @returns {Promise<Object>} Resultado de la operación
   */
  saveReportLabels: async (reportId, labelsData) => {
    try {
      const response = await fetch(buildUrl('SAVE_LABELS', { report_id: reportId }), {
        method: "POST",
        headers: getTunnelHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(labelsData),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data,
        error: null
      };
    } catch (error) {
      console.error('Error guardando etiquetas:', error);
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  },

  /**
   * Verifica el estado del backend
   * @returns {Promise<Object>} Estado del backend
   */
  checkBackendStatus: async () => {
    try {
      const response = await fetch(buildUrl('HEALTH'), {
        method: "GET",
        headers: getTunnelHeaders({
          'Content-Type': 'application/json',
        }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data,
        error: null
      };
    } catch (error) {
      console.error('Error verificando estado del backend:', error);
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  },

  /**
   * Calcula similitud entre dos conjuntos de etiquetas
   * @param {Array} labels1 - Primer conjunto de etiquetas
   * @param {Array} labels2 - Segundo conjunto de etiquetas
   * @returns {number} Puntuación de similitud (0-100)
   */
  calculateLabelSimilarity: (labels1, labels2) => {
    if (!labels1 || !labels2 || labels1.length === 0 || labels2.length === 0) {
      return 0;
    }

    const set1 = new Set(labels1.map(label => 
      typeof label === 'string' ? label.toLowerCase() : label.label?.toLowerCase()
    ));
    const set2 = new Set(labels2.map(label => 
      typeof label === 'string' ? label.toLowerCase() : label.label?.toLowerCase()
    ));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;

    return Math.round((intersection.size / union.size) * 100);
  },

  /**
   * Calcula similitud de colores
   * @param {Array} colors1 - Primer conjunto de colores
   * @param {Array} colors2 - Segundo conjunto de colores
   * @returns {number} Puntuación de similitud (0-100)
   */
  calculateColorSimilarity: (colors1, colors2) => {
    if (!colors1 || !colors2 || colors1.length === 0 || colors2.length === 0) {
      return 0;
    }

    // Convertir colores hex a RGB y calcular similitud
    const rgb1 = colors1.map(color => hexToRgb(color));
    const rgb2 = colors2.map(color => hexToRgb(color));

    let maxSimilarity = 0;
    
    for (const c1 of rgb1) {
      for (const c2 of rgb2) {
        if (c1 && c2) {
          const similarity = calculateColorDistance(c1, c2);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }
      }
    }

    return Math.round(maxSimilarity);
  }
};

/**
 * Convierte color hex a RGB
 * @param {string} hex - Color en formato hex
 * @returns {Object|null} Objeto con r, g, b
 */
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calcula distancia entre dos colores RGB
 * @param {Object} color1 - Primer color RGB
 * @param {Object} color2 - Segundo color RGB
 * @returns {number} Similitud (0-100)
 */
function calculateColorDistance(color1, color2) {
  const rDiff = Math.abs(color1.r - color2.r);
  const gDiff = Math.abs(color1.g - color2.g);
  const bDiff = Math.abs(color1.b - color2.b);
  
  const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
  const maxDistance = Math.sqrt(255 * 255 * 3);
  
  return Math.round((1 - distance / maxDistance) * 100);
}

export default aiSearchService;
