/**
 * Pantalla de Conversación Individual
 * ====================================
 * 
 * Esta pantalla muestra una conversación individual entre dos usuarios
 * relacionada con un reporte específico.
 * 
 * Funcionalidades:
 * - Ver todos los mensajes de la conversación
 * - Enviar mensajes de texto
 * - Enviar imágenes
 * - Scroll automático a nuevos mensajes
 * - Cargar más mensajes antiguos (paginación)
 * - Marcar mensajes como leídos
 * - Actualizaciones en tiempo real usando Supabase Realtime
 * 
 * La conversación se actualiza automáticamente cuando hay nuevos mensajes
 * gracias a Supabase Realtime.
 */

import { Image } from 'expo-image';  // Componente de imagen optimizado
import * as ImagePicker from 'expo-image-picker';  // Para seleccionar imágenes
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';  // Hooks de navegación
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';  // Hooks de React
import {
    Alert,  // Para mostrar alertas
    BackHandler,  // Para manejar el botón de atrás
    FlatList,  // Lista optimizada para muchos elementos
    KeyboardAvoidingView,  // Para ajustar cuando aparece el teclado
    Platform,  // Para detectar la plataforma
    StyleSheet,  // Para estilos
    TouchableOpacity,  // Botón táctil
    View,  // Componente de vista básico
} from 'react-native';
import {
    ActivityIndicator,  // Spinner de carga
    Avatar,  // Avatar de usuario
    Button,  // Botón de Material Design
    IconButton,  // Botón con ícono
    Text,  // Texto simple
    TextInput,  // Campo de entrada de texto
    useTheme,  // Hook para obtener el tema
} from 'react-native-paper';  // Componentes de Material Design
import { SafeAreaView } from 'react-native-safe-area-context';  // View que respeta áreas seguras
import { useConversationMessages } from '../../src/hooks/useConversationMessages';  // Hook para gestionar mensajes
import { storageService } from '../../src/services/storage';  // Servicio de almacenamiento
import { messageService } from '../../src/services/supabase';  // Servicio de mensajes
import { useAuthStore } from '../../src/stores/authStore';  // Store de autenticación
import { eventBus } from '../../src/utils/eventBus';  // Event bus para comunicación

/**
 * Formatea una fecha/hora a formato legible
 * 
 * @param {string} timestamp - Timestamp en formato ISO string
 * @returns {string} Hora formateada (ej: "14:30")
 */
const formatDateTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',  // Hora en 2 dígitos
      minute: '2-digit',  // Minutos en 2 dígitos
    });
  } catch {
    return '';  // Retornar string vacío si hay error
  }
};

/**
 * Formatea el tipo de reporte a texto legible
 * 
 * @param {string} type - Tipo de reporte ('lost' o 'found')
 * @returns {string} Texto formateado
 */
const formatReportType = (type) => {
  if (type === 'lost') {
    return 'Mascota perdida';
  }
  if (type === 'found') {
    return 'Mascota encontrada';
  }
  return 'Reporte';  // Fallback genérico
};

/**
 * Componente principal de la pantalla de conversación
 */
export default function ConversationScreen() {
  // =========================
  // Hooks y Navegación
  // =========================
  // Tema de Material Design
  const theme = useTheme();
  
  // ID de la conversación desde los parámetros de la ruta
  const { conversationId } = useLocalSearchParams();
  
  // Router para navegación
  const router = useRouter();
  
  // Obtener ID del usuario actual
  const getUserId = useAuthStore((state) => state.getUserId);
  const userId = getUserId();

  // =========================
  // Estado Local
  // =========================
  // Datos de la conversación (información del otro usuario, reporte relacionado, etc.)
  const [conversation, setConversation] = useState(null);
  
  // Estado de carga al cargar la conversación
  const [loadingConversation, setLoadingConversation] = useState(true);
  
  // Error al cargar la conversación (si hay)
  const [conversationError, setConversationError] = useState(null);
  
  // Texto del mensaje que el usuario está escribiendo
  const [messageInput, setMessageInput] = useState('');
  
  // Estado de carga al subir una imagen
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Verificar si el usuario actual es el reportero del reporte relacionado
  const isCurrentUserReporter = conversation?.report_reporter_id === userId;

  const {
    messages,
    loading: loadingMessages,
    loadingMore,
    sending,
    error: messagesError,
    hasMore,
    loadMore,
    sendMessage,
  } = useConversationMessages(conversationId);

  const listRef = useRef(null);
  const prevMessagesRef = useRef([]);

  const otherUserInitials = useMemo(() => {
    if (!conversation?.other_user_name) return 'U';
    return conversation.other_user_name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }, [conversation]);

  const canSendMessage = useMemo(() => {
    const trimmed = messageInput.trim();
    return trimmed.length > 0 && !sending;
  }, [messageInput, sending]);

  const fetchConversation = useCallback(async () => {
    if (!conversationId || !userId) {
      setLoadingConversation(false);
      setConversationError('No se encontró la conversación.');
      return;
    }

    setLoadingConversation(true);
    setConversationError(null);

    try {
      const { data, error } = await messageService.getConversationById(conversationId, userId);

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('No se encontró la conversación.');
      }

      setConversation(data);
    } catch (err) {
      console.error('Error cargando conversación:', err);
      setConversationError(err?.message || 'No se pudo cargar la conversación.');
    } finally {
      setLoadingConversation(false);
    }
  }, [conversationId, userId]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        router.replace('/(auth)/login');
        return undefined;
      }

      if (conversationId) {
        eventBus.emit('conversation:read', conversationId);
      }

      const onBackPress = () => {
        router.replace('/messages');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        subscription.remove();
      };
    }, [router, userId])
  );

  useEffect(() => {
    const previous = prevMessagesRef.current;
    if (messages.length === 0) {
      prevMessagesRef.current = messages;
      return;
    }

    const prevLastId = previous[previous.length - 1]?.id;
    const lastId = messages[messages.length - 1]?.id;

    if (lastId && lastId !== prevLastId && messages.length >= previous.length) {
      listRef.current?.scrollToEnd({ animated: true });
    }

    prevMessagesRef.current = messages;
  }, [messages]);

  const handleOpenReport = useCallback(() => {
    if (!conversation?.report_id) return;
    router.push({
      pathname: '/report/[id]',
      params: { id: conversation.report_id, conversationRedirect: conversationId },
    });
  }, [conversation?.report_id, conversationId, router]);

  const handleSend = useCallback(async () => {
    const trimmed = messageInput.trim();
    if (!trimmed) return;

    const { success } = await sendMessage(trimmed);
    if (success) {
      setMessageInput('');
    }
  }, [messageInput, sendMessage]);

  const handleUploadImage = useCallback(
    async (uri) => {
      if (!uri || uploadingImage || !userId || !conversationId) return;

      try {
      setUploadingImage(true);

        const { url, error } = await storageService.uploadMessageImage(
          userId,
          conversationId,
          uri
        );

        if (error || !url) {
          throw error || new Error('No se pudo subir la imagen.');
        }

        const { success } = await sendMessage('', { imageUrl: url });
        if (!success) {
          Alert.alert('Ups', 'No se pudo enviar la imagen. Intenta nuevamente.');
        }
      } catch (error) {
        console.error('Error enviando imagen:', error);
        Alert.alert('Ups', 'No se pudo enviar la imagen. Intenta nuevamente.');
      } finally {
        setUploadingImage(false);
      }
    },
    [conversationId, sendMessage, uploadingImage, userId]
  );

  const pickImageFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisos requeridos', 'Necesitamos acceso a tus fotos para enviar imágenes.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      await handleUploadImage(result.assets[0].uri);
    }
  }, [handleUploadImage]);

  const takePhotoWithCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisos requeridos', 'Necesitamos acceso a la cámara para tomar fotos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      await handleUploadImage(result.assets[0].uri);
    }
  }, [handleUploadImage]);

  const handlePickImage = useCallback(() => {
    if (!userId || uploadingImage) {
      return;
    }

    Alert.alert('Enviar imagen', 'Selecciona una opción', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Galería',
        onPress: pickImageFromLibrary,
      },
      {
        text: 'Cámara',
        onPress: takePhotoWithCamera,
      },
    ]);
  }, [pickImageFromLibrary, takePhotoWithCamera, uploadingImage, userId]);

  const renderMessage = ({ item }) => {
    const isOwnMessage = item.sender_id === userId;
    const isReporter = conversation?.report_reporter_id === userId;
    const isResponderMessage =
      conversation?.report_reporter_id && item.sender_id
        ? item.sender_id !== conversation.report_reporter_id
        : false;
    const showResponderNotice = isReporter && isResponderMessage;
    const bubbleStyles = [
      styles.messageBubble,
      isOwnMessage ? styles.messageBubbleOwn : styles.messageBubbleOther,
    ];
    const messageTextStyle = [
      styles.messageText,
      isOwnMessage ? styles.messageTextOwn : styles.messageTextOther,
    ];
    const messageTimeStyle = [
      styles.messageTime,
      isOwnMessage ? styles.messageTimeOwn : styles.messageTimeOther,
    ];

    return (
      <View
        style={[
          styles.messageRow,
          isOwnMessage ? styles.messageRowOwn : styles.messageRowOther,
        ]}
      >
        <View style={bubbleStyles}>
          {showResponderNotice ? (
            <View style={styles.responderTag}>
              <View style={styles.responderTagHeader}>
                <Text style={styles.responderTagLabel}>Respondiendo a tu reporte</Text>
                <TouchableOpacity onPress={handleOpenReport}>
                  <Text style={styles.responderTagLink}>Ver reporte</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.responderTagTitle} numberOfLines={1}>
                {(conversation?.report_pet_name || 'Mascota').trim() || 'Mascota'}
              </Text>
            </View>
          ) : null}
          {item.content ? <Text style={messageTextStyle}>{item.content}</Text> : null}
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.messageImage}
              contentFit="cover"
            />
          ) : null}
          <Text style={messageTimeStyle}>{formatDateTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerExtras}>
      {hasMore ? (
        <View style={styles.loadMoreContainer}>
          <Button
            mode="text"
            onPress={loadMore}
            disabled={loadingMore}
            icon={loadingMore ? 'progress-clock' : 'history'}
          >
            {loadingMore ? 'Cargando mensajes...' : 'Cargar mensajes anteriores'}
          </Button>
        </View>
      ) : null}

      {conversation ? (
        <TouchableOpacity style={styles.replyPreview} onPress={handleOpenReport}>
          <View style={styles.replySidebar} />
          <View style={styles.replyContent}>
            <View style={styles.replyHeaderRow}>
              <Text style={styles.replyLabel}>Reporte vinculado</Text>
              <Text style={styles.replyLink}>Ver reporte</Text>
            </View>
            <Text style={styles.replyTitle}>
              {conversation.report_pet_name || 'Mascota'} ·{' '}
              {formatReportType(conversation.report_type)}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (loadingConversation) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.centerText}>Cargando conversación...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (conversationError) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerContent}>
          <Text style={styles.errorTitle}>No pudimos abrir el chat</Text>
          <Text style={styles.centerText}>{conversationError}</Text>
          <Button mode="contained" style={styles.retryButton} onPress={fetchConversation}>
            Reintentar
          </Button>
          <Button onPress={() => router.replace('/messages')}>Volver</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => router.replace('/messages')} />
          <View style={styles.headerInfo}>
            {conversation?.other_user_avatar ? (
              <Avatar.Image
                size={44}
                source={{ uri: conversation.other_user_avatar }}
                style={styles.headerAvatar}
              />
            ) : (
              <Avatar.Text
                size={44}
                label={otherUserInitials}
                style={styles.headerAvatar}
              />
            )}
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>
                {conversation?.other_user_name || 'Usuario'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {formatReportType(conversation?.report_type)} ·{' '}
                {(conversation?.report_pet_name || '').trim() || 'Mascota'}
              </Text>
            </View>
          </View>
          <View style={styles.headerPlaceholder} />
        </View>

        <View style={styles.separator} />

        {messagesError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{messagesError}</Text>
            <Button compact mode="text" onPress={loadMore}>
              Reintentar
            </Button>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesContainer}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            loadingMessages ? (
              <View style={styles.messagesEmpty}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.emptyText}>Cargando mensajes...</Text>
              </View>
            ) : (
              <View style={styles.messagesEmpty}>
                <Text style={styles.emptyText}>
                  Aún no hay mensajes. ¡Envía el primero para coordinar!
                </Text>
              </View>
            )
          }
        />

        <View style={styles.composerContainer}>
          <View style={styles.composerRow}>
            <IconButton
              icon={uploadingImage ? 'progress-upload' : 'paperclip'}
              size={26}
              onPress={handlePickImage}
              disabled={uploadingImage || sending}
              style={styles.attachmentButton}
            />
            <TextInput
              mode="outlined"
              placeholder="Escribe tu mensaje"
              value={messageInput}
              onChangeText={setMessageInput}
              multiline
              style={styles.textInput}
              right={
                <TextInput.Icon
                  icon="send"
                  disabled={!canSendMessage || sending}
                  onPress={handleSend}
                  forceTextInputFocus={false}
                />
              }
            />
          </View>
          <Button
            mode="contained"
            onPress={handleSend}
            disabled={!canSendMessage || sending}
            loading={sending}
            style={styles.sendButton}
          >
            Enviar
          </Button>
          {uploadingImage ? (
            <View style={styles.uploadHint}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.uploadHintText}>Enviando imagen...</Text>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F6FB',
  },
  flex: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerText: {
    marginTop: 12,
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#D32F2F',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    marginRight: 12,
    backgroundColor: '#E0E7FF',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  headerPlaceholder: {
    width: 44,
    height: 44,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
  },
  errorBanner: {
    backgroundColor: '#FDECEC',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBannerText: {
    color: '#B00020',
    fontSize: 13,
    flex: 1,
    marginRight: 12,
  },
  headerExtras: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  messagesContainer: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messagesEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  loadMoreContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  replySidebar: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#7C3AED',
    marginRight: 10,
  },
  replyContent: {
    flex: 1,
  },
  replyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  replyLabel: {
    fontSize: 12,
    color: '#5B21B6',
    fontWeight: '600',
  },
  replyTitle: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  replyLink: {
    fontSize: 12,
    color: '#5B21B6',
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  messageBubbleOwn: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
  },
  messageTextOwn: {
    color: '#FFFFFF',
  },
  messageTextOther: {
    color: '#111',
  },
  responderTag: {
    backgroundColor: '#F4F0FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  responderTagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  responderTagLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5B21B6',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  responderTagLink: {
    fontSize: 11,
    color: '#5B21B6',
    fontWeight: '600',
  },
  responderTagTitle: {
    fontSize: 12,
    color: '#4C1D95',
    fontWeight: '500',
  },
  messageTime: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  messageTimeOther: {
    color: '#6B7280',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginTop: 8,
  },
  composerContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E5E7EB',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachmentButton: {
    margin: 0,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: '#FFFFFF',
  },
  sendButton: {
    marginTop: 12,
  },
  uploadHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  uploadHintText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
  },
});


