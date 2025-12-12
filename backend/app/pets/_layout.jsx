/**
 * Layout de Mascotas
 * ==================
 * 
 * Este componente define la navegación en stack para la sección de mascotas.
 * Permite navegar entre:
 * - Lista de mascotas (pantalla principal)
 * - Detalle de mascota ([petId])
 * - Crear nueva mascota (create)
 * - Agregar eventos de salud, vacunaciones, medicamentos, etc.
 * 
 * Todas las pantallas comparten el mismo estilo de header (azul con texto blanco).
 */

import { Stack } from 'expo-router';  // Componente de stack navigation de Expo Router

/**
 * Componente principal del layout de mascotas
 */
export default function PetsLayout() {
  return (
    <Stack
      screenOptions={{
        // Estilo del header para todas las pantallas
        headerStyle: {
          backgroundColor: '#007AFF',  // Color azul del header
        },
        headerTintColor: '#fff',  // Color del texto y botones del header (blanco)
        headerTitleStyle: {
          fontWeight: 'bold',  // Título en negrita
        },
      }}
    >
      <Stack.Screen
        name="[petId]"
        options={{
          title: 'Detalle de Mascota',
        }}
      />
      <Stack.Screen
        name="create"
        options={{
          title: 'Registrar Mascota',
        }}
      />
      <Stack.Screen
        name="[petId]/add-health-event"
        options={{
          title: 'Agregar Evento de Salud',
        }}
      />
      <Stack.Screen
        name="[petId]/add-vaccination"
        options={{
          title: 'Agregar Vacunación',
        }}
      />
      <Stack.Screen
        name="[petId]/add-medication"
        options={{
          title: 'Agregar Medicamento',
        }}
      />
      <Stack.Screen
        name="[petId]/add-wellness"
        options={{
          title: 'Registrar Indicador',
        }}
      />
      <Stack.Screen
        name="[petId]/add-reminder"
        options={{
          title: 'Crear Recordatorio',
        }}
      />
    </Stack>
  );
}

