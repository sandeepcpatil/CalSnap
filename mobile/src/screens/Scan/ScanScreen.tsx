import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/ScanNavigator';
import { supabase } from '../../services/supabase';
import { analyzeFood, analyzeLabel } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { PaywallModal } from '../Paywall/PaywallModal';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';

type Props = { navigation: NativeStackNavigationProp<ScanStackParamList, 'ScanCamera'> };

// ─── Analyzing overlay ───────────────────────────────────────────────────────
// Shows the user's actual photo with a scanning beam sweeping over it and a
// step checklist that fills in — feels like the AI is "looking" at the meal.

const STEPS = [
  { icon: 'cloud-upload-outline', text: 'Uploading photo' },
  { icon: 'scan-outline', text: 'AI scanning your meal' },
  { icon: 'nutrition-outline', text: 'Identifying ingredients' },
  { icon: 'stats-chart-outline', text: 'Calculating nutrition' },
] as const;

const SCREEN_H = Dimensions.get('window').height;
const SWEEP_RANGE = SCREEN_H * 0.52;

function AnalyzingOverlay({ imageUri }: { imageUri: string | null }) {
  const [stepIndex, setStepIndex] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Beam sweeps down, then back up, forever.
    Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();

    // Soft breathing glow on the frame corners.
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.6, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    // Steps advance and stay done; the last one keeps spinning until the
    // request actually finishes (the overlay unmounts).
    const interval = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const translateY = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, SWEEP_RANGE] });

  return (
    <View style={analyzeStyles.container}>
      {/* The photo being analyzed */}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={1} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0b0f10' }]} />
      )}
      {/* Dim + vignette so the beam and card read clearly */}
      <LinearGradient
        colors={['rgba(6,10,11,0.72)', 'rgba(6,10,11,0.35)', 'rgba(6,10,11,0.88)']}
        style={StyleSheet.absoluteFill}
      />

      {/* Scanning beam */}
      <View style={analyzeStyles.sweepArea} pointerEvents="none">
        <Animated.View style={[analyzeStyles.beam, { transform: [{ translateY }] }]}>
          <LinearGradient
            colors={['rgba(0,227,253,0)', 'rgba(0,227,253,0.30)']}
            style={analyzeStyles.beamTrail}
          />
          <View style={analyzeStyles.beamLine} />
        </Animated.View>
        {/* Corner brackets to frame the "scan zone" */}
        <Animated.View style={[analyzeStyles.frame, { opacity: glow }]} pointerEvents="none">
          <View style={[analyzeStyles.fCorner, analyzeStyles.fTL]} />
          <View style={[analyzeStyles.fCorner, analyzeStyles.fTR]} />
          <View style={[analyzeStyles.fCorner, analyzeStyles.fBL]} />
          <View style={[analyzeStyles.fCorner, analyzeStyles.fBR]} />
        </Animated.View>
      </View>

      {/* Step checklist */}
      <View style={analyzeStyles.card}>
        {STEPS.map((step, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <View key={step.text} style={[analyzeStyles.stepRow, !done && !active && { opacity: 0.35 }]}>
              <View style={[analyzeStyles.stepIcon, done && analyzeStyles.stepIconDone, active && analyzeStyles.stepIconActive]}>
                {done ? (
                  <Ionicons name="checkmark" size={15} color="#00363a" />
                ) : active ? (
                  <ActivityIndicator animating size={13} color="#00e3fd" />
                ) : (
                  <Ionicons name={step.icon} size={14} color="rgba(255,255,255,0.6)" />
                )}
              </View>
              <Text style={[analyzeStyles.stepText, done && { color: 'rgba(255,255,255,0.55)' }, active && { color: '#fff' }]}>
                {step.text}
              </Text>
            </View>
          );
        })}
        <Text style={analyzeStyles.subText}>Hang tight — this takes a few seconds</Text>
      </View>
    </View>
  );
}

const analyzeStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'flex-end',
  },
  sweepArea: {
    position: 'absolute',
    top: SCREEN_H * 0.12,
    left: 24,
    right: 24,
    height: SWEEP_RANGE + 40,
  },
  beam: { position: 'absolute', left: 0, right: 0, top: 0 },
  beamTrail: { height: 64, borderRadius: 2 },
  beamLine: {
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#00e3fd',
    shadowColor: '#00e3fd',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 8,
  },
  frame: { ...StyleSheet.absoluteFillObject },
  fCorner: { position: 'absolute', width: 30, height: 30, borderColor: 'rgba(133,211,218,0.9)', borderWidth: 3 },
  fTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 18 },
  fTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 18 },
  fBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 18 },
  fBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 18 },

  card: {
    marginHorizontal: 20,
    marginBottom: 48,
    backgroundColor: 'rgba(13,20,21,0.92)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(133,211,218,0.18)',
    paddingVertical: 20,
    paddingHorizontal: 22,
    gap: 14,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconDone: { backgroundColor: '#85d3da', borderColor: '#85d3da' },
  stepIconActive: { borderColor: 'rgba(0,227,253,0.55)', backgroundColor: 'rgba(0,227,253,0.10)' },
  stepText: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 14.5, fontWeight: '600', letterSpacing: 0.2 },
  subText: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
});

// ─────────────────────────────────────────────────────────────────────────────

type ScanMode = 'meal' | 'label';

export function ScanScreen({ navigation }: Props) {
  const { session } = useAuthStore();
  const { canScan, scansRemaining, isSubscribed, paywallVisible, showPaywall, dismissPaywall, consumeScan } = useSubscriptionGate();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [scanMode, setScanMode] = useState<ScanMode>('meal');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [showDescModal, setShowDescModal] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = async () => {
    if (!canScan) { showPaywall(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
    if (photo?.uri) {
      if (scanMode === 'label') {
        // Labels don't need a description — straight to analysis.
        setPendingUri(photo.uri);
        processLabelPhoto(photo.uri);
      } else {
        setPendingUri(photo.uri);
        setDescription('');
        setShowDescModal(true);
      }
    }
  };

  const handlePickFromLibrary = async () => {
    if (!canScan) { showPaywall(); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      if (scanMode === 'label') {
        setPendingUri(result.assets[0].uri);
        processLabelPhoto(result.assets[0].uri);
      } else {
        setPendingUri(result.assets[0].uri);
        setDescription('');
        setShowDescModal(true);
      }
    }
  };

  /** Compress, upload to Supabase Storage, and return local + signed URLs. */
  const uploadAndSign = async (rawUri: string): Promise<{ compressedUri: string; signedUrl: string }> => {
    // Compress to max 1024px before uploading
    const compressed = await ImageManipulator.manipulateAsync(
      rawUri,
      [{ resize: { width: 1024 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

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

    return { compressedUri: compressed.uri, signedUrl: signedData.signedUrl };
  };

  const handleScanError = (err: any) => {
    if (err?.statusCode === 402 || err?.code === 'scan_limit_reached') {
      // Free user out of daily scans — nudge to Pro.
      showPaywall();
    } else if (err?.statusCode === 429 || err?.code === 'daily_limit_reached') {
      // Pro/trial hit the fair-use ceiling — no paywall, just let them know.
      Alert.alert("Daily limit reached", err.message ?? "You've reached today's scan limit. It resets tomorrow.");
    } else {
      Alert.alert('Analysis failed', err.message ?? 'Please try again with a clearer photo.');
    }
  };

  const processPhoto = async (rawUri: string, userDescription: string) => {
    setShowDescModal(false);
    setIsAnalyzing(true);
    try {
      const { compressedUri, signedUrl } = await uploadAndSign(rawUri);

      // Call backend (server enforces scan count gate)
      const { result } = await analyzeFood(signedUrl, session!.access_token, userDescription || undefined);

      // Optimistically decrement the local "scans left" badge (server is authoritative).
      consumeScan();

      navigation.navigate('ScanResult', {
        imageUri: compressedUri,
        imageStorageUrl: signedUrl,
        result,
      });
    } catch (err: any) {
      handleScanError(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const processLabelPhoto = async (rawUri: string) => {
    setIsAnalyzing(true);
    try {
      const { compressedUri, signedUrl } = await uploadAndSign(rawUri);
      const { result } = await analyzeLabel(signedUrl, session!.access_token);
      consumeScan();

      navigation.navigate('LabelResult', {
        imageUri: compressedUri,
        imageStorageUrl: signedUrl,
        result,
      });
    } catch (err: any) {
      handleScanError(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.permissionRoot}>
        <SafeAreaView style={styles.permissionContainer} edges={['top', 'bottom']}>
          {/* Close */}
          <TouchableOpacity
            style={styles.permissionClose}
            onPress={() => navigation.getParent()?.navigate('Home')}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#bec8c9" />
          </TouchableOpacity>

          <View style={styles.permissionContent}>
            <View style={styles.permissionIconWrap}>
              <Ionicons name="camera-outline" size={44} color="#85d3da" />
            </View>

            <Text style={styles.permissionTitle}>Camera access needed</Text>
            <Text style={styles.permissionText}>
              CalSnap uses your camera to scan meals and packaged-food labels. Photos are only used
              to analyze nutrition.
            </Text>

            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.88}>
              <Ionicons name="lock-open-outline" size={18} color="#00363a" />
              <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePickFromLibrary} activeOpacity={0.7} style={styles.permissionSecondary}>
              <Text style={styles.permissionSecondaryText}>Pick from gallery instead</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={cameraType} />

      {/* Full-screen analyzing overlay — scans over the photo just taken */}
      {isAnalyzing && <AnalyzingOverlay imageUri={pendingUri} />}

      {/* Overlay UI */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.glassBtn}
            disabled={isAnalyzing}
            onPress={() => navigation.getParent()?.navigate('Home')}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleBadge}>
            <Text style={styles.titleBadgeText}>AI Scanner</Text>
          </View>
          <TouchableOpacity
            style={styles.glassBtn}
            onPress={() =>
              Alert.alert(
                'How to scan',
                'Point your camera at a plate of food and tap the shutter, or pick a photo from your gallery. Add an optional description to help the AI with hidden ingredients.',
              )
            }
          >
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
            <Text style={styles.hint}>
              {scanMode === 'label' ? 'Point at the nutrition label' : 'Point at your food'}
            </Text>
          </View>

          {/* Mode toggle: Meal | Label */}
          <View style={styles.modeToggle}>
            {(['meal', 'label'] as const).map((mode) => {
              const active = scanMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modePill, active && styles.modePillActive]}
                  onPress={() => {
                    if (!active) Haptics.selectionAsync();
                    setScanMode(mode);
                  }}
                  disabled={isAnalyzing}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={mode === 'meal' ? 'restaurant-outline' : 'barcode-outline'}
                    size={14}
                    color={active ? '#00363a' : 'rgba(255,255,255,0.75)'}
                  />
                  <Text style={[styles.modePillText, active && styles.modePillTextActive]}>
                    {mode === 'meal' ? 'MEAL' : 'LABEL'}
                  </Text>
                </TouchableOpacity>
              );
            })}
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

      {/* Description modal — shown after photo is taken, before analysis */}
      <Modal visible={showDescModal} transparent animationType="slide" onRequestClose={() => setShowDescModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={descStyles.backdrop}>
          <View style={descStyles.sheet}>
            <Text style={descStyles.title}>Anything to add?</Text>
            <Text style={descStyles.subtitle}>
              Help AI understand hidden ingredients (e.g. "peanut butter between two slices of bread")
            </Text>
            <TextInput
              style={descStyles.input}
              placeholder="e.g. 2 rotis with dal, extra ghee on top…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={300}
              autoFocus
            />
            <View style={descStyles.row}>
              <TouchableOpacity
                style={descStyles.skipBtn}
                onPress={() => processPhoto(pendingUri!, '')}
              >
                <Text style={descStyles.skipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={descStyles.analyzeBtn}
                onPress={() => processPhoto(pendingUri!, description)}
              >
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={descStyles.analyzeText}>Analyze</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionRoot: { flex: 1, backgroundColor: '#101415' },
  permissionContainer: { flex: 1, paddingHorizontal: 28 },
  permissionClose: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    marginTop: 8,
  },
  permissionContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingBottom: 60 },
  permissionIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(1,105,111,0.20)',
    borderWidth: 1, borderColor: 'rgba(133,211,218,0.35)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  permissionTitle: { color: '#e0e3e5', fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  permissionText: { color: '#bec8c9', fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
  permissionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 54, borderRadius: 14, backgroundColor: '#85d3da',
    alignSelf: 'stretch', marginTop: 12,
  },
  permissionButtonText: { color: '#00363a', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  permissionSecondary: { paddingVertical: 8 },
  permissionSecondaryText: { color: '#85d3da', fontSize: 14, fontWeight: '600' },
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

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 50,
  },
  modePillActive: { backgroundColor: '#85d3da' },
  modePillText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  modePillTextActive: { color: '#00363a' },

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

const descStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0d2b2d',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
    borderTopWidth: 1,
    borderColor: 'rgba(77,208,216,0.2)',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(77,208,216,0.3)',
    color: '#fff',
    fontSize: 15,
    padding: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  skipText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    fontSize: 15,
  },
  analyzeBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#01696f',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  analyzeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});
