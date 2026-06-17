const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Point Metro at the monorepo shared folder so `@shared/*` resolves at runtime.
// Type-only imports are erased by tsc, but Metro needs this for any runtime imports.
const sharedFolder = path.resolve(__dirname, '../shared');

const config = getDefaultConfig(__dirname);

config.watchFolders = [...(config.watchFolders ?? []), sharedFolder];

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
