/**
 * Configuración de Variables de Entorno
 * ======================================
 * 
 * Este módulo centraliza la configuración de variables de entorno
 * y proporciona valores por defecto para desarrollo.
 * 
 * IMPORTANTE: Para producción, configura las variables de entorno
 * en un archivo .env o en las variables de entorno del sistema.
 * 
 * Variables de entorno soportadas:
 * - EXPO_PUBLIC_SUPABASE_URL: URL de tu proyecto Supabase
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY: Clave anónima de Supabase
 * - EXPO_PUBLIC_APP_NAME: Nombre de la aplicación
 * - EXPO_PUBLIC_APP_VERSION: Versión de la aplicación
 * - EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: API key de Google Maps (opcional)
 */

// Configuración de variables de entorno para PetAlert App
// Este archivo debe ser configurado con las credenciales reales de Supabase

export const config = {
  // =========================
  // Configuración de Supabase
  // =========================
  // SUPABASE - Base de datos
  // Reemplaza estos valores con tus credenciales reales de Supabase
  // O configura las variables de entorno EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY
  supabase: {
    // URL de tu proyecto Supabase (ej: https://xxxxx.supabase.co)
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://eamsbroadstwkrkjcuvo.supabase.co',
    // Clave anónima de Supabase (pública, segura para usar en el frontend)
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhbXNicm9hZHN0d2tya2pjdXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MjQ3ODgsImV4cCI6MjA3NTMwMDc4OH0.bzFaxK25SPMKE5REMxRyK9jPj1n8ocDrn_u6qyMTXEw',
  },
  
  // =========================
  // Configuración de la Aplicación
  // =========================
  app: {
    // Nombre de la aplicación
    name: process.env.EXPO_PUBLIC_APP_NAME || 'PetAlert',
    // Versión de la aplicación
    version: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
  },
  
  // =========================
  // Configuración de Mapas
  // =========================
  // Configuración de mapas (opcional)
  // Google Maps API Key solo es necesario si usas Google Maps
  // React Native Maps no requiere API key
  maps: {
    googleApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  },
  
  // =========================
  // Configuración por Defecto
  // =========================
  defaults: {
    searchRadius: 5000,  // Radio de búsqueda por defecto en metros (5km)
    maxPhotosPerPet: 5,  // Máximo de fotos por mascota
    maxPhotosPerReport: 3,  // Máximo de fotos por reporte
  }
};

// Función para verificar si la configuración está completa
export const isConfigValid = () => {
  const hasValidUrl = config.supabase.url && 
                     config.supabase.url !== 'https://tu-proyecto.supabase.co' &&
                     config.supabase.url.includes('supabase.co');
  const hasValidKey = config.supabase.anonKey && 
                     config.supabase.anonKey !== 'tu-clave-anonima-aqui' &&
                     config.supabase.anonKey.length > 50;
  
  return hasValidUrl && hasValidKey;
};

// Función para obtener mensaje de configuración
export const getConfigMessage = () => {
  if (!isConfigValid()) {
    return {
      type: 'warning',
      title: 'Configuración requerida',
      message: 'Por favor, configura las credenciales de Supabase en src/config/env.js o crea un archivo .env con EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY'
    };
  }
  return null;
};

export default config;





