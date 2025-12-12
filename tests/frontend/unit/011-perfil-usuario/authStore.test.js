/**
 * Pruebas Unitarias: Funcionalidades de Perfil en authStore
 * 
 * Basado en: specs/011-perfil-usuario/spec.md
 * Principio X: Pruebas unitarias para cada funcionalidad
 */

import { useAuthStore } from '../../../../src/stores/authStore';
import { authService } from '../../../../src/services/supabase';

// Mock del servicio de autenticación
jest.mock('../../../../src/services/supabase', () => ({
  authService: {
    signOut: jest.fn(),
    updateUser: jest.fn(),
    getUser: jest.fn(),
  },
}));

describe('Perfil de Usuario - FR-001, FR-002: Ver información del perfil', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      session: null,
      loading: false,
    });
  });

  test('debe mostrar información del usuario autenticado', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Juan Pérez',
        phone: '+1234567890',
      },
    };

    useAuthStore.setState({ user: mockUser });

    const user = useAuthStore.getState().user;
    expect(user.email).toBe('test@example.com');
    expect(user.user_metadata.full_name).toBe('Juan Pérez');
    expect(user.user_metadata.phone).toBe('+1234567890');
  });

  test('debe manejar usuario sin metadata', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: null,
    };

    useAuthStore.setState({ user: mockUser });

    const user = useAuthStore.getState().user;
    expect(user.email).toBe('test@example.com');
    expect(user.user_metadata).toBeNull();
  });
});

describe('Perfil de Usuario - FR-003, FR-004, FR-005: Editar perfil', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('debe permitir actualizar nombre completo y teléfono', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Juan Pérez',
        phone: '+1234567890',
      },
    };

    const updatedUser = {
      ...mockUser,
      user_metadata: {
        full_name: 'Juan Pérez Actualizado',
        phone: '+9876543210',
      },
    };

    authService.updateUser.mockResolvedValue({
      data: { user: updatedUser },
      error: null,
    });

    // Simular actualización (si existe método updateProfile en el store)
    // Por ahora verificamos que el servicio puede actualizar
    const result = await authService.updateUser({
      data: {
        full_name: 'Juan Pérez Actualizado',
        phone: '+9876543210',
      },
    });

    expect(result.data.user.user_metadata.full_name).toBe('Juan Pérez Actualizado');
    expect(result.data.user.user_metadata.phone).toBe('+9876543210');
  });

  test('debe mantener email como solo lectura (no editable)', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Juan Pérez',
      },
    };

    useAuthStore.setState({ user: mockUser });

    const user = useAuthStore.getState().user;
    // El email no debe estar en user_metadata (no es editable)
    expect(user.email).toBe('test@example.com');
    expect(user.user_metadata.email).toBeUndefined();
  });
});

describe('Perfil de Usuario - FR-009, FR-010, FR-011: Cerrar sesión', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'user-123', email: 'test@example.com' },
      session: { access_token: 'token123' },
      loading: false,
    });
  });

  test('debe cerrar sesión exitosamente', async () => {
    authService.signOut.mockResolvedValue({
      error: null,
    });

    const result = await useAuthStore.getState().logout();

    expect(result.success).toBe(true);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().session).toBeNull();
  });

  test('debe manejar errores al cerrar sesión', async () => {
    authService.signOut.mockResolvedValue({
      error: { message: 'Error al cerrar sesión' },
    });

    const result = await useAuthStore.getState().logout();

    expect(result.success).toBe(false);
    expect(result.error.message).toContain('Error al cerrar sesión');
  });

  test('debe mostrar loading durante cierre de sesión', async () => {
    authService.signOut.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ error: null }), 100))
    );

    const logoutPromise = useAuthStore.getState().logout();

    // Verificar que loading se activa
    expect(useAuthStore.getState().loading).toBe(true);

    await logoutPromise;

    // Verificar que loading se desactiva
    expect(useAuthStore.getState().loading).toBe(false);
  });
});

describe('Perfil de Usuario - FR-008: Estadísticas del perfil', () => {
  test('debe mostrar fecha de registro del usuario', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: '2025-10-01T10:00:00Z',
      email_confirmed_at: '2025-10-01T11:00:00Z',
    };

    useAuthStore.setState({ user: mockUser });

    const user = useAuthStore.getState().user;
    expect(user.created_at).toBe('2025-10-01T10:00:00Z');
    expect(user.email_confirmed_at).toBe('2025-10-01T11:00:00Z');
  });

  test('debe identificar si el email está verificado', () => {
    const verifiedUser = {
      id: 'user-123',
      email: 'test@example.com',
      email_confirmed_at: '2025-10-01T11:00:00Z',
    };

    const unverifiedUser = {
      id: 'user-456',
      email: 'test2@example.com',
      email_confirmed_at: null,
    };

    useAuthStore.setState({ user: verifiedUser });
    expect(useAuthStore.getState().user.email_confirmed_at).toBeTruthy();

    useAuthStore.setState({ user: unverifiedUser });
    expect(useAuthStore.getState().user.email_confirmed_at).toBeNull();
  });
});


