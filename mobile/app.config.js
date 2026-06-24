const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
  name: IS_DEV ? 'CalSnap (Dev)' : 'CalSnap',
  slug: 'calsnap',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'calsnap',
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
    bundleIdentifier: IS_DEV ? 'com.sanverse.calsnap.dev' : 'com.sanverse.calsnap',
    infoPlist: {
      NSCameraUsageDescription: 'CalSnap needs camera access to scan your food.',
      NSPhotoLibraryUsageDescription: 'CalSnap needs photo library access to analyze food photos.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ab3500',
    },
    package: IS_DEV ? 'com.sanverse.calsnap.dev' : 'com.sanverse.calsnap',
    versionCode: process.env.EXPO_PUBLIC_VERSION_CODE ? parseInt(process.env.EXPO_PUBLIC_VERSION_CODE, 10) : 7,
    permissions: [
      'CAMERA',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          targetSdkVersion: 35,
          ndkVersion: '26.3.11579264',
        },
      },
    ],
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
      projectId: '8c518e8d-9244-4a5c-a504-98d7c97e1d9b',
    },
  },
};
