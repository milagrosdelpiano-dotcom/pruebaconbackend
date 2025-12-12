/**
 * Servicio de Supabase - Cliente principal para interactuar con la base de datos
 * ==============================================================================
 * 
 * Este archivo configura y exporta todas las funciones para interactuar con Supabase:
 * - Autenticación (login, registro, logout)
 * - CRUD de reportes (crear, leer, actualizar, eliminar)
 * - Gestión de mascotas
 * - Mensajería y conversaciones
 * - Búsqueda y filtrado
 * 
 * Supabase es una base de datos PostgreSQL con funciones adicionales como:
 * - Autenticación integrada
 * - Storage para archivos (imágenes)
 * - Realtime para actualizaciones en tiempo real
 * - RPC para funciones personalizadas
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';  // Almacenamiento seguro para tokens
import Constants from 'expo-constants';  // Constantes de Expo (URLs, configuración)
import apiService from './api';  // Servicio para llamadas al backend

// Configuración de Supabase desde variables de entorno o valores por defecto
// Estas credenciales son públicas (anon key) y seguras para usar en el frontend
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://eamsbroadstwkrkjcuvo.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhbXNicm9hZHN0d2tya2pjdXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MjQ3ODgsImV4cCI6MjA3NTMwMDc4OH0.bzFaxK25SPMKE5REMxRyK9jPj1n8ocDrn_u6qyMTXEw';

// Validar configuración
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Las credenciales de Supabase no están configuradas correctamente');
  console.error('URL:', supabaseUrl ? '✅ Configurada' : '❌ Faltante');
  console.error('Key:', supabaseAnonKey ? '✅ Configurada' : '❌ Faltante');
}

console.log('🔧 Configuración de Supabase:');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'No configurada');

/**
 * Adaptador de almacenamiento para Supabase usando Expo SecureStore
 * 
 * SecureStore es un almacenamiento seguro que encripta los datos en el dispositivo.
 * Se usa para guardar tokens de autenticación de forma segura.
 * 
 * Este adaptador permite que Supabase use SecureStore en lugar del localStorage
 * (que no está disponible en React Native).
 */
const ExpoSecureStoreAdapter = {
  getItem: (key) => {
    return SecureStore.getItemAsync(key);  // Obtener un valor guardado
  },
  setItem: (key, value) => {
    SecureStore.setItemAsync(key, value);  // Guardar un valor
  },
  removeItem: (key) => {
    SecureStore.deleteItemAsync(key);  // Eliminar un valor
  },
};

// Verificar que tenemos las credenciales necesarias
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Supabase URL y API Key son requeridos');
}

/**
 * Cliente principal de Supabase
 * 
 * Configuración:
 * - auth.storage: Usa SecureStore para guardar tokens de forma segura
 * - auth.autoRefreshToken: Renueva automáticamente el token cuando expira
 * - auth.persistSession: Guarda la sesión para que persista entre reinicios de la app
 * - auth.detectSessionInUrl: false porque React Native no usa URLs para autenticación
 * - db.schema: Esquema de la base de datos (por defecto 'public')
 * - realtime: Configuración para actualizaciones en tiempo real (máx 10 eventos/seg)
 */
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,  // Usar almacenamiento seguro
    autoRefreshToken: true,  // Renovar token automáticamente
    persistSession: true,  // Mantener sesión entre reinicios
    detectSessionInUrl: false,  // No detectar sesión en URL (solo web)
  },
  db: {
    schema: 'public',  // Esquema de la base de datos
  },
  // Configuración para actualizaciones en tiempo real
  realtime: {
    params: {
      eventsPerSecond: 10,  // Límite de eventos por segundo
    },
  },
});

/**
 * Función auxiliar para obtener la URL de redirección correcta después del login
 * 
 * Cuando un usuario se registra, Supabase envía un email de confirmación.
 * Al hacer clic en el enlace, necesita redirigir de vuelta a la app.
 * 
 * Esta función detecta automáticamente la URL correcta según el entorno:
 * - Desarrollo con túnel: usa la URL del túnel de Expo
 * - Desarrollo local: usa localhost
 * - Producción: usa la URL configurada en Expo
 * 
 * @param {string} path - Ruta dentro de la app (default: '/(auth)/login')
 * @returns {string} URL completa de redirección en formato exp://
 */
const getRedirectUrl = (path = '/(auth)/login') => {
  // Intentar obtener la URL del manifest de Expo (configuración de la app)
  const manifestUrl = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;
  
  if (manifestUrl) {
    // Si hay una URL del túnel (ej: vyofhco-idkjulii-8081.exp.direct)
    // Formato: exp://[host]/--[ruta]
    return `exp://${manifestUrl}/--${path}`;
  }
  
  // Fallback: usar localhost o IP local
  // Intentar detectar si estamos en desarrollo con túnel
  const debuggerHost = Constants.expoConfig?.debuggerHost || Constants.manifest?.debuggerHost;
  if (debuggerHost) {
    return `exp://${debuggerHost}/--${path}`;
  }
  
  // Último fallback: localhost por defecto
  return `exp://localhost:8081/--${path}`;
};

/**
 * Servicio de Autenticación
 * ==========================
 * 
 * Este objeto contiene todas las funciones relacionadas con autenticación:
 * - Registro de nuevos usuarios
 * - Login (inicio de sesión)
 * - Logout (cerrar sesión)
 * - Recuperación de contraseña
 * - Verificación de email
 * - Gestión de sesiones
 */
const authService = {
  /**
   * Registra un nuevo usuario en Supabase
   * 
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @param {string} fullName - Nombre completo del usuario
   * @returns {Promise<{data: any, error: Error|null}>}
   * 
   * Flujo:
   * 1. Obtiene la URL de redirección para el email de confirmación
   * 2. Crea el usuario en Supabase Auth
   * 3. Supabase envía un email de confirmación
   * 4. El perfil se crea automáticamente mediante un trigger en la base de datos
   * 
   * Nota: El usuario debe verificar su email antes de poder iniciar sesión
   */
  signUp: async (email, password, fullName) => {
    try {
      // Obtener la URL de redirección para cuando el usuario haga clic en el email
      // Esta URL debe apuntar de vuelta a la app móvil
      const redirectUrl = getRedirectUrl('/(auth)/login');
      console.log('🔗 URL de redirección para registro:', redirectUrl);

      // Crear el usuario en Supabase Auth
      // signUp crea el usuario y envía un email de confirmación automáticamente
      const { data, error } = await supabase.auth.signUp({
        email,  // Email del usuario
        password,  // Contraseña (Supabase la hashea automáticamente)
        options: {
          data: {
            // Metadatos adicionales del usuario (se guardan en user_metadata)
            full_name: fullName,
          },
          // URL a la que redirigir cuando el usuario haga clic en el email de confirmación
          emailRedirectTo: redirectUrl,
        },
      });
      
      // Si hay error (email ya existe, contraseña débil, etc.), lanzarlo
      if (error) throw error;
      
      // El perfil se crea automáticamente mediante un trigger en Supabase
      // Cuando se crea un usuario en auth.users, un trigger crea un registro en public.profiles
      // No necesitamos crearlo manualmente aquí
      
      // Retornar datos del usuario y null como error (éxito)
      return { data, error: null };
    } catch (error) {
      // Si hay cualquier error, retornar null como data y el error
      return { data: null, error };
    }
  },

  /**
   * Inicia sesión con email y contraseña
   * 
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<{data: {user, session}, error: Error|null}>}
   * 
   * Flujo:
   * 1. Verifica las credenciales con Supabase Auth
   * 2. Si son correctas, crea una sesión
   * 3. Retorna el usuario y la sesión (con tokens de autenticación)
   * 
   * La sesión se guarda automáticamente en SecureStore gracias a ExpoSecureStoreAdapter
   */
  signIn: async (email, password) => {
    try {
      // Iniciar sesión con Supabase Auth
      // signInWithPassword verifica las credenciales y crea una sesión
      const { data, error } = await supabase.auth.signInWithPassword({
        email,  // Email del usuario
        password,  // Contraseña (se compara con el hash guardado)
      });
      
      // Si hay error (credenciales incorrectas, usuario no existe, etc.), lanzarlo
      if (error) throw error;
      
      // Retornar datos (user y session) y null como error (éxito)
      // data.user contiene información del usuario
      // data.session contiene tokens de acceso y refresh
      return { data, error: null };
    } catch (error) {
      // Si hay cualquier error, retornar null como data y el error
      return { data: null, error };
    }
  },

  /**
   * Cierra la sesión del usuario actual
   * 
   * @returns {Promise<{error: Error|null}>}
   * 
   * Esta función:
   * 1. Cierra la sesión en Supabase Auth
   * 2. Elimina los tokens de autenticación del almacenamiento seguro
   * 3. El usuario deberá iniciar sesión nuevamente para acceder
   */
  signOut: async () => {
    try {
      // Cerrar sesión en Supabase
      // Esto elimina los tokens y la sesión del almacenamiento
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  /**
   * Obtiene el usuario actual autenticado
   * 
   * @returns {Promise<{user: User|null, error: Error|null}>}
   * 
   * Esta función obtiene el usuario actual desde Supabase Auth.
   * Verifica que el token sea válido y lo refresca si es necesario.
   */
  getCurrentUser: async () => {
    try {
      // Obtener el usuario actual
      // getUser() verifica el token y lo refresca automáticamente si es necesario
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { user, error: null };
    } catch (error) {
      return { user: null, error };
    }
  },

  /**
   * Obtiene la sesión actual
   * 
   * @returns {Promise<{session: Session|null, error: Error|null}>}
   * 
   * Esta función obtiene la sesión actual desde el almacenamiento local.
   * La sesión contiene tokens de acceso y refresh.
   */
  getSession: async () => {
    try {
      // Obtener la sesión actual desde el almacenamiento
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { session, error: null };
    } catch (error) {
      return { session: null, error };
    }
  },

  /**
   * Suscribe a cambios en el estado de autenticación
   * 
   * @param {function} callback - Función que se ejecuta cuando cambia el estado
   * @returns {object} Objeto con método unsubscribe() para cancelar la suscripción
   * 
   * Esta función permite escuchar cambios en el estado de autenticación:
   * - SIGNED_IN: Usuario inició sesión
   * - SIGNED_OUT: Usuario cerró sesión
   * - TOKEN_REFRESHED: Token fue renovado
   * - USER_UPDATED: Datos del usuario fueron actualizados
   * 
   * Ejemplo:
   * ```javascript
   * const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
   *   console.log('Auth state changed:', event);
   * });
   * // Más tarde, cancelar la suscripción:
   * subscription.unsubscribe();
   * ```
   */
  onAuthStateChange: (callback) => {
    // Retornar la suscripción de Supabase
    // El callback recibe (event, session) como parámetros
    return supabase.auth.onAuthStateChange(callback);
  },

  // Recuperar contraseña - Enviar email de recuperación
  resetPassword: async (email) => {
    try {
      const redirectUrl = getRedirectUrl('/(auth)/reset-password');
      console.log('🔗 URL de redirección para reset password:', redirectUrl);

      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Actualizar contraseña (después de recuperación)
  updatePassword: async (newPassword) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Reenviar email de confirmación
  resendConfirmation: async (email) => {
    try {
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Verificar si el email está confirmado
  checkEmailConfirmation: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { 
        isConfirmed: user?.email_confirmed_at !== null, 
        user,
        error: null 
      };
    } catch (error) {
      return { isConfirmed: false, user: null, error };
    }
  },

  // Actualizar perfil del usuario (metadata)
  updateUserMetadata: async (metadata) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: metadata,
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};

const profileService = {
  getProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  updateProfile: async (userId, updates) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Actualiza la ubicación del usuario en su perfil
   * 
   * @param {string} userId - ID del usuario
   * @param {number} latitude - Latitud
   * @param {number} longitude - Longitud
   * @returns {Promise<{data: object|null, error: Error|null}>}
   * 
   * Actualiza la ubicación del usuario usando formato PostGIS POINT.
   * Esto permite hacer búsquedas geográficas eficientes.
   */
  updateLocation: async (userId, latitude, longitude) => {
    try {
      // Actualizar la ubicación en formato PostGIS
      // Formato: POINT(lon lat) - PostGIS usa (longitud, latitud)
      const { data, error } = await supabase
        .from('profiles')
        .update({
          location: `POINT(${longitude} ${latitude})`,  // PostGIS format: POINT(lon lat)
        })
        .eq('id', userId);  // Filtrar por ID del usuario
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Asegura que un perfil existe para un usuario, creándolo si es necesario
   * 
   * @param {string} userId - ID del usuario
   * @param {object} userData - Datos iniciales del perfil (opcional)
   * @returns {Promise<{data: object|null, error: Error|null}>}
   * 
   * Esta función es útil cuando:
   * - Un usuario se registra pero el trigger de Supabase falló
   * - Necesitas asegurar que el perfil existe antes de actualizarlo
   * - Quieres crear un perfil con datos iniciales
   * 
   * Flujo:
   * 1. Verifica si el perfil existe
   * 2. Si existe, lo retorna
   * 3. Si no existe, lo crea con los datos proporcionados
   */
  ensureProfile: async (userId, userData = {}) => {
    try {
      // Primero, verificar si el perfil existe
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // If profile exists, return it
      if (existingProfile && !fetchError) {
        return { data: existingProfile, error: null };
      }

      // If profile doesn't exist, create it
      // Get user data from auth if available
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      const profileData = {
        id: userId,
        email: userData.email || authUser?.email || null,
        full_name: userData.full_name || authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Usuario',
        avatar_url: userData.avatar_url || null,
        phone: userData.phone || null,
        location: userData.location || null,
      };

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([profileData])
        .select()
        .single();

      if (insertError) {
        // If insert fails, it might be because profile was created between check and insert
        // Try fetching again
        const { data: retryProfile, error: retryError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (retryProfile && !retryError) {
          return { data: retryProfile, error: null };
        }
        throw insertError;
      }

      return { data: newProfile, error: null };
    } catch (error) {
      console.error('Error ensuring profile:', error);
      return { data: null, error };
    }
  },
};

/**
 * Servicio de Mascotas
 * ====================
 * 
 * Este servicio maneja todas las operaciones relacionadas con las mascotas
 * de los usuarios en la tabla 'pets' de Supabase.
 * 
 * Funcionalidades:
 * - CRUD de mascotas (crear, leer, actualizar, eliminar)
 * - Gestión de salud (vacunaciones, medicamentos, recordatorios)
 * - Historial de salud
 * - Marcar mascota como perdida/encontrada
 */
const petService = {
  /**
   * Obtiene todas las mascotas de un usuario
   * 
   * @param {string} userId - ID del usuario
   * @returns {Promise<{data: Array|null, error: Error|null}>}
   * 
   * Retorna todas las mascotas del usuario ordenadas por fecha de creación
   * (más recientes primero).
   */
  getUserPets: async (userId) => {
    try {
      // Consultar la tabla 'pets' filtrando por owner_id
      const { data, error } = await supabase
        .from('pets')  // Tabla de mascotas
        .select('*')  // Seleccionar todas las columnas
        .eq('owner_id', userId)  // Filtrar por ID del dueño
        .order('created_at', { ascending: false });  // Ordenar por fecha (más recientes primero)
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getPetById: async (petId) => {
    try {
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('id', petId)
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  createPet: async (petData) => {
    try {
      const { data, error } = await supabase
        .from('pets')
        .insert([petData])
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  updatePet: async (petId, updates) => {
    try {
      const { data, error } = await supabase
        .from('pets')
        .update(updates)
        .eq('id', petId)
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  deletePet: async (petId) => {
    try {
      const { error } = await supabase
        .from('pets')
        .delete()
        .eq('id', petId);
      
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  markAsLost: async (petId, isLost = true) => {
    try {
      const { data, error } = await supabase
        .from('pets')
        .update({ is_lost: isLost })
        .eq('id', petId)
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // ==============================================
  // FUNCIONES DE SALUD VETERINARIA (Backend API)
  // ==============================================
  
  // Obtener mascota con resumen de salud
  getPetWithHealth: async (petId) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      return { data: result.pet, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Historial de salud
  getHealthHistory: async (petId, limit = 50, offset = 0) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/health-history?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.history, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  addHealthEvent: async (petId, eventData) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/health-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.event, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Vacunaciones
  getVaccinations: async (petId) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/vaccinations`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.vaccinations, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  addVaccination: async (petId, vaccinationData) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/vaccinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vaccinationData)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.vaccination, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  updateVaccination: async (vaccinationId, updates) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/vaccinations/${vaccinationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.vaccination, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Medicamentos
  getMedications: async (petId, activeOnly = false) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/medications?active_only=${activeOnly}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.medications, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  addMedication: async (petId, medicationData) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medicationData)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.medication, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  updateMedication: async (medicationId, updates) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/medications/${medicationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.medication, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Indicadores de bienestar
  getWellnessIndicators: async (petId, limit = 30) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/wellness?limit=${limit}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.indicators, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  addWellnessIndicator: async (petId, indicatorData) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/wellness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(indicatorData)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.indicator, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Recordatorios
  getReminders: async (petId, activeOnly = true, upcomingOnly = false) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/reminders?active_only=${activeOnly}&upcoming_only=${upcomingOnly}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.reminders, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  createReminder: async (petId, reminderData) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminderData)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.reminder, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  completeReminder: async (reminderId) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/reminders/${reminderId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.reminder, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Documentos médicos
  getMedicalDocuments: async (petId) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/documents`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.documents, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  addMedicalDocument: async (petId, documentData) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentData)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.document, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Planes de cuidado
  getCarePlans: async (petId, activeOnly = false) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/care-plans?active_only=${activeOnly}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.care_plans, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  createCarePlan: async (petId, planData) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/${petId}/care-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.care_plan, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  updateChecklistItem: async (planId, itemId, updates) => {
    try {
      const { BACKEND_URL } = await import('../config/backend');
      const response = await fetch(`${BACKEND_URL}/pets/care-plans/${planId}/checklist/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.item, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};

// =========================
// Funciones Auxiliares
// =========================

/**
 * Calcula la distancia entre dos puntos geográficos usando la fórmula de Haversine
 * 
 * @param {number} lat1 - Latitud del primer punto (en grados)
 * @param {number} lon1 - Longitud del primer punto (en grados)
 * @param {number} lat2 - Latitud del segundo punto (en grados)
 * @param {number} lon2 - Longitud del segundo punto (en grados)
 * @returns {number} Distancia en metros entre los dos puntos
 * 
 * Esta función usa la fórmula de Haversine para calcular la distancia del círculo máximo
 * (great circle distance) entre dos puntos en una esfera.
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;  // Radio de la Tierra en metros
  // Convertir grados a radianes
  const φ1 = (lat1 * Math.PI) / 180;  // Latitud 1 en radianes
  const φ2 = (lat2 * Math.PI) / 180;  // Latitud 2 en radianes
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;  // Diferencia de latitud en radianes
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;  // Diferencia de longitud en radianes

  // Aplicar fórmula de Haversine
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Retornar distancia en metros
  return R * c;
};

/**
 * Función auxiliar para hacer llamadas RPC (Remote Procedure Call) a Supabase
 * 
 * @param {string} functionName - Nombre de la función RPC en Supabase
 * @param {object} params - Parámetros para pasar a la función RPC
 * @returns {Promise<{data: any, error: Error|null}>}
 * 
 * Esta función maneja llamadas RPC a funciones SQL almacenadas en Supabase.
 * Las funciones RPC permiten ejecutar lógica compleja en el servidor de base de datos.
 * 
 * Si falla la llamada RPC normal, intenta hacer una llamada directa usando fetch
 * como fallback (útil para problemas de configuración de API key).
 */
const rpcCall = async (functionName, params = {}) => {
  try {
    // Obtener la sesión actual para incluir el token de autenticación si existe
    // El token se usa para autenticar la llamada RPC si la función requiere autenticación
    const { data: { session } } = await supabase.auth.getSession();
    
    // Hacer la llamada RPC con el cliente configurado
    // supabase.rpc() ejecuta una función SQL almacenada en Supabase
    const { data, error } = await supabase.rpc(functionName, params);
    
    if (error) {
      console.error(
        `❌ Error en RPC ${functionName}:`,
        error,
        'params:',
        JSON.stringify(params),
        'session:',
        session?.user?.id || '(sin sesión)'
      );
      // Si el error es por falta de API key, intentar con fetch directo
      if (error.message && error.message.includes('API key')) {
        console.warn('⚠️ Intentando llamada RPC directa con fetch...');
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': session ? `Bearer ${session.access_token}` : `Bearer ${supabaseAnonKey}`,
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(params),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return { data, error: null };
      }
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    console.error(`❌ Error en rpcCall para ${functionName}:`, error);
    return { data: null, error };
  }
};

/**
 * Servicio de Reportes
 * ====================
 * 
 * Este servicio maneja todas las operaciones relacionadas con reportes
 * de mascotas perdidas y encontradas.
 * 
 * Funcionalidades:
 * - Crear reportes (con generación automática de embeddings)
 * - Obtener reportes (por ID, por usuario, todos, cercanos)
 * - Buscar matches para reportes
 * - Actualizar y eliminar reportes
 */
const reportService = {
  /**
   * Crea un nuevo reporte
   * 
   * @param {object} reportData - Datos del reporte a crear
   * @returns {Promise<{data: object|null, error: Error|null}>}
   * 
   * IMPORTANTE: Intenta crear el reporte a través del backend primero
   * para que se generen embeddings automáticamente. Si el backend no está
   * disponible, crea el reporte directamente en Supabase (sin embeddings).
   * 
   * Flujo:
   * 1. Asegura que el perfil del usuario existe
   * 2. Intenta crear el reporte a través del backend (genera embeddings)
   * 3. Si falla, crea directamente en Supabase (sin embeddings)
   */
  createReport: async (reportData) => {
    try {
      // Asegurar que el perfil del usuario existe antes de crear el reporte
      // Esto previene errores de foreign key constraint
      if (reportData.reporter_id) {
        const { error: profileError } = await profileService.ensureProfile(reportData.reporter_id);
        if (profileError) {
          console.error('Error ensuring profile:', profileError);
          // Continuar de todas formas, pero registrar el error
        }
      }

      // IMPORTANTE: Usar el endpoint del backend para que genere embeddings automáticamente
      // El backend genera embeddings en segundo plano cuando se crea un reporte con fotos
      // Si el backend no está disponible, fallback a Supabase directo
      try {
        console.log('📤 Creando reporte a través del backend (generación automática de embeddings)...');
        // Llamar al servicio de API que se comunica con el backend
        const backendResult = await apiService.createReport(reportData);
        
        // Si hay error, lanzarlo para que se maneje en el catch
        if (backendResult.error) {
          throw backendResult.error;
        }
        
        // Si el backend retornó el reporte correctamente
        if (backendResult.data?.report) {
          console.log('✅ Reporte creado a través del backend. Embeddings se generarán automáticamente.');
          return { data: backendResult.data.report, error: null };
        }
        
        // Si el formato de respuesta es diferente al esperado, intentar con Supabase directo
        throw new Error('Formato de respuesta inesperado del backend');
        
      } catch (backendError) {
        // Fallback: si el backend no está disponible, crear directamente en Supabase
        console.warn('⚠️ Backend no disponible, creando reporte directamente en Supabase:', backendError.message);
        console.warn('   Los embeddings NO se generarán automáticamente.');
        console.warn('   Para generar embeddings, ejecuta el backend y regenera los embeddings manualmente.');
        
        // Crear el reporte directamente en Supabase
        // Nota: Los embeddings NO se generarán automáticamente en este caso
        const { data, error } = await supabase
          .from('reports')
          .insert([reportData])
          .select()
          .single();
        
        if (error) throw error;

        return { data, error: null };
      }
    } catch (error) {
      return { data: null, error };
    }
  },

  requestMatchesAnalysis: async (reportId) => {
    try {
      console.log('🔍 Buscando coincidencias para reporte:', reportId);
      const directResult = await apiService.findDirectMatches(reportId);
      
      if (directResult && !directResult.error && directResult.data) {
        console.log('✅ Coincidencias encontradas:', directResult.data);
        return { data: directResult.data, error: null };
      }
      
      if (directResult && directResult.error) {
        throw directResult.error;
      }
      
      throw new Error('No se pudieron encontrar coincidencias');
    } catch (error) {
      console.error('❌ Error buscando coincidencias:', error);
      return { data: null, error };
    }
  },

  getMatchesForReport: async (reportId) => {
    try {
      const result = await apiService.getMatchesForReport(reportId);
      if (result.error) throw result.error;
      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getReportById: async (reportId) => {
    try {
      const { data, error } = await rpcCall('get_report_by_id_with_coords', { report_id: reportId });
      
      if (error) throw error;
      
      // La función RPC devuelve un array, pero solo queremos el primer elemento
      const report = data && data.length > 0 ? data[0] : null;
      
      if (!report) {
        return { data: null, error: { message: 'Reporte no encontrado' } };
      }
      
      return { data: report, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getUserReports: async (userId) => {
    try {
      const { data, error } = await rpcCall('get_user_reports_with_coords', { user_id: userId });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getAllReports: async () => {
    try {
      const { data, error } = await rpcCall('get_reports_with_coords');
      
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getReportsSimple: async () => {
    try {
      console.log('🔄 Obteniendo todos los reportes activos...');
      const { data, error } = await rpcCall('get_reports_with_coords');
      
      if (error) {
        console.error('❌ Error obteniendo reportes:', error);
        throw error;
      }
      
      console.log(`✅ Obtenidos ${data?.length || 0} reportes activos`);
      if (data && data.length > 0) {
        console.log('📍 Primeras coordenadas:', {
          id: data[0].id,
          latitude: data[0].latitude,
          longitude: data[0].longitude
        });
      }
      return { data: data || [], error: null };
    } catch (error) {
      console.error('❌ Error en getReportsSimple:', error);
      return { data: null, error };
    }
  },

  getNearbyReports: async (latitude, longitude, radiusMeters = 5000) => {
    try {
      const { data: rpcData, error: rpcError } = await rpcCall('nearby_reports', {
        lat: latitude,
        lng: longitude,
        radius_meters: radiusMeters,
      });
      
      if (rpcError) {
        console.warn('⚠️ RPC nearby_reports falló, usando método alternativo:', rpcError.message);
        const { data: allReports, error: allError } = await rpcCall('get_reports_with_coords');
        
        if (allError) throw allError;
        
        const nearbyReports = allReports
          .filter(report => {
            if (!report.latitude || !report.longitude) return false;
            
            const distance = calculateDistance(
              latitude, 
              longitude, 
              report.latitude, 
              report.longitude
            );
            
            report.distance_meters = distance;
            return distance <= radiusMeters;
          })
          .sort((a, b) => a.distance_meters - b.distance_meters);
        
        console.log(`✅ Filtrados ${nearbyReports.length} reportes cercanos (método local)`);
        return { data: nearbyReports, error: null };
      }
      
      const reportIds = rpcData.map(r => r.id);
      const { data: fullReports, error: reportsError } = await rpcCall('get_reports_with_coords');
      
      if (reportsError) throw reportsError;
      
      const filtered = fullReports.filter(report => reportIds.includes(report.id));
      const reportsWithDistance = filtered.map(report => {
        const distanceData = rpcData.find(d => d.id === report.id);
        return {
          ...report,
          distance_meters: distanceData?.distance_meters || 0,
        };
      });
      
      return { data: reportsWithDistance, error: null };
    } catch (error) {
      console.error('❌ Error en getNearbyReports:', error);
      return { data: null, error };
    }
  },

  updateReport: async (reportId, updates) => {
    try {
      // Usar el endpoint del backend para que genere embeddings automáticamente si hay fotos nuevas
      try {
        console.log('📤 Actualizando reporte a través del backend (generación automática de embeddings)...');
        const backendResult = await apiService.updateReport(reportId, updates);
        
        if (backendResult.error) {
          throw backendResult.error;
        }
        
        if (backendResult.data?.report) {
          console.log('✅ Reporte actualizado a través del backend. Embeddings se generarán automáticamente si hay fotos nuevas.');
          return { data: backendResult.data.report, error: null };
        }
        
        throw new Error('Formato de respuesta inesperado del backend');
        
      } catch (backendError) {
        console.warn('⚠️ Backend no disponible, actualizando reporte directamente en Supabase:', backendError.message);
        
        // Fallback: actualizar directamente en Supabase
        const { data, error } = await supabase
          .from('reports')
          .update(updates)
          .eq('id', reportId)
          .select()
          .single();
        
        if (error) throw error;
        
        return { data, error: null };
      }
    } catch (error) {
      return { data: null, error };
    }
  },

  resolveReport: async (reportId) => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', reportId)
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  deleteReport: async (reportId) => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .update({
          status: 'cancelled',
        })
        .eq('id', reportId)
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};

/**
 * Servicio de Mensajes
 * ====================
 * 
 * Este servicio maneja todas las operaciones relacionadas con mensajes
 * y conversaciones entre usuarios.
 * 
 * Funcionalidades:
 * - Crear y obtener conversaciones
 * - Enviar y recibir mensajes
 * - Suscribirse a mensajes en tiempo real usando Supabase Realtime
 * - Marcar mensajes como leídos
 * - Gestionar canales de suscripción
 */
const messageService = {
  /**
   * Obtiene una conversación existente o crea una nueva
   * 
   * @param {string} reportId - ID del reporte relacionado
   * @param {string} participant1 - ID del primer participante
   * @param {string} participant2 - ID del segundo participante
   * @returns {Promise<{data: object|null, error: Error|null}>}
   * 
   * Esta función busca si ya existe una conversación entre los dos participantes
   * para el mismo reporte. Si existe, la retorna. Si no, crea una nueva.
   * 
   * Esto previene crear múltiples conversaciones para el mismo reporte y usuarios.
   */
  getOrCreateConversation: async (reportId, participant1, participant2) => {
    try {
      // Buscar conversación existente
      // La búsqueda verifica ambos órdenes posibles de participantes
      const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .eq('report_id', reportId)  // Filtrar por reporte
        .or(`and(participant_1.eq.${participant1},participant_2.eq.${participant2}),and(participant_1.eq.${participant2},participant_2.eq.${participant1})`)  // Verificar ambos órdenes
        .maybeSingle();  // Retornar null si no existe (no lanzar error)

      // Si existe, retornarla
      if (existing) {
        return { data: existing, error: null };
      }

      // Si no existe, crear una nueva conversación
      const { data, error } = await supabase
        .from('conversations')
        .insert([
          {
            report_id: reportId,  // ID del reporte relacionado
            participant_1: participant1,  // Primer participante
            participant_2: participant2,  // Segundo participante
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getUserConversations: async (userId) => {
    try {
      const { data, error } = await rpcCall('get_user_conversations', {
        p_user_id: userId,
      });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getConversationById: async (conversationId, userId) => {
    try {
      const { data, error } = await rpcCall('get_conversation_detail', {
        p_conversation_id: conversationId,
        p_user_id: userId,
      });

      if (error) throw error;

      const conversation = Array.isArray(data) ? data[0] : data;
      return { data: conversation || null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  sendMessage: async (conversationId, senderId, content, imageUrl = null) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            conversation_id: conversationId,
            sender_id: senderId,
            content,
            image_url: imageUrl,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getMessages: async (conversationId, { limit = 50, cursor = null } = {}) => {
    try {
      const { data, error } = await rpcCall('get_conversation_messages', {
        p_conversation_id: conversationId,
        p_limit: limit,
        p_cursor: cursor,
      });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  markConversationAsRead: async (conversationId, userId) => {
    try {
      const { data, error } = await rpcCall('mark_conversation_messages_read', {
        p_conversation_id: conversationId,
        p_user_id: userId,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Suscribe a mensajes de una conversación en tiempo real
   * 
   * @param {string} conversationId - ID de la conversación
   * @param {object} callbacks - Callbacks para eventos
   * @param {Function} callbacks.onInsert - Callback cuando se inserta un nuevo mensaje
   * @param {Function} callbacks.onUpdate - Callback cuando se actualiza un mensaje
   * @returns {object|null} Canal de suscripción o null si hay error
   * 
   * Esta función se suscribe a cambios en la tabla 'messages' usando Supabase Realtime.
   * Cuando hay un nuevo mensaje o se actualiza uno, se ejecutan los callbacks correspondientes.
   * 
   * Ejemplo:
   * ```javascript
   * const channel = messageService.subscribeToMessages('conv-123', {
   *   onInsert: (newMessage) => {
   *     console.log('Nuevo mensaje:', newMessage);
   *   }
   * });
   * 
   * // Más tarde, desuscribirse:
   * messageService.removeChannel(channel);
   * ```
   */
  subscribeToMessages: (conversationId, { onInsert, onUpdate } = {}) => {
    // Validar que conversationId existe
    if (!conversationId) {
      console.warn('⚠️ No se puede suscribir: conversationId es null');
      return null;
    }

    // Nombre del canal de suscripción
    const channelName = `messages:${conversationId}`;
    console.log('🔔 Suscribiéndose a mensajes en tiempo real:', channelName);

    // Crear canal de suscripción usando Supabase Realtime
    const channel = supabase
      .channel(channelName)
      // Suscribirse a eventos INSERT (nuevos mensajes)
      .on(
        'postgres_changes',  // Tipo de evento: cambios en PostgreSQL
        {
          event: 'INSERT',  // Evento: inserción de nuevo registro
          schema: 'public',  // Esquema de la base de datos
          table: 'messages',  // Tabla a observar
          filter: `conversation_id=eq.${conversationId}`,  // Filtrar solo mensajes de esta conversación
        },
        (payload) => {
          // Callback cuando se inserta un nuevo mensaje
          console.log('📨 Nuevo mensaje recibido (INSERT):', payload.new);
          onInsert?.(payload.new, payload);  // Ejecutar callback si existe
        }
      )
      // Suscribirse a eventos UPDATE (mensajes actualizados)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',  // Evento: actualización de registro
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,  // Filtrar solo mensajes de esta conversación
        },
        (payload) => {
          // Callback cuando se actualiza un mensaje
          console.log('📝 Mensaje actualizado (UPDATE):', payload.new);
          onUpdate?.(payload.new, payload);  // Ejecutar callback si existe
        }
      )
      // Suscribirse al canal y manejar cambios de estado
      .subscribe((status) => {
        console.log(`🔔 Estado de suscripción [${channelName}]:`, status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción activa para mensajes en tiempo real');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error en el canal de suscripción');
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Suscripción expiró, reintentando...');
        } else if (status === 'CLOSED') {
          console.warn('🔴 Canal cerrado');
        }
      });

    // Retornar el canal para poder desuscribirse más tarde
    return channel;
  },

  subscribeToConversations: (userId, callback) => {
    if (!userId) return null;

    const channel = supabase
      .channel(`conversations:user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          const participants = [
            payload.new?.participant_1,
            payload.new?.participant_2,
            payload.old?.participant_1,
            payload.old?.participant_2,
          ].filter(Boolean);

          if (participants.includes(userId)) {
            callback?.(payload);
          }
        }
      )
      .subscribe();

    return channel;
  },

  removeChannel: (channel) => {
    if (!channel) return;
    supabase.removeChannel(channel);
  },
};

/**
 * Servicio de Notificaciones Push
 * ================================
 * 
 * Este servicio maneja el registro y gestión de tokens de notificaciones push.
 * 
 * Funcionalidades:
 * - Registrar tokens de Expo Push Notifications
 * - Obtener tokens de un usuario
 * - Eliminar tokens (por ID o por valor)
 * 
 * Los tokens se almacenan en Supabase para poder enviar notificaciones push
 * a los usuarios cuando hay nuevos mensajes, matches, etc.
 */
const notificationService = {
  /**
   * Registra un token de notificaciones push para un usuario
   * 
   * @param {object} params - Parámetros del registro
   * @param {string} params.userId - ID del usuario (opcional, se usa el de la sesión)
   * @param {string} params.expoPushToken - Token de Expo Push Notifications
   * @param {string} params.platform - Plataforma ('ios' o 'android')
   * @param {string} params.deviceId - ID único del dispositivo (opcional)
   * @returns {Promise<{data: object|null, error: Error|null}>}
   * 
   * Esta función registra el token en Supabase usando una función RPC.
   * El token se usa para enviar notificaciones push al dispositivo.
   */
  registerToken: async ({ userId, expoPushToken, platform, deviceId }) => {
    try {
      // Obtener la sesión actual para verificar autenticación
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const sessionUserId = session?.user?.id;

      // Si no hay usuario autenticado, no registrar el token
      if (!sessionUserId) {
        console.info('[notificationService] Registro de push omitido: sin usuario autenticado.');
        return { data: null, error: null };
      }

      // Si se proporcionó un userId diferente al de la sesión, usar el de la sesión
      if (userId && userId !== sessionUserId) {
        console.warn(
          '[notificationService] userId provisto no coincide con la sesión actual. Se usará auth.uid().'
        );
      }

      // Llamar a la función RPC para registrar el token
      const { data, error } = await rpcCall('register_push_token', {
        p_user_id: sessionUserId,  // ID del usuario de la sesión
        p_expo_token: expoPushToken,  // Token de Expo Push Notifications
        p_platform: platform,  // Plataforma ('ios' o 'android')
        p_device_id: deviceId || null,  // ID del dispositivo (opcional)
      });

      if (error) {
        // Si el error es por falta de autenticación o permisos, retornar sin error (no crítico)
        if (
          error?.message?.includes('autenticado') ||
          error?.message?.includes('permission') ||
          error?.message?.includes('permission denied') ||
          error?.code === '42501' ||
          error?.code === 'PGRST301'
        ) {
          console.info('[notificationService] Registro de push omitido:', error.message || error);
          return { data: null, error: null };
        }
        
        // Si el error es que la función RPC no existe, retornar sin error (no crítico)
        if (
          error?.message?.includes('function') ||
          error?.message?.includes('does not exist') ||
          error?.code === '42883'
        ) {
          console.warn(
            '[notificationService] Función RPC register_push_token no encontrada. ' +
            'Asegúrate de ejecutar la migración 004_messaging.sql en Supabase.'
          );
          return { data: null, error: null };
        }
        
        // Para otros errores, lanzar para que se capture en el catch
        throw error;
      }

      // La función RPC puede retornar un array o un objeto
      const tokenData = Array.isArray(data) ? data[0] : data;
      return { data: tokenData, error: null };
    } catch (error) {
      // Manejar errores de red o otros errores no críticos
      // Las notificaciones push no son críticas para el funcionamiento básico de la app
      if (
        error?.message?.includes('network') ||
        error?.message?.includes('fetch') ||
        error?.message?.includes('Network request failed')
      ) {
        console.warn(
          '[notificationService] Error de red al registrar push token. ' +
          'Las notificaciones push pueden no funcionar hasta que se resuelva la conexión.'
        );
        return { data: null, error: null };  // No crítico, retornar sin error
      }
      
      // Si el error es por falta de autenticación, retornar sin error
      if (error?.message?.includes('autenticado') || error?.message?.includes('No hay un usuario autenticado')) {
        console.info('[notificationService] Registro de push abortado: sesión inexistente.');
        return { data: null, error: null };
      }
      
      // Para otros errores, loguear pero no fallar la app
      console.warn('[notificationService] Error registrando push token (no crítico):', {
        message: error?.message || error,
        code: error?.code,
        details: error?.details,
      });
      return { data: null, error: null };  // No crítico, retornar sin error
    }
  },

  getUserTokens: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('push_tokens')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  removeTokenById: async (tokenId) => {
    try {
      const { error } = await supabase.from('push_tokens').delete().eq('id', tokenId);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  removeTokenValue: async (userId, expoPushToken) => {
    try {
      const { error } = await supabase
        .from('push_tokens')
        .delete()
        .match({
          user_id: userId,
          expo_token: expoPushToken,
        });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  },
};

export {
  authService, messageService, notificationService, petService, profileService, reportService, supabase
};

