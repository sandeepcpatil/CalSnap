const IS_DEV = process.env.APP_VARIANT === 'development';
// v6
module.exports = {
  name: IS_DEV ? 'CalSnap (Dev)' : 'CalSnap',
  slug: 'calsnap',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'calsnap',
  icon: './assets/icon.png',
  // The app ships dark-only — 'automatic' let the OS force a light appearance
  // on some surfaces while every screen renders dark.
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    // Was near-white #f7fafa — a white flash before a dark app.
    backgroundColor: '#0C1112',
  },
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_DEV ? 'com.sanverse.calsnapapp.dev' : 'com.sanverse.calsnapapp',
    infoPlist: {
      NSCameraUsageDescription: 'CalSnap needs camera access to scan your food.',
      NSPhotoLibraryUsageDescription: 'CalSnap needs photo library access to analyze food photos.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      // Was orange #ab3500 — clashed with the teal brand on the home screen.
      backgroundColor: '#01696F',
    },
    package: IS_DEV ? 'com.sanverse.calsnapapp.dev' : 'com.sanverse.calsnapapp',
    versionCode: 11,
    permissions: [
      'CAMERA',
      'RECEIVE_BOOT_COMPLETED',
      'SCHEDULE_EXACT_ALARM',
    ],
    newArchEnabled: false,
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
          compileSdkVersion: 35,
          minSdkVersion: 24,
          ndkVersion: '26.3.11579264',
          kotlinVersion: '1.9.25',
        },
      },
    ],
    'expo-notifications',
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
    [
      '@react-native-voice/voice',
      {
        microphonePermission: 'CalSnap uses the microphone so you can log a meal by speaking.',
        speechRecognitionPermission: 'CalSnap converts your speech to text so you can log a meal without typing.',
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      {
        // iOS reversed client ID (com.googleusercontent.apps.XXXX). Required for
        // the iOS build; set EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME before building iOS.
        iosUrlScheme:
          process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME || 'com.googleusercontent.apps.placeholder',
      },
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL,
    revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    eas: {
      projectId: '8c518e8d-9244-4a5c-a504-98d7c97e1d9b',
    },
  },
};
