/**
 * Función de Búsqueda de Imágenes
 * =================================
 * 
 * Esta función permite buscar mascotas similares subiendo una imagen.
 * Se comunica con el endpoint /embeddings/search_image del backend.
 * 
 * Funcionalidades:
 * - Sube una imagen al backend
 * - El backend genera un embedding y busca matches
 * - Retorna resultados ordenados por similitud
 * - Maneja reintentos automáticos en caso de errores de red
 * - Timeout configurable para operaciones largas
 * 
 * @param {string} baseUrl - URL base del backend (opcional)
 * @param {string} fileUri - URI de la imagen a buscar (local file://)
 * @param {number} lat - Latitud del usuario (opcional, para filtrar por distancia)
 * @param {number} lng - Longitud del usuario (opcional, para filtrar por distancia)
 * @param {number} maxKm - Radio máximo de búsqueda en kilómetros (opcional)
 * @param {number} retryCount - Número de reintentos realizados (interno, no pasar manualmente)
 * @returns {Promise<Object>} Resultados de la búsqueda con matches encontrados
 */

import { NETWORK_CONFIG } from '../config/network.js';  // Configuración de red
import { BACKEND_URL, getTunnelHeaders } from '../config/backend.js';  // Configuración del backend

export async function searchImage(baseUrl = BACKEND_URL || NETWORK_CONFIG.BACKEND_URL, fileUri, lat, lng, maxKm, retryCount = 0) {
  // =========================
  // Configuración
  // =========================
  const MAX_RETRIES = 2;  // Número máximo de reintentos en caso de error
  const TIMEOUT_MS = 90000;  // 90 segundos para dar tiempo al modelo de generar embedding
  
  try {
    const form = new FormData();
    // @ts-expect-error RN FormData file
    form.append("file", { uri: fileUri, name: "query.jpg", type: "image/jpeg" });
    const q = new URLSearchParams({ top_k: "10" });
    if (lat !== undefined && lng !== undefined && maxKm) {
      q.set("lat", String(lat));
      q.set("lng", String(lng));
      q.set("max_km", String(maxKm));
    }
    
    // Crear timeout manual ya que React Native fetch no soporta timeout nativo
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    try {
      const res = await fetch(`${baseUrl}/embeddings/search_image?${q.toString()}`, { 
        method: "POST", 
        body: form,
        headers: getTunnelHeaders(),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Error desconocido');
        throw new Error(`Error del servidor (${res.status}): ${errorText}`);
      }
      
      return await res.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    // Si es un error de timeout o red, intentar retry
    if ((error.name === 'AbortError' || error.message.includes('Network') || error.message.includes('Failed to fetch')) && retryCount < MAX_RETRIES) {
      console.log(`⚠️ Error en búsqueda, reintentando (${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos antes de reintentar
      return searchImage(baseUrl, fileUri, lat, lng, maxKm, retryCount + 1);
    }
    
    // Si ya no hay más reintentos o es otro tipo de error
    if (error.name === 'AbortError') {
      throw new Error('La búsqueda tardó demasiado. El servidor puede estar procesando muchas solicitudes. Intenta de nuevo en unos momentos.');
    }
    
    throw error;
  }
}
