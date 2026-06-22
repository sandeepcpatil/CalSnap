import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/ScanNavigator';
import { supabase } from '../../services/supabase';
import { analyzeFood } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { PaywallModal } from '../Paywall/PaywallModal';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';

type Props = { navigation: NativeStackNavigationProp<ScanStackParamList, 'ScanCamera'> };

// ─── Analyzing overlay ───────────────────────────────────────────────────────

const STEPS = [
  { emoji: '📤', text: 'Uploading photo' },
  { emoji: '🔍', text: 'AI is analyzing' },
  { emoji: '🥗', text: 'Identifying ingredients' },
  { emoji: '📊', text: 'Calculating nutrition' },
];

function AnalyzingOverlay() {
  const [stepIndex, setStepIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Icon pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Expanding ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.delay(200),
        Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();

    // Bouncing dots
    const animateDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        ])
      ).start();
    animateDot(dot1, 0);
    animateDot(dot2, 180);
    animateDot(dot3, 360);

    // Cycle steps with fade
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      setStepIndex(prev => (prev + 1) % STEPS.length);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.2, 0] });

  return (
    <View style={analyzeStyles.container}>
      <View style={analyzeStyles.card}>
        {/* Pulsing icon with expanding ring */}
        <View style={analyzeStyles.iconWrapper}>
          <Animated.View style={[analyzeStyles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          <Animated.View style={[analyzeStyles.iconCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={analyzeStyles.emoji}>{STEPS[stepIndex].emoji}</Text>
          </Animated.View>
        </View>

        {/* Cycling status */}
        <Animated.Text style={[analyzeStyles.stepText, { opacity: fadeAnim }]}>
          {STEPS[stepIndex].text}
        </Animated.Text>

        {/* Bouncing dots */}
        <View style={analyzeStyles.dotsRow}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View key={i} style={[analyzeStyles.dot, { opacity: dot }]} />
          ))}
        </View>

        <Text style={analyzeStyles.subText}>This takes a few seconds</Text>
      </View>
    </View>
  );
}

const analyzeStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 40,
    paddingHorizontal: 48,
    alignItems: 'center',
    gap: 18,
    minWidth: 260,
  },
  iconWrapper: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#4dd0d8',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(77,208,216,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(77,208,216,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 32 },
  stepText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4dd0d8',
  },
  subText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '500',
  },
});

// ─────────────────────────────────────────────────────────────────────────────

export function ScanScreen({ navigation }: Props) {
  const { session } = useAuthStore();
  const { canScan, scansRemaining, isSubscribed, paywallVisible, showPaywall, dismissPaywall, consumeScan } = useSubscriptionGate();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = async () => {
    if (!canScan) {
      showPaywall();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await processPhoto(async () => {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
      return photo?.uri ?? null;
    });
  };

  const handlePickFromLibrary = async () => {
    if (!canScan) {
      showPaywall();
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      await processPhoto(async () => result.assets[0].uri);
    }
  };

  const processPhoto = async (getUri: () => Promise<string | null>) => {
    setIsAnalyzing(true);
    try {
      const rawUri = await getUri();
      if (!rawUri) return;

      // Compress to max 1024px before uploading
      const compressed = await ImageManipulator.manipulateAsync(
        rawUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Upload to Supabase Storage
      const fileName = `${session!.user.id}/${Date.now()}.jpg`;

      // Read as base64 — fetch(file://) fails on Android production builds
      const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('food-images')
        .upload(fileName, bytes, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // Get a 1-hour signed URL for the backend to use
      const { data: signedData, error: signedError } = await supabase.storage
        .from('food-images')
        .createSignedUrl(fileName, 3600);

      if (signedError || !signedData?.signedUrl) throw new Error('Could not get signed URL');

      // Call backend (server enforces scan count gate)
      const { result } = await analyzeFood(signedData.signedUrl, session!.access_token);

      navigation.navigate('ScanResult', {
        imageUri: compressed.uri,
        imageStorageUrl: signedData.signedUrl,
        result,
      });
    } catch (err: any) {
      if (err?.statusCode === 402 || err?.code === 'scan_limit_reached') {
        showPaywall();
      } else {
        Alert.alert('Analysis failed', err.message ?? 'Please try again with a clearer photo.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text variant="headlineSmall" style={styles.permissionTitle}>Camera access needed</Text>
        <Text variant="bodyMedium" style={styles.permissionText}>
          CalSnap needs camera access to scan your food.
        </Text>
        <Button mode="contained" onPress={requestPermission} style={styles.permissionButton}>
          Grant Permission
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={cameraType} />

      {/* Full-screen analyzing overlay */}
      {isAnalyzing && <AnalyzingOverlay />}

      {/* Overlay UI */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.glassBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleBadge}>
            <Text style={styles.titleBadgeText}>AI Scanner</Text>
          </View>
          <TouchableOpacity style={styles.glassBtn}>
            <Ionicons name="help-circle-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Scan counter badge for free users */}
          {!isSubscribed && (
            <TouchableOpacity onPress={showPaywall} style={styles.scanCountBadge}>
              <Text style={styles.scanCountText}>{scansRemaining} scan{scansRemaining !== 1 ? 's' : ''} left today</Text>
            </TouchableOpacity>
          )}

          {/* Viewfinder frame */}
        <View style={styles.viewfinderWrap}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.hintWrap}>
            <Text style={styles.hint}>Point at your food</Text>
          </View>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={handlePickFromLibrary} style={styles.sideButton} disabled={isAnalyzing}>
            <View style={styles.glassBtn}>
              <Ionicons name="images-outline" size={26} color="#fff" />
            </View>
            <Text style={styles.sideLabel}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCapture} style={styles.captureButton} disabled={isAnalyzing}>
            <View style={[styles.captureInner, isAnalyzing && { opacity: 0.4 }]} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setCameraType(cameraType === 'back' ? 'front' : 'back')}
            style={styles.sideButton}
            disabled={isAnalyzing}
          >
            <View style={styles.glassBtn}>
              <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
            </View>
            <Text style={styles.sideLabel}>Flip</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <PaywallModal visible={paywallVisible} onDismiss={dismissPaywall} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16, backgroundColor: '#f7fafa' },
  permissionTitle: { color: '#004f54', fontWeight: '700' },
  permissionText: { color: '#3f4949', textAlign: 'center' },
  permissionButton: { borderRadius: 50, backgroundColor: '#004f54' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  scanCountBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  scanCountText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  glassBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  titleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  titleBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  viewfinderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
  viewfinder: {
    width: 280,
    height: 280,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#fff',
    borderWidth: 4,
  },
  cornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 40 },
  cornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 40 },
  cornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 40 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 40 },
  hintWrap: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 50,
  },
  hint: { color: '#fff', fontSize: 16, fontWeight: '700' },

  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  sideButton: { alignItems: 'center', gap: 6 },
  sideLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff' },
});
