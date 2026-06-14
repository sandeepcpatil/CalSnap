const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
  name: IS_DEV ? 'CalSnap (Dev)' : 'CalSnap',
  slug: 'calsnap',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#01696f',
  },
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_DEV ? 'com.calsnap.app.dev' : 'com.calsnap.app',
    config: {
      googleServicesFile: './GoogleService-Info.plist',
    },
    infoPlist: {
      NSCameraUsageDescription: 'CalSnap needs camera access to scan your food.',
      NSPhotoLibraryUsageDescription: 'CalSnap needs photo library access to analyze food photos.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#01696f',
    },
    package: IS_DEV ? 'com.calsnap.app.dev' : 'com.calsnap.app',
    googleServicesFile: './google-services.json',
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission: 'CalSnap needs camera access to scan your food.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'CalSnap needs photo library access to analyze food photos.',
      },
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL,
    razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
    eas: {
      projectId: 'your-eas-project-id',
    },
  },
};
