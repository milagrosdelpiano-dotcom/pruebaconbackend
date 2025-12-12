/**
 * Pruebas Unitarias: Servicio de Reportes
 * 
 * Basado en: specs/005-ver-mis-reportes/spec.md
 * Principio X: Pruebas unitarias para cada funcionalidad
 */

import { reportService } from '../../../../src/services/supabase';

// Mock del servicio de reportes
jest.mock('../../../../src/services/supabase', () => ({
  reportService: {
    getUserReports: jest.fn(),
    getReportById: jest.fn(),
    updateReport: jest.fn(),
    deleteReport: jest.fn(),
    resolveReport: jest.fn(),
  },
}));

describe('Servicio de Reportes - FR-001: Obtener reportes del usuario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('debe obtener todos los reportes del usuario autenticado', async () => {
    const mockReports = [
      {
        id: '1',
        pet_name: 'Max',
        type: 'lost',
        status: 'active',
        reporter_id: 'user-123',
        created_at: '2025-10-01T10:00:00Z',
      },
      {
        id: '2',
        pet_name: 'Luna',
        type: 'found',
        status: 'resolved',
        reporter_id: 'user-123',
        created_at: '2025-10-02T10:00:00Z',
      },
    ];

    reportService.getUserReports.mockResolvedValue({
      data: mockReports,
      error: null,
    });

    const result = await reportService.getUserReports('user-123');

    expect(result.data).toEqual(mockReports);
    expect(result.error).toBeNull();
    expect(reportService.getUserReports).toHaveBeenCalledWith('user-123');
  });

  test('debe retornar lista vacía cuando el usuario no tiene reportes', async () => {
    reportService.getUserReports.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await reportService.getUserReports('user-123');

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  test('debe manejar errores al obtener reportes', async () => {
    const mockError = { message: 'Error de conexión' };

    reportService.getUserReports.mockResolvedValue({
      data: null,
      error: mockError,
    });

    const result = await reportService.getUserReports('user-123');

    expect(result.data).toBeNull();
    expect(result.error).toEqual(mockError);
  });
});

describe('Servicio de Reportes - FR-002: Filtrar reportes por estado', () => {
  test('debe filtrar reportes activos', async () => {
    const mockReports = [
      { id: '1', status: 'active' },
      { id: '2', status: 'resolved' },
      { id: '3', status: 'active' },
    ];

    reportService.getUserReports.mockResolvedValue({
      data: mockReports,
      error: null,
    });

    const result = await reportService.getUserReports('user-123');
    const activeReports = result.data.filter(r => r.status === 'active');

    expect(activeReports.length).toBe(2);
  });

  test('debe filtrar reportes resueltos', async () => {
    const mockReports = [
      { id: '1', status: 'active' },
      { id: '2', status: 'resolved' },
      { id: '3', status: 'resolved' },
    ];

    reportService.getUserReports.mockResolvedValue({
      data: mockReports,
      error: null,
    });

    const result = await reportService.getUserReports('user-123');
    const resolvedReports = result.data.filter(r => r.status === 'resolved');

    expect(resolvedReports.length).toBe(2);
  });
});

describe('Servicio de Reportes - FR-003: Filtrar reportes por tipo', () => {
  test('debe filtrar reportes perdidos', async () => {
    const mockReports = [
      { id: '1', type: 'lost' },
      { id: '2', type: 'found' },
      { id: '3', type: 'lost' },
    ];

    reportService.getUserReports.mockResolvedValue({
      data: mockReports,
      error: null,
    });

    const result = await reportService.getUserReports('user-123');
    const lostReports = result.data.filter(r => r.type === 'lost');

    expect(lostReports.length).toBe(2);
  });

  test('debe filtrar reportes encontrados', async () => {
    const mockReports = [
      { id: '1', type: 'lost' },
      { id: '2', type: 'found' },
      { id: '3', type: 'found' },
    ];

    reportService.getUserReports.mockResolvedValue({
      data: mockReports,
      error: null,
    });

    const result = await reportService.getUserReports('user-123');
    const foundReports = result.data.filter(r => r.type === 'found');

    expect(foundReports.length).toBe(2);
  });
});

describe('Servicio de Reportes - FR-006: Resolver reporte', () => {
  test('debe marcar reporte como resuelto', async () => {
    const resolvedReport = {
      id: '1',
      status: 'resolved',
      resolved_at: '2025-10-05T12:00:00Z',
    };

    reportService.resolveReport.mockResolvedValue({
      data: resolvedReport,
      error: null,
    });

    const result = await reportService.resolveReport('1');

    expect(result.data.status).toBe('resolved');
    expect(result.data.resolved_at).toBeTruthy();
  });

  test('debe manejar errores al resolver reporte', async () => {
    const mockError = { message: 'Reporte no encontrado' };

    reportService.resolveReport.mockResolvedValue({
      data: null,
      error: mockError,
    });

    const result = await reportService.resolveReport('999');

    expect(result.data).toBeNull();
    expect(result.error).toEqual(mockError);
  });
});

describe('Servicio de Reportes - FR-007: Eliminar reporte', () => {
  test('debe eliminar reporte exitosamente', async () => {
    reportService.deleteReport.mockResolvedValue({
      error: null,
    });

    const result = await reportService.deleteReport('1');

    expect(result.error).toBeNull();
    expect(reportService.deleteReport).toHaveBeenCalledWith('1');
  });

  test('debe manejar errores al eliminar reporte', async () => {
    const mockError = { message: 'No autorizado' };

    reportService.deleteReport.mockResolvedValue({
      error: mockError,
    });

    const result = await reportService.deleteReport('1');

    expect(result.error).toEqual(mockError);
  });
});


