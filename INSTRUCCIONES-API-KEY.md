# 🔑 INSTRUCCIONES URGENTES - Google Maps API Key

## ⚠️ ESTADO ACTUAL
- **Mapa DESHABILITADO temporalmente** para evitar crashes
- **App funcional** SIN el mapa
- Todas las funciones trabajan pero sin visualización de mapas

## 🚀 ACTIVAR EL MAPA (cuando tengas la API key)

### Paso 1: Conseguir la API Key
1. Andá a https://console.cloud.google.com/
2. Creá un proyecto nuevo (o usá uno existente)
3. Habilitá "Maps SDK for Android"
4. Creá credenciales → API Key
5. **Copiá la key** (formato: `AIzaSyXXXXXXXXXX...`)

### Paso 2: Pegar la API Key
Editá el archivo `app.config.js` línea 40:

**ANTES:**
```javascript
apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyDummy-Key-Replace-With-Real-One"
```

**DESPUÉS:**
```javascript
apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "TU-API-KEY-AQUI"
```

### Paso 3: Descomentar el código del mapa

**Archivo 1:** `app/(tabs)/index.jsx` - Línea 56
```javascript
// CAMBIAR ESTO:
// import MapView from '../../src/components/Map/MapView'; // TEMPORAL: Deshabilitado

// A ESTO:
import MapView from '../../src/components/Map/MapView';
```

**Archivo 1:** `app/(tabs)/index.jsx` - Líneas 283-300
Reemplazar el `<View style={styles.mapPlaceholder}>` con:
```javascript
<MapView
  reports={reports}
  onReportPress={handleReportPress}
  onMarkerPress={handleMarkerPress}
  showUserLocation={true}
  showRadius={false}
  style={styles.map}
/>
```

**Archivo 2:** `app/report/create-lost.jsx` - Línea 78
```javascript
// CAMBIAR ESTO:
// import MapView from '../../src/components/Map/MapView'; // TEMPORAL: Deshabilitado

// A ESTO:
import MapView from '../../src/components/Map/MapView';
```

**Archivo 2:** `app/report/create-lost.jsx` - Línea ~750
Reemplazar el placeholder con:
```javascript
<MapView
  reports={[]}
  onLocationSelect={handleLocationSelect}
  allowLocationSelection={true}
  selectedLocation={selectedLocation}
  showUserLocation={true}
  style={styles.map}
/>
```

**Archivo 3:** `app/report/create-found.jsx` - Línea 75
```javascript
// CAMBIAR ESTO:
// import MapView from '../../src/components/Map/MapView'; // TEMPORAL: Deshabilitado

// A ESTO:
import MapView from '../../src/components/Map/MapView';
```

**Archivo 3:** `app/report/create-found.jsx` - Línea ~730
Reemplazar el placeholder con:
```javascript
<MapView
  reports={[]}
  onLocationSelect={handleLocationSelect}
  allowLocationSelection={true}
  selectedLocation={selectedLocation}
  showUserLocation={true}
  style={styles.map}
/>
```

### Paso 4: Reconstruir APK
```powershell
$env:EAS_NO_VCS=1; eas build --platform android --profile preview --non-interactive
```

## 📋 ALTERNATIVA SI NO CONSEGUÍS LA API KEY

**Para la presentación de mañana:**
- La app **FUNCIONA** sin el mapa
- Todas las funciones están operativas
- Explicá que por razones de cuenta de Google Cloud el mapa está temporalmente deshabilitado
- El código del mapa ESTÁ y FUNCIONA (mostrá el código)

## 🆘 ÚLTIMO RECURSO
Pedile a un profesor/tutor/compañero que tenga cuenta de Google Cloud con tarjeta verificada que te genere una API key.
