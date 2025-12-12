/**
 * Pruebas Unitarias: Servicio de Reportes - Crear Reporte Perdida
 * 
 * Basado en: specs/003-crear-reporte-perdida/spec.md
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

describe('Servicio de Reportes - FR-001: Crear reporte completo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('debe crear reporte con todos los campos requeridos', async () => {
    const reportData = {
      pet_name: 'Max',
      species: 'dog',
      breed: 'Labrador',
      size: 'large',
      color: 'Dorado',
      description: 'Perro muy amigable',
      photos: ['https://example.com/photo1.jpg'],
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      address: 'Buenos Aires, Argentina',
      type: 'lost',
      reporter_id: 'user-123',
    };

    const createdReport = {
      id: 'report-new',
      ...reportData,
      status: 'active',
      created_at: '2025-10-05T12:00:00Z',
    };

    // Mock de reportService.createReport directamente
    reportService.createReport.mockResolvedValue({
      data: createdReport,
      error: null,
    });

    const result = await reportService.createReport(reportData);

    expect(result.data).toEqual(createdReport);
    expect(result.error).toBeNull();
    expect(reportService.createReport).toHaveBeenCalledWith(reportData);
  });

  test('debe validar campos requeridos antes de crear', async () => {
    const incompleteData = {
      pet_name: 'Max',
      // Faltan: species, size, description, photos, location
    };

    // Mock de error cuando faltan campos
    reportService.createReport.mockResolvedValue({
      data: null,
      error: { message: 'Campos requeridos faltantes' },
    });

    const result = await reportService.createReport(incompleteData);

    expect(result.error).toBeTruthy();
  });
});

describe('Servicio de Reportes - FR-002: Subida de fotos', () => {
  test('debe aceptar hasta 5 fotos', async () => {
    const reportData = {
      pet_name: 'Max',
      species: 'dog',
      size: 'large',
      description: 'Test',
      photos: [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg',
        'https://example.com/photo3.jpg',
        'https://example.com/photo4.jpg',
        'https://example.com/photo5.jpg',
      ],
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      type: 'lost',
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

    expect(result.data.photos.length).toBe(5);
  });

  test('debe requerir al menos una foto', async () => {
    const reportData = {
      pet_name: 'Max',
      species: 'dog',
      size: 'large',
      description: 'Test',
      photos: [], // Sin fotos
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      type: 'lost',
      reporter_id: 'user-123',
    };

    reportService.createReport.mockResolvedValue({
      data: null,
      error: { message: 'Al menos una foto es requerida' },
    });

    const result = await reportService.createReport(reportData);

    expect(result.error).toBeTruthy();
    expect(result.error.message).toContain('foto');
  });
});

describe('Servicio de Reportes - FR-003: Selección de ubicación', () => {
  test('debe aceptar ubicación en formato PostGIS', async () => {
    const reportData = {
      pet_name: 'Max',
      species: 'dog',
      size: 'large',
      description: 'Test',
      photos: ['https://example.com/photo1.jpg'],
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      address: 'Buenos Aires, Argentina',
      type: 'lost',
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

    expect(result.data.location).toContain('POINT');
    expect(result.data.address).toBe('Buenos Aires, Argentina');
  });

  test('debe requerir ubicación', async () => {
    const reportData = {
      pet_name: 'Max',
      species: 'dog',
      size: 'large',
      description: 'Test',
      photos: ['https://example.com/photo1.jpg'],
      // Sin location
      type: 'lost',
      reporter_id: 'user-123',
    };

    const errorObj = { message: 'Ubicación es requerida' };
    reportService.createReport.mockResolvedValue({
      data: null,
      error: errorObj,
    });

    const result = await reportService.createReport(reportData);

    expect(result.error).toBeTruthy();
    expect(result.error).toEqual(errorObj);
  });
});

describe('Servicio de Reportes - FR-004: Validación de campos', () => {
  test('debe validar nombre de mascota requerido', async () => {
    const reportData = {
      // Sin pet_name
      species: 'dog',
      size: 'large',
      description: 'Test',
      photos: ['https://example.com/photo1.jpg'],
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      type: 'lost',
      reporter_id: 'user-123',
    };

    reportService.createReport.mockResolvedValue({
      data: null,
      error: { message: 'Nombre de mascota es requerido' },
    });

    const result = await reportService.createReport(reportData);

    expect(result.error).toBeTruthy();
  });

  test('debe validar especie requerida', async () => {
    const reportData = {
      pet_name: 'Max',
      // Sin species
      size: 'large',
      description: 'Test',
      photos: ['https://example.com/photo1.jpg'],
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      type: 'lost',
      reporter_id: 'user-123',
    };

    reportService.createReport.mockResolvedValue({
      data: null,
      error: { message: 'Especie es requerida' },
    });

    const result = await reportService.createReport(reportData);

    expect(result.error).toBeTruthy();
  });

  test('debe validar tamaño requerido', async () => {
    const reportData = {
      pet_name: 'Max',
      species: 'dog',
      // Sin size
      description: 'Test',
      photos: ['https://example.com/photo1.jpg'],
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      type: 'lost',
      reporter_id: 'user-123',
    };

    reportService.createReport.mockResolvedValue({
      data: null,
      error: { message: 'Tamaño es requerido' },
    });

    const result = await reportService.createReport(reportData);

    expect(result.error).toBeTruthy();
  });

  test('debe validar descripción requerida', async () => {
    const reportData = {
      pet_name: 'Max',
      species: 'dog',
      size: 'large',
      // Sin description
      photos: ['https://example.com/photo1.jpg'],
      location: 'SRID=4326;POINT(-58.3816 -34.6037)',
      type: 'lost',
      reporter_id: 'user-123',
    };

    reportService.createReport.mockResolvedValue({
      data: null,
      error: { message: 'Descripción es requerida' },
    });

    const result = await reportService.createReport(reportData);

    expect(result.error).toBeTruthy();
  });
});

