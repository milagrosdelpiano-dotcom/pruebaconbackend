/**
 * Pantalla de Login (Inicio de Sesión)
 * =====================================
 * 
 * Esta pantalla permite a los usuarios iniciar sesión en la aplicación.
 * 
 * Funcionalidades:
 * - Validación de email y contraseña
 * - Manejo de errores (credenciales incorrectas, email no verificado, etc.)
 * - Navegación a registro y recuperación de contraseña
 * - Redirección automática después de login exitoso
 * 
 * Flujo:
 * 1. Usuario ingresa email y contraseña
 * 2. Se validan los campos
 * 3. Se llama a login() del authStore
 * 4. Si es exitoso, el _layout.jsx detecta el cambio y navega automáticamente
 * 5. Si hay error, se muestra un mensaje apropiado
 */

// =========================
// Imports de Expo Router
// =========================
import { useRouter } from 'expo-router';

// =========================
// Imports de React
// =========================
import React, { useState } from 'react';

// =========================
// Imports de React Native
// =========================
import {
  Alert, // Para mostrar alertas al usuario
  KeyboardAvoidingView, // Para ajustar la vista cuando aparece el teclado
  Platform, // Para detectar la plataforma (iOS/Android)
  ScrollView, // Para hacer scrollable el contenido
  StyleSheet, // Para estilos
  View, // Componente de vista básico
} from 'react-native';

// =========================
// Imports de React Native Paper
// =========================
import {
  Button, // Botón de Material Design
  Card, // Tarjeta de Material Design
  Divider, // Divisor visual
  Paragraph, // Párrafo de texto
  Text, // Texto simple
  TextInput, // Campo de entrada de texto
  Title, // Título
} from 'react-native-paper';

// =========================
// Imports de Safe Area
// =========================
import { SafeAreaView } from 'react-native-safe-area-context';

// =========================
// Imports de Stores
// =========================
import { useAuthStore } from '../../src/stores/authStore';

/**
 * Componente principal de la pantalla de login
 */
export default function LoginScreen() {
  // =========================
  // Hooks y Stores
  // =========================
  // Router para navegación entre pantallas
  const router = useRouter();
  
  // Obtener funciones y estado del store de autenticación
  // login: función para iniciar sesión
  // loading: estado que indica si hay una operación en curso
  const { login, loading } = useAuthStore();
  
  // =========================
  // Estado Local
  // =========================
  // Email del usuario (controlado por el TextInput)
  const [email, setEmail] = useState('');
  
  // Contraseña del usuario (controlada por el TextInput)
  const [password, setPassword] = useState('');
  
  // Controla si se muestra u oculta la contraseña (para el ícono de ojo)
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Maneja el proceso de inicio de sesión
   * 
   * Esta función:
   * 1. Valida que los campos no estén vacíos
   * 2. Valida que el email tenga formato válido
   * 3. Llama a la función login() del store
   * 4. Maneja diferentes tipos de errores con mensajes apropiados
   * 5. Si es exitoso, el _layout.jsx detecta el cambio y navega automáticamente
   */
  const handleLogin = async () => {
    // =========================
    // Validación de campos
    // =========================
    // Verificar que email y contraseña no estén vacíos
    // .trim() elimina espacios al inicio y final
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;  // Salir de la función si falta algún campo
    }

    // Validación básica de formato de email
    // Verificar que contenga el símbolo @ (validación mínima)
    // Una validación más completa usaría regex, pero esto es suficiente para UX
    if (!email.includes('@')) {
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;  // Salir si el email no tiene formato válido
    }

    // =========================
    // Proceso de login
    // =========================
    try {
      // Log para debugging
      console.log('🔐 Intentando iniciar sesión con:', email.trim());
      
      // Llamar a la función login del store de autenticación
      // login() retorna { success: boolean, data?: {...}, error?: Error }
      // email.trim() elimina espacios al inicio y final
      const result = await login(email.trim(), password);

      // Log del resultado para debugging
      console.log('📊 Resultado del login:', { success: result.success, error: result.error?.message });

      // =========================
      // Manejo de errores
      // =========================
      if (!result.success) {
        console.error('❌ Error en login:', result.error);
        
        // Mensaje de error por defecto
        let errorMessage = 'No se pudo iniciar sesión. Verifica tus credenciales.';
        
        // Manejar diferentes tipos de errores con mensajes específicos
        // Esto mejora la experiencia del usuario al dar mensajes más claros
        if (result.error?.message?.includes('Invalid login credentials')) {
          // Credenciales incorrectas (email o contraseña erróneos)
          errorMessage = 'Email o contraseña incorrectos. Verifica tus credenciales.';
        } else if (result.error?.message?.includes('Email not confirmed')) {
          // Email no verificado (usuario se registró pero no confirmó el email)
          errorMessage = 'Por favor verifica tu email antes de iniciar sesión.';
        } else if (result.error?.message?.includes('Too many requests')) {
          // Demasiados intentos (rate limiting de Supabase)
          errorMessage = 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
        } else if (result.error?.message) {
          // Cualquier otro error, usar el mensaje del error
          errorMessage = result.error.message;
        }
        
        // Mostrar alerta al usuario con el mensaje apropiado
        Alert.alert('Error de inicio de sesión', errorMessage);
      } else {
        // =========================
        // Login exitoso
        // =========================
        console.log('✅ Login exitoso para usuario:', result.data?.user?.email);
        
        // El authStore ya actualiza el estado (user, session) automáticamente
        // El _layout.jsx detecta el cambio en el estado de autenticación
        // y navega automáticamente a la pantalla principal
        // No necesitamos hacer navegación manual aquí
      }
    } catch (error) {
      // Capturar cualquier error inesperado (excepciones no manejadas)
      console.error('💥 Error inesperado en login:', error);
      Alert.alert('Error', 'Ocurrió un error inesperado. Inténtalo de nuevo.');
    }
  };

  /**
   * Navega a la pantalla de registro
   * 
   * Esta función se llama cuando el usuario hace clic en "Registrarse"
   * o en el enlace de registro
   */
  const goToRegister = () => {
    // Navegar a la pantalla de registro usando Expo Router
    router.push('/(auth)/register');
  };

  /**
   * Navega a la pantalla de recuperación de contraseña
   * 
   * Esta función se llama cuando el usuario hace clic en "¿Olvidaste tu contraseña?"
   */
  const goToForgotPassword = () => {
    // Navegar a la pantalla de recuperación de contraseña usando Expo Router
    router.push('/(auth)/forgot-password');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Title style={styles.title}>🐾 PetAlert</Title>
            <Paragraph style={styles.subtitle}>
              Inicia sesión para ayudar a encontrar mascotas perdidas
            </Paragraph>
          </View>

          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Title style={styles.cardTitle}>Iniciar Sesión</Title>

              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                left={<TextInput.Icon icon="email" />}
              />

              <TextInput
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
              />

              <Button
                mode="text"
                onPress={goToForgotPassword}
                style={styles.forgotButton}
                labelStyle={styles.forgotButtonText}
              >
                ¿Olvidaste tu contraseña?
              </Button>

              <Button
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={styles.loginButton}
                contentStyle={styles.loginButtonContent}
              >
                Iniciar Sesión
              </Button>

              <Divider style={styles.divider} />

              <View style={styles.registerContainer}>
                <Text style={styles.registerText}>
                  ¿No tienes una cuenta?
                </Text>
                <Button
                  mode="text"
                  onPress={goToRegister}
                  style={styles.registerButton}
                  labelStyle={styles.registerButtonText}
                >
                  Regístrate aquí
                </Button>
              </View>
            </Card.Content>
          </Card>

          <View style={styles.footer}>
            <Paragraph style={styles.footerText}>
              Al continuar, aceptas nuestros términos de servicio y política de privacidad
            </Paragraph>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    padding: 24,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  loginButton: {
    marginBottom: 20,
    borderRadius: 8,
  },
  loginButtonContent: {
    paddingVertical: 8,
  },
  divider: {
    marginVertical: 20,
  },
  registerContainer: {
    alignItems: 'center',
  },
  registerText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  registerButton: {
    marginTop: -8,
  },
  registerButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
});