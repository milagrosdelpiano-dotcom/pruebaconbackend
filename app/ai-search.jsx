/**
 * Pantalla de Búsqueda con IA
 * ============================
 * 
 * Esta pantalla permite buscar mascotas usando inteligencia artificial.
 * El usuario sube una foto de una mascota y el sistema busca coincidencias
 * visuales usando embeddings de MegaDescriptor.
 * 
 * Funcionalidades:
 * - Seleccionar imagen de la galería o tomar foto
 * - Configurar tipo de búsqueda (perdidas, encontradas, ambas)
 * - Configurar radio de búsqueda (5km, 10km, 25km, 50km)
 * - Ver resultados de búsqueda con scores de similitud
 * - Navegar a detalles de reportes encontrados
 * 
 * Flujo:
 * 1. Usuario selecciona/toma una foto
 * 2. Configura tipo de búsqueda y radio
 * 3. Presiona "Buscar"
 * 4. El backend genera embedding y busca matches
 * 5. Se muestran los resultados ordenados por similitud
 */

// =========================
// Imports de Expo
// =========================
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

// =========================
// Imports de React
// =========================
import React, { useState } from 'react';

// =========================
// Imports de React Native
// =========================
import {
    Alert,              // Para mostrar alertas
    Image,              // Componente de imagen
    ScrollView,         // Para hacer scrollable el contenido
    StyleSheet,         // Para estilos
    TouchableOpacity,   // Botón táctil
    View,               // Componente de vista básico
} from 'react-native';

// =========================
// Imports de React Native Paper
// =========================
import {
    Button,             // Botón de Material Design
    Card,               // Tarjeta de Material Design
    Chip,               // Chip para selección
    IconButton,         // Botón con ícono
    Paragraph,          // Párrafo de texto
    Text,               // Texto simple
    Title,              // Título
} from 'react-native-paper';

// =========================
// Imports de Safe Area
// =========================
import { SafeAreaView } from 'react-native-safe-area-context';

// =========================
// Imports de Servicios
// =========================
import { aiSearchService, getCurrentLocation, searchImage } from '@services';
import { postImage } from '../src/lib/api';

/**
 * Componente principal de la pantalla de búsqueda con IA
 */
export default function AISearchScreen() {
  // =========================
  // Hooks y Navegación
  // =========================
  // Router para navegación
  const router = useRouter();
  
  // =========================
  // Estado Local
  // =========================
  // URI de la imagen seleccionada (local file://)
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Resultado del análisis de la imagen (si se hizo análisis previo)
  const [analysisResult, setAnalysisResult] = useState(null);
  
  // Estado de carga (cuando se está buscando)
  const [loading, setLoading] = useState(false);
  
  // Resultados de la búsqueda (matches encontrados)
  const [searchResults, setSearchResults] = useState([]);
  
  // Resultados de búsqueda por embedding (si se usa búsqueda vectorial)
  const [embeddingResults, setEmbeddingResults] = useState([]);
  
  // Tipo de búsqueda: 'lost' (perdidas), 'found' (encontradas), 'both' (ambas)
  const [searchType, setSearchType] = useState('both');
  
  // Radio de búsqueda en kilómetros
  const [radius, setRadius] = useState(10);  // km

  const SEARCH_TYPES = [
    { id: 'lost', label: 'Buscar mascotas perdidas', icon: 'alert', color: '#FF3B30' },
    { id: 'found', label: 'Buscar mascotas encontradas', icon: 'paw', color: '#34C759' },
    { id: 'both', label: 'Buscar ambas', icon: 'magnify', color: '#007AFF' },
  ];

  const RADIUS_OPTIONS = [
    { id: 5, label: '5 km' },
    { id: 10, label: '10 km' },
    { id: 25, label: '25 km' },
    { id: 50, label: '50 km' },
  ];

  const pickImage = async () => {
    try {
      // Solicitar permisos antes de abrir la galería
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Necesitamos acceso a tu galería para seleccionar imágenes.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setAnalysisResult(null);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error seleccionando imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const takePhoto = async () => {
    try {
      // Solicitar permisos antes de abrir la cámara
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Necesitamos acceso a tu cámara para tomar fotos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setAnalysisResult(null);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error tomando foto:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const analyzeImageWithAI = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Por favor selecciona una imagen primero');
      return;
    }

    try {
      setLoading(true);
      
      // Usar el nuevo helper postImage para subir la imagen
      const data = await postImage("/analyze_image", { uri: selectedImage });
      
      setAnalysisResult({
        labels: data.labels || [],
        colors: data.colors || [],
        timestamp: new Date().toISOString(),
      });

      console.log('✅ Análisis completado:', data);
    } catch (error) {
      console.error('Error analizando imagen:', error);
      Alert.alert('Error', `No se pudo analizar la imagen: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const searchForMatches = async () => {
    if (!selectedImage || !analysisResult) {
      Alert.alert('Error', 'Por favor analiza la imagen primero');
      return;
    }

    try {
      setLoading(true);

      // Obtener ubicación actual del usuario
      const location = await getCurrentLocation();
      if (location.error) {
        Alert.alert('Error', 'No se pudo obtener tu ubicación. Verifica los permisos.');
        return;
      }

      // Realizar búsqueda con IA usando el nuevo servicio
      const searchParams = {
        imageUri: selectedImage,
        userLatitude: location.latitude,
        userLongitude: location.longitude,
        radiusKm: radius,
        searchType: searchType,
        analysisData: analysisResult
      };

      const result = await aiSearchService.searchMatches(searchParams);

      if (result.success) {
        setSearchResults(result.data.matches || []);
        
        Alert.alert(
          'Búsqueda completada',
          `Encontramos ${result.data.matches.length} posibles coincidencias`
        );
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error en búsqueda:', error);
      Alert.alert('Error', `No se pudo realizar la búsqueda: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onBuscarCoincidencias = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Por favor selecciona una imagen primero');
      return;
    }

    setLoading(true);
    try {
      // Obtener ubicación del usuario para filtro geográfico
      let location = null;
      try {
        location = await getCurrentLocation();
      } catch (error) {
        console.log('No se pudo obtener ubicación, búsqueda sin filtro geográfico');
      }
      
      // Pasar coordenadas y radio si están disponibles
      const data = await searchImage(
        selectedImage,
        location?.latitude,
        location?.longitude,
        radius // Usar el radio configurado en la UI
      );
      
      setEmbeddingResults(data.results ?? []);
      
      if (data.results && data.results.length > 0) {
        Alert.alert(
          'Búsqueda completada',
          `Encontramos ${data.results.length} coincidencias por similitud visual${location ? ` en ${radius}km` : ''}`
        );
      } else {
        Alert.alert('Sin resultados', 'No se encontraron coincidencias similares');
      }
    } catch (e) {
      console.error('Error en búsqueda por similitud:', e);
      
      // Manejo específico de errores de conexión
      if (e.message?.includes('Network request failed') || e.message?.includes('fetch')) {
        Alert.alert(
          'Error de Conexión', 
          'No se pudo conectar con el servidor. Verifica que:\n\n' +
          '1. El backend esté ejecutándose\n' +
          '2. Tu dispositivo esté en la misma red WiFi\n' +
          '3. La IP del servidor sea correcta'
        );
      } else if (e.message?.includes('Error del servidor')) {
        Alert.alert('Error del Servidor', e.message);
      } else {
        Alert.alert("Error", `No se pudo buscar coincidencias: ${e.message || 'Error desconocido'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResultPress = (result) => {
    // Navegar a detalles del reporte
    router.push(`/report/${result.candidate.id}`);
  };

  const handleEmbeddingResultPress = (result) => {
    // Navegar a detalles del reporte
    router.push(`/report/${result.report_id}`);
  };

  const renderAnalysisResult = () => {
    if (!analysisResult) return null;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>🔍 Análisis de IA</Title>
          <Paragraph style={styles.analysisText}>
            Etiquetas detectadas:
          </Paragraph>
          <View style={styles.labelsContainer}>
            {analysisResult.labels.slice(0, 5).map((label, index) => (
              <Chip
                key={index}
                style={[styles.labelChip, { backgroundColor: getLabelColor(label.score) }]}
                textStyle={styles.labelText}
              >
                {label.label} ({label.score}%)
              </Chip>
            ))}
          </View>
          {analysisResult.colors && analysisResult.colors.length > 0 && (
            <>
              <Paragraph style={[styles.analysisText, { marginTop: 16 }]}>
                Colores dominantes:
              </Paragraph>
              <View style={styles.colorsContainer}>
                {analysisResult.colors.slice(0, 3).map((color, index) => (
                  <View key={index} style={styles.colorItem}>
                    <View style={[styles.colorSwatch, { backgroundColor: color }]} />
                    <Text style={styles.colorText}>{color}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderEmbeddingResults = () => {
    if (embeddingResults.length === 0) return null;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>🔍 Resultados por Similitud Visual</Title>
          <Paragraph style={styles.resultsCount}>
            {embeddingResults.length} coincidencia{embeddingResults.length !== 1 ? 's' : ''} encontrada{embeddingResults.length !== 1 ? 's' : ''}
          </Paragraph>
          {embeddingResults.map((result, index) => (
            <TouchableOpacity
              key={result.report_id || index}
              style={styles.resultItem}
              onPress={() => handleEmbeddingResultPress(result)}
            >
              <View style={styles.resultContent}>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle}>
                    Reporte #{result.report_id?.slice(-8) || 'N/A'}
                  </Text>
                  <Text style={styles.resultSubtitle}>
                    {result.species} • {result.color}
                  </Text>
                  {result.labels && result.labels.tags && (
                    <View style={styles.tagsContainer}>
                      {result.labels.tags.slice(0, 3).map((tag, tagIndex) => (
                        <Chip key={tagIndex} style={styles.tag} textStyle={styles.tagText}>
                          {tag}
                        </Chip>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.resultRight}>
                  {result.photo && (
                    <Image
                      source={{ uri: result.photo }}
                      style={styles.resultImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>
                      {Math.round((result.similarity_score || 0) * 100)}%
                    </Text>
                    <Text style={styles.scoreLabel}>Similitud</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </Card.Content>
      </Card>
    );
  };

  const renderSearchResults = () => {
    if (searchResults.length === 0) return null;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>🎯 Resultados de Búsqueda</Title>
          <Paragraph style={styles.resultsCount}>
            {searchResults.length} coincidencia{searchResults.length !== 1 ? 's' : ''} encontrada{searchResults.length !== 1 ? 's' : ''}
          </Paragraph>
          
          {searchResults.map((result, index) => (
            <TouchableOpacity
              key={result.id}
              style={styles.resultItem}
              onPress={() => handleResultPress(result)}
            >
              <View style={styles.resultContent}>
                <View style={styles.resultHeader}>
                  <Text style={styles.petName}>{result.candidate.pet_name}</Text>
                  <Chip
                    style={[styles.scoreChip, { backgroundColor: getScoreColor(result.total_score) }]}
                    textStyle={styles.scoreText}
                  >
                    {result.total_score}% match
                  </Chip>
                </View>
                
                <Text style={styles.resultDetails}>
                  🐕 {result.candidate.species === 'dog' ? 'Perro' : 'Gato'} • 🎨 {result.candidate.color} • 📍 {result.distance_km} km
                </Text>
                
                <Text style={styles.resultDescription} numberOfLines={2}>
                  {result.candidate.description}
                </Text>
                
                <Text style={styles.matchDetails}>
                  🎯 Similitud visual: {result.visual_similarity}% • 🎨 Colores: {result.color_similarity}%
                </Text>
                
                <Text style={styles.confidenceText}>
                  Confianza: {result.match_confidence}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card.Content>
      </Card>
    );
  };

  const getLabelColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerContainer}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <View style={styles.headerContent}>
          <Title style={styles.title}>🔍 Búsqueda con IA</Title>
          <Paragraph style={styles.subtitle}>
            Sube una foto de la mascota para buscar coincidencias usando inteligencia artificial
          </Paragraph>
        </View>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Selector de tipo de búsqueda */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Tipo de Búsqueda</Title>
            <View style={styles.chipContainer}>
              {SEARCH_TYPES.map((type) => (
                <Chip
                  key={type.id}
                  selected={searchType === type.id}
                  onPress={() => setSearchType(type.id)}
                  style={[styles.chip, { borderColor: type.color }]}
                  icon={type.icon}
                >
                  {type.label}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Selector de radio de búsqueda */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Radio de Búsqueda</Title>
            <View style={styles.chipContainer}>
              {RADIUS_OPTIONS.map((option) => (
                <Chip
                  key={option.id}
                  selected={radius === option.id}
                  onPress={() => setRadius(option.id)}
                  style={styles.chip}
                >
                  {option.label}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Selección de imagen */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>📸 Foto de la Mascota</Title>
            
            {selectedImage ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: selectedImage }} style={styles.image} />
                <TouchableOpacity
                  style={styles.changeImageButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <Text style={styles.changeImageText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imageButtons}>
                <Button
                  mode="outlined"
                  onPress={pickImage}
                  icon="image"
                  style={styles.imageButton}
                >
                  Galería
                </Button>
                <Button
                  mode="outlined"
                  onPress={takePhoto}
                  icon="camera"
                  style={styles.imageButton}
                >
                  Cámara
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Botones de acción */}
        {selectedImage && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.actionButtons}>
                <Button
                  mode="contained"
                  onPress={analyzeImageWithAI}
                  loading={loading}
                  disabled={loading}
                  style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                  icon="robot"
                >
                  Analizar con IA
                </Button>
                
                {analysisResult && (
                  <Button
                    mode="contained"
                    onPress={searchForMatches}
                    loading={loading}
                    disabled={loading}
                    style={[styles.actionButton, { backgroundColor: '#007AFF' }]}
                    icon="magnify"
                  >
                    Buscar Coincidencias (IA)
                  </Button>
                )}
                
                <Button
                  mode="contained"
                  onPress={onBuscarCoincidencias}
                  loading={loading}
                  disabled={loading}
                  style={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
                  icon="eye"
                >
                  Buscar por Similitud Visual
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Resultado del análisis */}
        {renderAnalysisResult()}

        {/* Resultados de búsqueda */}
        {renderSearchResults()}
        
        {/* Resultados de búsqueda por similitud visual */}
        {renderEmbeddingResults()}

        {/* Información adicional */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.infoTitle}>💡 Cómo funciona</Title>
            <Paragraph style={styles.infoText}>
              1. Sube una foto clara de la mascota{'\n'}
              2. La IA analiza características visuales{'\n'}
              3. Buscamos coincidencias en nuestra base de datos{'\n'}
              4. Te mostramos los mejores resultados
            </Paragraph>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 8,
  },
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  image: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 16,
  },
  changeImageButton: {
    position: 'absolute',
    top: -8,
    right: 80,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeImageText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flex: 1,
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    borderRadius: 8,
  },
  analysisText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  labelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  labelChip: {
    marginBottom: 8,
  },
  labelText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  resultsCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  resultItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  resultContent: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  petName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  scoreChip: {
    borderRadius: 12,
  },
  scoreText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  resultDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  resultDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  reporterInfo: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  colorsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  colorItem: {
    alignItems: 'center',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  colorText: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  matchDetails: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
  },
  resultRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  resultImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  scoreContainer: {
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scoreLabel: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    backgroundColor: '#E1BEE7',
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    color: '#4A148C',
  },
});
