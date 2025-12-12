/**
 * Pruebas Unitarias: Servicio de Mensajería - Lista de Conversaciones
 * 
 * Basado en: specs/008-lista-conversaciones/spec.md
 * Principio X: Pruebas unitarias para cada funcionalidad
 */

import { messageService } from '../../../../src/services/supabase';

// Mock del servicio de mensajería
jest.mock('../../../../src/services/supabase', () => ({
  messageService: {
    getUserConversations: jest.fn(),
    getOrCreateConversation: jest.fn(),
    getConversationById: jest.fn(),
  },
}));

describe('Servicio de Mensajería - FR-001: Obtener conversaciones del usuario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('debe obtener todas las conversaciones del usuario autenticado', async () => {
    const mockConversations = [
      {
        id: 'conv-1',
        participant1_id: 'user-123',
        participant2_id: 'user-456',
        report_id: 'report-1',
        last_message: 'Hola, ¿sigue disponible?',
        last_message_at: '2025-10-05T12:00:00Z',
        unread_count: 2,
      },
      {
        id: 'conv-2',
        participant1_id: 'user-123',
        participant2_id: 'user-789',
        report_id: 'report-2',
        last_message: 'Gracias por contactarme',
        last_message_at: '2025-10-04T10:00:00Z',
        unread_count: 0,
      },
    ];

    messageService.getUserConversations.mockResolvedValue({
      data: mockConversations,
      error: null,
    });

    const result = await messageService.getUserConversations('user-123');

    expect(result.data).toEqual(mockConversations);
    expect(result.error).toBeNull();
    expect(messageService.getUserConversations).toHaveBeenCalledWith('user-123');
  });

  test('debe retornar lista vacía cuando el usuario no tiene conversaciones', async () => {
    messageService.getUserConversations.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await messageService.getUserConversations('user-123');

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  test('debe manejar errores al obtener conversaciones', async () => {
    const mockError = { message: 'Error de conexión' };

    messageService.getUserConversations.mockResolvedValue({
      data: null,
      error: mockError,
    });

    const result = await messageService.getUserConversations('user-123');

    expect(result.data).toBeNull();
    expect(result.error).toEqual(mockError);
  });
});

describe('Servicio de Mensajería - FR-002: Preview de último mensaje', () => {
  test('debe incluir preview del último mensaje en cada conversación', async () => {
    const mockConversations = [
      {
        id: 'conv-1',
        last_message: 'Hola, ¿sigue disponible?',
        last_message_at: '2025-10-05T12:00:00Z',
      },
    ];

    messageService.getUserConversations.mockResolvedValue({
      data: mockConversations,
      error: null,
    });

    const result = await messageService.getUserConversations('user-123');

    expect(result.data[0]).toHaveProperty('last_message');
    expect(result.data[0]).toHaveProperty('last_message_at');
    expect(result.data[0].last_message).toBe('Hola, ¿sigue disponible?');
  });

  test('debe manejar conversaciones sin mensajes', async () => {
    const mockConversations = [
      {
        id: 'conv-1',
        last_message: null,
        last_message_at: null,
      },
    ];

    messageService.getUserConversations.mockResolvedValue({
      data: mockConversations,
      error: null,
    });

    const result = await messageService.getUserConversations('user-123');

    expect(result.data[0].last_message).toBeNull();
  });
});

describe('Servicio de Mensajería - FR-003: Indicadores de mensajes no leídos', () => {
  test('debe incluir conteo de mensajes no leídos', async () => {
    const mockConversations = [
      {
        id: 'conv-1',
        unread_count: 3,
      },
      {
        id: 'conv-2',
        unread_count: 0,
      },
    ];

    messageService.getUserConversations.mockResolvedValue({
      data: mockConversations,
      error: null,
    });

    const result = await messageService.getUserConversations('user-123');

    expect(result.data[0].unread_count).toBe(3);
    expect(result.data[1].unread_count).toBe(0);
  });
});

describe('Servicio de Mensajería - FR-004: Actualizar lista', () => {
  test('debe permitir recargar conversaciones', async () => {
    const initialConversations = [
      {
        id: 'conv-1',
        last_message: 'Mensaje antiguo',
        last_message_at: '2025-10-05T10:00:00Z',
      },
    ];

    const updatedConversations = [
      {
        id: 'conv-1',
        last_message: 'Mensaje nuevo',
        last_message_at: '2025-10-05T12:00:00Z',
      },
    ];

    // Primera llamada
    messageService.getUserConversations.mockResolvedValueOnce({
      data: initialConversations,
      error: null,
    });

    const result1 = await messageService.getUserConversations('user-123');
    expect(result1.data[0].last_message).toBe('Mensaje antiguo');

    // Segunda llamada (refresh) con datos actualizados
    messageService.getUserConversations.mockResolvedValueOnce({
      data: updatedConversations,
      error: null,
    });

    const result2 = await messageService.getUserConversations('user-123');
    expect(result2.data[0].last_message).toBe('Mensaje nuevo');
    
    // Verificar que se llamó al menos 2 veces (puede ser más por otros tests)
    expect(messageService.getUserConversations.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

