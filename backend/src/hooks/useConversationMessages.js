/**
 * Hook de Mensajes de Conversación
 * ==================================
 * 
 * Este hook gestiona la carga y envío de mensajes en una conversación específica.
 * 
 * Funcionalidades:
 * - Cargar mensajes con paginación (carga más mensajes antiguos)
 * - Enviar mensajes de texto e imágenes
 * - Suscribirse a nuevos mensajes en tiempo real usando Supabase Realtime
 * - Marcar mensajes como leídos
 * - Actualizar estado automáticamente cuando hay nuevos mensajes
 * 
 * El hook se suscribe automáticamente a cambios en los mensajes usando
 * Supabase Realtime, por lo que los mensajes se actualizan en tiempo real.
 */

import { useCallback, useEffect, useRef, useState } from 'react';  // Hooks de React
import { messageService } from '../services/supabase';  // Servicio de mensajes
import { eventBus } from '../utils/eventBus';  // Event bus para comunicación
import { useAuthStore } from '../stores/authStore';  // Store de autenticación

// Tamaño de página para paginación de mensajes (cuántos mensajes cargar a la vez)
const MESSAGE_PAGE_SIZE = 40;

/**
 * Hook personalizado para gestionar mensajes de una conversación
 * 
 * @param {string} conversationId - ID de la conversación
 * @returns {object} Objeto con:
 *   - messages: Lista de mensajes
 *   - loading: Estado de carga inicial
 *   - loadingMore: Estado de carga de más mensajes
 *   - sending: Estado de envío de mensaje
 *   - error: Error si hay
 *   - hasMore: Si hay más mensajes antiguos para cargar
 *   - loadMore: Función para cargar más mensajes antiguos
 *   - sendMessage: Función para enviar un mensaje
 *   - markAsRead: Función para marcar mensajes como leídos
 */
export const useConversationMessages = (conversationId) => {
  // =========================
  // Hooks y Stores
  // =========================
  // Obtener función para obtener ID del usuario
  const getUserId = useAuthStore((state) => state.getUserId);
  const userId = getUserId();

  // =========================
  // Estado Local
  // =========================
  // Lista de mensajes de la conversación
  const [messages, setMessages] = useState([]);
  
  // Estado de carga inicial (cuando se carga por primera vez)
  const [loading, setLoading] = useState(true);
  
  // Estado de envío (cuando se está enviando un mensaje)
  const [sending, setSending] = useState(false);
  
  // Error al cargar/enviar mensajes (si hay)
  const [error, setError] = useState(null);
  
  // Si hay más mensajes antiguos para cargar (paginación)
  const [hasMore, setHasMore] = useState(true);
  
  // Estado de marcado como leído
  const [markingRead, setMarkingRead] = useState(false);
  
  // Estado de carga de más mensajes (paginación)
  const [loadingMore, setLoadingMore] = useState(false);

  // =========================
  // Referencias
  // =========================
  // Cursor para paginación (timestamp del mensaje más antiguo cargado)
  const cursorRef = useRef(null);
  
  // Referencia a la suscripción de Supabase Realtime
  const channelRef = useRef(null);
  
  // Flag para prevenir múltiples cargas simultáneas
  const isFetchingRef = useRef(false);

  const updateMessagesState = useCallback((incomingMessages = []) => {
    if (!incomingMessages.length) return;

    setMessages((prev) => {
      const merged = new Map(prev.map((message) => [message.id, message]));

      incomingMessages.forEach((message) => {
        merged.set(message.id, message);
      });

      return Array.from(merged.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, []);

  const loadMessages = useCallback(
    async ({ reset = false } = {}) => {
      if (!conversationId || isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;

      if (reset) {
        setLoading(true);
        cursorRef.current = null;
        setHasMore(true);
        setMessages([]);
      } else {
        setLoadingMore(true);
      }

      setError(null);

      try {
        const { data, error: fetchError } = await messageService.getMessages(conversationId, {
          limit: MESSAGE_PAGE_SIZE,
          cursor: reset ? null : cursorRef.current,
        });

        if (fetchError) {
          throw fetchError;
        }

        const fetchedMessages = Array.isArray(data) ? data : [];

        if (fetchedMessages.length === 0) {
          if (reset) {
            setMessages([]);
          }
          setHasMore(false);
          return;
        }

        const oldestTimestamp =
          fetchedMessages[fetchedMessages.length - 1]?.created_at || cursorRef.current;
        cursorRef.current = oldestTimestamp;

        updateMessagesState(fetchedMessages);
        setHasMore(fetchedMessages.length === MESSAGE_PAGE_SIZE);
      } catch (err) {
        console.error('Error cargando mensajes:', err);
        setError(err?.message || 'No se pudieron cargar los mensajes.');
      } finally {
        if (reset) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
        isFetchingRef.current = false;
      }
    },
    [conversationId, updateMessagesState]
  );

  const refreshMessages = useCallback(async () => {
    await loadMessages({ reset: true });
  }, [loadMessages]);

  const markAsRead = useCallback(async () => {
    if (!conversationId || !userId || markingRead) {
      return;
    }

    const hasUnread = messages.some(
      (message) => message.sender_id !== userId && !message.read_at
    );

    if (!hasUnread) {
      return;
    }

    setMarkingRead(true);

    try {
      const { error: markError } = await messageService.markConversationAsRead(
        conversationId,
        userId
      );
      if (markError) {
        throw markError;
      }
      setMessages((prev) =>
        prev.map((message) =>
          message.sender_id !== userId && !message.read_at
            ? { ...message, read_at: new Date().toISOString() }
            : message
        )
      );
      eventBus.emit('conversation:read', conversationId);
    } catch (err) {
      console.error('Error marcando mensajes como leídos:', err);
    } finally {
      setMarkingRead(false);
    }
  }, [conversationId, messages, userId, markingRead]);

  const markAsReadRef = useRef(markAsRead);
  useEffect(() => {
    markAsReadRef.current = markAsRead;
  }, [markAsRead]);

  const sendMessage = useCallback(
    async (content, { imageUrl = null } = {}) => {
      if (!conversationId || !userId) {
        return { success: false, error: new Error('No hay conversación activa.') };
      }

      const trimmedContent = (content || '').trim();
      if (!trimmedContent && !imageUrl) {
        return { success: false, error: new Error('El mensaje está vacío.') };
      }

      setSending(true);

      try {
        const { data, error: sendError } = await messageService.sendMessage(
          conversationId,
          userId,
          trimmedContent,
          imageUrl
        );

        if (sendError) {
          throw sendError;
        }

        if (data) {
          updateMessagesState([data]);
        }
        eventBus.emit('conversation:updated', { conversationId, lastMessage: data });
        return { success: true, data };
      } catch (err) {
        console.error('Error enviando mensaje:', err);
        setError(err?.message || 'No se pudo enviar el mensaje.');
        return { success: false, error: err };
      } finally {
        setSending(false);
      }
    },
    [conversationId, updateMessagesState, userId]
  );

  // Suscripción en tiempo real
  useEffect(() => {
    if (!conversationId) {
      return undefined;
    }

    loadMessages({ reset: true });

    if (channelRef.current) {
      messageService.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    channelRef.current = messageService.subscribeToMessages(conversationId, {
      onInsert: (message) => {
        updateMessagesState([message]);
        if (message.sender_id !== userId) {
          markAsReadRef.current?.();
        }
      },
      onUpdate: (message) => {
        updateMessagesState([message]);
      },
    });

    return () => {
      if (channelRef.current) {
        messageService.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, loadMessages, updateMessagesState, userId]);

  // Marcar como leídos cuando llegan mensajes nuevos
  useEffect(() => {
    if (!conversationId) {
      return;
    }

    if (!loading) {
      markAsRead();
    }
  }, [conversationId, loading, messages, markAsRead]);

  return {
    messages,
    loading,
    sending,
    error,
    hasMore,
    loadingMore,
    refreshMessages,
    loadMore: () => loadMessages({ reset: false }),
    sendMessage,
  };
};


