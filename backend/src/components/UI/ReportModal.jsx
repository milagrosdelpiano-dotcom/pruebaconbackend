/**
 * Modal de Detalles de Reporte
 * =============================
 * 
 * Este componente muestra un modal con información resumida de un reporte.
 * Se usa en el mapa para mostrar detalles rápidos cuando el usuario hace clic
 * en un marcador.
 * 
 * Funcionalidades:
 * - Mostrar información básica del reporte (tipo, especie, nombre, etc.)
 * - Mostrar primera foto de la mascota
 * - Mostrar distancia desde el usuario
 * - Botones para ver detalles completos o contactar
 * - Formateo de fechas y distancias
 * 
 * Este modal es una vista previa rápida. Para ver todos los detalles,
 * el usuario debe hacer clic en "Ver detalles" que navega a la pantalla completa.
 */

import { Image } from 'expo-image';  // Componente de imagen optimizado de Expo
import React from 'react';  // React
import { Dimensions, StyleSheet, View } from 'react-native';  // Componentes básicos
import {
    Avatar,  // Avatar de usuario
    Button,  // Botón de Material Design
    Card,  // Tarjeta de Material Design
    Chip,  // Chip para mostrar etiquetas
    Divider,  // Divisor visual
    IconButton,  // Botón con ícono
    Modal,  // Modal de Material Design
    Text  // Texto simple
} from 'react-native-paper';  // Componentes de Material Design

// Obtener dimensiones de la ventana para ajustar el tamaño del modal
const { width, height } = Dimensions.get('window');

/**
 * Componente de modal de reporte
 * 
 * @param {boolean} visible - Si el modal está visible
 * @param {object} report - Datos del reporte a mostrar
 * @param {Function} onClose - Callback cuando se cierra el modal
 * @param {Function} onViewDetails - Callback cuando se presiona "Ver detalles"
 * @param {Function} onContact - Callback cuando se presiona "Contactar"
 */
const ReportModal = ({ 
  visible,  // Controla si el modal está visible
  report,  // Datos del reporte
  onClose,  // Función para cerrar el modal
  onViewDetails,  // Función para navegar a detalles completos
  onContact  // Función para contactar al reportero
}) => {
  // Si no hay reporte, no renderizar nada
  if (!report) return null;

  // Determinar si es un reporte de mascota perdida o encontrada
  const isLost = report.type === 'lost';

  const getSpeciesEmoji = (species) => {
    switch (species) {
      case 'dog': return '🐕';
      case 'cat': return '🐈';
      case 'bird': return '🐦';
      case 'rabbit': return '🐰';
      default: return '🐾';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onClose}
      contentContainerStyle={styles.modalContainer}
    >
      <Card style={styles.modalCard}>
        {/* Header con botón de cerrar */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.modalTitle}>
              {isLost ? '🔴 Mascota Perdida' : '🟢 Mascota Encontrada'}
            </Text>
            <Chip 
              mode="outlined"
              style={[styles.statusChip, { 
                borderColor: report.status === 'active' ? '#34C759' : '#FF9500' 
              }]}
              textStyle={{ 
                color: report.status === 'active' ? '#34C759' : '#FF9500',
                fontSize: 12
              }}
            >
              {report.status === 'active' ? 'Activo' : 'Resuelto'}
            </Chip>
          </View>
          <IconButton
            icon="close"
            size={20}
            onPress={onClose}
            style={styles.closeButton}
          />
        </View>

        {/* Imagen principal */}
        {report.photos && report.photos.length > 0 && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: report.photos[0] }}
              style={styles.mainImage}
              contentFit="cover"
            />
          </View>
        )}

        {/* Información del reporte */}
        <Card.Content style={styles.content}>
          <View style={styles.petInfo}>
            <Text style={styles.petName}>
              {report.pet_name || (isLost ? 'Mascota Perdida' : 'Mascota Encontrada')}
            </Text>
            <View style={styles.speciesContainer}>
              <Text style={styles.speciesEmoji}>
                {getSpeciesEmoji(report.species)}
              </Text>
              <Text style={styles.speciesText}>
                {report.breed || report.species || 'Sin información'}
              </Text>
            </View>
          </View>

          {/* Descripción */}
          {report.description && (
            <>
              <Divider style={styles.divider} />
              <Text style={styles.description} numberOfLines={3}>
                {report.description}
              </Text>
            </>
          )}

          {/* Información de ubicación y distancia */}
          <View style={styles.locationInfo}>
            <Text style={styles.locationText} numberOfLines={2}>
              📍 {report.location_description || 'Sin descripción de ubicación'}
            </Text>
            {report.distance_meters !== undefined && (
              <Text style={styles.distanceText}>
                {formatDistance(report.distance_meters)} de distancia
              </Text>
            )}
          </View>

          {/* Información del contacto */}
          <View style={styles.contactInfo}>
            <View style={styles.reporterInfo}>
              <Avatar.Text 
                size={32} 
                label={report.reporter_name ? report.reporter_name.charAt(0).toUpperCase() : 'U'} 
                style={styles.avatar}
              />
              <View style={styles.reporterDetails}>
                <Text style={styles.reporterName}>
                  {report.reporter_name || 'Usuario'}
                </Text>
                <Text style={styles.reportDate}>
                  {formatDate(report.created_at)}
                </Text>
              </View>
            </View>
          </View>
        </Card.Content>

        {/* Botones de acción */}
        <Card.Actions style={styles.actions}>
          <Button
            mode="outlined"
            onPress={() => onViewDetails?.()}
            style={styles.detailsButton}
            compact
            >
              Ver detalles
            </Button>
          <Button
            mode="contained"
            onPress={onContact}
            style={styles.contactButton}
            compact
            icon="message"
            >
              Contactar
            </Button>
        </Card.Actions>
      </Card>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    margin: 16,
    marginBottom: 32,
    borderRadius: 16,
    maxHeight: height * 0.75,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginRight: 8,
  },
  statusChip: {
    height: 24,
  },
  closeButton: {
    margin: 0,
  },
  imageContainer: {
    height: 200,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  content: {
    paddingTop: 0,
  },
  petInfo: {
    marginBottom: 12,
  },
  petName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  speciesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speciesEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  speciesText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  divider: {
    marginVertical: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333333',
  },
  locationInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  locationText: {
    fontSize: 13,
    color: '#333333',
    marginBottom: 4,
    fontWeight: '500',
  },
  distanceText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  contactInfo: {
    marginTop: 16,
  },
  reporterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 12,
  },
  reporterDetails: {
    flex: 1,
  },
  reporterName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  reportDate: {
    fontSize: 12,
    color: '#333333',
    marginTop: 2,
    fontWeight: '500',
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  detailsButton: {
    flex: 1,
    marginRight: 8,
  },
  contactButton: {
    flex: 1,
    marginLeft: 8,
  },
});

export default ReportModal;

