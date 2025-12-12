/**
 * Pantalla de Agregar Medicamento
 * =================================
 * 
 * Esta pantalla permite al usuario registrar un nuevo medicamento para una mascota.
 * 
 * Funcionalidades:
 * - Ingresar información del medicamento (nombre, dosis, frecuencia)
 * - Fechas de inicio y fin del tratamiento
 * - Motivo del tratamiento
 * - Veterinario que lo prescribió
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
 * Componente principal de la pantalla de agregar medicamento
 */
export default function AddMedicationScreen() {
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
    nombre: '',  // Nombre del medicamento
    dosis: '',  // Cantidad de dosis
    frecuencia: '',  // Frecuencia de administración
    fecha_inicio: new Date().toISOString().split('T')[0],  // Fecha de inicio (por defecto hoy)
    fecha_fin: '',  // Fecha de fin del tratamiento (opcional)
    motivo: '',  // Razón por la que se prescribe (opcional)
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
   * - dosis: Debe tener contenido
   * - frecuencia: Debe tener contenido
   * - fecha_inicio: Debe estar presente
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.dosis.trim()) {
      newErrors.dosis = 'La dosis es requerida';
    }

    if (!formData.frecuencia.trim()) {
      newErrors.frecuencia = 'La frecuencia es requerida';
    }

    if (!formData.fecha_inicio) {
      newErrors.fecha_inicio = 'La fecha de inicio es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Maneja el guardado del medicamento
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
      const medicationData = {
        nombre: formData.nombre.trim(),
        dosis: formData.dosis.trim(),
        frecuencia: formData.frecuencia.trim(),
        fecha_inicio: formData.fecha_inicio,
        fecha_fin: formData.fecha_fin || null,  // null si está vacío
        motivo: formData.motivo.trim() || null,
        veterinario: formData.veterinario.trim() || null,
        activo: true,  // El medicamento se marca como activo al crearlo
      };

      // Llamar al servicio para guardar en Supabase
      const { data, error } = await petService.addMedication(petId, medicationData);

      if (error) {
        throw error;
      }

      // Mostrar mensaje de éxito y navegar de vuelta
      Alert.alert('¡Éxito!', 'Medicamento registrado correctamente', [
        {
          text: 'OK',
          onPress: () => router.back(),  // Volver a la pantalla anterior
        },
      ]);
    } catch (error) {
      console.error('Error agregando medicamento:', error);
      Alert.alert(
        'Error',
        `No se pudo registrar el medicamento: ${error.message || error}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Title style={styles.title}>Agregar Medicamento</Title>

        {/* Nombre */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Nombre del medicamento *"
              value={formData.nombre}
              onChangeText={(text) => setFormData({ ...formData, nombre: text })}
              mode="outlined"
              style={styles.input}
              error={!!errors.nombre}
              placeholder="Ej: Amoxicilina, Ivermectina..."
            />
            {errors.nombre && <HelperText type="error">{errors.nombre}</HelperText>}
          </Card.Content>
        </Card>

        {/* Dosis */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Dosis *"
              value={formData.dosis}
              onChangeText={(text) => setFormData({ ...formData, dosis: text })}
              mode="outlined"
              style={styles.input}
              error={!!errors.dosis}
              placeholder="Ej: 1 comprimido, 0.5ml, 250mg..."
            />
            {errors.dosis && <HelperText type="error">{errors.dosis}</HelperText>}
          </Card.Content>
        </Card>

        {/* Frecuencia */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Frecuencia *"
              value={formData.frecuencia}
              onChangeText={(text) => setFormData({ ...formData, frecuencia: text })}
              mode="outlined"
              style={styles.input}
              error={!!errors.frecuencia}
              placeholder="Ej: Cada 8 horas, 2 veces al día, Diario..."
            />
            {errors.frecuencia && <HelperText type="error">{errors.frecuencia}</HelperText>}
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
            <HelperText type="info">Fecha en que comenzó a tomar el medicamento</HelperText>
          </Card.Content>
        </Card>

        {/* Fecha de fin */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Fecha de fin"
              value={formData.fecha_fin}
              onChangeText={(text) => setFormData({ ...formData, fecha_fin: text })}
              mode="outlined"
              style={styles.input}
              placeholder="YYYY-MM-DD"
            />
            <HelperText type="info">Fecha en que debe terminar el tratamiento (opcional)</HelperText>
          </Card.Content>
        </Card>

        {/* Motivo */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Motivo del tratamiento"
              value={formData.motivo}
              onChangeText={(text) => setFormData({ ...formData, motivo: text })}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              placeholder="Razón por la que se prescribe este medicamento..."
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
              placeholder="Nombre del veterinario que lo prescribió (opcional)"
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
            Guardar Medicamento
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


