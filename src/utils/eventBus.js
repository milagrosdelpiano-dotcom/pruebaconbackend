/**
 * Event Bus (Bus de Eventos)
 * ===========================
 * 
 * Este módulo implementa un patrón de publicación/suscripción (pub/sub)
 * para comunicación entre componentes que no están directamente relacionados.
 * 
 * Funcionalidades:
 * - Suscribirse a eventos (on)
 * - Desuscribirse de eventos (off)
 * - Emitir eventos (emit)
 * 
 * Útil para:
 * - Comunicación entre componentes distantes
 * - Notificar cambios de estado global
 * - Sincronizar datos entre diferentes partes de la app
 * 
 * Ejemplo de uso:
 * ```javascript
 * // Suscribirse a un evento
 * const unsubscribe = eventBus.on('conversation:read', (conversationId) => {
 *   console.log('Conversación leída:', conversationId);
 * });
 * 
 * // Emitir un evento
 * eventBus.emit('conversation:read', 'conversation-123');
 * 
 * // Desuscribirse
 * unsubscribe();
 * ```
 */

// Objeto que almacena los listeners por evento
// Estructura: { 'event-name': Set<handlers> }
const listeners = {};

/**
 * Suscribe un handler a un evento
 * 
 * @param {string} event - Nombre del evento
 * @param {Function} handler - Función que se ejecutará cuando se emita el evento
 * @returns {Function} Función para desuscribirse del evento
 * 
 * Ejemplo:
 * ```javascript
 * const unsubscribe = eventBus.on('user:login', (user) => {
 *   console.log('Usuario logueado:', user);
 * });
 * ```
 */
const on = (event, handler) => {
  // Si no hay listeners para este evento, crear un nuevo Set
  if (!listeners[event]) {
    listeners[event] = new Set();
  }
  // Agregar el handler al Set de listeners
  listeners[event].add(handler);
  // Retornar función para desuscribirse
  return () => off(event, handler);
};

/**
 * Desuscribe un handler de un evento
 * 
 * @param {string} event - Nombre del evento
 * @param {Function} handler - Handler a desuscribir
 * 
 * Ejemplo:
 * ```javascript
 * eventBus.off('user:login', myHandler);
 * ```
 */
const off = (event, handler) => {
  // Si no hay listeners para este evento, no hacer nada
  if (!listeners[event]) {
    return;
  }
  // Eliminar el handler del Set
  listeners[event].delete(handler);
  // Si no quedan handlers, eliminar el evento del objeto
  if (listeners[event].size === 0) {
    delete listeners[event];
  }
};

/**
 * Emite un evento, ejecutando todos los handlers suscritos
 * 
 * @param {string} event - Nombre del evento a emitir
 * @param {any} payload - Datos a pasar a los handlers
 * 
 * Ejemplo:
 * ```javascript
 * eventBus.emit('user:login', { id: '123', name: 'Juan' });
 * ```
 */
const emit = (event, payload) => {
  // Si no hay listeners para este evento, no hacer nada
  if (!listeners[event]) {
    return;
  }
  // Ejecutar todos los handlers suscritos al evento
  listeners[event].forEach((handler) => {
    try {
      handler(payload);
    } catch (error) {
      // Si un handler falla, registrar el error pero no detener la ejecución
      console.error('[eventBus] Error ejecutando handler:', error);
    }
  });
};

// Exportar el objeto eventBus con todos los métodos
export const eventBus = { on, off, emit };


