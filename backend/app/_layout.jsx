/**
 * Layout Principal de la Aplicación
 * ===================================
 * 
 * Este es el componente raíz de la aplicación que maneja:
 * - Inicialización de autenticación
 * - Navegación basada en estado de autenticación
 * - Suscripción a cambios de autenticación
 * - Registro de notificaciones push
 * - Pantalla de splash inicial
 * 
 * Flujo de inicialización:
 * 1. Muestra splash screen
 * 2. Inicializa autenticación (verifica sesión existente)
 * 3. Suscribe a cambios de autenticación
 * 4. Navega según el estado de autenticación:
 *    - Si está autenticado: redirige a /(tabs)
 *    - Si no está autenticado: redirige a /(auth)/login
 * 
 * Navegación automática:
 * - Detecta cambios en el estado de autenticación
 * - Redirige automáticamente según la ruta actual
 * - Previene acceso a rutas protegidas sin autenticación
 */

import { Slot, useRouter, useSegments } from 'expo-router';  // Router de Expo
import React, { useEffect, useState } from 'react';  // Hooks de React
import { ActivityIndicator, StyleSheet, View } from 'react-native';  // Componentes básicos
import SplashScreen from '../components/SplashScreen';  // Pantalla de splash
import { useAuthStore } from '../src/stores/authStore';  // Store de autenticación
import { usePushNotifications } from '../src/hooks/usePushNotifications';  // Hook de notificaciones

/**
 * Componente raíz de la aplicación
 * 
 * Este componente se renderiza primero y maneja toda la lógica
 * de inicialización y navegación de la aplicación.
 */
export default function RootLayout() {
  // =========================
  // Hooks de Expo Router
  // =========================
  // Router para navegación programática
  const router = useRouter();
  
  // Segmentos de la ruta actual (ej: ['(tabs)', 'index'])
  const segments = useSegments();
  
  // =========================
  // Store de Autenticación
  // =========================
  // Obtener estado y funciones del store de autenticación
  const { 
    user,  // Usuario actual (null si no está autenticado)
    session,  // Sesión actual (null si no está autenticado)
    initialize,  // Función para inicializar autenticación
    initialized,  // Flag que indica si ya se inicializó
    subscribeToAuthChanges  // Función para suscribirse a cambios de auth
  } = useAuthStore();
  
  // =========================
  // Estado Local
  // =========================
  // Estado de carga durante la inicialización
  const [isLoading, setIsLoading] = useState(true);
  
  // Controla si se muestra la pantalla de splash
  const [showSplash, setShowSplash] = useState(true);
  
  // Error al registrar notificaciones push (si hay)
  const { error: pushError } = usePushNotifications();

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        await initialize();
      } catch (error) {
        console.error('Error inicializando autenticación:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [initialize]);

  // Suscribirse a cambios de autenticación
  useEffect(() => {
    if (!initialized) return;

    console.log('🔔 Suscribiéndose a cambios de autenticación...');
    const subscription = subscribeToAuthChanges();

    return () => {
      console.log('🔕 Desuscribiéndose de cambios de autenticación...');
      // El método onAuthStateChange de Supabase devuelve un objeto con unsubscribe
      if (subscription) {
        if (typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        } else if (subscription?.data?.subscription?.unsubscribe) {
          subscription.data.subscription.unsubscribe();
        }
      }
    };
  }, [initialized, subscribeToAuthChanges]);

  useEffect(() => {
    if (!initialized || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const isAuthenticated = !!(user && session);

    console.log('🔍 Auth state check:', { 
      user: !!user, 
      session: !!session, 
      isAuthenticated, 
      segments: segments[0],
      inAuthGroup,
      inTabsGroup 
    });

    if (isAuthenticated) {
      // Usuario autenticado
      if (inAuthGroup) {
        // Si está en grupo de auth, redirigir a tabs
        console.log('🔄 Redirigiendo a tabs desde auth');
        router.replace('/(tabs)');
      } else if (segments.length === 0 || segments[0] === 'index') {
        // Si está en la raíz, redirigir a tabs
        console.log('🔄 Redirigiendo a tabs desde raíz');
        router.replace('/(tabs)');
      }
    } else {
      // Usuario no autenticado
      if (inTabsGroup || segments.length === 0 || segments[0] === 'index') {
        // Si está en tabs o raíz, redirigir a login
        console.log('🔄 Redirigiendo a login desde tabs/raíz');
        router.replace('/(auth)/login');
      }
    }
  }, [user, session, initialized, segments, router, isLoading]);

  useEffect(() => {
    if (pushError) {
      console.warn('Error al registrar notificaciones push:', pushError);
    }
  }, [pushError]);

  // Mostrar splash screen primero
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // Mostrar loading mientras se inicializa la autenticación
  if (!initialized || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Renderizar el slot para las rutas
  return <Slot />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // Blanco puro para consistencia con el splash screen
  },
});

