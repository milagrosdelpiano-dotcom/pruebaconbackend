/**
 * Store de Matches (Coincidencias) usando Zustand
 * ================================================
 * 
 * Este store gestiona el estado de los matches (coincidencias) entre reportes.
 * Los matches se agrupan por report_id para facilitar el acceso.
 * 
 * Estructura del estado:
 * matchesByReport: {
 *   "report-id-1": [match1, match2, ...],
 *   "report-id-2": [match3, match4, ...],
 *   ...
 * }
 * 
 * Ejemplo de uso:
 * ```javascript
 * const { matchesByReport, setMatchesForReport } = useMatchesStore();
 * 
 * // Obtener matches de un reporte
 * const matches = matchesByReport['report-id-1'];
 * 
 * // Establecer matches para un reporte
 * setMatchesForReport('report-id-1', [match1, match2]);
 * 
 * // Limpiar matches de un reporte
 * clearMatchesForReport('report-id-1');
 * ```
 */

import { create } from 'zustand';  // Librería para gestión de estado

/**
 * Crear el store de matches
 * 
 * Este store mantiene un objeto que mapea report_id a arrays de matches.
 * Esto permite acceder rápidamente a los matches de un reporte específico.
 */
export const useMatchesStore = create((set) => ({
  // =========================
  // Estado inicial
  // =========================
  // Objeto que mapea report_id -> array de matches
  // Ejemplo: { "uuid-1": [match1, match2], "uuid-2": [match3] }
  matchesByReport: {},
  
  // =========================
  // Actions
  // =========================
  /**
   * Establece los matches para un reporte específico
   * 
   * @param {string} reportId - ID del reporte
   * @param {Array} matchesData - Array de matches para ese reporte
   * 
   * Esta función actualiza el estado agregando o reemplazando los matches
   * de un reporte específico sin afectar los matches de otros reportes.
   */
  setMatchesForReport: (reportId, matchesData) =>
    set((state) => ({
      matchesByReport: {
        ...state.matchesByReport,  // Mantener matches de otros reportes
        [reportId]: matchesData,  // Actualizar o agregar matches de este reporte
      },
    })),
  
  /**
   * Limpia los matches de un reporte específico
   * 
   * @param {string} reportId - ID del reporte cuyos matches se quieren limpiar
   * 
   * Esta función elimina los matches de un reporte específico del estado,
   * pero mantiene los matches de otros reportes.
   */
  clearMatchesForReport: (reportId) =>
    set((state) => {
      // Crear una copia del estado actual
      const updated = { ...state.matchesByReport };
      // Eliminar el reporte del objeto
      delete updated[reportId];
      // Retornar el estado actualizado
      return { matchesByReport: updated };
    }),
  
  /**
   * Limpia todos los matches de todos los reportes
   * 
   * Esta función resetea completamente el estado de matches.
   * Útil para limpiar cuando el usuario cierra sesión o refresca la app.
   */
  clearAllMatches: () => set({ matchesByReport: {} }),
}));

