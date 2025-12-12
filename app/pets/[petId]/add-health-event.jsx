/**
 * Pantalla de Agregar Evento de Salud
 * ====================================
 * 
 * Esta pantalla permite al usuario registrar un evento de salud para una mascota,
 * como chequeos, enfermedades, cirugías, alergias, etc.
 * 
 * Funcionalidades:
 * - Seleccionar tipo de evento (chequeo, enfermedad, cirugía, alergia, otro)
 * - Ingresar fecha del evento
 * - Descripción detallada del evento
 * - Información del veterinario
 * - Costo del tratamiento/consulta
 * - Validación de campos requeridos
 * - Guardar en Supabase
 */

// =========================
// Imports de React
// =========================
import React, { useState } from 'react';

// =========================
// Imports de React Native
// =========================
import {
  Alert,              // Para mostrar alertas
  ScrollView,         // Para hacer scrollable el contenido
  StyleSheet,         // Para estilos
  View,               // Componente de vista básico
} from 'react-native';

// =========================
// Imports de React Native Paper
// =========================
import {
  Button,             // Botón de Material Design
  Card,               // Tarjeta de Material Design
  HelperText,         // Texto de ayuda
  RadioButton,        // Radio button para selección
  Text,               // Texto simple
  TextInput,          // Campo de entrada de texto
  Title,              // Título
} from 'react-native-paper';

// =========================
// Imports de Safe Area
// =========================
import { SafeAreaView } from 'react-native-safe-area-context';

// =========================
// Imports de Expo Router
// =========================
import { useLocalSearchParams, useRouter } from 'expo-router';

// =========================
// Imports de Servicios
// =========================
import { petService } from '../../../src/services/supabase';

/**
 * Componente principal de la pantalla de agregar evento de salud
 */
export default function AddHealthEventScreen() {
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
  // Estado de carga (cuando se está guardando)
  const [loading, setLoading] = useState(false);

  // Datos del formulario
  const [formData, setFormData] = useState({
    tipo_evento: 'chequeo',  // Tipo: 'chequeo', 'enfermedad', 'cirugia', 'alergia', 'otro'
    fecha: new Date().toISOString().split('T')[0],  // Fecha del evento (por defecto hoy)
    descripcion: '',  // Descripción detallada del evento
    veterinario: '',  // Nombre del veterinario (opcional)
    notas: '',  // Notas adicionales (opcional)
    costo: '',  // Costo del tratamiento/consulta (opcional)
  });

  // Errores de validación del formulario
  const [errors, setErrors] = useState({});

  /**
   * Valida los campos del formulario
   * 
   * @returns {boolean} true si el formulario es válido, false en caso contrario
   * 
   * Campos requeridos:
   * - descripcion: Debe tener contenido
   * - fecha: Debe estar presente
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es requerida';
    }

    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Maneja el guardado del evento de salud
   * 
   * Esta función:
   * 1. Valida el formulario
   * 2. Prepara los datos para enviar (convierte costo a número)
   * 3. Llama al servicio para guardar en Supabase
   * 4. Muestra mensaje de éxito o error
   * 5. Navega de vuelta si es exitoso
   */
  const handleSave = async () => {
    // Validar formulario antes de guardar
    if (!validateForm()) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }

    setLoading(true);

    try {
      // Preparar datos para enviar
      // Convertir costo a número si está presente, o null si está vacío
      const eventData = {
        tipo_evento: formData.tipo_evento,
        fecha: formData.fecha,
        descripcion: formData.descripcion.trim(),
        veterinario: formData.veterinario.trim() || null,  // null si está vacío
        notas: formData.notas.trim() || null,
        costo: formData.costo ? parseFloat(formData.costo) : null,  // Convertir a número o null
      };

      // Llamar al servicio para guardar en Supabase
      const { data, error } = await petService.addHealthEvent(petId, eventData);

      if (error) {
        throw error;
      }

      // Mostrar mensaje de éxito y navegar de vuelta
      Alert.alert('¡Éxito!', 'Evento de salud registrado correctamente', [
        {
          text: 'OK',
          onPress: () => router.back(),  // Volver a la pantalla anterior
        },
      ]);
    } catch (error) {
      console.error('Error agregando evento:', error);
      Alert.alert(
        'Error',
        `No se pudo registrar el evento: ${error.message || error}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Title style={styles.title}>Agregar Evento de Salud</Title>

        {/* Tipo de evento */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.label}>Tipo de evento *</Text>
            <View style={styles.radioGroup}>
              <View style={styles.radioOption}>
                <RadioButton
                  value="chequeo"
                  status={formData.tipo_evento === 'chequeo' ? 'checked' : 'unchecked'}
                  onPress={() => setFormData({ ...formData, tipo_evento: 'chequeo' })}
                />
                <Text style={styles.radioLabel}>Chequeo</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton
                  value="enfermedad"
                  status={formData.tipo_evento === 'enfermedad' ? 'checked' : 'unchecked'}
                  onPress={() => setFormData({ ...formData, tipo_evento: 'enfermedad' })}
                />
                <Text style={styles.radioLabel}>Enfermedad</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton
                  value="cirugia"
                  status={formData.tipo_evento === 'cirugia' ? 'checked' : 'unchecked'}
                  onPress={() => setFormData({ ...formData, tipo_evento: 'cirugia' })}
                />
                <Text style={styles.radioLabel}>Cirugía</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton
                  value="alergia"
                  status={formData.tipo_evento === 'alergia' ? 'checked' : 'unchecked'}
                  onPress={() => setFormData({ ...formData, tipo_evento: 'alergia' })}
                />
                <Text style={styles.radioLabel}>Alergia</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton
                  value="otro"
                  status={formData.tipo_evento === 'otro' ? 'checked' : 'unchecked'}
                  onPress={() => setFormData({ ...formData, tipo_evento: 'otro' })}
                />
                <Text style={styles.radioLabel}>Otro</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Fecha */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Fecha *"
              value={formData.fecha}
              onChangeText={(text) => setFormData({ ...formData, fecha: text })}
              mode="outlined"
              style={styles.input}
              placeholder="YYYY-MM-DD"
              error={!!errors.fecha}
            />
            {errors.fecha && <HelperText type="error">{errors.fecha}</HelperText>}
            <HelperText type="info">Formato: AAAA-MM-DD (ej: 2025-01-15)</HelperText>
          </Card.Content>
        </Card>

        {/* Descripción */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Descripción *"
              value={formData.descripcion}
              onChangeText={(text) => setFormData({ ...formData, descripcion: text })}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.input}
              error={!!errors.descripcion}
              placeholder="Describe el evento de salud..."
            />
            {errors.descripcion && <HelperText type="error">{errors.descripcion}</HelperText>}
          </Card.Content>
        </Card>

        {/* Veterinario */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Veterinario"
              value={formData.veterinario}
              onChangeText={(text) => setFormData({ ...formData, veterinario: text })}
              mode="outlined"
              style={styles.input}
              placeholder="Nombre del veterinario (opcional)"
            />
          </Card.Content>
        </Card>

        {/* Notas */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Notas adicionales"
              value={formData.notas}
              onChangeText={(text) => setFormData({ ...formData, notas: text })}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              placeholder="Notas adicionales sobre el evento..."
            />
          </Card.Content>
        </Card>

        {/* Costo */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Costo"
              value={formData.costo}
              onChangeText={(text) => setFormData({ ...formData, costo: text })}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="0.00"
              left={<TextInput.Affix text="$" />}
            />
            <HelperText type="info">Costo del tratamiento o consulta (opcional)</HelperText>
          </Card.Content>
        </Card>

        {/* Botones */}
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            style={styles.cancelButton}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            style={styles.saveButton}
          >
            Guardar Evento
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  input: {
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  radioLabel: {
    marginLeft: 8,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});


