/**
 * Servicio de Selección de Imágenes
 * ==================================
 * 
 * Este servicio proporciona un wrapper robusto para ImagePicker de Expo
 * que maneja errores de API y simplifica el uso de selección de imágenes.
 * 
 * Funcionalidades:
 * - Solicitar permisos de galería y cámara
 * - Seleccionar imágenes de la galería
 * - Tomar fotos con la cámara
 * - Manejo robusto de errores y permisos
 * 
 * Este servicio abstrae las diferencias entre versiones de ImagePicker
 * y proporciona una API consistente para toda la aplicación.
 */

// Wrapper robusto para ImagePicker que maneja errores de API
import * as ImagePicker from 'expo-image-picker';  // API de Expo para seleccionar imágenes
import { Alert } from 'react-native';  // Para mostrar alertas

/**
 * Servicio de selección de imágenes
 * 
 * Proporciona métodos simplificados para trabajar con ImagePicker,
 * manejando automáticamente permisos y errores.
 */
export const ImagePickerService = {
  /**
   * Solicita permisos de acceso a la galería
   * 
   * @returns {Promise<boolean>} true si el permiso fue otorgado, false en caso contrario
   * 
   * Esta función solicita permisos de acceso a la galería de fotos del dispositivo.
   * En iOS y Android, el usuario debe aprobar explícitamente el permiso.
   */
  async requestGalleryPermissions() {
    try {
      // Solicitar permisos de acceso a la galería
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      // Retornar true si el permiso fue otorgado
      return status === 'granted';
    } catch (error) {
      console.error('Error solicitando permisos de galería:', error);
      return false;
    }
  },

  // Solicitar permisos de cámara
  async requestCameraPermissions() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error solicitando permisos de cámara:', error);
      return false;
    }
  },

  // Seleccionar imagen de galería
  async pickImageFromGallery() {
    try {
      const hasPermission = await this.requestGalleryPermissions();
      if (!hasPermission) {
        Alert.alert('Permisos necesarios', 'Necesitas permitir el acceso a la galería para seleccionar fotos');
        return null;
      }

      // Usar la API correcta según la versión
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images', // Usar string en lugar de MediaType.Images
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error('Error seleccionando imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
      return null;
    }
  },

  // Tomar foto con cámara
  async takePhotoWithCamera() {
    try {
      const hasPermission = await this.requestCameraPermissions();
      if (!hasPermission) {
        Alert.alert('Permisos necesarios', 'Necesitas permitir el acceso a la cámara para tomar fotos');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error('Error tomando foto:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
      return null;
    }
  }
};
