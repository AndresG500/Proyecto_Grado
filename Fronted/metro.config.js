const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Agregar soporte para rutas absolutas con @
config.resolver.alias = {
  '@': path.resolve(__dirname),
};

module.exports = config;