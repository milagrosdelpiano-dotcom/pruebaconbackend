/**
 * Hook para gestionar alertas geográficas de mascotas perdidas
 * 
 * Funcionalidades:
 * - Solicitar permisos de ubicación
 * - Rastrear ubicación del usuario (foreground y background)
 * - Actualizar ubicación en el servidor
 * - Gestionar preferencias de alertas
 * - Recibir notificaciones de mascotas cercanas
 */

import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_STORAGE_KEY = '@geo_alerts:location_enabled';
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutos
const LOCATION_ACCURACY = Location.Accuracy.Balanced;

export function useGeoAlerts() {
  const { user } = useAuthStore();
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [alertPreferences, setAlertPreferences] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(null);
  
  const locationSubscription = useRef(null);
  const updateTimer = useRef(null);

  // Cargar estado inicial
  useEffect(() => {
    loadInitialState();
  }, [user]);

  // Iniciar/detener rastreo según configuración
  useEffect(() => {
    if (locationEnabled && user) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }

    return () => stopLocationTracking();
  }, [locationEnabled, user]);

  /**
   * Cargar estado inicial desde AsyncStorage y Supabase
   */
  const loadInitialState = async () => {
    try {
      if (!user) return;

      // Cargar preferencia local
      const enabled = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      setLocationEnabled(enabled === 'true');

      // Cargar preferencias del servidor
      await loadAlertPreferences();

      // Verificar permisos
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);
    } catch (error) {
      console.error('Error cargando estado inicial:', error);
    }
  };

  /**
   * Cargar preferencias de alertas del usuario
   */
  const loadAlertPreferences = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('user_alert_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no encontrado
        throw error;
      }

      // Si no existe, crear preferencias por defecto
      if (!data) {
        const defaultPrefs = {
          user_id: user.id,
          enabled: true,
          radius_meters: 1000,
          alert_types: ['lost'],
          species_filter: null,
          quiet_hours_start: null,
          quiet_hours_end: null,
        };

        const { data: newData, error: insertError } = await supabase
          .from('user_alert_preferences')
          .insert(defaultPrefs)
          .select()
          .single();

        if (insertError) throw insertError;
        setAlertPreferences(newData);
      } else {
        setAlertPreferences(data);
      }
    } catch (error) {
      console.error('Error cargando preferencias:', error);
      setError(error.message);
    }
  };

  /**
   * Solicitar permisos de ubicación
   */
  const requestLocationPermission = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Solicitar permisos de foreground
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        setError('Se necesitan permisos de ubicación para recibir alertas');
        setPermissionStatus(foregroundStatus);
        return false;
      }

      setPermissionStatus(foregroundStatus);

      // Opcional: Solicitar permisos de background (para actualizaciones continuas)
      // Nota: Requiere configuración adicional en app.json
      try {
        await Location.requestBackgroundPermissionsAsync();
      } catch (bgError) {
        console.log('Permisos de background no disponibles:', bgError);
      }

      return true;
    } catch (error) {
      console.error('Error solicitando permisos:', error);
      setError(error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Habilitar/deshabilitar rastreo de ubicación
   */
  const toggleLocationTracking = async (enabled) => {
    try {
      setIsLoading(true);
      setError(null);

      if (enabled) {
        // Verificar/solicitar permisos
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          return false;
        }

        // Obtener ubicación inicial
        const location = await getCurrentLocation();
        if (location) {
          await updateLocationOnServer(location.coords.latitude, location.coords.longitude);
        }
      } else {
        // Detener rastreo
        stopLocationTracking();
      }

      // Guardar preferencia
      await AsyncStorage.setItem(LOCATION_STORAGE_KEY, enabled.toString());
      setLocationEnabled(enabled);

      return true;
    } catch (error) {
      console.error('Error cambiando estado de ubicación:', error);
      setError(error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Obtener ubicación actual
   */
  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: LOCATION_ACCURACY,
      });
      
      setCurrentLocation(location);
      return location;
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
      setError('No se pudo obtener la ubicación');
      return null;
    }
  };

  /**
   * Iniciar rastreo de ubicación
   */
  const startLocationTracking = async () => {
    try {
      // Verificar permisos
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Sin permisos de ubicación');
        return;
      }

      // Obtener ubicación inicial
      await getCurrentLocation();

      // Configurar actualizaciones periódicas
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: LOCATION_ACCURACY,
          timeInterval: UPDATE_INTERVAL,
          distanceInterval: 100, // Actualizar cada 100 metros
        },
        async (location) => {
          console.log('📍 Nueva ubicación:', location.coords);
          setCurrentLocation(location);
          
          // Actualizar en el servidor
          await updateLocationOnServer(
            location.coords.latitude,
            location.coords.longitude,
            location.coords.accuracy
          );
        }
      );

      console.log('✅ Rastreo de ubicación iniciado');
    } catch (error) {
      console.error('Error iniciando rastreo:', error);
      setError(error.message);
    }
  };

  /**
   * Detener rastreo de ubicación
   */
  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
      console.log('🛑 Rastreo de ubicación detenido');
    }

    if (updateTimer.current) {
      clearInterval(updateTimer.current);
      updateTimer.current = null;
    }
  };

  /**
   * Actualizar ubicación en el servidor
   */
  const updateLocationOnServer = async (latitude, longitude, accuracy = null) => {
    try {
      if (!user) return;

      const { data, error } = await supabase.rpc('upsert_user_location', {
        p_user_id: user.id,
        p_latitude: latitude,
        p_longitude: longitude,
        p_accuracy: accuracy,
      });

      if (error) throw error;
      
      console.log('✅ Ubicación actualizada en servidor');
      return data;
    } catch (error) {
      console.error('Error actualizando ubicación:', error);
      // No mostrar error al usuario, es una operación en background
    }
  };

  /**
   * Actualizar preferencias de alertas
   */
  const updateAlertPreferences = async (preferences) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const { data, error } = await supabase
        .from('user_alert_preferences')
        .update(preferences)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setAlertPreferences(data);
      return true;
    } catch (error) {
      console.error('Error actualizando preferencias:', error);
      setError(error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Actualizar radio de alertas
   */
  const updateAlertRadius = async (radiusMeters) => {
    return updateAlertPreferences({ radius_meters: radiusMeters });
  };

  /**
   * Actualizar tipos de alertas (lost, found)
   */
  const updateAlertTypes = async (types) => {
    return updateAlertPreferences({ alert_types: types });
  };

  /**
   * Actualizar filtro de especies
   */
  const updateSpeciesFilter = async (species) => {
    return updateAlertPreferences({ species_filter: species });
  };

  /**
   * Configurar horario silencioso
   */
  const updateQuietHours = async (startTime, endTime) => {
    return updateAlertPreferences({
      quiet_hours_start: startTime,
      quiet_hours_end: endTime,
    });
  };

  /**
   * Habilitar/deshabilitar alertas (sin detener rastreo de ubicación)
   */
  const toggleAlerts = async (enabled) => {
    return updateAlertPreferences({ enabled });
  };

  /**
   * Obtener estadísticas de alertas
   */
  const getAlertStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_geo_alerts_stats');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return null;
    }
  };

  /**
   * Forzar actualización de ubicación
   */
  const forceLocationUpdate = async () => {
    try {
      setIsLoading(true);
      const location = await getCurrentLocation();
      
      if (location) {
        await updateLocationOnServer(
          location.coords.latitude,
          location.coords.longitude,
          location.coords.accuracy
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error actualizando ubicación:', error);
      setError(error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // Estado
    locationEnabled,
    currentLocation,
    alertPreferences,
    isLoading,
    error,
    permissionStatus,
    
    // Acciones
    toggleLocationTracking,
    requestLocationPermission,
    getCurrentLocation,
    forceLocationUpdate,
    
    // Preferencias
    updateAlertPreferences,
    updateAlertRadius,
    updateAlertTypes,
    updateSpeciesFilter,
    updateQuietHours,
    toggleAlerts,
    
    // Utilidades
    getAlertStats,
  };
}

