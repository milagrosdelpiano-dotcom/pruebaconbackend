/**
 * Hook de Conversaciones
 * =======================
 * 
 * Este hook gestiona la carga y actualización de conversaciones del usuario.
 * 
 * Funcionalidades:
 * - Cargar todas las conversaciones del usuario
 * - Suscribirse a actualizaciones en tiempo real usando Supabase Realtime
 * - Actualizar contadores de mensajes no leídos
 * - Pull-to-refresh para recargar conversaciones
 * - Manejo de errores y estados de carga
 * 
 * El hook se suscribe automáticamente a cambios en las conversaciones
 * usando Supabase Realtime, por lo que las conversaciones se actualizan
 * automáticamente cuando hay nuevos mensajes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';  // Hooks de React
import { messageService } from '../services/supabase';  // Servicio de mensajes
import { useAuthStore } from '../stores/authStore';  // Store de autenticación
import { eventBus } from '../utils/eventBus';  // Event bus para comunicación entre componentes

/**
 * Hook personalizado para gestionar conversaciones
 * 
 * @returns {object} Objeto con:
 *   - conversations: Lista de conversaciones
 *   - loading: Estado de carga inicial
 *   - refreshing: Estado de refresh
 *   - error: Error si hay
 *   - refresh: Función para refrescar manualmente
 *   - refetch: Función para recargar datos
 * 
 * Este hook se suscribe automáticamente a cambios en tiempo real
 * y actualiza las conversaciones cuando hay nuevos mensajes.
 */
export const useConversations = () => {
  // =========================
  // Hooks y Stores
  // =========================
  // Obtener función para obtener ID del usuario
  const getUserId = useAuthStore((state) => state.getUserId);
  
  // =========================
  // Estado Local
  // =========================
  // Lista de conversaciones del usuario
  const [conversations, setConversations] = useState([]);
  
  // Estado de carga inicial (cuando se carga por primera vez)
  const [loading, setLoading] = useState(true);
  
  // Estado de refresh (cuando el usuario hace pull-to-refresh)
  const [refreshing, setRefreshing] = useState(false);
  
  // Error al cargar conversaciones (si hay)
  const [error, setError] = useState(null);
  
  // Referencia a la suscripción de Supabase Realtime
  const subscriptionRef = useRef(null);
  
  // Referencia a conversaciones que fueron marcadas como leídas
  // Se usa para mantener el contador de no leídos en 0 después de leer
  const clearedConversationsRef = useRef(new Set());

  const fetchConversations = useCallback(
    async ({ showLoader = true } = {}) => {
      const userId = getUserId();

      if (!userId) {
        setConversations([]);
        setLoading(false);
        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      setError(null);

      try {
        const { data, error: fetchError } = await messageService.getUserConversations(userId);

        if (fetchError) {
          throw fetchError;
        }

        const processed =
          data?.map((conversation) => {
            if (clearedConversationsRef.current.has(conversation.conversation_id)) {
              return { ...conversation, unread_count: 0 };
            }
            return conversation;
          }) || [];

        setConversations(processed);
      } catch (err) {
        console.error('Error cargando conversaciones:', err);
        setError(err?.message || 'No se pudieron cargar las conversaciones.');
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [getUserId]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations({ showLoader: false });
    setRefreshing(false);
  }, [fetchConversations]);

  useEffect(() => {
    fetchConversations();

    const userId = getUserId();

    if (subscriptionRef.current) {
      messageService.removeChannel(subscriptionRef.current);
    }

    if (!userId) {
      return undefined;
    }

    subscriptionRef.current = messageService.subscribeToConversations(userId, () => {
      fetchConversations({ showLoader: false });
    });

    return () => {
      if (subscriptionRef.current) {
        messageService.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [fetchConversations, getUserId]);

  useEffect(() => {
    const offRead = eventBus.on('conversation:read', (conversationId) => {
      if (!conversationId) return;
      clearedConversationsRef.current.add(conversationId);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.conversation_id === conversationId
            ? { ...conversation, unread_count: 0 }
            : conversation
        )
      );
    });

    return () => {
      offRead();
    };
  }, [getUserId]);

  return {
    conversations,
    loading,
    error,
    refreshing,
    refresh,
    refetch: fetchConversations,
  };
};


