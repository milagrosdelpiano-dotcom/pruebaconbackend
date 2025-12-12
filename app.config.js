export default {
  expo: {
    name: "PetAlert",
    slug: "petalert",
    scheme: "petalert",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.petalert.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Necesitamos tu ubicación para mostrar mascotas perdidas cerca de ti.",
        NSCameraUsageDescription: "Necesitamos acceso a la cámara para tomar fotos de mascotas.",
        NSPhotoLibraryUsageDescription: "Necesitamos acceso a tus fotos para seleccionar imágenes."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        backgroundColor: "#ffffff"
      },
      package: "com.petalert.app",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyDummy-Key-Replace-With-Real-One"
        }
      }
    },
    plugins: [
      "expo-router",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Necesitamos tu ubicación para mostrar mascotas perdidas cerca de ti."
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Necesitamos acceso a tus fotos para seleccionar imágenes.",
          cameraPermission: "Necesitamos acceso a la cámara para tomar fotos de mascotas."
        }
      ],
      "expo-secure-store",
      "expo-web-browser",
      "expo-font",
      "expo-av"
    ],
    extra: {
      // Variables de entorno para Supabase
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "https://tu-proyecto-id.supabase.co",
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "tu-clave-anonima-aqui",
      
      // Variables de entorno para la aplicación
      appName: process.env.EXPO_PUBLIC_APP_NAME || "PetAlert",
      appVersion: process.env.EXPO_PUBLIC_APP_VERSION || "1.0.0",
      backendUrl:
        process.env.EXPO_PUBLIC_BACKEND_URL ||
        process.env.EXPO_PUBLIC_TUNNEL_URL ||
        null, // Debe configurarse en eas.json o .env
      
      // Variables de entorno para mapas
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
      
      // EAS
      eas: {
        projectId: "52c1874f-26fb-46c5-966e-809fb7b5ff4b"
      }
    },
    // Runtime version para controlar qué builds reciben qué actualizaciones
    runtimeVersion: {
      policy: "appVersion" // Usa la versión de la app (1.0.0) como runtime version
    }
  }
};
