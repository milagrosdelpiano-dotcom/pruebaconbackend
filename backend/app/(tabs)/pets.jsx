/**
 * Pantalla de Mis Mascotas
 * ========================
 * 
 * Esta pantalla muestra todas las mascotas registradas del usuario.
 * 
 * Funcionalidades:
 * - Listar todas las mascotas del usuario
 * - Ver detalles de cada mascota
 * - Crear nueva mascota
 * - Pull-to-refresh para actualizar la lista
 * - Navegar a detalles de mascota
 * 
 * Las mascotas se cargan desde Supabase usando el servicio de mascotas.
 */

import React, { useEffect, useState } from 'react';  // Hooks de React
import { ScrollView, StyleSheet, View, TouchableOpacity, Image, RefreshControl } from 'react-native';  // Componentes básicos
import { ActivityIndicator, Card, Text, Title, Button } from 'react-native-paper';  // Componentes de Material Design
import { SafeAreaView } from 'react-native-safe-area-context';  // View que respeta áreas seguras
import { useRouter } from 'expo-router';  // Hook de navegación
import { petService } from '../../src/services/supabase';  // Servicio de mascotas
import { useAuthStore } from '../../src/stores/authStore';  // Store de autenticación

/**
 * Componente principal de la pantalla de mascotas
 */
export default function PetsScreen() {
  // =========================
  // Hooks y Stores
  // =========================
  // Obtener funciones y estado del store de autenticación
  const { 
    getUserId,  // Función para obtener ID del usuario
    isAuthenticated,  // Función para verificar si está autenticado
    user  // Usuario actual
  } = useAuthStore();
  
  // Router para navegación
  const router = useRouter();
  
  // =========================
  // Estado Local
  // =========================
  // Lista de mascotas del usuario
  const [pets, setPets] = useState([]);
  
  // Estado de carga inicial (cuando se carga la pantalla por primera vez)
  const [loading, setLoading] = useState(true);
  
  // Error al cargar mascotas (si hay)
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUserPets();
  }, []);

  const loadUserPets = async () => {
    try {
      setError(null);
      setLoading(true);
      
      // Verificar autenticación
      if (!isAuthenticated()) {
        console.warn('Usuario no autenticado');
        setError('Debes iniciar sesión para ver tus mascotas');
        setLoading(false);
        return;
      }

      const userId = getUserId();
      console.log('🔍 Cargando mascotas para usuario:', userId);
      
      if (!userId) {
        console.warn('No se pudo obtener el ID del usuario');
        setError('No se pudo obtener tu información de usuario');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await petService.getUserPets(userId);
      
      if (fetchError) {
        console.error('❌ Error cargando mascotas:', fetchError);
        setError(`Error al cargar mascotas: ${fetchError.message || fetchError}`);
        setPets([]);
      } else {
        console.log('✅ Mascotas cargadas:', data?.length || 0);
        setPets(data || []);
        setError(null);
      }
    } catch (error) {
      console.error('❌ Error inesperado:', error);
      setError(`Error inesperado: ${error.message || error}`);
      setPets([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando mascotas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Si hay error, mostrarlo
  if (error && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Title style={styles.title}>Mis Mascotas</Title>
          <Card style={styles.errorCard}>
            <Card.Content style={styles.errorContent}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
              <Button
                mode="contained"
                onPress={loadUserPets}
                style={styles.retryButton}
              >
                Reintentar
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
      <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadUserPets} />
        }
      >
        <View style={styles.header}>
          <Title style={styles.title}>Mis Mascotas</Title>
          <Button
            mode="contained"
            onPress={() => router.push('/pets/create')}
            icon="plus"
            style={styles.addButton}
            compact
          >
            Nueva Mascota
          </Button>
        </View>
        
        {/* Debug info (solo en desarrollo) */}
        {__DEV__ && user && (
          <Card style={styles.debugCard}>
            <Card.Content>
              <Text style={styles.debugText}>
                Usuario: {user.email || user.id?.substring(0, 8)}...
              </Text>
              <Text style={styles.debugText}>
                Mascotas encontradas: {pets.length}
              </Text>
            </Card.Content>
          </Card>
        )}
        
        {pets.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text style={styles.emptyText}>
                🐾 No tienes mascotas registradas aún
              </Text>
              <Text style={styles.emptySubtext}>
                Registra tu primera mascota para poder crear reportes
              </Text>
              <Button
                mode="contained"
                onPress={() => router.push('/pets/create')}
                style={styles.createButton}
                icon="plus"
              >
                Registrar Mi Primera Mascota
              </Button>
              {__DEV__ && (
                <Button
                  mode="outlined"
                  onPress={() => {
                    console.log('Usuario:', user);
                    console.log('UserId:', getUserId());
                    console.log('Autenticado:', isAuthenticated());
                  }}
                  style={styles.debugButton}
                >
                  Ver Info Debug
                </Button>
              )}
            </Card.Content>
          </Card>
        ) : (
          pets.map((pet) => (
            <TouchableOpacity
              key={pet.id}
              onPress={() => router.push(`/pets/${pet.id}`)}
              activeOpacity={0.7}
            >
              <Card style={styles.petCard}>
                <Card.Content style={styles.petCardContent}>
                  {pet.photos && pet.photos.length > 0 && pet.photos[0] && (
                    <Image
                      source={{ uri: pet.photos[0] }}
                      style={styles.petImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.petInfoContainer}>
                    <Text style={styles.petName}>
                      {pet.name || 'Sin nombre'}
                    </Text>
                    <Text style={styles.petInfo}>
                      🐕 {pet.species === 'dog' ? 'Perro' : pet.species === 'cat' ? 'Gato' : 'Otro'} • {pet.breed || 'Raza no especificada'}
                    </Text>
                    <Text style={styles.petInfo}>
                      📏 Tamaño: {pet.size === 'small' ? 'Pequeño' : pet.size === 'medium' ? 'Mediano' : 'Grande'}
                    </Text>
                    <Text style={styles.petInfo}>
                      🎨 Color: {pet.color || 'No especificado'}
                    </Text>
                    {pet.is_lost && (
                      <Text style={styles.lostStatus}>
                        ⚠️ MASCOTA PERDIDA
                      </Text>
                    )}
                    <Text style={styles.petDate}>
                      📅 Registrado: {new Date(pet.created_at).toLocaleDateString()}
                    </Text>
                    <Button
                      mode="outlined"
                      onPress={() => router.push(`/pets/${pet.id}`)}
                      style={styles.viewButton}
                    >
                      Ver Detalles y Salud
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))
        )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  addButton: {
    marginLeft: 12,
  },
  createButton: {
    marginTop: 16,
  },
  emptyCard: {
    marginTop: 40,
    elevation: 2,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  petCard: {
    marginBottom: 16,
    elevation: 2,
  },
  petCardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  petImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 12,
  },
  petInfoContainer: {
    flex: 1,
  },
  petName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  viewButton: {
    marginTop: 12,
  },
  petInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  lostStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginTop: 8,
    marginBottom: 4,
  },
  petDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  errorCard: {
    marginTop: 40,
    elevation: 2,
    backgroundColor: '#ffebee',
  },
  errorContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#c62828',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
  },
  debugCard: {
    marginBottom: 16,
    backgroundColor: '#e3f2fd',
  },
  debugText: {
    fontSize: 12,
    color: '#1976d2',
    fontFamily: 'monospace',
  },
  debugButton: {
    marginTop: 12,
  },
});

