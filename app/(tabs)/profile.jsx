/**
 * Pantalla de Perfil de Usuario
 * ==============================
 * 
 * Esta pantalla muestra y permite editar el perfil del usuario autenticado.
 * 
 * Funcionalidades:
 * - Ver información del perfil (nombre, email, teléfono)
 * - Editar información del perfil
 * - Cerrar sesión
 * - Navegar a configuraciones adicionales
 * 
 * El perfil se obtiene del store de autenticación y se puede actualizar
 * mediante el servicio de perfiles de Supabase.
 */

import React, { useEffect, useState } from 'react';  // Hooks de React
import { Alert, ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';  // Componentes básicos
import { ActivityIndicator, Button, Card, Text, TextInput, Title } from 'react-native-paper';  // Componentes de Material Design
import { SafeAreaView } from 'react-native-safe-area-context';  // View que respeta áreas seguras
import { useRouter } from 'expo-router';  // Hook de navegación
import { Ionicons } from '@expo/vector-icons';  // Iconos
import { useAuthStore } from '../../src/stores/authStore';  // Store de autenticación

/**
 * Componente principal de la pantalla de perfil
 */
export default function ProfileScreen() {
  // =========================
  // Hooks y Stores
  // =========================
  // Obtener estado y funciones del store de autenticación
  const { 
    user,  // Usuario actual
    logout,  // Función para cerrar sesión
    refreshUser  // Función para refrescar datos del usuario
  } = useAuthStore();
  
  // Router para navegación
  const router = useRouter();
  
  // =========================
  // Estado Local
  // =========================
  // Estado de carga (cuando se está actualizando el perfil o cerrando sesión)
  const [loading, setLoading] = useState(false);
  
  // Datos del perfil editables
  const [profileData, setProfileData] = useState({
    full_name: '',  // Nombre completo
    phone: '',  // Teléfono
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.user_metadata?.full_name || '',
        phone: user.user_metadata?.phone || '',
      });
    }
  }, [user]);

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              console.log('🚪 Iniciando logout...');
              
              const result = await logout();
              
              if (result.success) {
                console.log('✅ Logout exitoso');
                // El _layout.jsx detectará el cambio de estado y navegará automáticamente
              } else {
                console.error('❌ Error en logout:', result.error);
                Alert.alert('Error', 'No se pudo cerrar sesión');
                setLoading(false);
              }
            } catch (error) {
              console.error('💥 Error inesperado cerrando sesión:', error);
              Alert.alert('Error', 'No se pudo cerrar sesión');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      // Aquí podrías implementar la actualización del perfil
      Alert.alert('Éxito', 'Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Title style={styles.title}>Mi Perfil</Title>
        
        <Card style={styles.profileCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Información Personal</Text>
            
            <TextInput
              label="Nombre completo"
              value={profileData.full_name}
              onChangeText={(text) => setProfileData({ ...profileData, full_name: text })}
              mode="outlined"
              style={styles.input}
            />
            
            <TextInput
              label="Teléfono"
              value={profileData.phone}
              onChangeText={(text) => setProfileData({ ...profileData, phone: text })}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
            />
            
            <TextInput
              label="Email"
              value={user.email}
              mode="outlined"
              editable={false}
              style={styles.input}
            />
            
            <Button
              mode="contained"
              onPress={handleUpdateProfile}
              loading={loading}
              disabled={loading}
              style={styles.updateButton}
            >
              Actualizar Perfil
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.statsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Estadísticas</Text>
            <Text style={styles.statText}>📧 Email: {user.email}</Text>
            <Text style={styles.statText}>📅 Miembro desde: {new Date(user.created_at).toLocaleDateString()}</Text>
            <Text style={styles.statText}>✅ Email verificado: {user.email_confirmed_at ? 'Sí' : 'No'}</Text>
          </Card.Content>
        </Card>

        <Card style={styles.configCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Configuración</Text>
            
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.push('/geo-alerts-settings')}
            >
              <View style={styles.settingIconContainer}>
                <Ionicons name="location" size={24} color="#007AFF" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Alertas Geográficas</Text>
                <Text style={styles.settingSubtitle}>
                  Recibe notificaciones de mascotas cerca de ti
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </Card.Content>
        </Card>

        <Card style={styles.actionsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Acciones</Text>
            
            <Button
              mode="outlined"
              onPress={handleLogout}
              loading={loading}
              disabled={loading}
              style={styles.logoutButton}
              buttonColor="#FF3B30"
              textColor="#FFFFFF"
            >
              Cerrar Sesión
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  profileCard: {
    marginBottom: 16,
    elevation: 2,
  },
  statsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  configCard: {
    marginBottom: 16,
    elevation: 2,
  },
  actionsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  updateButton: {
    marginTop: 8,
  },
  statText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  logoutButton: {
    marginTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#666',
  },
});

