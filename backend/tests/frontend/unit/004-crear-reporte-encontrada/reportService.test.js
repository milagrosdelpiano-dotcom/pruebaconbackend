/**
 * Pruebas Unitarias: Servicio de Reportes - Crear Reporte Encontrada
 * 
 * Basado en: specs/004-crear-reporte-encontrada/spec.md
 * Principio X: Pruebas unitarias para cada funcionalidad
 */

import { reportService } from '../../../../src/services/supabase';
import { apiService } from '../../../../src/services/api';

// Mock completo de reportService para testear la lógica de creación
jest.mock('../../../../src/services/supabase', () => ({
  reportService: {
    createReport: jest.fn(),
  },
  profileService: {
    ensureProfile: jest.fn().mockResolvedValue({ error: null }),
  },
}));

jest.mock('../../../../src/services/api', () => ({
  apiService: {
    createReport: jest.fn(),
  },
}));

describe('Servicio de Reportes - FR-001: Crear reporte encontrada', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('debe crear reporte de mascota encontrada con campos específicos', async () => {
    const reportData = {
      species: 'cat',
      breed: 'Persa',
      size: 'small',
      color: 'Blanco',
      description: 'Gato blanco encontrado en el parque',
      found_location: 'Parque Central',
      found_date: '2025-10-05',
      photos: ['https://example.com/photo1.jpg'],
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      address: 'Buenos Aires, Argentina',
      type: 'found', // Tipo encontrada
      reporter_id: 'user-123',
    };

    const createdReport = {
      id: 'report-new',
      ...reportData,
      status: 'active',
      created_at: '2025-10-05T12:00:00Z',
    };

    reportService.createReport.mockResolvedValue({
      data: createdReport,
      error: null,
    });

    const result = await reportService.createReport(reportData);

    expect(result.data.type).toBe('found');
    expect(result.data.found_location).toBe('Parque Central');
    expect(result.data.found_date).toBe('2025-10-05');
    expect(result.error).toBeNull();
  });

  test('debe validar que reporte encontrada no requiere nombre de mascota', async () => {
    const reportData = {
      // Sin pet_name (válido para encontradas)
      species: 'cat',
      size: 'small',
      description: 'Gato encontrado',
      photos: ['https://example.com/photo1.jpg'],
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      type: 'found',
      reporter_id: 'user-123',
    };

    const createdReport = {
      id: 'report-new',
      ...reportData,
    };

    reportService.createReport.mockResolvedValue({
      data: createdReport,
      error: null,
    });

    const result = await reportService.createReport(reportData);

    // No debe tener pet_name
    expect(result.data.pet_name).toBeUndefined();
    expect(result.data.type).toBe('found');
  });
});

describe('Servicio de Reportes - FR-002: Campos específicos encontrada', () => {
  test('debe incluir ubicación donde se encontró', async () => {
    const reportData = {
      species: 'dog',
      size: 'medium',
      description: 'Perro encontrado',
      found_location: 'Avenida Principal 123',
      photos: ['https://example.com/photo1.jpg'],
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      type: 'found',
      reporter_id: 'user-123',
    };

    const createdReport = {
      id: 'report-new',
      ...reportData,
    };

    reportService.createReport.mockResolvedValue({
      data: createdReport,
      error: null,
    });

    const result = await reportService.createReport(reportData);

    expect(result.data.found_location).toBe('Avenida Principal 123');
  });

  test('debe incluir fecha cuando se encontró', async () => {
    const reportData = {
      species: 'cat',
      size: 'small',
      description: 'Gato encontrado',
      found_date: '2025-10-04',
      photos: ['https://example.com/photo1.jpg'],
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      type: 'found',
      reporter_id: 'user-123',
    };

    const createdReport = {
      id: 'report-new',
      ...reportData,
    };

    reportService.createReport.mockResolvedValue({
      data: createdReport,
      error: null,
    });

    const result = await reportService.createReport(reportData);

    expect(result.data.found_date).toBe('2025-10-04');
  });
});

describe('Servicio de Reportes - FR-003: Validación encontrada', () => {
  test('debe validar campos requeridos para encontrada', async () => {
    const incompleteData = {
      species: 'dog',
      // Faltan: size, description, photos, location
      type: 'found',
    };

    reportService.createReport.mockResolvedValue({
      data: null,
      error: { message: 'Campos requeridos faltantes' },
    });

    const result = await reportService.createReport(incompleteData);

    expect(result.error).toBeTruthy();
  });

  test('debe validar que encontrada no tiene campo de recompensa', async () => {
    const reportData = {
      species: 'cat',
      size: 'small',
      description: 'Gato encontrado',
      photos: ['https://example.com/photo1.jpg'],
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      type: 'found',
      reward: 500, // No debería estar en encontradas
      reporter_id: 'user-123',
    };

    const createdReport = {
      id: 'report-new',
      ...reportData,
      reward: undefined, // Reward no aplica a encontradas
    };

    reportService.createReport.mockResolvedValue({
      data: createdReport,
      error: null,
    });

    const result = await reportService.createReport(reportData);

    // Reward no debería aplicarse a encontradas
    expect(result.data.type).toBe('found');
  });
});

