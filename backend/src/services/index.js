/**
 * Archivo de Índice de Servicios
 * ===============================
 * 
 * Este archivo centraliza todas las exportaciones de servicios
 * para facilitar los imports en otros archivos.
 * 
 * En lugar de importar desde múltiples archivos:
 * ```javascript
 * import aiSearchService from './services/aiSearch.js';
 * import { getCurrentLocation } from './services/location.js';
 * ```
 * 
 * Puedes importar desde este archivo:
 * ```javascript
 * import { aiSearchService, getCurrentLocation } from '@services';
 * ```
 * 
 * Esto hace el código más limpio y fácil de mantener.
 */

import aiSearchService from './aiSearch.js';  // Servicio de búsqueda con IA
import { getCurrentLocation, requestLocationPermission } from './location.js';  // Servicios de ubicación
import { searchImage } from './searchImage.js';  // Función de búsqueda de imágenes
import { storageService } from './storage.js';  // Servicio de almacenamiento
import { supabase } from './supabase.js';  // Cliente de Supabase

// Exportar todos los servicios para facilitar los imports
export {
    aiSearchService,  // Servicio de búsqueda con IA
    getCurrentLocation,  // Obtener ubicación actual
    requestLocationPermission,  // Solicitar permisos de ubicación
    searchImage,  // Buscar imágenes similares
    storageService,  // Servicio de almacenamiento de archivos
    supabase  // Cliente de Supabase
};


