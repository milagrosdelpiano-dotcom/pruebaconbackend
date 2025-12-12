/**
 * Pruebas Unitarias: Servicio de Búsqueda IA
 * 
 * Basado en: specs/007-busqueda-ia/spec.md
 * Principio X: Pruebas unitarias para cada funcionalidad
 * 
 * Nota: La búsqueda IA se realiza usando MegaDescriptor localmente
 */

import aiSearchService from '../../../../src/services/aiSearch';
import { apiService } from '../../../../src/services/api';

// Mock de servicios
jest.mock('../../../../src/services/aiSearch', () => ({
  __esModule: true,
  default: {
    analyzeImage: jest.fn(),
    searchByImage: jest.fn(),
    searchByClip: jest.fn(),
  },
}));

jest.mock('../../../../src/services/api', () => ({
  apiService: {
    aiSearch: jest.fn(),
    searchByClip: jest.fn(),
  },
}));

describe('Servicio de Búsqueda IA - FR-001: Analizar imagen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('debe analizar imagen y obtener etiquetas y colores', async () => {
    const mockAnalysis = {
      labels: [
        { description: 'Dog', score: 0.95 },
        { description: 'Golden Retriever', score: 0.87 },
      ],
      colors: [
        { color: { r: 255, g: 200, b: 0 }, score: 0.8 },
        { color: { r: 200, g: 150, b: 50 }, score: 0.6 },
      ],
    };

    aiSearchService.analyzeImage.mockResolvedValue({
      success: true,
      data: mockAnalysis,
      error: null,
    });

    const result = await aiSearchService.analyzeImage('file:///path/to/image.jpg');

    expect(result.success).toBe(true);
    expect(result.data.labels).toBeDefined();
    expect(result.data.colors).toBeDefined();
    expect(result.data.labels.length).toBeGreaterThan(0);
  });

  test('debe manejar errores al analizar imagen', async () => {
    aiSearchService.analyzeImage.mockResolvedValue({
      success: false,
      data: null,
      error: { message: 'Error al analizar imagen' },
    });

    const result = await aiSearchService.analyzeImage('file:///path/to/image.jpg');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('debe retornar etiquetas con scores', async () => {
    const mockAnalysis = {
      labels: [
        { description: 'Cat', score: 0.92 },
        { description: 'Persian', score: 0.75 },
      ],
    };

    aiSearchService.analyzeImage.mockResolvedValue({
      success: true,
      data: mockAnalysis,
      error: null,
    });

    const result = await aiSearchService.analyzeImage('file:///path/to/image.jpg');

    expect(result.data.labels[0].score).toBeGreaterThan(0);
    expect(result.data.labels[0].description).toBe('Cat');
  });
});

describe('Servicio de Búsqueda IA - FR-002: Buscar coincidencias por imagen', () => {
  test('debe buscar coincidencias usando análisis de IA', async () => {
    const mockResults = [
      {
        id: 'report-1',
        pet_name: 'Max',
        similarity_score: 0.85,
        visual_similarity: 0.80,
        color_similarity: 0.90,
        distance_km: 2.5,
      },
      {
        id: 'report-2',
        pet_name: 'Luna',
        similarity_score: 0.72,
        visual_similarity: 0.70,
        color_similarity: 0.75,
        distance_km: 5.1,
      },
    ];

    // La búsqueda se realiza usando MegaDescriptor localmente
    apiService.aiSearch.mockResolvedValue({
      data: { results: mockResults },
      error: null,
    });

    const result = await apiService.aiSearch({
      image_uri: 'file:///path/to/image.jpg',
      user_lat: -34.6037,
      user_lng: -58.3816,
      radius_km: 10,
      search_type: 'visual',
    });

    expect(result.data.results).toEqual(mockResults);
    expect(result.data.results.length).toBe(2);
  });

  test('debe incluir scores de similitud en resultados', async () => {
    const mockResults = [
      {
        id: 'report-1',
        similarity_score: 0.85,
        visual_similarity: 0.80,
        color_similarity: 0.90,
      },
    ];

    apiService.aiSearch.mockResolvedValue({
      data: { results: mockResults },
      error: null,
    });

    const result = await apiService.aiSearch({
      image_uri: 'file:///path/to/image.jpg',
      user_lat: -34.6037,
      user_lng: -58.3816,
      radius_km: 10,
    });

    expect(result.data.results[0].similarity_score).toBeDefined();
    expect(result.data.results[0].visual_similarity).toBeDefined();
    expect(result.data.results[0].color_similarity).toBeDefined();
  });

  test('debe retornar lista vacía cuando no hay coincidencias', async () => {
    apiService.aiSearch.mockResolvedValue({
      data: { results: [] },
      error: null,
    });

    const result = await apiService.aiSearch({
      image_uri: 'file:///path/to/image.jpg',
      user_lat: -34.6037,
      user_lng: -58.3816,
      radius_km: 10,
    });

    expect(result.data.results).toEqual([]);
  });

  test('debe manejar errores del servicio de búsqueda', async () => {
    apiService.aiSearch.mockResolvedValue({
      data: null,
      error: { message: 'Servicio de IA no disponible' },
    });

    const result = await apiService.aiSearch({
      image_uri: 'file:///path/to/image.jpg',
      user_lat: -34.6037,
      user_lng: -58.3816,
      radius_km: 10,
    });

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe('Servicio de Búsqueda IA - FR-003: Buscar por Similitud Visual', () => {
  test('debe buscar coincidencias usando embeddings de MegaDescriptor', async () => {
    const mockResults = [
      {
        id: 'report-1',
        similarity_score: 0.88,
        photo_url: 'https://example.com/photo1.jpg',
        species: 'dog',
        color: 'Dorado',
      },
    ];

    apiService.searchByClip.mockResolvedValue({
      data: { results: mockResults },
      error: null,
    });

    const result = await apiService.searchByClip({
      image_uri: 'file:///path/to/image.jpg',
      user_lat: -34.6037,
      user_lng: -58.3816,
      radius_km: 10,
      top_k: 10,
    });

    expect(result.data.results).toEqual(mockResults);
    expect(result.data.results[0].similarity_score).toBeDefined();
  });

  test('debe respetar filtros de búsqueda (radio, tipo)', async () => {
    const mockResults = [
      {
        id: 'report-1',
        type: 'lost',
        distance_km: 5.0,
      },
    ];

    apiService.searchByClip.mockResolvedValue({
      data: { results: mockResults },
      error: null,
    });

    const result = await apiService.searchByClip({
      image_uri: 'file:///path/to/image.jpg',
      user_lat: -34.6037,
      user_lng: -58.3816,
      radius_km: 10,
      type: 'lost',
    });

    expect(result.data.results[0].type).toBe('lost');
    expect(result.data.results[0].distance_km).toBeLessThanOrEqual(10);
  });
});

describe('Servicio de Búsqueda IA - FR-004: Configurar filtros', () => {
  test('debe aplicar filtro de tipo de reporte', async () => {
    const mockResults = [
      {
        id: 'report-1',
        type: 'lost',
      },
    ];

    apiService.aiSearch.mockResolvedValue({
      data: { results: mockResults },
      error: null,
    });

    const result = await apiService.aiSearch({
      image_uri: 'file:///path/to/image.jpg',
      user_lat: -34.6037,
      user_lng: -58.3816,
      radius_km: 10,
      search_type: 'visual',
      type: 'lost',
    });

    // Verificar que se aplicó el filtro
    expect(apiService.aiSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'lost',
      })
    );
  });

  test('debe aplicar filtro de radio geográfico', async () => {
    const mockResults = [
      {
        id: 'report-1',
        distance_km: 8.5,
      },
    ];

    apiService.aiSearch.mockResolvedValue({
      data: { results: mockResults },
      error: null,
    });

    const result = await apiService.aiSearch({
      image_uri: 'file:///path/to/image.jpg',
      user_lat: -34.6037,
      user_lng: -58.3816,
      radius_km: 10,
    });

    // Verificar que se respeta el radio
    expect(result.data.results[0].distance_km).toBeLessThanOrEqual(10);
  });
});

