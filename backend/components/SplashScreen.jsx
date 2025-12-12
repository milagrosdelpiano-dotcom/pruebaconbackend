/**
 * Componente de Pantalla de Inicio (Splash Screen)
 * ================================================
 * 
 * Este componente muestra una animación de video al iniciar la aplicación.
 * Se reproduce automáticamente y cuando termina, llama a la función onFinish
 * para continuar con la carga de la aplicación.
 * 
 * Funcionalidades:
 * - Reproducir video de logo animado automáticamente
 * - Detectar cuando el video termina
 * - Llamar a onFinish cuando termina o si hay error
 * - Manejar errores de carga del video
 */

// =========================
// Imports de Expo AV
// =========================
import { ResizeMode, Video } from 'expo-av';

// =========================
// Imports de React
// =========================
import React, { useEffect, useRef } from 'react';

// =========================
// Imports de React Native
// =========================
import {
  Dimensions,         // Para obtener dimensiones de la pantalla
  StyleSheet,         // Para estilos
  View,               // Componente de vista básico
} from 'react-native';

// Obtener dimensiones de la ventana para ajustar el tamaño del video
const { width, height } = Dimensions.get('window');

/**
 * Componente principal de la pantalla de inicio
 * 
 * @param {Function} onFinish - Función a llamar cuando el video termina o hay error
 */
export default function SplashScreen({ onFinish }) {
  // Referencia al componente Video para controlarlo programáticamente
  const videoRef = useRef(null);

  /**
   * Efecto que se ejecuta al montar el componente
   * Configura y carga el video para reproducirlo automáticamente
   */
  useEffect(() => {
    // Configurar el video para que se reproduzca automáticamente
    const setupVideo = async () => {
      if (videoRef.current) {
        try {
          // Cargar el video desde los assets
          // El video se reproduce automáticamente, sin loop, y sin sonido
          await videoRef.current.loadAsync(
            require('../assets/images/Logo_Animado_Para_Aplicación_PetAlert - Trim.mp4'),
            {
              shouldPlay: true,   // Reproducir automáticamente
              isLooping: false,    // No repetir
              isMuted: true,      // Sin sonido
            }
          );
        } catch (error) {
          console.error('Error cargando el video:', error);
          // Si hay error, llamar onFinish después de 1 segundo
          // Esto asegura que la app continúe incluso si el video no carga
          setTimeout(() => onFinish && onFinish(), 1000);
        }
      }
    };

    setupVideo();
  }, []);

  /**
   * Maneja las actualizaciones del estado de reproducción del video
   * 
   * @param {object} status - Estado actual de la reproducción del video
   * 
   * Cuando el video termina (didJustFinish), llama a onFinish para continuar
   * con la carga de la aplicación.
   */
  const handlePlaybackStatusUpdate = (status) => {
    if (status.didJustFinish) {
      // Cuando el video termine, llamar onFinish para continuar
      onFinish && onFinish();
    }
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={true}
        isLooping={false}
        isMuted={true}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Blanco puro para coincidir con el video
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: width * 0.9, // 90% del ancho de la pantalla para mejor visibilidad
    height: height * 0.5, // 50% de la altura de la pantalla
    maxWidth: 400, // Máximo ancho aumentado para mejor visualización
    maxHeight: 300, // Máximo alto aumentado para mejor visualización
  },
});
