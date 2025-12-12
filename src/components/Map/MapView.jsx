/**
 * Componente de Mapa Interactivo
 * ===============================
 * 
 * Este componente muestra un mapa interactivo con marcadores de reportes
 * y permite interactuar con ellos.
 * 
 * Funcionalidades:
 * - Mostrar marcadores de reportes en el mapa
 * - Mostrar ubicación del usuario
 * - Ajustar zoom automáticamente para mostrar todos los marcadores
 * - Permitir seleccionar ubicación (para crear reportes)
 * - Mostrar círculo de radio de búsqueda
 * - Manejar clics en marcadores
 * 
 * Usa react-native-maps que es un wrapper de MapKit (iOS) y Google Maps (Android).
 */

import React, { useEffect, useRef, useState } from 'react'; // Hooks de React
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native'; // Componentes básicos
import MapView, { Circle, Marker } from 'react-native-maps'; // Componente de mapa y sus componentes
import { getCurrentLocation } from '../../services/location'; // Servicio de ubicación

// Error boundary simple para capturar errores de Google Maps
class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.log('MapView Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={[styles.container, this.props.style]}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>🗺️ Mapa no disponible</Text>
            <Text style={styles.errorText}>
              Configura Google Maps API Key para ver el mapa interactivo
            </Text>
            <Text style={styles.errorHint}>
              {this.props.reports?.length || 0} reporte(s) disponible(s)
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

/**
 * Componente de mapa personalizado
 * 
 * @param {Array} reports - Lista de reportes a mostrar como marcadores
 * @param {Function} onReportPress - Callback cuando se presiona un reporte
 * @param {Function} onLocationSelect - Callback cuando se selecciona una ubicación
 * @param {boolean} showUserLocation - Si mostrar la ubicación del usuario
 * @param {boolean} showRadius - Si mostrar un círculo de radio
 * @param {number} radiusMeters - Radio del círculo en metros
 * @param {Object} initialRegion - Región inicial del mapa (lat, lng, delta)
 * @param {Object} style - Estilos personalizados para el mapa
 * @param {boolean} allowLocationSelection - Si permitir seleccionar ubicación tocando el mapa
 * @param {Object} selectedLocation - Ubicación seleccionada (si hay)
 * @param {Function} onMarkerPress - Callback cuando se presiona un marcador
 */
const CustomMapView = ({ 
  reports = [],  // Lista de reportes a mostrar
  onReportPress,  // Callback para cuando se presiona un reporte
  onLocationSelect,  // Callback para cuando se selecciona una ubicación
  showUserLocation = true,  // Mostrar ubicación del usuario (default: true)
  showRadius = false,  // Mostrar círculo de radio (default: false)
  radiusMeters = 5000,  // Radio en metros (default: 5km)
  initialRegion = null,  // Región inicial del mapa
  style,  // Estilos personalizados
  allowLocationSelection = false,  // Permitir seleccionar ubicación (default: false)
  selectedLocation = null,  // Ubicación seleccionada
  onMarkerPress,  // Callback para cuando se presiona un marcador
}) => {
  // =========================
  // Referencias y Estado
  // =========================
  // Referencia al componente MapView para controlarlo programáticamente
  const mapRef = useRef(null);
  
  // Ubicación actual del usuario (lat, lng)
  const [userLocation, setUserLocation] = useState(null);
  
  // Estado de carga (cuando se está obteniendo la ubicación)
  const [loading, setLoading] = useState(true);
  
  // Región actual del mapa (lat, lng, latDelta, lngDelta)
  const [region, setRegion] = useState(initialRegion);

  useEffect(() => {
    if (!reports || reports.length === 0 || !mapRef.current) return;

    const coordinates = reports
      .filter(r => r.latitude && r.longitude)
      .map(r => ({
        latitude: r.latitude,
        longitude: r.longitude,
      }));

    if (coordinates.length === 0) return;

    // Solo loggear en modo debug
    if (__DEV__) {
      console.log('📍 Ajustando mapa a coordenadas:', coordinates);
    }
    
    // Esperar un poco más para que el mapa esté completamente renderizado
    const timer = setTimeout(() => {
      if (mapRef.current) {
        try {
          if (coordinates.length === 1) {
            // Si solo hay un marcador, hacer zoom directo a esa ubicación
            mapRef.current.animateToRegion({
              latitude: coordinates[0].latitude,
              longitude: coordinates[0].longitude,
              latitudeDelta: 0.01,  // Zoom cercano
              longitudeDelta: 0.01,
            }, 1000);
          } else {
            // Si hay múltiples marcadores, ajustar para mostrar todos
            mapRef.current.fitToCoordinates(coordinates, {
              edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
              animated: true,
            });
          }
        } catch (error) {
          console.error('Error ajustando región del mapa:', error);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [reports]);

  useEffect(() => {
    getUserLocation();
  }, []);

  const getUserLocation = async () => {
    try {
      const location = await getCurrentLocation();
      
      if (location.error || !location.latitude || !location.longitude) {
        Alert.alert(
          'Error de ubicación',
          'No se pudo obtener tu ubicación. Por favor, verifica los permisos.',
        );
        setLoading(false);
        return;
      }

      setUserLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      });

      if (!region) {
        setRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
      setLoading(false);
    }
  };

  const handleMapPress = (event) => {
    if (allowLocationSelection && onLocationSelect) {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      onLocationSelect({ latitude, longitude });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <MapErrorBoundary style={style} reports={reports}>
      <View style={[styles.container, style]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
          showsUserLocation={showUserLocation}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
          loadingEnabled={true}
          onRegionChangeComplete={setRegion}
          onPress={handleMapPress}
        >
        {showRadius && userLocation && (
          <Circle
            center={userLocation}
            radius={radiusMeters}
            strokeColor="rgba(0, 122, 255, 0.3)"
            fillColor="rgba(0, 122, 255, 0.1)"
            strokeWidth={2}
          />
        )}

        {/* Marcador de prueba simple */}
        <Marker
          coordinate={{
            latitude: -27.4692117,
            longitude: -58.8306333,
          }}
          pinColor="red"
          title="PRUEBA"
          description="Si ves esto, los marcadores funcionan"
          titleStyle={{ color: 'white' }}
          descriptionStyle={{ color: 'white' }}
        />

        {/* Marcadores de reportes - usando marcadores nativos simples */}
        {reports.map((report, index) => {
          let latitude, longitude;
          
          if (report.latitude && report.longitude) {
            latitude = report.latitude;
            longitude = report.longitude;
          }

          if (!latitude || !longitude) {
            console.log('⚠️ Reporte sin coordenadas válidas');
            return null;
          }

          const isLost = report.type === 'lost';
          const markerColor = isLost ? '#FF3B30' : '#34C759';
          
          // Solo loggear en modo debug o cuando hay cambios significativos
          if (__DEV__ && index === 0) {
            console.log('🗺️ Renderizando marcadores para reportes:', {
              total: reports.length,
              sample: {
                id: report.id,
                type: report.type,
                coordinates: { latitude, longitude }
              }
            });
          }

          return (
            <Marker
              key={report.id}
              coordinate={{ latitude, longitude }}
              pinColor={isLost ? 'red' : 'green'}
              title={report.pet_name || (isLost ? 'Mascota Perdida' : 'Mascota Encontrada')}
              description={report.breed || report.species || 'Ver detalles'}
              titleStyle={{ color: 'white' }}
              descriptionStyle={{ color: 'white' }}
              onPress={() => {
                if (onMarkerPress) {
                  onMarkerPress(report);
                } else if (onReportPress) {
                  onReportPress(report);
                }
              }}
            />
          );
        })}

        {allowLocationSelection && selectedLocation && (
          <Marker
            coordinate={selectedLocation}
            pinColor="#007AFF"
            title="Ubicación seleccionada"
            titleStyle={{ color: 'white' }}
          />
        )}
      </MapView>
    </View>
    </MapErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  errorTitle: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  errorHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default CustomMapView;

