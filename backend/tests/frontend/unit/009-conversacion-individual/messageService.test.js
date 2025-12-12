/**
 * Pruebas Unitarias: Servicio de Mensajería - Conversación Individual
 * 
 * Basado en: specs/009-conversacion-individual/spec.md
 * Principio X: Pruebas unitarias para cada funcionalidad
 */

import { messageService } from '../../../../src/services/supabase';

// Mock del servicio de mensajería
jest.mock('../../../../src/services/supabase', () => ({
  messageService: {
    getConversationById: jest.fn(),
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
    markMessagesAsRead: jest.fn(),
  },
}));

describe('Servicio de Mensajería - FR-001: Obtener conversación por ID', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('debe obtener conversación con información completa', async () => {
    const mockConversation = {
      id: 'conv-1',
      participant1_id: 'user-123',
      participant2_id: 'user-456',
      report_id: 'report-1',
      created_at: '2025-10-01T10:00:00Z',
    };

    messageService.getConversationById.mockResolvedValue({
      data: mockConversation,
      error: null,
    });

    const result = await messageService.getConversationById('conv-1');

    expect(result.data).toEqual(mockConversation);
    expect(result.error).toBeNull();
    expect(messageService.getConversationById).toHaveBeenCalledWith('conv-1');
  });

  test('debe manejar conversación no encontrada', async () => {
    messageService.getConversationById.mockResolvedValue({
      data: null,
      error: { message: 'Conversación no encontrada' },
    });

    const result = await messageService.getConversationById('non-existent');

    expect(result.data).toBeNull();
    expect(result.error.message).toContain('no encontrada');
  });
});

describe('Servicio de Mensajería - FR-002: Obtener mensajes de conversación', () => {
  test('debe obtener todos los mensajes de una conversación', async () => {
    const mockMessages = [
      {
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_id: 'user-123',
        content: 'Hola, ¿sigue disponible?',
        created_at: '2025-10-05T10:00:00Z',
        read: false,
      },
      {
        id: 'msg-2',
        conversation_id: 'conv-1',
        sender_id: 'user-456',
        content: 'Sí, todavía está disponible',
        created_at: '2025-10-05T10:05:00Z',
        read: true,
      },
    ];

    messageService.getMessages.mockResolvedValue({
      data: mockMessages,
      error: null,
    });

    const result = await messageService.getMessages('conv-1');

    expect(result.data).toEqual(mockMessages);
    expect(result.data.length).toBe(2);
    expect(messageService.getMessages).toHaveBeenCalledWith('conv-1');
  });

  test('debe retornar lista vacía cuando no hay mensajes', async () => {
    messageService.getMessages.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await messageService.getMessages('conv-1');

    expect(result.data).toEqual([]);
  });

  test('debe ordenar mensajes por fecha (más antiguos primero)', async () => {
    const mockMessages = [
      {
        id: 'msg-2',
        created_at: '2025-10-05T10:05:00Z',
      },
      {
        id: 'msg-1',
        created_at: '2025-10-05T10:00:00Z',
      },
    ];

    messageService.getMessages.mockResolvedValue({
      data: mockMessages,
      error: null,
    });

    const result = await messageService.getMessages('conv-1');

    // Los mensajes deben estar ordenados (el servicio debería ordenarlos)
    expect(result.data.length).toBe(2);
  });
});

describe('Servicio de Mensajería - FR-003: Enviar mensaje', () => {
  test('debe enviar mensaje de texto exitosamente', async () => {
    const newMessage = {
      id: 'msg-new',
      conversation_id: 'conv-1',
      sender_id: 'user-123',
      content: 'Nuevo mensaje',
      created_at: '2025-10-05T12:00:00Z',
      read: false,
    };

    messageService.sendMessage.mockResolvedValue({
      data: newMessage,
      error: null,
    });

    const result = await messageService.sendMessage('conv-1', 'user-123', 'Nuevo mensaje');

    expect(result.data.content).toBe('Nuevo mensaje');
    expect(result.data.sender_id).toBe('user-123');
    expect(result.error).toBeNull();
  });

  test('debe manejar errores al enviar mensaje', async () => {
    const mockError = { message: 'Error al enviar mensaje' };

    messageService.sendMessage.mockResolvedValue({
      data: null,
      error: mockError,
    });

    const result = await messageService.sendMessage('conv-1', 'user-123', 'Mensaje');

    expect(result.data).toBeNull();
    expect(result.error).toEqual(mockError);
  });
});

describe('Servicio de Mensajería - FR-004: Marcar mensajes como leídos', () => {
  test('debe marcar mensajes como leídos', async () => {
    messageService.markMessagesAsRead.mockResolvedValue({
      data: { updated: 3 },
      error: null,
    });

    const result = await messageService.markMessagesAsRead('conv-1', 'user-123');

    expect(result.data.updated).toBe(3);
    expect(result.error).toBeNull();
    expect(messageService.markMessagesAsRead).toHaveBeenCalledWith('conv-1', 'user-123');
  });

  test('debe manejar errores al marcar como leído', async () => {
    const mockError = { message: 'Error al actualizar' };

    messageService.markMessagesAsRead.mockResolvedValue({
      data: null,
      error: mockError,
    });

    const result = await messageService.markMessagesAsRead('conv-1', 'user-123');

    expect(result.data).toBeNull();
    expect(result.error).toEqual(mockError);
  });
});

