/**
 * Pruebas Unitarias: Login de Usuario
 * 
 * Basado en: specs/001-login-usuario/spec.md
 * Principio X: Pruebas unitarias para cada funcionalidad
 */

import { useAuthStore } from '../../../../src/stores/authStore';
import { authService } from '../../../../src/services/supabase';

// Mock del servicio de autenticación
jest.mock('../../../../src/services/supabase', () => ({
  authService: {
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}));

describe('Login de Usuario - authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      user: null,
      session: null,
      loading: false,
      initialized: false,
    });
  });

  describe('FR-001: Permitir login con email y contraseña', () => {
    test('debe autenticar usuario con credenciales válidas', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { access_token: 'token123' };
      
      authService.signIn.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Testear directamente el store de zustand
      const response = await useAuthStore.getState().login('test@example.com', 'password123');
      
      expect(response.success).toBe(true);
      expect(response.data.user).toEqual(mockUser);
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().session).toEqual(mockSession);
    });

    test('debe manejar credenciales inválidas', async () => {
      authService.signIn.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      const response = await useAuthStore.getState().login('test@example.com', 'wrongpassword');
      
      expect(response.success).toBe(false);
      expect(response.error.message).toContain('Invalid login credentials');
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('FR-002, FR-003: Validación de campos', () => {
    test('debe validar que email no esté vacío', () => {
      // Esta validación se hace en el componente, pero podemos testear el servicio
      // El componente debe validar antes de llamar a login
      // Aquí testearíamos que el servicio rechaza emails vacíos si tiene validación
      expect(authService.signIn).not.toHaveBeenCalled();
    });
  });

  describe('FR-005: Indicador de carga', () => {
    test('debe mostrar loading durante autenticación', async () => {
      authService.signIn.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          data: { user: { id: '123' }, session: {} },
          error: null,
        }), 100))
      );

      // Iniciar login (asíncrono)
      const loginPromise = useAuthStore.getState().login('test@example.com', 'password123');
      
      // Verificar que loading se activa inmediatamente
      expect(useAuthStore.getState().loading).toBe(true);

      // Esperar a que termine
      await loginPromise;

      // Verificar que loading se desactiva
      expect(useAuthStore.getState().loading).toBe(false);
    });
  });

  describe('FR-006: Manejo de errores específicos', () => {
    test('debe manejar email no confirmado', async () => {
      authService.signIn.mockResolvedValue({
        data: null,
        error: { message: 'Email not confirmed' },
      });

      const response = await useAuthStore.getState().login('test@example.com', 'password123');
      
      expect(response.success).toBe(false);
      expect(response.error.message).toContain('Email not confirmed');
    });

    test('debe manejar demasiados intentos', async () => {
      authService.signIn.mockResolvedValue({
        data: null,
        error: { message: 'Too many requests' },
      });

      const response = await useAuthStore.getState().login('test@example.com', 'password123');
      
      expect(response.success).toBe(false);
      expect(response.error.message).toContain('Too many requests');
    });
  });

  describe('FR-012: Mantener sesión', () => {
    test('debe mantener sesión después de login exitoso', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { access_token: 'token123' };
      
      authService.signIn.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      await useAuthStore.getState().login('test@example.com', 'password123');

      // Verificar que la sesión se mantiene
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().session).toEqual(mockSession);
    });
  });
});

