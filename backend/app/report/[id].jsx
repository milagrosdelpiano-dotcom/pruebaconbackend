/**
 * Pantalla de Detalles de Reporte
 * ================================
 * 
 * Esta pantalla muestra los detalles completos de un reporte específico.
 * 
 * Funcionalidades:
 * - Ver todos los detalles del reporte (fotos, descripción, ubicación, etc.)
 * - Contactar al reportero (si está autenticado)
 * - Ver información del reportero
 * - Navegar de vuelta
 * 
 * El ID del reporte se obtiene de los parámetros de la ruta dinámica [id].
 */

// app/report/[id].jsx
import { Image } from "expo-image";  // Componente de imagen optimizado de Expo
import { useLocalSearchParams, useRouter } from "expo-router";  // Hooks de navegación
import React, { useEffect, useMemo, useState } from "react";  // Hooks de React
import { BackHandler, ScrollView, StyleSheet, View } from "react-native";  // Componentes básicos
import {
  ActivityIndicator,  // Spinner de carga
  Avatar,  // Avatar de usuario
  Button,  // Botón de Material Design
  Chip,  // Chip para mostrar etiquetas
  Divider,  // Divisor visual
  HelperText,  // Texto de ayuda
  IconButton,  // Botón con ícono
  Text,  // Texto simple
} from "react-native-paper";  // Componentes de Material Design
import { SafeAreaView } from "react-native-safe-area-context";  // View que respeta áreas seguras
import { messageService, reportService } from "../../src/services/supabase";  // Servicios
import { useAuthStore } from "../../src/stores/authStore";  // Store de autenticación

/**
 * Obtiene el emoji correspondiente a una especie
 * 
 * @param {string} species - Especie de la mascota (dog, cat, bird, rabbit, other)
 * @returns {string} Emoji correspondiente
 */
const getSpeciesEmoji = (species) => {
  switch (species) {
    case "dog":
      return "🐕";
    case "cat":
      return "🐈";
    case "bird":
      return "🐦";
    case "rabbit":
      return "🐰";
    default:
      return "🐾";  // Emoji genérico para otras especies
  }
};

/**
 * Formatea una fecha a formato legible en español
 * 
 * @param {string} dateString - Fecha en formato ISO string
 * @returns {string} Fecha formateada (ej: "15 ene, 14:30")
 */
const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString("es-ES", {
      month: "short",  // Mes abreviado (ene, feb, etc.)
      day: "numeric",  // Día numérico
      hour: "2-digit",  // Hora en 2 dígitos
      minute: "2-digit",  // Minutos en 2 dígitos
    });
  } catch {
    return "-";  // Retornar "-" si hay error al parsear
  }
};

/**
 * Componente principal de la pantalla de detalles de reporte
 */
export default function ReportDetailScreen() {
  // =========================
  // Hooks y Navegación
  // =========================
  // Parámetros de la ruta (incluye el ID del reporte)
  const params = useLocalSearchParams();
  
  // ID del reporte desde los parámetros de la ruta
  const id = params?.id ? String(params.id) : null;
  
  // Router para navegación
  const router = useRouter();
  
  // =========================
  // Estado Local
  // =========================
  // Datos del reporte cargado
  const [report, setReport] = useState(null);
  
  // Estado de carga (cuando se está cargando el reporte)
  const [loading, setLoading] = useState(true);
  
  // Error al cargar el reporte (si hay)
  const [error, setError] = useState(null);
  
  // Estado de carga al contactar al reportero
  const [contactLoading, setContactLoading] = useState(false);
  
  // Error al contactar al reportero (si hay)
  const [contactError, setContactError] = useState(null);
  
  // =========================
  // Store de Autenticación
  // =========================
  // Obtener funciones del store
  const getUserId = useAuthStore((state) => state.getUserId);
  const isAuthenticatedFn = useAuthStore((state) => state.isAuthenticated);
  
  // Obtener ID del usuario actual y estado de autenticación
  const userId = getUserId();
  const isAuthenticated = isAuthenticatedFn();

  useEffect(() => {
    const loadReport = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await reportService.getReportById(String(id));
        if (fetchError) {
          setError(
            fetchError.message || "No se pudo obtener el reporte. Intenta nuevamente."
          );
        } else if (!data) {
          setError("Reporte no encontrado.");
        } else {
          setReport(data);
        }
      } catch (err) {
        setError(err?.message || "No se pudo obtener el reporte.");
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [id]);

  const locationDescription = useMemo(() => {
    if (!report) return "Sin información de ubicación";
    return (
      report.location_details ||
      report.location_description ||
      report.address ||
      "Sin información de ubicación"
    );
  }, [report]);

  const photoUrl = useMemo(() => {
    if (!report) return null;
    if (Array.isArray(report.photos) && report.photos.length > 0) {
      return report.photos[0];
    }
    if (typeof report.photos === "string") {
      try {
        const parsed = JSON.parse(report.photos);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0];
        }
      } catch {
        return null;
      }
    }
    return null;
  }, [report]);

  useEffect(() => {
    const previousRoute = params?.conversationRedirect
      ? {
          pathname: '/messages/[conversationId]',
          params: { conversationId: params.conversationRedirect },
        }
      : { pathname: '/(tabs)/reports' };

    const onBack = () => {
      router.replace(previousRoute);
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [params?.conversationRedirect, router]);

  const handleBack = () => {
    if (params?.conversationRedirect) {
      router.replace({
        pathname: '/messages/[conversationId]',
        params: { conversationId: params.conversationRedirect },
      });
    } else {
      router.replace('/(tabs)/reports');
    }
  };

  useEffect(() => {
    setContactError(null);
    setContactLoading(false);
  }, [report]);

  const isOwnReport = useMemo(() => {
    if (!report || !userId) return false;
    return report.reporter_id === userId;
  }, [report, userId]);

  const handleContact = async () => {
    if (!report || !report.reporter_id) {
      setContactError("El reporte no tiene un autor válido.");
      return;
    }

    if (!isAuthenticated) {
      router.push("/(auth)/login");
      return;
    }

    if (isOwnReport) {
      setContactError("Este es tu propio reporte.");
      return;
    }

    try {
      setContactLoading(true);
      setContactError(null);

      const { data, error: conversationError } = await messageService.getOrCreateConversation(
        report.id,
        userId,
        report.reporter_id
      );

      if (conversationError) {
        throw conversationError;
      }

      if (!data?.id) {
        throw new Error("No se pudo crear la conversación.");
      }

      router.push(`/messages/${data.id}`);
    } catch (contactErr) {
      console.error("Error iniciando conversación:", contactErr);
      setContactError(contactErr?.message || "No se pudo iniciar el chat. Intenta nuevamente.");
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={handleBack} />
        <Text style={styles.headerTitle}>Detalle del reporte</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando reporte...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={handleBack} style={styles.retryButton}>
            Volver
          </Button>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.typeRow}>
              <Text style={styles.typeText}>
                {report.type === "lost" ? "🔴 Mascota Perdida" : "🟢 Mascota Encontrada"}
              </Text>
              <Chip
                mode="outlined"
                style={[
                  styles.statusChip,
                  {
                    borderColor: report.status === "active" ? "#34C759" : "#FF9500",
                  },
                ]}
                textStyle={{
                  color: report.status === "active" ? "#34C759" : "#FF9500",
                  fontSize: 12,
                }}
              >
                {report.status === "active" ? "Activo" : "Resuelto"}
              </Chip>
            </View>

            {photoUrl && (
              <View style={styles.imageContainer}>
                <Image source={{ uri: photoUrl }} style={styles.mainImage} contentFit="cover" />
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.petName}>
                {report.pet_name ||
                  (report.type === "lost" ? "Mascota Perdida" : "Mascota Encontrada")}
              </Text>
              <View style={styles.speciesRow}>
                <Text style={styles.speciesEmoji}>{getSpeciesEmoji(report.species)}</Text>
                <Text style={styles.speciesText}>
                  {report.breed || report.species || "Sin información"}
                </Text>
              </View>
            </View>

            {report.description ? (
              <>
                <Divider style={styles.divider} />
                <Text style={styles.description}>{report.description}</Text>
              </>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ubicación</Text>
              <Text style={styles.sectionBody}>{locationDescription}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información del reporte</Text>
              <View style={styles.infoRow}>
                <Avatar.Text
                  size={32}
                  label={
                    report.reporter_name ? report.reporter_name.charAt(0).toUpperCase() : "U"
                  }
                  style={styles.avatar}
                />
                <View style={styles.reporterData}>
                  <Text style={styles.reporterName}>
                    {report.reporter_name || "Usuario"}
                  </Text>
                  <Text style={styles.reportDate}>{formatDate(report.created_at)}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.contactSection}>
            <Button
              mode="contained"
              style={styles.contactButton}
              icon="message"
              onPress={handleContact}
              loading={contactLoading}
              disabled={contactLoading || isOwnReport || !report?.reporter_id}
            >
              {isOwnReport
                ? "Este es tu reporte"
                : isAuthenticated
                ? "Contactar"
                : "Inicia sesión para contactar"}
            </Button>
            {contactError ? (
              <HelperText type="error" visible style={styles.contactError}>
                {contactError}
              </HelperText>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f1f1f",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#555",
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#D32F2F",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    alignSelf: "center",
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    marginBottom: 16,
  },
  typeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  typeText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111",
  },
  statusChip: {
    height: 26,
  },
  imageContainer: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  section: {
    marginBottom: 16,
  },
  petName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
    marginBottom: 8,
  },
  speciesRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  speciesEmoji: {
    fontSize: 22,
    marginRight: 6,
  },
  speciesText: {
    fontSize: 16,
    color: "#444",
    fontWeight: "500",
  },
  divider: {
    marginVertical: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#333",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f1f1f",
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#444",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    marginRight: 12,
  },
  reporterData: {
    flex: 1,
  },
  reporterName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f1f1f",
  },
  reportDate: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },
  contactButton: {
    marginTop: 4,
  },
  contactSection: {
    marginTop: 8,
  },
  contactError: {
    marginTop: 8,
  },
});


