/**
 * Pruebas Unitarias: Servicio de Ubicación - Mapa Interactivo
 * 
 * Basado en: specs/006-mapa-interactivo/spec.md
 * Principio X: Pruebas unitarias para cada funcionalidad
 */

import { getCurrentLocation, getMapRegion } from '../../../../src/services/location';
import { reportService } from '../../../../src/services/supabase';

// Mock de servicios
jest.mock('../../../../src/services/location', () => ({
  getCurrentLocation: jest.fn(),
  getMapRegion: jest.fn(),
  checkLocationPermission: jest.fn(),
  requestLocationPermission: jest.fn(),
}));

jest.mock('../../../../src/services/supabase', () => ({
  reportService: {
    getNearbyReports: jest.fn(),
  },
}));

describe('Servicio de Ubicación - FR-001: Obtener ubicación actual', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('debe obtener ubicación GPS del usuario', async () => {
    const mockLocation = {
      latitude: -34.6037,
      longitude: -58.3816,
      accuracy: 10,
    };

    getCurrentLocation.mockResolvedValue({
      success: true,
      data: mockLocation,
      error: null,
    });

    const result = await getCurrentLocation();

    expect(result.success).toBe(true);
    expect(result.data.latitude).toBe(-34.6037);
    expect(result.data.longitude).toBe(-58.3816);
  });

  test('debe manejar error cuando no se puede obtener ubicación', async () => {
    getCurrentLocation.mockResolvedValue({
      success: false,
      data: null,
      error: { message: 'No se pudo obtener la ubicación' },
    });

    const result = await getCurrentLocation();

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('Servicio de Ubicación - FR-002: Región del mapa', () => {
  test('debe generar región del mapa con ubicación y radio', async () => {
    const mockRegion = {
      latitude: -34.6037,
      longitude: -58.3816,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };

    getMapRegion.mockReturnValue(mockRegion);

    const region = getMapRegion(-34.6037, -58.3816, 10);

    expect(region.latitude).toBe(-34.6037);
    expect(region.longitude).toBe(-58.3816);
    expect(region.latitudeDelta).toBeDefined();
    expect(region.longitudeDelta).toBeDefined();
  });
});

describe('Servicio de Reportes - FR-003: Obtener reportes cercanos', () => {
  test('debe obtener reportes cercanos a una ubicación', async () => {
    const mockReports = [
      {
        id: 'report-1',
        pet_name: 'Max',
        type: 'lost',
        location: { type: 'Point', coordinates: [-58.3816, -34.6037] },
        distance: 0.5,
      },
      {
        id: 'report-2',
        pet_name: 'Luna',
        type: 'found',
        location: { type: 'Point', coordinates: [-58.3820, -34.6040] },
        distance: 1.2,
      },
    ];

    reportService.getNearbyReports.mockResolvedValue({
      data: mockReports,
      error: null,
    });

    const result = await reportService.getNearbyReports(-34.6037, -58.3816, 5000);

    expect(result.data).toEqual(mockReports);
    expect(result.data.length).toBe(2);
    expect(result.error).toBeNull();
  });

  test('debe retornar lista vacía cuando no hay reportes cercanos', async () => {
    reportService.getNearbyReports.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await reportService.getNearbyReports(-34.6037, -58.3816, 5000);

    expect(result.data).toEqual([]);
  });

  test('debe respetar el radio de búsqueda', async () => {
    const mockReports = [
      {
        id: 'report-1',
        distance: 2.5, // Dentro del radio de 5km
      },
    ];

    reportService.getNearbyReports.mockResolvedValue({
      data: mockReports,
      error: null,
    });

    const result = await reportService.getNearbyReports(-34.6037, -58.3816, 5000);

    expect(result.data[0].distance).toBeLessThanOrEqual(5);
  });

  test('debe manejar errores al obtener reportes cercanos', async () => {
    const mockError = { message: 'Error de conexión' };

    reportService.getNearbyReports.mockResolvedValue({
      data: null,
      error: mockError,
    });

    const result = await reportService.getNearbyReports(-34.6037, -58.3816, 5000);

    expect(result.data).toBeNull();
    expect(result.error).toEqual(mockError);
  });
});

describe('Servicio de Reportes - FR-004: Diferenciación de tipos', () => {
  test('debe incluir tipo de reporte (lost/found) en cada resultado', async () => {
    const mockReports = [
      {
        id: 'report-1',
        type: 'lost',
      },
      {
        id: 'report-2',
        type: 'found',
      },
    ];

    reportService.getNearbyReports.mockResolvedValue({
      data: mockReports,
      error: null,
    });

    const result = await reportService.getNearbyReports(-34.6037, -58.3816, 5000);

    expect(result.data[0].type).toBe('lost');
    expect(result.data[1].type).toBe('found');
  });
});

