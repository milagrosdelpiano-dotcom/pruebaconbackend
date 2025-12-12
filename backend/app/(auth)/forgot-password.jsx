/**
 * Pantalla de Recuperación de Contraseña
 * =======================================
 * 
 * Esta pantalla permite a los usuarios solicitar un enlace de recuperación
 * de contraseña por email.
 * 
 * Funcionalidades:
 * - Ingresar email para recuperar contraseña
 * - Validación de formato de email
 * - Envío de email de recuperación
 * - Manejo de errores (rate limiting, email no encontrado, etc.)
 * - Navegación de vuelta a login
 * 
 * Flujo:
 * 1. Usuario ingresa su email
 * 2. Se valida el formato del email
 * 3. Se envía un email de recuperación con Supabase
 * 4. El usuario recibe un email con un enlace para resetear su contraseña
 * 5. Al hacer clic en el enlace, se abre la app y puede cambiar su contraseña
 */

import { useRouter } from 'expo-router';  // Hook de navegación
import React, { useState } from 'react';  // Hooks de React
import {
    Alert,  // Para mostrar alertas
    KeyboardAvoidingView,  // Para ajustar cuando aparece el teclado
    Platform,  // Para detectar la plataforma
    ScrollView,  // Para hacer scrollable el contenido
    StyleSheet,  // Para estilos
    View,  // Componente de vista básico
} from 'react-native';
import {
    Button,  // Botón de Material Design
    Card,  // Tarjeta de Material Design
    Divider,  // Divisor visual
    Paragraph,  // Párrafo de texto
    Text,  // Texto simple
    TextInput,  // Campo de entrada de texto
    Title,  // Título
} from 'react-native-paper';  // Componentes de Material Design
import { SafeAreaView } from 'react-native-safe-area-context';  // View que respeta áreas seguras
import { useAuthStore } from '../../src/stores/authStore';  // Store de autenticación

/**
 * Componente principal de la pantalla de recuperación de contraseña
 */
export default function ForgotPasswordScreen() {
  // =========================
  // Hooks y Navegación
  // =========================
  // Router para navegación
  const router = useRouter();
  
  // Obtener funciones del store de autenticación
  const { 
    resetPassword,  // Función para enviar email de recuperación
    loading  // Estado de carga
  } = useAuthStore();
  
  // =========================
  // Estado Local
  // =========================
  // Email del usuario
  const [email, setEmail] = useState('');
  
  // Flag que indica si el email fue enviado exitosamente
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu email');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;
    }

    try {
      console.log('📧 Enviando email de recuperación a:', email.trim());
      
      const result = await resetPassword(email.trim());

      if (!result.success) {
        console.error('❌ Error en reset password:', result.error);
        
        let errorMessage = 'No se pudo enviar el email de recuperación. Inténtalo de nuevo.';
        
        if (result.error?.message?.includes('rate limit')) {
          errorMessage = 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
        } else if (result.error?.message) {
          errorMessage = result.error.message;
        }
        
        Alert.alert('Error', errorMessage);
      } else {
        console.log('✅ Email de recuperación enviado exitosamente');
        setEmailSent(true);
        Alert.alert(
          'Email enviado',
          'Hemos enviado un enlace de recuperación a tu email. Por favor revisa tu bandeja de entrada.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('💥 Error inesperado en reset password:', error);
      Alert.alert('Error', 'Ocurrió un error inesperado. Inténtalo de nuevo.');
    }
  };

  const goToLogin = () => {
    router.replace('/(auth)/login');
  };

  if (emailSent) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>📧</Text>
              </View>
              <Title style={styles.title}>Email Enviado</Title>
              <Paragraph style={styles.message}>
                Hemos enviado un enlace de recuperación a tu email. Por favor revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.
              </Paragraph>
              <Button
                mode="contained"
                onPress={goToLogin}
                style={styles.button}
                contentStyle={styles.buttonContent}
              >
                Volver al Login
              </Button>
            </Card.Content>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

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
            <Title style={styles.headerTitle}>🐾 PetAlert</Title>
            <Paragraph style={styles.subtitle}>
              Recuperar contraseña
            </Paragraph>
          </View>

          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Title style={styles.cardTitle}>¿Olvidaste tu contraseña?</Title>
              <Paragraph style={styles.description}>
                Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
              </Paragraph>

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
                editable={!loading}
              />

              <Button
                mode="contained"
                onPress={handleResetPassword}
                loading={loading}
                disabled={loading || !email.trim()}
                style={styles.button}
                contentStyle={styles.buttonContent}
              >
                Enviar Email de Recuperación
              </Button>

              <Divider style={styles.divider} />

              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>
                  ¿Recordaste tu contraseña?
                </Text>
                <Button
                  mode="text"
                  onPress={goToLogin}
                  style={styles.loginButton}
                  labelStyle={styles.loginButtonText}
                >
                  Volver al Login
                </Button>
              </View>
            </Card.Content>
          </Card>

          <View style={styles.footer}>
            <Paragraph style={styles.footerText}>
              Si no recibes el email, verifica tu carpeta de spam o intenta de nuevo en unos minutos.
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
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  headerTitle: {
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
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 64,
  },
  input: {
    marginBottom: 20,
  },
  button: {
    marginBottom: 20,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  divider: {
    marginVertical: 20,
  },
  loginContainer: {
    alignItems: 'center',
  },
  loginText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  loginButton: {
    marginTop: -8,
  },
  loginButtonText: {
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
});

