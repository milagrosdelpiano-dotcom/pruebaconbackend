/**
 * Hook de Notificaciones Push
 * ============================
 * 
 * Este hook gestiona el registro y manejo de notificaciones push.
 * 
 * Funcionalidades:
 * - Solicitar permisos de notificaciones
 * - Registrar token de Expo Push Notifications
 * - Guardar token en Supabase para enviar notificaciones
 * - Escuchar notificaciones recibidas
 * - Manejar respuestas a notificaciones (cuando el usuario hace clic)
 * 
 * Las notificaciones se usan para:
 * - Nuevos mensajes en conversaciones
 * - Nuevos matches encontrados
 * - Actualizaciones de reportes
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';  // Hooks de React
import { Platform } from 'react-native';  // Para detectar la plataforma
import * as Notifications from 'expo-notifications';  // API de notificaciones de Expo
import Constants from 'expo-constants';  // Constantes de Expo
import { notificationService } from '../services/supabase';  // Servicio de notificaciones
import { useAuthStore } from '../stores/authStore';  // Store de autenticación

// =========================
// Configuración de Notificaciones
// =========================
// Configurar cómo se manejan las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,  // Mostrar alerta cuando llega una notificación
    shouldPlaySound: false,  // No reproducir sonido (puede ser molesto)
    shouldSetBadge: false,  // No actualizar badge (contador de notificaciones)
  }),
});

/**
 * Obtiene el Project ID de Expo para notificaciones push
 * 
 * @returns {string|null} Project ID o null si no se encuentra
 * 
 * El Project ID es necesario para generar tokens de Expo Push Notifications.
 * Se busca en múltiples lugares:
 * 1. expoConfig.extra.eas.projectId
 * 2. Constants.easConfig.projectId
 * 3. EXPO_PUBLIC_EAS_PROJECT_ID (variable de entorno)
 */
const getProjectId = () => {
  const expoConfig = Constants.expoConfig ?? Constants.manifest;
  const candidate =
    expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    null;

  // Validar que el Project ID tenga formato UUID válido
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (candidate && uuidRegex.test(String(candidate))) {
    return candidate;
  }

  console.warn(
    '[usePushNotifications] projectId no válido o no disponible. Se usará getExpoPushTokenAsync sin projectId.'
  );
  return null;
};

/**
 * Hook personalizado para gestionar notificaciones push
 * 
 * @returns {object} Objeto con:
 *   - expoToken: Token de Expo Push Notifications
 *   - status: Estado de los permisos
 *   - error: Error si hay
 *   - registering: Si se está registrando el token
 * 
 * Este hook se suscribe automáticamente a cambios en el usuario
 * y registra/actualiza el token cuando el usuario cambia.
 */
export const usePushNotifications = () => {
  // =========================
  // Estado y Referencias
  // =========================
  // Obtener ID del usuario actual del store
  const userId = useAuthStore((state) => state.user?.id || null);
  
  // Token de Expo Push Notifications
  const [expoToken, setExpoToken] = useState(null);
  
  // Estado de permisos de notificaciones
  const [status, setStatus] = useState(null);
  
  // Error al registrar notificaciones (si hay)
  const [error, setError] = useState(null);
  
  // Estado de registro (cuando se está registrando el token)
  const [registering, setRegistering] = useState(false);
  
  // Referencias para los listeners de notificaciones
  const notificationListener = useRef(null);  // Listener para notificaciones recibidas
  const responseListener = useRef(null);  // Listener para respuestas a notificaciones

  const ensureAndroidChannel = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    await Notifications.setNotificationChannelAsync('default', {
      name: 'Mensajes',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      bypassDnd: false,
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }, []);

  const registerPushToken = useCallback(async () => {
    if (!userId || registering) {
      return;
    }

    setRegistering(true);
    setError(null);

    try {
      await ensureAndroidChannel();

      const projectId = getProjectId();
      if (!projectId) {
        console.warn(
          '[usePushNotifications] No se encontró un projectId válido. Configura EXPO_PUBLIC_EAS_PROJECT_ID o eas.projectId en app.config.js.'
        );
        setError(
          'Las notificaciones push requieren configurar un Project ID de Expo (EAS). Revisa app.config.js o EXPO_PUBLIC_EAS_PROJECT_ID.'
        );
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status: requestedStatus } = await Notifications.requestPermissionsAsync();
        finalStatus = requestedStatus;
      }

      setStatus(finalStatus);

      if (finalStatus !== 'granted') {
        throw new Error('Los permisos de notificaciones fueron denegados.');
      }

      let tokenResponse;

      try {
        tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      } catch (err) {
        console.warn(
          '[usePushNotifications] Falló getExpoPushTokenAsync con projectId.',
          err?.message || err
        );
        throw err;
      }
      const token = tokenResponse.data;

      setExpoToken(token);

      await notificationService.registerToken({
        userId,
        expoPushToken: token,
        platform: Platform.OS,
      });
    } catch (err) {
      console.error('Error registrando notificaciones push:', err);
      setError(err?.message || 'Error registrando notificaciones push.');
    } finally {
      setRegistering(false);
    }
  }, [ensureAndroidChannel, registering, userId]);

  useEffect(() => {
    if (!userId) {
      setExpoToken(null);
      setStatus(null);
      setError(null);
      return;
    }

    registerPushToken();
  }, [registerPushToken, userId]);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Podríamos manejar métricas o actualizar estado aquí si fuese necesario.
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      // Idealmente manejar la navegación hacia la conversación cuando se abre la notificación.
    });

    return () => {
      if (notificationListener.current) {
        try {
          notificationListener.current.remove?.();
        } catch {
          Notifications.removeNotificationSubscription?.(notificationListener.current);
        } finally {
          notificationListener.current = null;
        }
      }
      if (responseListener.current) {
        try {
          responseListener.current.remove?.();
        } catch {
          Notifications.removeNotificationSubscription?.(responseListener.current);
        } finally {
          responseListener.current = null;
        }
      }
    };
  }, []);

  const summary = useMemo(
    () => ({
      expoToken,
      status,
      error,
      registering,
      refresh: registerPushToken,
    }),
    [error, expoToken, registering, registerPushToken, status]
  );

  return summary;
};


