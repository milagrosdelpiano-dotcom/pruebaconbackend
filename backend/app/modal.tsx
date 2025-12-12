/**
 * Pantalla Modal de Ejemplo
 * ==========================
 * 
 * Esta es una pantalla modal de ejemplo proporcionada por Expo Router.
 * Se puede usar como plantilla para crear modales personalizados.
 * 
 * NOTA: Este archivo es principalmente una plantilla de ejemplo.
 * Puede ser modificado o eliminado según las necesidades del proyecto.
 */

// =========================
// Imports de Expo Router
// =========================
import { Link } from 'expo-router';

// =========================
// Imports de React Native
// =========================
import { StyleSheet } from 'react-native';

// =========================
// Imports de Componentes
// =========================
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/**
 * Componente de pantalla modal de ejemplo
 * 
 * Muestra un mensaje simple y un enlace para volver a la pantalla principal.
 * Este es un componente de ejemplo que puede ser personalizado.
 */
export default function ModalScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">This is a modal</ThemedText>
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="link">Go to home screen</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
