/**
 * Pantalla de Registrar Indicador de Bienestar
 * ==============================================
 * 
 * Esta pantalla permite al usuario registrar indicadores de bienestar de una mascota,
 * como peso, altura, actividad, horas de descanso, temperatura, etc.
 * 
 * Funcionalidades:
 * - Registrar múltiples métricas de bienestar
 * - Fecha del registro
 * - Validación (debe haber al menos una métrica)
 * - Guardar en Supabase
 * 
 * Métricas disponibles:
 * - Peso (kg)
 * - Altura (cm)
 * - Actividad (minutos)
 * - Horas de descanso
 * - Temperatura (°C)
 * - Notas adicionales
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
 * Componente principal de la pantalla de registrar indicador de bienestar
 */
export default function AddWellnessScreen() {
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
    fecha: new Date().toISOString().split('T')[0],  // Fecha del registro (por defecto hoy)
    peso: '',  // Peso en kg (opcional)
    altura: '',  // Altura en cm (opcional)
    actividad: '',  // Actividad en minutos (opcional)
    horas_descanso: '',  // Horas de descanso (opcional)
    temperatura: '',  // Temperatura en °C (opcional)
    notas: '',  // Notas adicionales (opcional)
  });

  // Errores de validación del formulario
  const [errors, setErrors] = useState({});

  /**
   * Valida los campos del formulario
   * 
   * @returns {boolean} true si el formulario es válido, false en caso contrario
   * 
   * Campos requeridos:
   * - fecha: Debe estar presente
   * - Al menos una métrica (peso, actividad, horas_descanso o temperatura) debe estar presente
   */
  const validateForm = () => {
    const newErrors = {};

    // Validar fecha
    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es requerida';
    }

    // Validar que al menos una métrica esté presente
    // Esto asegura que el registro tenga algún valor útil
    if (!formData.peso && !formData.actividad && !formData.horas_descanso && !formData.temperatura) {
      newErrors.peso = 'Debes registrar al menos una métrica (peso, actividad, descanso o temperatura)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Maneja el guardado del indicador de bienestar
   * 
   * Esta función:
   * 1. Valida el formulario
   * 2. Convierte los valores de texto a números donde corresponda
   * 3. Llama al servicio para guardar en Supabase
   * 4. Muestra mensaje de éxito o error
   * 5. Navega de vuelta si es exitoso
   */
  const handleSave = async () => {
    // Validar formulario antes de guardar
    if (!validateForm()) {
      Alert.alert('Error', 'Por favor completa al menos una métrica');
      return;
    }

    setLoading(true);

    try {
      // Preparar datos para enviar
      // Convertir strings a números donde corresponda, o null si están vacíos
      const indicatorData = {
        fecha: formData.fecha,
        peso: formData.peso ? parseFloat(formData.peso) : null,  // Convertir a número o null
        altura: formData.altura ? parseFloat(formData.altura) : null,
        actividad: formData.actividad ? parseInt(formData.actividad) : null,  // Entero para minutos
        horas_descanso: formData.horas_descanso ? parseFloat(formData.horas_descanso) : null,
        temperatura: formData.temperatura ? parseFloat(formData.temperatura) : null,
        notas: formData.notas.trim() || null,  // null si está vacío
      };

      // Llamar al servicio para guardar en Supabase
      const { data, error } = await petService.addWellnessIndicator(petId, indicatorData);

      if (error) {
        throw error;
      }

      // Mostrar mensaje de éxito y navegar de vuelta
      Alert.alert('¡Éxito!', 'Indicador de bienestar registrado correctamente', [
        {
          text: 'OK',
          onPress: () => router.back(),  // Volver a la pantalla anterior
        },
      ]);
    } catch (error) {
      console.error('Error agregando indicador:', error);
      Alert.alert(
        'Error',
        `No se pudo registrar el indicador: ${error.message || error}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Title style={styles.title}>Registrar Indicador de Bienestar</Title>

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
            <HelperText type="info">Fecha del registro</HelperText>
          </Card.Content>
        </Card>

        {/* Peso */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Peso (kg)"
              value={formData.peso}
              onChangeText={(text) => setFormData({ ...formData, peso: text })}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="0.0"
              error={!!errors.peso}
              right={<TextInput.Affix text="kg" />}
            />
            {errors.peso && <HelperText type="error">{errors.peso}</HelperText>}
            <HelperText type="info">Peso actual de la mascota</HelperText>
          </Card.Content>
        </Card>

        {/* Altura */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Altura (cm)"
              value={formData.altura}
              onChangeText={(text) => setFormData({ ...formData, altura: text })}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="0.0"
              right={<TextInput.Affix text="cm" />}
            />
            <HelperText type="info">Altura a la cruz (opcional)</HelperText>
          </Card.Content>
        </Card>

        {/* Actividad */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Actividad (minutos)"
              value={formData.actividad}
              onChangeText={(text) => setFormData({ ...formData, actividad: text })}
              mode="outlined"
              keyboardType="number-pad"
              style={styles.input}
              placeholder="0"
              right={<TextInput.Affix text="min" />}
            />
            <HelperText type="info">Minutos de actividad o pasos del día (opcional)</HelperText>
          </Card.Content>
        </Card>

        {/* Horas de descanso */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Horas de descanso"
              value={formData.horas_descanso}
              onChangeText={(text) => setFormData({ ...formData, horas_descanso: text })}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="0.0"
              right={<TextInput.Affix text="hrs" />}
            />
            <HelperText type="info">Horas de sueño/descanso del día (opcional)</HelperText>
          </Card.Content>
        </Card>

        {/* Temperatura */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Temperatura (°C)"
              value={formData.temperatura}
              onChangeText={(text) => setFormData({ ...formData, temperatura: text })}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="0.0"
              right={<TextInput.Affix text="°C" />}
            />
            <HelperText type="info">Temperatura corporal (opcional)</HelperText>
          </Card.Content>
        </Card>

        {/* Notas */}
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Notas"
              value={formData.notas}
              onChangeText={(text) => setFormData({ ...formData, notas: text })}
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
            Guardar Indicador
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


