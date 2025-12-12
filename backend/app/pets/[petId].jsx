/**
 * Pantalla de Detalles de Mascota
 * ================================
 * 
 * Esta pantalla muestra todos los detalles de una mascota específica,
 * incluyendo información básica, historial de salud, vacunaciones,
 * medicamentos, recordatorios e indicadores de bienestar.
 * 
 * Funcionalidades:
 * - Ver información completa de la mascota
 * - Ver resumen de salud
 * - Ver historial de salud
 * - Ver vacunaciones
 * - Ver medicamentos activos
 * - Ver recordatorios
 * - Ver indicadores de bienestar
 * - Pull-to-refresh para actualizar datos
 * - Navegar a agregar nuevos registros (vacunación, medicamento, etc.)
 * 
 * La pantalla usa tabs para organizar la información en secciones.
 */

// =========================
// Imports de Expo Router
// =========================
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

// =========================
// Imports de React
// =========================
import React, { useEffect, useState } from 'react';

// =========================
// Imports de React Native
// =========================
import {
  Image, // Componente de imagen
  RefreshControl, // Control de pull-to-refresh
  ScrollView, // Para hacer scrollable el contenido
  StyleSheet, // Para estilos
  TouchableOpacity, // Botón táctil
  View, // Componente de vista básico
} from 'react-native';

// =========================
// Imports de React Native Paper
// =========================
import {
  ActivityIndicator, // Spinner de carga
  Button, // Botón de Material Design
  Card, // Tarjeta de Material Design
  Chip, // Chip para mostrar etiquetas
  Divider, // Divisor visual
  FAB, // Floating Action Button
  Text, // Texto simple
  Title, // Título
} from 'react-native-paper';

// =========================
// Imports de Safe Area
// =========================
import { SafeAreaView } from 'react-native-safe-area-context';

// =========================
// Imports de Servicios
// =========================
import { petService } from '../../src/services/supabase';

/**
 * Componente principal de la pantalla de detalles de mascota
 */
export default function PetDetailScreen() {
  // =========================
  // Hooks y Navegación
  // =========================
  // Router para navegación
  const router = useRouter();
  
  // ID de la mascota desde los parámetros de la ruta
  const { petId } = useLocalSearchParams();
  
  // =========================
  // Estado Local
  // =========================
  // Tab activo: 'info', 'health', 'reminders', 'wellness'
  const [activeTab, setActiveTab] = useState('info');
  
  // Datos de la mascota
  const [pet, setPet] = useState(null);
  
  // Resumen de salud de la mascota
  const [healthSummary, setHealthSummary] = useState(null);
  
  // Historial de eventos de salud
  const [healthHistory, setHealthHistory] = useState([]);
  
  // Lista de vacunaciones
  const [vaccinations, setVaccinations] = useState([]);
  
  // Lista de medicamentos
  const [medications, setMedications] = useState([]);
  
  // Lista de recordatorios
  const [reminders, setReminders] = useState([]);
  
  // Indicadores de bienestar (peso, temperatura, etc.)
  const [wellnessIndicators, setWellnessIndicators] = useState([]);
  
  // Estado de carga inicial
  const [loading, setLoading] = useState(true);
  
  // Estado de refresh (pull-to-refresh)
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPetData();
  }, [petId]);

  // Recargar datos cuando la pantalla vuelve a estar enfocada
  useFocusEffect(
    React.useCallback(() => {
      loadPetData();
    }, [petId])
  );

  const loadPetData = async () => {
    try {
      setLoading(true);
      
      // Cargar datos de la mascota con resumen de salud
      const { data: petData, error: petError } = await petService.getPetWithHealth(petId);
      if (petError) {
        console.error('Error cargando mascota:', petError);
        return;
      }
      setPet(petData);
      setHealthSummary(petData.health_summary || {});

      // Cargar datos adicionales según la pestaña activa
      if (activeTab === 'health') {
        await Promise.all([
          loadHealthHistory(),
          loadVaccinations(),
          loadMedications(),
        ]);
      } else if (activeTab === 'reminders') {
        await loadReminders();
      } else if (activeTab === 'wellness') {
        await loadWellnessIndicators();
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHealthHistory = async () => {
    const { data, error } = await petService.getHealthHistory(petId);
    if (!error) setHealthHistory(data || []);
  };

  const loadVaccinations = async () => {
    const { data, error } = await petService.getVaccinations(petId);
    if (!error) setVaccinations(data || []);
  };

  const loadMedications = async () => {
    const { data, error } = await petService.getMedications(petId, true);
    if (!error) setMedications(data || []);
  };

  const loadReminders = async () => {
    const { data, error } = await petService.getReminders(petId, true, true);
    if (!error) setReminders(data || []);
  };

  const loadWellnessIndicators = async () => {
    const { data, error } = await petService.getWellnessIndicators(petId, 30);
    if (!error) setWellnessIndicators(data || []);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPetData();
    setRefreshing(false);
  };

  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    // Cargar datos de la nueva pestaña si no están cargados
    if (tab === 'health' && healthHistory.length === 0) {
      await Promise.all([
        loadHealthHistory(),
        loadVaccinations(),
        loadMedications(),
      ]);
    } else if (tab === 'reminders' && reminders.length === 0) {
      await loadReminders();
    } else if (tab === 'wellness' && wellnessIndicators.length === 0) {
      await loadWellnessIndicators();
    }
  };

  if (loading && !pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando información...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Mascota no encontrada</Text>
          <Button onPress={() => router.back()}>Volver</Button>
        </View>
      </SafeAreaView>
    );
  }

  const tabs = [
    { id: 'info', label: 'Información', icon: '🐾' },
    { id: 'health', label: 'Salud', icon: '🏥' },
    { id: 'wellness', label: 'Bienestar', icon: '📊' },
    { id: 'reminders', label: 'Recordatorios', icon: '🔔' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header con foto */}
        <View style={styles.header}>
          {pet.photos && pet.photos.length > 0 && pet.photos[0] ? (
            <Image
              source={{ uri: pet.photos[0] }}
              style={styles.headerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.headerImagePlaceholder}>
              <Text style={styles.headerImagePlaceholderText}>📷</Text>
            </View>
          )}
          <Title style={styles.petName}>{pet.name}</Title>
          <View style={styles.petBasicInfo}>
            <Chip icon="paw" style={styles.chip}>
              {pet.species === 'dog' ? 'Perro' : pet.species === 'cat' ? 'Gato' : 'Otro'}
            </Chip>
            {pet.breed && (
              <Chip icon="tag" style={styles.chip}>
                {pet.breed}
              </Chip>
            )}
            {pet.size && (
              <Chip icon="ruler" style={styles.chip}>
                {pet.size === 'small' ? 'Pequeño' : pet.size === 'medium' ? 'Mediano' : 'Grande'}
              </Chip>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => handleTabChange(tab.id)}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.icon} {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Divider />

        {/* Contenido según pestaña activa */}
        <View style={styles.content}>
          {activeTab === 'info' && <InfoTab pet={pet} />}
          {activeTab === 'health' && (
            <HealthTab
              pet={pet}
              healthSummary={healthSummary}
              healthHistory={healthHistory}
              vaccinations={vaccinations}
              medications={medications}
              onAddEvent={() => router.push(`/pets/${petId}/add-health-event`)}
              onAddVaccination={() => router.push(`/pets/${petId}/add-vaccination`)}
              onAddMedication={() => router.push(`/pets/${petId}/add-medication`)}
            />
          )}
          {activeTab === 'wellness' && (
            <WellnessTab
              pet={pet}
              indicators={wellnessIndicators}
              onAddIndicator={() => router.push(`/pets/${petId}/add-wellness`)}
            />
          )}
          {activeTab === 'reminders' && (
            <RemindersTab
              pet={pet}
              reminders={reminders}
              onCompleteReminder={async (reminderId) => {
                await petService.completeReminder(reminderId);
                await loadReminders();
              }}
              onAddReminder={() => router.push(`/pets/${petId}/add-reminder`)}
            />
          )}
        </View>
      </ScrollView>

      {/* FAB para agregar contenido */}
      {activeTab === 'health' && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => router.push(`/pets/${petId}/add-health-event`)}
        />
      )}
      {activeTab === 'wellness' && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => router.push(`/pets/${petId}/add-wellness`)}
        />
      )}
      {activeTab === 'reminders' && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => router.push(`/pets/${petId}/add-reminder`)}
        />
      )}
    </SafeAreaView>
  );
}

// Componente de pestaña de información
function InfoTab({ pet }) {
  return (
    <View style={styles.tabContent}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Información Básica</Title>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nombre:</Text>
            <Text style={styles.infoValue}>{pet.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Especie:</Text>
            <Text style={styles.infoValue}>
              {pet.species === 'dog' ? 'Perro' : pet.species === 'cat' ? 'Gato' : 'Otro'}
            </Text>
          </View>
          {pet.breed && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Raza:</Text>
              <Text style={styles.infoValue}>{pet.breed}</Text>
            </View>
          )}
          {pet.color && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Color:</Text>
              <Text style={styles.infoValue}>{pet.color}</Text>
            </View>
          )}
          {pet.size && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tamaño:</Text>
              <Text style={styles.infoValue}>
                {pet.size === 'small' ? 'Pequeño' : pet.size === 'medium' ? 'Mediano' : 'Grande'}
              </Text>
            </View>
          )}
          {pet.description && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Descripción:</Text>
              <Text style={styles.infoValue}>{pet.description}</Text>
            </View>
          )}
          {pet.distinctive_features && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Señales particulares:</Text>
              <Text style={styles.infoValue}>{pet.distinctive_features}</Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </View>
  );
}

// Componente de pestaña de salud
function HealthTab({ pet, healthSummary, healthHistory, vaccinations, medications, onAddEvent, onAddVaccination, onAddMedication }) {
  return (
    <View style={styles.tabContent}>
      {/* Resumen de salud */}
      {healthSummary && (
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Resumen de Salud</Title>
            {healthSummary.ultimo_peso && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Último peso registrado:</Text>
                <Text style={styles.summaryValue}>
                  {healthSummary.ultimo_peso} kg
                  {healthSummary.ultima_fecha_peso && (
                    <Text style={styles.summaryDate}>
                      {' '}({new Date(healthSummary.ultima_fecha_peso).toLocaleDateString()})
                    </Text>
                  )}
                </Text>
              </View>
            )}
            {healthSummary.proxima_vacuna && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Próxima vacuna:</Text>
                <Text style={styles.summaryValue}>
                  {healthSummary.proxima_vacuna_nombre || 'Vacuna'}
                  {' '}({new Date(healthSummary.proxima_vacuna).toLocaleDateString()})
                </Text>
              </View>
            )}
            {healthSummary.medicamentos_activos > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Medicamentos activos:</Text>
                <Text style={styles.summaryValue}>{healthSummary.medicamentos_activos}</Text>
              </View>
            )}
            {healthSummary.recordatorios_pendientes > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Recordatorios pendientes:</Text>
                <Text style={styles.summaryValue}>{healthSummary.recordatorios_pendientes}</Text>
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Vacunaciones */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Title style={styles.cardTitle}>Vacunaciones y Tratamientos</Title>
            <Button
              mode="outlined"
              compact
              icon="plus"
              onPress={onAddVaccination}
              style={styles.addButtonSmall}
            >
              Agregar
            </Button>
          </View>
          {vaccinations.length === 0 ? (
            <View>
              <Text style={styles.emptyText}>No hay vacunaciones registradas</Text>
              <Button mode="contained" onPress={onAddVaccination} style={styles.addButton}>
                Agregar Vacunación
              </Button>
            </View>
          ) : (
            vaccinations.map((vac) => (
              <View key={vac.id} style={styles.vaccinationItem}>
                <Text style={styles.vaccinationName}>{vac.nombre}</Text>
                <Text style={styles.vaccinationDate}>
                  {new Date(vac.fecha_inicio).toLocaleDateString()}
                  {vac.proxima_fecha && (
                    <Text> • Próxima: {new Date(vac.proxima_fecha).toLocaleDateString()}</Text>
                  )}
                </Text>
                {vac.observaciones && (
                  <Text style={styles.vaccinationNotes}>{vac.observaciones}</Text>
                )}
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      {/* Medicamentos activos */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Title style={styles.cardTitle}>Medicamentos Activos</Title>
            <Button
              mode="outlined"
              compact
              icon="plus"
              onPress={onAddMedication}
              style={styles.addButtonSmall}
            >
              Agregar
            </Button>
          </View>
          {medications.length === 0 ? (
            <View>
              <Text style={styles.emptyText}>No hay medicamentos activos</Text>
              <Button mode="contained" onPress={onAddMedication} style={styles.addButton}>
                Agregar Medicamento
              </Button>
            </View>
          ) : (
            medications.map((med) => (
              <View key={med.id} style={styles.medicationItem}>
                <Text style={styles.medicationName}>{med.nombre}</Text>
                <Text style={styles.medicationDose}>
                  {med.dosis} • {med.frecuencia}
                </Text>
                {med.motivo && (
                  <Text style={styles.medicationReason}>Motivo: {med.motivo}</Text>
                )}
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      {/* Historial reciente */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Title style={styles.cardTitle}>Historial Reciente</Title>
            <Button
              mode="outlined"
              compact
              icon="plus"
              onPress={onAddEvent}
              style={styles.addButtonSmall}
            >
              Agregar
            </Button>
          </View>
          {healthHistory.length === 0 ? (
            <View>
              <Text style={styles.emptyText}>No hay eventos registrados</Text>
              <Button mode="contained" onPress={onAddEvent} style={styles.addButton}>
                Agregar Evento
              </Button>
            </View>
          ) : (
            healthHistory.slice(0, 5).map((event) => (
              <View key={event.id} style={styles.historyItem}>
                <Text style={styles.historyDate}>
                  {new Date(event.fecha).toLocaleDateString()}
                </Text>
                <Text style={styles.historyType}>{event.tipo_evento}</Text>
                <Text style={styles.historyDescription}>{event.descripcion}</Text>
              </View>
            ))
          )}
        </Card.Content>
      </Card>
    </View>
  );
}

// Componente de pestaña de bienestar
function WellnessTab({ pet, indicators, onAddIndicator }) {
  return (
    <View style={styles.tabContent}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Indicadores de Bienestar</Title>
          {indicators.length === 0 ? (
            <View>
              <Text style={styles.emptyText}>No hay indicadores registrados</Text>
              <Button mode="contained" onPress={onAddIndicator} style={styles.addButton}>
                Agregar Indicador
              </Button>
            </View>
          ) : (
            indicators.map((ind) => (
              <View key={ind.id} style={styles.indicatorItem}>
                <Text style={styles.indicatorDate}>
                  {new Date(ind.fecha).toLocaleDateString()}
                </Text>
                <View style={styles.indicatorValues}>
                  {ind.peso && (
                    <Text style={styles.indicatorValue}>Peso: {ind.peso} kg</Text>
                  )}
                  {ind.actividad && (
                    <Text style={styles.indicatorValue}>Actividad: {ind.actividad} min</Text>
                  )}
                  {ind.horas_descanso && (
                    <Text style={styles.indicatorValue}>
                      Descanso: {ind.horas_descanso} hrs
                    </Text>
                  )}
                </View>
                {ind.notas && (
                  <Text style={styles.indicatorNotes}>{ind.notas}</Text>
                )}
              </View>
            ))
          )}
        </Card.Content>
      </Card>
    </View>
  );
}

// Componente de pestaña de recordatorios
function RemindersTab({ pet, reminders, onCompleteReminder, onAddReminder }) {
  return (
    <View style={styles.tabContent}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Recordatorios</Title>
          {reminders.length === 0 ? (
            <View>
              <Text style={styles.emptyText}>No hay recordatorios pendientes</Text>
              <Button mode="contained" onPress={onAddReminder} style={styles.addButton}>
                Crear Recordatorio
              </Button>
            </View>
          ) : (
            reminders.map((rem) => (
              <View key={rem.id} style={styles.reminderItem}>
                <View style={styles.reminderHeader}>
                  <Text style={styles.reminderTitle}>{rem.titulo}</Text>
                  {!rem.cumplido && (
                    <Button
                      mode="outlined"
                      compact
                      onPress={() => onCompleteReminder(rem.id)}
                    >
                      Completar
                    </Button>
                  )}
                </View>
                <Text style={styles.reminderDate}>
                  {new Date(rem.fecha_programada).toLocaleDateString()}
                  {rem.hora_programada && ` a las ${rem.hora_programada}`}
                </Text>
                {rem.descripcion && (
                  <Text style={styles.reminderDescription}>{rem.descripcion}</Text>
                )}
                {rem.cumplido && (
                  <Chip icon="check" style={styles.completedChip}>
                    Completado
                  </Chip>
                )}
              </View>
            ))
          )}
        </Card.Content>
      </Card>
    </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  headerImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 16,
  },
  headerImagePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerImagePlaceholderText: {
    fontSize: 60,
  },
  petName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  petBasicInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    margin: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  tabActive: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  tabContent: {
    gap: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  addButtonSmall: {
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    fontWeight: 'bold',
    width: 120,
    color: '#666',
  },
  infoValue: {
    flex: 1,
    color: '#333',
  },
  summaryRow: {
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryDate: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'normal',
  },
  vaccinationItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  vaccinationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  vaccinationDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  vaccinationNotes: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  medicationItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  medicationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  medicationDose: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  medicationReason: {
    fontSize: 14,
    color: '#999',
  },
  historyItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  historyType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  historyDescription: {
    fontSize: 14,
    color: '#333',
  },
  indicatorItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  indicatorDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  indicatorValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  indicatorValue: {
    fontSize: 14,
    color: '#666',
  },
  indicatorNotes: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  reminderItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  reminderDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  reminderDescription: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  completedChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  addButton: {
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#007AFF',
  },
});

