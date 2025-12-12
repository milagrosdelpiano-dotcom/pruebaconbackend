/**
 * Layout de Tabs (Navegación Principal)
 * ======================================
 * 
 * Este componente define la navegación por tabs (pestañas) de la aplicación.
 * Las tabs aparecen en la parte inferior de la pantalla y permiten navegar
 * entre las secciones principales de la app.
 * 
 * Tabs disponibles:
 * - Inicio: Mapa con reportes cercanos
 * - Reportes: Lista de reportes del usuario
 * - Mascotas: Lista de mascotas del usuario
 * - Mensajes: Conversaciones del usuario
 * - Perfil: Perfil y configuración del usuario
 * 
 * El layout se adapta automáticamente al tema del sistema (claro/oscuro).
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';  // Iconos de Material Design
import { Tabs } from 'expo-router';  // Componente de tabs de Expo Router
import React from 'react';  // React
import { useColorScheme } from 'react-native';  // Hook para detectar tema del sistema

/**
 * Componente principal del layout de tabs
 */
export default function TabLayout() {
  // Detectar el tema del sistema (claro u oscuro)
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: isDark ? '#8E8E93' : '#999999',
        tabBarStyle: {
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          borderTopColor: isDark ? '#38383A' : '#E5E5E7',
          borderTopWidth: 0.5,
          height: 85,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        headerStyle: {
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          borderBottomColor: isDark ? '#38383A' : '#E5E5E7',
          borderBottomWidth: 0.5,
        },
        headerTintColor: isDark ? '#FFFFFF' : '#000000',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
          headerTitle: '🐾 PetAlert',
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 20,
          },
        }}
      />
      
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reportes',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="file-document" size={size} color={color} />
          ),
          headerTitle: 'Mis Reportes',
        }}
      />
      
      <Tabs.Screen
        name="pets"
        options={{
          title: 'Mascotas',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="paw" size={size} color={color} />
          ),
          headerTitle: 'Mis Mascotas',
        }}
      />
      
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="message" size={size} color={color} />
          ),
          headerTitle: 'Mensajes',
        }}
      />
      
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
          headerTitle: 'Mi Perfil',
        }}
      />
    </Tabs>
  );
}

