/**
 * Store de Autenticación usando Zustand
 * =======================================
 * 
 * Este store gestiona todo el estado relacionado con la autenticación del usuario:
 * - Usuario actual y sesión
 * - Estado de carga
 * - Operaciones de login, registro, logout
 * - Verificación de sesión existente
 * - Actualización de perfil
 * 
 * Zustand es una librería de gestión de estado ligera y simple.
 * Este store se puede usar en cualquier componente con el hook useAuthStore().
 * 
 * Ejemplo de uso:
 * ```javascript
 * const { user, login, isAuthenticated } = useAuthStore();
 * if (!isAuthenticated()) {
 *   await login(email, password);
 * }
 * ```
 */

import { create } from 'zustand';  // Librería para gestión de estado
import { authService, profileService } from '../services/supabase';  // Servicios de autenticación

/**
 * Crear el store de autenticación
 * 
 * set: función para actualizar el estado
 * get: función para leer el estado actual
 */
export const useAuthStore = create((set, get) => ({
  // =========================
  // Estado inicial del store
  // =========================
  user: null,  // Objeto del usuario autenticado (null si no hay usuario)
  session: null,  // Sesión de Supabase (contiene tokens, refresh tokens, etc.)
  loading: false,  // Indica si hay una operación en curso (login, registro, etc.)
  initialized: false,  // Indica si ya se verificó si hay una sesión existente al iniciar la app

  // =========================
  // Actions simples para actualizar estado
  // =========================
  // Estas funciones permiten actualizar el estado directamente desde componentes
  setUser: (user) => set({ user }),  // Actualizar el usuario actual
  setSession: (session) => set({ session }),  // Actualizar la sesión
  setLoading: (loading) => set({ loading }),  // Actualizar estado de carga
  setInitialized: (initialized) => set({ initialized }),  // Marcar como inicializado

  // =========================
  // Función de login
  // =========================
  /**
   * Inicia sesión con email y contraseña
   * 
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<{success: boolean, data?: any, error?: Error}>}
   * 
   * Flujo:
   * 1. Marca loading como true
   * 2. Llama al servicio de autenticación
   * 3. Si hay error, retorna error
   * 4. Si es exitoso, actualiza el estado con user y session
   * 5. Asegura que el perfil del usuario existe en la base de datos
   * 6. Retorna éxito
   */
  login: async (email, password) => {
    try {
      // Marcar que hay una operación en curso
      set({ loading: true });
      
      // Llamar al servicio de autenticación de Supabase
      // signIn verifica las credenciales y crea una sesión
      const { data, error } = await authService.signIn(email, password);
      
      // Si hay error (credenciales incorrectas, usuario no existe, etc.)
      if (error) {
        set({ loading: false });  // Dejar de cargar
        return { success: false, error };  // Retornar error
      }

      // Login exitoso: actualizar el estado con los datos del usuario y sesión
      set({
        user: data.user,  // Objeto del usuario (id, email, metadata, etc.)
        session: data.session,  // Sesión con tokens de autenticación
        loading: false,  // Operación completada
      });

      // Asegurar que el perfil del usuario existe en la tabla 'profiles'
      // Esto es importante porque el perfil puede no existir si el usuario se registró
      // pero no completó algún paso, o si hubo un error al crearlo
      if (data.user) {
        try {
          // ensureProfile crea el perfil si no existe, o lo actualiza si ya existe
          await profileService.ensureProfile(data.user.id, {
            // Usar el nombre completo de los metadatos, o el email sin dominio, o 'Usuario' por defecto
            full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Usuario',
          });
        } catch (profileError) {
          // No es crítico si falla - el perfil se creará en el próximo intento
          // o cuando el usuario actualice su perfil
          console.warn('No se pudo asegurar el perfil después del login:', profileError);
        }
      }

      // Retornar éxito con los datos
      return { success: true, data };
    } catch (error) {
      // Cualquier error inesperado (red, servidor, etc.)
      set({ loading: false });
      return { success: false, error };
    }
  },

  // Función de logout
  logout: async () => {
    try {
      set({ loading: true });
      
      const { error } = await authService.signOut();
      
      if (error) {
        set({ loading: false });
        return { success: false, error };
      }

      // Limpiar estado
      set({
        user: null,
        session: null,
        loading: false,
      });

      return { success: true };
    } catch (error) {
      set({ loading: false });
      return { success: false, error };
    }
  },

  // Función de registro
  signUp: async (email, password, fullName) => {
    try {
      set({ loading: true });
      
      const { data, error } = await authService.signUp(email, password, fullName);
      
      set({ loading: false });
      
      if (error) {
        return { success: false, error };
      }

      // En registro, no establecemos sesión inmediatamente
      // El usuario debe verificar su email primero
      return { success: true, data };
    } catch (error) {
      set({ loading: false });
      return { success: false, error };
    }
  },

  // Función de inicialización para verificar sesión existente
  initialize: async () => {
    try {
      set({ loading: true });
      
      const { session, error: sessionError } = await authService.getSession();
      
      if (sessionError) {
        set({ loading: false, initialized: true });
        return { success: false, error: sessionError };
      }

      if (session?.user) {
        const { user, error: userError } = await authService.getCurrentUser();
        
        if (userError) {
          set({ loading: false, initialized: true });
          return { success: false, error: userError };
        }

        set({
          user: user,
          session: session,
          loading: false,
          initialized: true,
        });

        // Asegurar que el perfil existe al inicializar
        if (user) {
          try {
            await profileService.ensureProfile(user.id, {
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
            });
          } catch (profileError) {
            console.warn('No se pudo asegurar el perfil durante la inicialización:', profileError);
          }
        }
      } else {
        set({
          user: null,
          session: null,
          loading: false,
          initialized: true,
        });
      }

      return { success: true };
    } catch (error) {
      set({ loading: false, initialized: true });
      return { success: false, error };
    }
  },

  // Función para refrescar datos del usuario
  refreshUser: async () => {
    try {
      const { user, error } = await authService.getCurrentUser();
      
      if (error) {
        return { success: false, error };
      }

      set({ user });
      return { success: true, user };
    } catch (error) {
      return { success: false, error };
    }
  },

  // Función para actualizar perfil del usuario
  updateProfile: async (updates) => {
    try {
      const { user } = get();
      
      if (!user) {
        return { success: false, error: new Error('Usuario no autenticado') };
      }

      // Aquí podrías llamar a profileService.updateProfile si lo tienes
      // Por ahora solo actualizamos el estado local
      set({ user: { ...user, ...updates } });
      
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  },

  // Función para verificar si el usuario está autenticado
  isAuthenticated: () => {
    const { user, session } = get();
    return !!(user && session);
  },

  // Función para obtener el ID del usuario
  getUserId: () => {
    const { user } = get();
    return user?.id || null;
  },

  // Función para limpiar el estado (útil para errores)
  clearAuth: () => {
    set({
      user: null,
      session: null,
      loading: false,
    });
  },

  // Suscribirse a cambios de autenticación
  subscribeToAuthChanges: () => {
    return authService.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event, session?.user?.email || 'sin usuario');
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Obtener el usuario actualizado
        const { user, error } = await authService.getCurrentUser();
        
        if (!error && user) {
          set({
            user: user,
            session: session,
          });
          
          // Asegurar que el perfil existe
          try {
            await profileService.ensureProfile(user.id, {
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
            });
          } catch (profileError) {
            console.warn('Error asegurando perfil:', profileError);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        set({
          user: null,
          session: null,
        });
      } else if (event === 'USER_UPDATED') {
        const { user, error } = await authService.getCurrentUser();
        if (!error && user) {
          set({ user: user });
        }
      }
    });
  },

  // Función para recuperar contraseña
  resetPassword: async (email) => {
    try {
      set({ loading: true });
      const { data, error } = await authService.resetPassword(email);
      set({ loading: false });
      
      if (error) {
        return { success: false, error };
      }
      
      return { success: true, data };
    } catch (error) {
      set({ loading: false });
      return { success: false, error };
    }
  },

  // Función para actualizar contraseña
  updatePassword: async (newPassword) => {
    try {
      set({ loading: true });
      const { data, error } = await authService.updatePassword(newPassword);
      set({ loading: false });
      
      if (error) {
        return { success: false, error };
      }
      
      return { success: true, data };
    } catch (error) {
      set({ loading: false });
      return { success: false, error };
    }
  },

  // Función para reenviar confirmación de email
  resendConfirmation: async (email) => {
    try {
      set({ loading: true });
      const { data, error } = await authService.resendConfirmation(email);
      set({ loading: false });
      
      if (error) {
        return { success: false, error };
      }
      
      return { success: true, data };
    } catch (error) {
      set({ loading: false });
      return { success: false, error };
    }
  },
}));

