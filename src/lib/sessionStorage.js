/**
 * Utilidad de Almacenamiento de Sesión
 * =====================================
 * 
 * Este módulo proporciona funciones para guardar y recuperar datos de sesión
 * del usuario de forma segura.
 * 
 * Usa dos tipos de almacenamiento:
 * - SecureStore: Para datos sensibles (tokens de autenticación)
 *   - Encriptado y seguro
 *   - Solo accesible por la app
 * - AsyncStorage: Para datos no sensibles (perfil de usuario)
 *   - Más rápido y con más capacidad
 *   - No encriptado (pero solo accesible por la app)
 * 
 * Funcionalidades:
 * - Guardar y recuperar tokens de autenticación
 * - Guardar y recuperar perfil de usuario
 * - Limpiar datos de sesión
 */

// src/lib/sessionStorage.js
import AsyncStorage from "@react-native-async-storage/async-storage";  // Almacenamiento asíncrono (no sensible)
import * as SecureStore from "expo-secure-store";  // Almacenamiento seguro (encriptado)

// =========================
// Claves de Almacenamiento
// =========================
const TOKEN_KEY = "auth_token";  // Clave para token de acceso
const REFRESH_KEY = "refresh_token";  // Clave para token de refresh
const PROFILE_KEY = "user_profile";  // Clave para perfil de usuario (no sensible, grande → AsyncStorage)

/**
 * Guarda los tokens de autenticación en SecureStore
 * 
 * @param {object} tokens - Tokens a guardar
 * @param {string} tokens.access_token - Token de acceso
 * @param {string} tokens.refresh_token - Token de refresh
 * 
 * Los tokens se guardan en SecureStore porque son datos sensibles
 * que deben estar encriptados.
 */
export async function saveTokens({ access_token, refresh_token }) {
  // Guardar token de acceso si existe
  if (access_token) await SecureStore.setItemAsync(TOKEN_KEY, access_token);
  // Guardar token de refresh si existe
  if (refresh_token) await SecureStore.setItemAsync(REFRESH_KEY, refresh_token);
}

/**
 * Obtiene los tokens de autenticación desde SecureStore
 * 
 * @returns {Promise<{access_token: string|null, refresh_token: string|null}>}
 * 
 * Retorna los tokens guardados o null si no existen.
 */
export async function getTokens() {
  const access_token = await SecureStore.getItemAsync(TOKEN_KEY);
  const refresh_token = await SecureStore.getItemAsync(REFRESH_KEY);
  return { access_token, refresh_token };
}

/**
 * Elimina los tokens de autenticación de SecureStore
 * 
 * Útil para cerrar sesión o limpiar datos de autenticación.
 */
export async function clearTokens() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

/**
 * Guarda el perfil de usuario en AsyncStorage
 * 
 * @param {object} profile - Perfil de usuario a guardar
 * 
 * El perfil se guarda en AsyncStorage porque:
 * - No es sensible (no contiene contraseñas ni tokens)
 * - Puede ser grande (muchos datos)
 * - AsyncStorage es más rápido para datos grandes
 */
export async function saveUserProfile(profile) {
  // Guardar perfil como JSON string
  // profile ?? {} asegura que siempre guardemos un objeto (aunque sea vacío)
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile ?? {}));
}

/**
 * Obtiene el perfil de usuario desde AsyncStorage
 * 
 * @returns {Promise<object|null>} Perfil de usuario o null si no existe
 */
export async function getUserProfile() {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  // Parsear JSON si existe, retornar null si no
  return raw ? JSON.parse(raw) : null;
}

/**
 * Elimina el perfil de usuario de AsyncStorage
 * 
 * Útil para limpiar datos de usuario al cerrar sesión.
 */
export async function clearUserProfile() {
  await AsyncStorage.removeItem(PROFILE_KEY);
}

