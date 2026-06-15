const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Stub out packages that are native-only and break web builds
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    const stubs = [
      '@opentelemetry/api',
      'expo-secure-store',
      'expo-haptics',
    ];
    if (stubs.includes(moduleName)) {
      return { type: 'empty' };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
