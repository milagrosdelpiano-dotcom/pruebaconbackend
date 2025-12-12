/**
 * Layout de Mensajes
 * ===================
 * 
 * Este componente define la navegación en stack para la sección de mensajes.
 * Permite navegar entre:
 * - Lista de conversaciones (pantalla principal)
 * - Conversación individual ([conversationId])
 * 
 * La pantalla de conversación individual oculta el header para tener más espacio
 * para los mensajes.
 */

import { Stack } from 'expo-router';  // Componente de stack navigation de Expo Router

/**
 * Componente principal del layout de mensajes
 */
export default function MessagesLayout() {
  return (
    <Stack>
      {/* Pantalla de conversación individual */}
      <Stack.Screen
        name="[conversationId]"
        options={{
          title: 'Conversación',  // Título del header (aunque está oculto)
          headerShown: false,  // Ocultar header para tener más espacio para mensajes
        }}
      />
    </Stack>
  );
}


