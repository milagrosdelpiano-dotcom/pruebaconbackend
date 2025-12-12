const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configuración adicional para resolver problemas de módulos
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Resolver extensiones de archivo (usar defaults de Expo + nuestras extensiones)
const defaultSourceExts = config.resolver.sourceExts || [];
config.resolver.sourceExts = [...defaultSourceExts, 'ts', 'tsx'];

// Configuración para resolver módulos
config.resolver.alias = {
  '@': __dirname + '/src',
  '@services': __dirname + '/src/services',
  '@components': __dirname + '/src/components',
  '@config': __dirname + '/src/config',
};

// Configuración para evitar errores de bytecode
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

// Configuración para evitar errores de InternalBytecode.js
config.transformer.unstable_allowRequireContext = true;

module.exports = config;



