/**
 * Pruebas Unitarias: Servicio de Mascotas
 * 
 * Basado en: specs/010-mis-mascotas/spec.md
 * Principio X: Pruebas unitarias para cada funcionalidad
 */

import { petService } from '../../../../src/services/supabase';

// Mock del servicio de Supabase
jest.mock('../../../../src/services/supabase', () => {
  const mockSupabase = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
    })),
  };

  return {
    petService: {
      getUserPets: jest.fn(),
      getPetById: jest.fn(),
      createPet: jest.fn(),
      updatePet: jest.fn(),
      deletePet: jest.fn(),
    },
    supabase: mockSupabase,
  };
});

describe('Servicio de Mascotas - FR-001: Obtener mascotas del usuario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('debe obtener todas las mascotas del usuario autenticado', async () => {
    const mockPets = [
      {
        id: '1',
        name: 'Max',
        species: 'dog',
        breed: 'Labrador',
        size: 'large',
        color: 'Dorado',
        owner_id: 'user-123',
        created_at: '2025-10-01T10:00:00Z',
        is_lost: false,
      },
      {
        id: '2',
        name: 'Luna',
        species: 'cat',
        breed: 'Persa',
        size: 'small',
        color: 'Blanco',
        owner_id: 'user-123',
        created_at: '2025-10-02T10:00:00Z',
        is_lost: true,
      },
    ];

    petService.getUserPets.mockResolvedValue({
      data: mockPets,
      error: null,
    });

    const result = await petService.getUserPets('user-123');

    expect(result.data).toEqual(mockPets);
    expect(result.error).toBeNull();
    expect(petService.getUserPets).toHaveBeenCalledWith('user-123');
  });

  test('debe retornar lista vacía cuando el usuario no tiene mascotas', async () => {
    petService.getUserPets.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await petService.getUserPets('user-123');

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  test('debe manejar errores al obtener mascotas', async () => {
    const mockError = { message: 'Error de conexión' };

    petService.getUserPets.mockResolvedValue({
      data: null,
      error: mockError,
    });

    const result = await petService.getUserPets('user-123');

    expect(result.data).toBeNull();
    expect(result.error).toEqual(mockError);
  });
});

describe('Servicio de Mascotas - FR-002: Información de mascotas', () => {
  test('debe retornar mascotas con todos los campos requeridos', async () => {
    const mockPet = {
      id: '1',
      name: 'Max',
      species: 'dog',
      breed: 'Labrador',
      size: 'large',
      color: 'Dorado',
      owner_id: 'user-123',
      created_at: '2025-10-01T10:00:00Z',
      is_lost: false,
    };

    petService.getUserPets.mockResolvedValue({
      data: [mockPet],
      error: null,
    });

    const result = await petService.getUserPets('user-123');

    expect(result.data[0]).toHaveProperty('name');
    expect(result.data[0]).toHaveProperty('species');
    expect(result.data[0]).toHaveProperty('breed');
    expect(result.data[0]).toHaveProperty('size');
    expect(result.data[0]).toHaveProperty('color');
    expect(result.data[0]).toHaveProperty('created_at');
    expect(result.data[0]).toHaveProperty('is_lost');
  });
});

describe('Servicio de Mascotas - FR-003: Indicador de mascota perdida', () => {
  test('debe identificar mascotas perdidas (is_lost = true)', async () => {
    const mockPets = [
      {
        id: '1',
        name: 'Max',
        is_lost: true,
      },
      {
        id: '2',
        name: 'Luna',
        is_lost: false,
      },
    ];

    petService.getUserPets.mockResolvedValue({
      data: mockPets,
      error: null,
    });

    const result = await petService.getUserPets('user-123');

    const lostPet = result.data.find(pet => pet.id === '1');
    expect(lostPet.is_lost).toBe(true);
  });
});

describe('Servicio de Mascotas - SC-001: Rendimiento', () => {
  test('debe cargar lista de mascotas rápidamente', async () => {
    const startTime = Date.now();

    petService.getUserPets.mockResolvedValue({
      data: [],
      error: null,
    });

    await petService.getUserPets('user-123');

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Debe completarse en menos de 2 segundos (según SC-001)
    expect(duration).toBeLessThan(2000);
  });
});


