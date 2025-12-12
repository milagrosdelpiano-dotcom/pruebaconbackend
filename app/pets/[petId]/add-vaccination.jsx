/**
 * Pantalla de Agregar Vacunación o Tratamiento
 * =================================================
 * 
 * Esta pantalla permite al usuario registrar una nueva vacunación, tratamiento,
 * desparasitación o antiparasitario para una mascota específica.
 * 
 * Funcionalidades:
 * - Seleccionar tipo de registro (vacuna, tratamiento, desparasitación, antiparasitario)
 * - Ingresar información detallada (nombre, fechas, dosis, frecuencia)
 * - Validar campos requeridos
 * - Guardar en Supabase
 * - Navegar de vuelta después de guardar
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
 * Componente principal de la pantalla de agregar vacunación
 */
export default function AddVaccinationScreen() {
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
    tipo: 'vacuna',  // Tipo: 'vacuna', 'tratamiento', 'desparasitacion', 'antiparasitario'
    nombre: '',  // Nombre de la vacuna/tratamiento
    fecha_inicio: new Date().toISOString().split('T')[0],  // Fecha de inicio (por defecto hoy)
    fecha_final: '',  // Fecha final (opcional, para tratamientos con duración)
    proxima_fecha: '',  // Próxima fecha de refuerzo (opcional)
    dosis: '',  // Cantidad de dosis (opcional)
    frecuencia: '',  // Frecuencia de aplicación (opcional)
    observaciones: '',  // Observaciones adicionales (opcional)
    veterinario: '',  // Nombre del veterinario (opcional)
  });

  // Errores de validación del formulario
  const [errors, setErrors] = useState({});

  /**
   * Valida los campos del formulario
   * 
   * @returns {boolean} true si el formulario es válido, false en caso contrario
   * 
   * Campos requeridos:
   * - nombre: Debe tener contenido
   * - fecha_inicio: Debe estar presente
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.fecha_inicio) {
      newErrors.fecha_inicio = 'La fecha de inicio es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Maneja el guardado de la vacunación/tratamiento
   * 
   * Esta función:
   * 1. Valida el formulario
   * 2. Prepara los datos para enviar
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
      // Preparar datos para enviar (limpiar strings vacíos y convertirlos a null)
      const vaccinationData = {
        tipo: formData.tipo,
        nombre: formData.nombre.trim(),
        fecha_inicio: formData.fecha_inicio,
        fecha_final: formData.fecha_final || null,  // null si está vacío
        proxima_fecha: formData.proxima_fecha || null,
        dosis: formData.dosis.trim() || null,
        frecuencia: formData.frecuencia.trim() || null,
        observaciones: formData.observaciones.trim() || null,
        veterinario: formData.veterinario.trim() || null,
      };

      // Llamar al servicio para guardar en Supabase
      const { data, error } = await petService.addVaccination(petId, vaccinationData);

      if (error) {
        throw error;
      }

      // Mostrar mensaje de éxito y navegar de vuelta
      Alert.alert('¡Éxito!', 'Vacunación registrada correctamente', [
        {
          text: 'OK',
          onPress: () => router.back(),  // Volver a la pantalla anterior
        },
      ]);
    } catch (error) {
      console.error('Error agregando vacunación:', error);
      Alert.alert(
        'Error',
        `No se pudo registrar la vacunación: ${error.message || error}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Title style={styles.title}>Agregar Vacunación o Tratamiento</Title>

        {/* Tipo */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.label}>Tipo *</Text>
            <View style={styles.radioGroup}>
              <View style={styles.radioOption}>
                <RadioButton
                  value="vacuna"
                  status={formData.tipo === 'vacuna' ? 'checked' : 'unchecked'}
                  onPress={() => setFormData({ ...formData, tipo: 'vacuna' })}
                />
                <Text style={styles.radioLabel}>Vacuna</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton
                  value="tratamiento"
                  status={formData.tipo === 'tratamiento' ? 'checked' : 'unchecked'}
                  onPress={() => setFormData({ ...formData, tipo: 'tratamiento' })}
                />
                <Text style={styles.radioLabel}>Tratamiento</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton
                  value="desparasitacion"
                  status={formData.tipo === 'desparasitacion' ? 'checked' : 'unchecked'}
                  onPress={() => setFormData({ ...formData, tipo: 'desparasitacion' })}
                />
                <Text style={styles.radioLabel}>Desparasitación</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton
                  value="antiparasitario"
                  status={formData.tipo === 'antiparasitario' ? 'checked' : 'unchecked'}
                  onPress={() => setFormData({ ...formData, tipo: 'antiparasitario' })}
                />
                <Text style={styles.radioLabel}>Antiparasitario</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Nombre */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Nombre *"
              value={formData.nombre}
              onChangeText={(text) => setFormData({ ...formData, nombre: text })}
              mode="outlined"
              style={styles.input}
              error={!!errors.nombre}
              placeholder="Ej: Antirrábica, Triple felina..."
            />
            {errors.nombre && <HelperText type="error">{errors.nombre}</HelperText>}
          </Card.Content>
        </Card>

        {/* Fecha de inicio */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Fecha de inicio *"
              value={formData.fecha_inicio}
              onChangeText={(text) => setFormData({ ...formData, fecha_inicio: text })}
              mode="outlined"
              style={styles.input}
              placeholder="YYYY-MM-DD"
              error={!!errors.fecha_inicio}
            />
            {errors.fecha_inicio && <HelperText type="error">{errors.fecha_inicio}</HelperText>}
            <HelperText type="info">Fecha en que se aplicó</HelperText>
          </Card.Content>
        </Card>

        {/* Fecha final */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Fecha final"
              value={formData.fecha_final}
              onChangeText={(text) => setFormData({ ...formData, fecha_final: text })}
              mode="outlined"
              style={styles.input}
              placeholder="YYYY-MM-DD"
            />
            <HelperText type="info">Solo si es un tratamiento con duración (opcional)</HelperText>
          </Card.Content>
        </Card>

        {/* Próxima fecha */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Próxima fecha"
              value={formData.proxima_fecha}
              onChangeText={(text) => setFormData({ ...formData, proxima_fecha: text })}
              mode="outlined"
              style={styles.input}
              placeholder="YYYY-MM-DD"
            />
            <HelperText type="info">Fecha de la próxima dosis o refuerzo (opcional)</HelperText>
          </Card.Content>
        </Card>

        {/* Dosis */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Dosis"
              value={formData.dosis}
              onChangeText={(text) => setFormData({ ...formData, dosis: text })}
              mode="outlined"
              style={styles.input}
              placeholder="Ej: 1ml, 0.5ml..."
            />
          </Card.Content>
        </Card>

        {/* Frecuencia */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Frecuencia"
              value={formData.frecuencia}
              onChangeText={(text) => setFormData({ ...formData, frecuencia: text })}
              mode="outlined"
              style={styles.input}
              placeholder="Ej: Cada 6 meses, Diario..."
            />
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

        {/* Observaciones */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Observaciones"
              value={formData.observaciones}
              onChangeText={(text) => setFormData({ ...formData, observaciones: text })}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              placeholder="Observaciones adicionales..."
            />
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
            Guardar Vacunación
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


