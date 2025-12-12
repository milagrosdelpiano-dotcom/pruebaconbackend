/**
 * Pantalla de configuración de alertas geográficas
 * Accesible desde el perfil del usuario
 */

// =========================
// Imports de React Native
// =========================
import React from 'react';
import { StyleSheet, SafeAreaView, Platform, StatusBar, TouchableOpacity } from 'react-native';

// =========================
// Imports de Expo Router
// =========================
import { Stack, useRouter } from 'expo-router';

// =========================
// Imports de Componentes
// =========================
import { GeoAlertsSettings } from '../components/GeoAlerts/GeoAlertsSettings';
import { Ionicons } from '@expo/vector-icons';

/**
 * Componente principal de la pantalla de configuración de alertas geográficas
 */
export default function GeoAlertsSettingsScreen() {
  // Router para navegación
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Alertas Geográficas',
          headerShown: false,  // Ocultar header nativo para usar el botón personalizado
          presentation: 'modal',
        }}
      />
      <GeoAlertsSettings onClose={() => {
        // Intentar cerrar de múltiples formas para asegurar que funcione
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/profile');
        }
      }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  closeButton: {
    marginLeft: 16,
    padding: 8,
    borderRadius: 20,
  },
});


