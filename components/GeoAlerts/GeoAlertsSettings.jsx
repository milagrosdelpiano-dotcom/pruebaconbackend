/**
 * Componente de configuración de alertas geográficas
 * Permite al usuario configurar:
 * - Habilitar/deshabilitar rastreo de ubicación
 * - Radio de alertas
 * - Tipos de reportes a recibir
 * - Filtros de especies
 * - Horario silencioso
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGeoAlerts } from '../../hooks/useGeoAlerts';

const RADIUS_OPTIONS = [
  { label: '500m', value: 500 },
  { label: '1km', value: 1000 },
  { label: '2km', value: 2000 },
  { label: '5km', value: 5000 },
];

const ALERT_TYPES = [
  { label: 'Mascotas perdidas', value: 'lost', icon: 'search' },
  { label: 'Mascotas encontradas', value: 'found', icon: 'checkmark-circle' },
];

const SPECIES_OPTIONS = [
  { label: 'Perros', value: 'dog', icon: '🐕' },
  { label: 'Gatos', value: 'cat', icon: '🐈' },
  { label: 'Aves', value: 'bird', icon: '🦜' },
  { label: 'Otros', value: 'other', icon: '🐾' },
];

export function GeoAlertsSettings({ onClose }) {
  const {
    locationEnabled,
    currentLocation,
    alertPreferences,
    isLoading,
    error,
    permissionStatus,
    toggleLocationTracking,
    updateAlertRadius,
    updateAlertTypes,
    updateSpeciesFilter,
    toggleAlerts,
    forceLocationUpdate,
  } = useGeoAlerts();

  const [selectedRadius, setSelectedRadius] = useState(1000);
  const [selectedTypes, setSelectedTypes] = useState(['lost']);
  const [selectedSpecies, setSelectedSpecies] = useState(null); // null = todas
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [locationTracking, setLocationTracking] = useState(false);

  // Cargar preferencias iniciales
  useEffect(() => {
    if (alertPreferences) {
      setSelectedRadius(alertPreferences.radius_meters || 1000);
      setSelectedTypes(alertPreferences.alert_types || ['lost']);
      setSelectedSpecies(alertPreferences.species_filter);
      setAlertsEnabled(alertPreferences.enabled !== false);
    }
  }, [alertPreferences]);

  useEffect(() => {
    setLocationTracking(locationEnabled);
  }, [locationEnabled]);

  // Manejar cambio de rastreo de ubicación
  const handleToggleLocation = async (enabled) => {
    if (enabled && permissionStatus !== 'granted') {
      Alert.alert(
        'Permisos requeridos',
        'Para recibir alertas de mascotas cercanas, necesitamos acceso a tu ubicación.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Permitir',
            onPress: async () => {
              const success = await toggleLocationTracking(enabled);
              if (!success) {
                Alert.alert(
                  'Error',
                  'No se pudieron obtener los permisos de ubicación. Por favor, habilítalos en la configuración de tu dispositivo.'
                );
              }
            },
          },
        ]
      );
    } else {
      const success = await toggleLocationTracking(enabled);
      if (!success && enabled) {
        Alert.alert('Error', 'No se pudo activar el rastreo de ubicación');
      }
    }
  };

  // Manejar cambio de radio
  const handleRadiusChange = async (radius) => {
    setSelectedRadius(radius);
    const success = await updateAlertRadius(radius);
    if (!success) {
      Alert.alert('Error', 'No se pudo actualizar el radio de alertas');
    }
  };

  // Manejar cambio de tipos de alerta
  const handleTypeToggle = async (type) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];

    if (newTypes.length === 0) {
      Alert.alert('Aviso', 'Debes seleccionar al menos un tipo de alerta');
      return;
    }

    setSelectedTypes(newTypes);
    const success = await updateAlertTypes(newTypes);
    if (!success) {
      Alert.alert('Error', 'No se pudo actualizar los tipos de alerta');
      setSelectedTypes(selectedTypes); // revertir
    }
  };

  // Manejar cambio de especies
  const handleSpeciesToggle = async (species) => {
    let newSpecies;
    
    if (selectedSpecies === null) {
      // Si está en "todas", seleccionar solo esta
      newSpecies = [species];
    } else if (selectedSpecies.includes(species)) {
      // Si ya está seleccionada, quitarla
      newSpecies = selectedSpecies.filter((s) => s !== species);
      // Si no queda ninguna, volver a "todas"
      if (newSpecies.length === 0) {
        newSpecies = null;
      }
    } else {
      // Agregar a la lista
      newSpecies = [...selectedSpecies, species];
    }

    setSelectedSpecies(newSpecies);
    const success = await updateSpeciesFilter(newSpecies);
    if (!success) {
      Alert.alert('Error', 'No se pudo actualizar el filtro de especies');
      setSelectedSpecies(selectedSpecies); // revertir
    }
  };

  // Manejar activación/desactivación de alertas
  const handleToggleAlerts = async (enabled) => {
    setAlertsEnabled(enabled);
    const success = await toggleAlerts(enabled);
    if (!success) {
      Alert.alert('Error', 'No se pudo cambiar el estado de las alertas');
      setAlertsEnabled(!enabled); // revertir
    }
  };

  // Actualizar ubicación manualmente
  const handleForceUpdate = async () => {
    const success = await forceLocationUpdate();
    if (success) {
      Alert.alert('✅', 'Ubicación actualizada correctamente');
    } else {
      Alert.alert('Error', 'No se pudo actualizar la ubicación');
    }
  };

  if (isLoading && !alertPreferences) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando configuración...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Botón de cerrar en la parte superior */}
      {onClose && (
        <View style={styles.closeButtonContainer}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color="#000" />
          </TouchableOpacity>
        </View>
      )}
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Alertas Geográficas</Text>
        <Text style={styles.subtitle}>
          Recibe notificaciones cuando se reporte una mascota cerca de ti
        </Text>
      </View>

      {/* Rastreo de ubicación */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="location" size={24} color="#007AFF" />
          <Text style={styles.sectionTitle}>Rastreo de Ubicación</Text>
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Activar rastreo</Text>
            <Text style={styles.settingDescription}>
              Comparte tu ubicación para recibir alertas
            </Text>
          </View>
          <Switch
            value={locationTracking}
            onValueChange={handleToggleLocation}
            disabled={isLoading}
          />
        </View>

        {locationTracking && currentLocation && (
          <View style={styles.locationInfo}>
            <Text style={styles.locationText}>
              📍 Última actualización:{' '}
              {new Date(currentLocation.timestamp).toLocaleTimeString()}
            </Text>
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleForceUpdate}
              disabled={isLoading}
            >
              <Ionicons name="refresh" size={16} color="#007AFF" />
              <Text style={styles.updateButtonText}>Actualizar ahora</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Alertas activas */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="notifications" size={24} color="#007AFF" />
          <Text style={styles.sectionTitle}>Notificaciones</Text>
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Alertas activas</Text>
            <Text style={styles.settingDescription}>
              Recibir notificaciones push
            </Text>
          </View>
          <Switch
            value={alertsEnabled}
            onValueChange={handleToggleAlerts}
            disabled={isLoading || !locationTracking}
          />
        </View>
      </View>

      {/* Radio de alertas */}
      {locationTracking && alertsEnabled && (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="radio-outline" size={24} color="#007AFF" />
              <Text style={styles.sectionTitle}>Radio de Alertas</Text>
            </View>
            
            <Text style={styles.sectionDescription}>
              Distancia máxima para recibir alertas
            </Text>

            <View style={styles.optionsGrid}>
              {RADIUS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    selectedRadius === option.value && styles.optionButtonActive,
                  ]}
                  onPress={() => handleRadiusChange(option.value)}
                  disabled={isLoading}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedRadius === option.value && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tipos de alertas */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="filter" size={24} color="#007AFF" />
              <Text style={styles.sectionTitle}>Tipos de Alertas</Text>
            </View>
            
            <Text style={styles.sectionDescription}>
              Qué tipo de reportes quieres recibir
            </Text>

            {ALERT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={styles.checkboxRow}
                onPress={() => handleTypeToggle(type.value)}
                disabled={isLoading}
              >
                <View
                  style={[
                    styles.checkbox,
                    selectedTypes.includes(type.value) && styles.checkboxActive,
                  ]}
                >
                  {selectedTypes.includes(type.value) && (
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  )}
                </View>
                <Ionicons name={type.icon} size={20} color="#666" style={styles.typeIcon} />
                <Text style={styles.checkboxLabel}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Filtro de especies */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="paw" size={24} color="#007AFF" />
              <Text style={styles.sectionTitle}>Especies</Text>
            </View>
            
            <Text style={styles.sectionDescription}>
              Filtrar por tipo de mascota (vacío = todas)
            </Text>

            <View style={styles.speciesGrid}>
              {SPECIES_OPTIONS.map((species) => {
                const isSelected =
                  selectedSpecies === null || selectedSpecies.includes(species.value);
                return (
                  <TouchableOpacity
                    key={species.value}
                    style={[
                      styles.speciesButton,
                      isSelected && styles.speciesButtonActive,
                    ]}
                    onPress={() => handleSpeciesToggle(species.value)}
                    disabled={isLoading}
                  >
                    <Text style={styles.speciesIcon}>{species.icon}</Text>
                    <Text
                      style={[
                        styles.speciesText,
                        isSelected && styles.speciesTextActive,
                      ]}
                    >
                      {species.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>
      )}

      {/* Información adicional */}
      <View style={styles.infoSection}>
        <Ionicons name="information-circle-outline" size={20} color="#666" />
        <Text style={styles.infoText}>
          Las alertas se envían automáticamente cuando alguien reporta una mascota
          perdida o encontrada cerca de tu ubicación.
        </Text>
      </View>

      {error && (
        <View style={styles.errorSection}>
          <Ionicons name="alert-circle" size={20} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  closeButtonContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 16,
    zIndex: 1000,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  header: {
    backgroundColor: '#FFF',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 70 : 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 20,
    padding: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5E5',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 10,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingInfo: {
    flex: 1,
    marginRight: 10,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 3,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
  },
  locationInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  locationText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#FFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  updateButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 5,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    minWidth: '45%',
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  optionTextActive: {
    color: '#FFF',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeIcon: {
    marginLeft: 12,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#000',
    marginLeft: 10,
  },
  speciesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  speciesButton: {
    flex: 1,
    minWidth: '45%',
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  speciesButtonActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  speciesIcon: {
    fontSize: 32,
    marginBottom: 5,
  },
  speciesText: {
    fontSize: 14,
    color: '#666',
  },
  speciesTextActive: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  infoSection: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 15,
    marginTop: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5E5',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    marginLeft: 10,
    lineHeight: 18,
  },
  errorSection: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 15,
    marginTop: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FFE5E5',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#FF3B30',
    marginLeft: 10,
  },
  bottomSpacer: {
    height: 40,
  },
});


