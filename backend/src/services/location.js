/**
 * Servicio de Ubicación
 * =====================
 * 
 * Este servicio maneja todas las operaciones relacionadas con la ubicación:
 * - Solicitar y verificar permisos de ubicación
 * - Obtener la ubicación actual del dispositivo
 * - Geocodificación inversa (convertir coordenadas a dirección)
 * - Formateo de direcciones
 * 
 * Usa expo-location para acceder a los servicios de ubicación del dispositivo.
 */

import * as Location from 'expo-location';  // API de ubicación de Expo

/**
 * Solicita permisos de ubicación al usuario
 * 
 * @returns {Promise<{granted: boolean, error: Error|null}>}
 * 
 * Esta función solicita permisos de ubicación en primer plano.
 * En iOS y Android, el usuario debe aprobar explícitamente el permiso.
 * 
 * Nota: Los permisos se solicitan automáticamente la primera vez,
 * pero el usuario puede denegarlos. En ese caso, se debe mostrar
 * un mensaje explicando por qué se necesita el permiso.
 */
const requestLocationPermission = async () => {
  try {
    // Solicitar permisos de ubicación en primer plano
    // requestForegroundPermissionsAsync muestra un diálogo al usuario
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    // Verificar si el permiso fue otorgado
    if (status !== 'granted') {
      return {
        granted: false,
        error: 'Permiso de ubicación denegado',
      };
    }
    
    // Permiso otorgado
    return { granted: true, error: null };
  } catch (error) {
    console.error('Error solicitando permisos de ubicación:', error);
    return { granted: false, error };
  }
};

const checkLocationPermission = async () => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error verificando permisos de ubicación:', error);
    return false;
  }
};

const getCurrentLocation = async () => {
  try {
    const hasPermission = await checkLocationPermission();
    if (!hasPermission) {
      const permission = await requestLocationPermission();
      if (!permission.granted) {
        throw new Error('Permiso de ubicación denegado');
      }
    }
    
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      error: null,
    };
  } catch (error) {
    console.error('Error obteniendo ubicación actual:', error);
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      error,
    };
  }
};

const reverseGeocode = async (latitude, longitude, retryCount = 0) => {
  try {
    // Crear un timeout personalizado más generoso
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout en geocodificación inversa')), 8000); // Aumentado a 8 segundos
    });

    const geocodePromise = Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    const addresses = await Promise.race([geocodePromise, timeoutPromise]);
    
    if (addresses && addresses.length > 0) {
      const address = addresses[0];
      const formattedAddress = formatAddress(address);
      
      return {
        address: formattedAddress,
        details: address,
        error: null,
      };
    }
    
    return {
      address: null,
      details: null,
      error: new Error('No se encontró dirección'),
    };
  } catch (error) {
    console.error('Error en geocodificación inversa:', error);
    
    // Si es un error de timeout o DEADLINE_EXCEEDED, intentar retry una vez
    if ((error.message?.includes('Timeout') || error.message?.includes('DEADLINE_EXCEEDED')) && retryCount < 1) {
      console.log('Reintentando geocodificación inversa...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo antes del retry
      return reverseGeocode(latitude, longitude, retryCount + 1);
    }
    
    // Si falla después del retry o es otro tipo de error, usar coordenadas como fallback
    if (error.message?.includes('Timeout') || error.message?.includes('DEADLINE_EXCEEDED')) {
      return {
        address: `Ubicación: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        details: null,
        error: null,
      };
    }
    
    return {
      address: null,
      details: null,
      error,
    };
  }
};

const formatAddress = (addressObject) => {
  const parts = [];
  
  if (addressObject.street) parts.push(addressObject.street);
  if (addressObject.streetNumber) parts.push(addressObject.streetNumber);
  if (addressObject.city) parts.push(addressObject.city);
  if (addressObject.region) parts.push(addressObject.region);
  if (addressObject.country) parts.push(addressObject.country);
  
  return parts.join(', ');
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

const getMapRegion = (latitude, longitude, latitudeDelta = 0.05, longitudeDelta = 0.05) => {
  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  };
};

export {
    calculateDistance, checkLocationPermission, formatAddress, formatDistance, getCurrentLocation, getMapRegion, requestLocationPermission, reverseGeocode
};

