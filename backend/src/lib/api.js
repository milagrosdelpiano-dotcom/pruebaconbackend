/**
 * Utilidad de API para Subir Imágenes
 * ====================================
 * 
 * Este módulo proporciona funciones helper para hacer peticiones HTTP,
 * especialmente para subir imágenes al backend.
 * 
 * Funcionalidades:
 * - Subir imágenes al backend usando FormData
 * - Construir URLs del backend automáticamente
 * - Manejo de errores de subida
 */

// src/lib/api.js
import { NETWORK_CONFIG } from '../config/network.js';  // Configuración de red
import { BACKEND_URL } from '../config/backend.js';  // URL del backend

// URL base de la API
// Prioridad: variable de entorno > BACKEND_URL > NETWORK_CONFIG
export const API_URL = process.env.EXPO_PUBLIC_API_URL || BACKEND_URL || NETWORK_CONFIG.BACKEND_URL;

/**
 * Sube una imagen al backend
 * 
 * @param {string} endpoint - Endpoint del backend (ej: '/ai-search')
 * @param {object} imageData - Datos de la imagen
 * @param {string} imageData.uri - URI de la imagen (local file://)
 * @param {string} imageData.name - Nombre del archivo (default: "photo.jpg")
 * @param {string} imageData.type - Tipo MIME (default: "image/jpeg")
 * @returns {Promise<object>} Respuesta JSON del backend
 * 
 * Esta función:
 * 1. Crea un FormData con la imagen
 * 2. Hace una petición POST al endpoint
 * 3. Retorna la respuesta parseada como JSON
 * 
 * Ejemplo:
 * ```javascript
 * const result = await postImage('/ai-search', {
 *   uri: 'file:///path/to/image.jpg',
 *   name: 'search.jpg'
 * });
 * ```
 */
export async function postImage(endpoint, { uri, name = "photo.jpg", type = "image/jpeg" }) {
  // Crear FormData para enviar la imagen
  const form = new FormData();
  // Agregar la imagen al FormData
  // En React Native, FormData acepta objetos con uri, name, y type
  form.append("file", { uri, name, type });
  
  // Headers para la petición
  // Cloudflare Tunnel no requiere headers especiales
  const headers = {};
  // No establecer Content-Type manualmente; fetch agregará el boundary de multipart automáticamente
  
  // Hacer petición POST al backend
  const res = await fetch(`${API_URL}${endpoint}`, { 
    method: "POST", 
    body: form,  // FormData con la imagen
    headers: headers
  });
  
  // Verificar que la respuesta sea exitosa
  if (!res.ok) {
    // Intentar leer el mensaje de error del backend
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed ${res.status}: ${text}`);
  }
  
  // Parsear y retornar la respuesta JSON
  return res.json();
}
