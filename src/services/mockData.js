/**
 * Sistema de Datos Mock
 * ======================
 * 
 * Este módulo proporciona datos y servicios mock para desarrollo y pruebas
 * cuando Supabase no está configurado o no está disponible.
 * 
 * Funcionalidades:
 * - Datos de ejemplo (usuarios, reportes, mascotas)
 * - Servicios mock que simulan el comportamiento de Supabase
 * - Funciones de utilidad (simular delay de red, calcular distancias)
 * 
 * Uso:
 * Este módulo se usa principalmente durante el desarrollo inicial o cuando
 * se necesita probar la aplicación sin conexión a Supabase.
 * 
 * NOTA: En producción, estos datos mock NO deben usarse. La aplicación
 * debe usar siempre los servicios reales de Supabase.
 */

// =========================
// Datos Mock
// =========================
// Datos de ejemplo para desarrollo y pruebas
export const mockData = {
  // Usuarios mock
  users: [
    {
      id: 'mock-user-1',
      email: 'demo@petalert.com',
      full_name: 'Usuario Demo',
      avatar_url: null,
      created_at: new Date().toISOString(),
    }
  ],

  // Reportes mock
  reports: [
    {
      id: 'mock-report-1',
      type: 'lost',
      pet_name: 'Max',
      species: 'Perro',
      breed: 'Golden Retriever',
      color: 'Dorado',
      size: 'Grande',
      description: 'Perro perdido en el parque central. Muy amigable y lleva collar azul.',
      photos: [],
      latitude: -27.475366800493575,
      longitude: -58.85188466782436,
      address: 'Parque Central, Corrientes',
      status: 'active',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 días atrás
      reporter_id: 'mock-user-1',
      pet_id: null,
      hasValidCoords: true,
      distance_meters: 0
    },
    {
      id: 'mock-report-2',
      type: 'found',
      pet_name: 'Luna',
      species: 'Gato',
      breed: 'Siamés',
      color: 'Blanco y negro',
      size: 'Mediano',
      description: 'Gato encontrado cerca del mercado. Parece perdido y busca comida.',
      photos: [],
      latitude: -27.480000000000000,
      longitude: -58.850000000000000,
      address: 'Cerca del Mercado Central',
      status: 'active',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 día atrás
      reporter_id: 'mock-user-1',
      pet_id: null,
      hasValidCoords: true,
      distance_meters: 500
    },
    {
      id: 'mock-report-3',
      type: 'lost',
      pet_name: 'Bella',
      species: 'Perro',
      breed: 'Mestizo',
      color: 'Marrón',
      size: 'Pequeño',
      description: 'Perrita pequeña perdida en el barrio norte. Muy tímida pero cariñosa.',
      photos: [],
      latitude: -27.470000000000000,
      longitude: -58.860000000000000,
      address: 'Barrio Norte, Corrientes',
      status: 'active',
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 horas atrás
      reporter_id: 'mock-user-1',
      pet_id: null,
      hasValidCoords: true,
      distance_meters: 1200
    }
  ],

  // Mascotas mock
  pets: [
    {
      id: 'mock-pet-1',
      owner_id: 'mock-user-1',
      name: 'Max',
      species: 'Perro',
      breed: 'Golden Retriever',
      color: 'Dorado',
      age: 3,
      size: 'Grande',
      description: 'Mi perro Max, muy juguetón y amigable',
      photos: [],
      is_lost: true,
      created_at: new Date().toISOString(),
    }
  ]
};

// =========================
// Funciones de Utilidad
// =========================

/**
 * Simula un delay de red para hacer las respuestas mock más realistas
 * 
 * @param {number} ms - Milisegundos de delay (default: 1000ms)
 * @returns {Promise<void>} Promise que se resuelve después del delay
 * 
 * Esta función es útil para simular la latencia de red en desarrollo.
 */
export const simulateNetworkDelay = (ms = 1000) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Calcula la distancia entre dos puntos geográficos usando la fórmula de Haversine
 * 
 * @param {number} lat1 - Latitud del primer punto (en grados)
 * @param {number} lon1 - Longitud del primer punto (en grados)
 * @param {number} lat2 - Latitud del segundo punto (en grados)
 * @param {number} lon2 - Longitud del segundo punto (en grados)
 * @returns {number} Distancia en metros entre los dos puntos
 * 
 * La fórmula de Haversine calcula la distancia del círculo máximo (great circle distance)
 * entre dos puntos en una esfera, considerando que la Tierra es una esfera perfecta.
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// =========================
// Servicios Mock
// =========================
/**
 * Servicios mock que simulan el comportamiento de Supabase
 * 
 * Estos servicios proporcionan la misma interfaz que los servicios reales
 * de Supabase, pero usando datos mock en memoria.
 * 
 * Incluye:
 * - auth: Autenticación mock (signIn, signUp, signOut, etc.)
 * - reports: Gestión de reportes mock (getAllReports, getNearbyReports, etc.)
 * - pets: Gestión de mascotas mock (getUserPets, createPet, etc.)
 * 
 * NOTA: Estos servicios solo deben usarse en desarrollo o cuando Supabase
 * no está disponible. En producción, usar siempre los servicios reales.
 */
export const mockServices = {
  // Mock de autenticación
  auth: {
    signIn: async (email, password) => {
      await simulateNetworkDelay(500);
      
      if (email === 'demo@petalert.com' && password === 'demo123') {
        return {
          data: {
            user: mockData.users[0],
            session: {
              access_token: 'mock-token',
              user: mockData.users[0]
            }
          },
          error: null
        };
      }
      
      return {
        data: null,
        error: { message: 'Credenciales incorrectas' }
      };
    },

    signUp: async (email, password, fullName) => {
      await simulateNetworkDelay(500);
      
      const newUser = {
        id: `mock-user-${Date.now()}`,
        email,
        full_name: fullName,
        avatar_url: null,
        created_at: new Date().toISOString(),
      };
      
      mockData.users.push(newUser);
      
      return {
        data: { user: newUser },
        error: null
      };
    },

    signOut: async () => {
      await simulateNetworkDelay(200);
      return { error: null };
    },

    getCurrentUser: async () => {
      await simulateNetworkDelay(200);
      return {
        user: mockData.users[0],
        error: null
      };
    },

    getSession: async () => {
      await simulateNetworkDelay(200);
      return {
        session: {
          access_token: 'mock-token',
          user: mockData.users[0]
        },
        error: null
      };
    },

    onAuthStateChange: (callback) => {
      // Mock de suscripción a cambios de auth
      return {
        data: { subscription: { unsubscribe: () => {} } }
      };
    }
  },

  // Mock de reportes
  reports: {
    getAllReports: async () => {
      await simulateNetworkDelay(800);
      return {
        data: mockData.reports,
        error: null
      };
    },

    getNearbyReports: async (latitude, longitude, radiusMeters = 5000) => {
      await simulateNetworkDelay(600);
      
      const nearbyReports = mockData.reports
        .map(report => {
          const distance = calculateDistance(
            latitude, 
            longitude, 
            report.latitude, 
            report.longitude
          );
          
          return {
            ...report,
            distance_meters: distance
          };
        })
        .filter(report => report.distance_meters <= radiusMeters)
        .sort((a, b) => a.distance_meters - b.distance_meters);
      
      return {
        data: nearbyReports,
        error: null
      };
    },

    createReport: async (reportData) => {
      await simulateNetworkDelay(1000);
      
      const newReport = {
        id: `mock-report-${Date.now()}`,
        ...reportData,
        status: 'active',
        created_at: new Date().toISOString(),
        reporter_id: 'mock-user-1',
        hasValidCoords: true
      };
      
      mockData.reports.unshift(newReport);
      
      return {
        data: newReport,
        error: null
      };
    },

    getReportById: async (reportId) => {
      await simulateNetworkDelay(300);
      
      const report = mockData.reports.find(r => r.id === reportId);
      
      if (!report) {
        return {
          data: null,
          error: { message: 'Reporte no encontrado' }
        };
      }
      
      return {
        data: report,
        error: null
      };
    }
  },

  // Mock de mascotas
  pets: {
    getUserPets: async (userId) => {
      await simulateNetworkDelay(400);
      
      const userPets = mockData.pets.filter(pet => pet.owner_id === userId);
      
      return {
        data: userPets,
        error: null
      };
    },

    createPet: async (petData) => {
      await simulateNetworkDelay(600);
      
      const newPet = {
        id: `mock-pet-${Date.now()}`,
        ...petData,
        created_at: new Date().toISOString(),
      };
      
      mockData.pets.push(newPet);
      
      return {
        data: newPet,
        error: null
      };
    }
  }
};
