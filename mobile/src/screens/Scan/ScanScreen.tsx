import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Animated,
  Easing,
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
import { useFocusEffect } from '@react-navigation/native';
import { ScanStackParamList, type ScanMode } from '../../navigation/ScanNavigator';
import { supabase } from '../../services/supabase';
import { analyzeFood, analyzeLabel, analyzeText, lookupBarcode } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { PaywallModal } from '../Paywall/PaywallModal';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { VoiceModePanel } from '../../components/VoiceModePanel';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { T } from '../../theme';

type Props = {
  navigation: NativeStackNavigationProp<ScanStackParamList, 'ScanCamera'>;
  route: { params?: { mode?: ScanMode } };
};

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
        <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} />
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
            colors={['rgba(133,211,218,0)', 'rgba(133,211,218,0.30)']}
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
                  <Ionicons name="checkmark" size={15} color={T.textOnPrimary} />
                ) : active ? (
                  <ActivityIndicator animating size={13} color={T.primary} />
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
    backgroundColor: T.primary,
    shadowColor: T.primary,
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
    backgroundColor: T.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 20,
    paddingHorizontal: 22,
    gap: 14,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.divider,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconDone: { backgroundColor: T.primary, borderColor: T.primary },
  stepIconActive: { borderColor: T.primary, backgroundColor: T.primaryTint },
  stepText: { flex: 1, color: T.textSecondary, fontSize: 14.5, fontWeight: '600', letterSpacing: 0.2 },
  subText: {
    color: T.textSecondary,
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
});

// ─────────────────────────────────────────────────────────────────────────────

export function ScanScreen({ navigation, route }: Props) {
  const { session } = useAuthStore();
  const { canScan, scansRemaining, isSubscribed, paywallVisible, showPaywall, dismissPaywall, consumeScan } = useSubscriptionGate();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const requestedMode = route.params?.mode ?? 'meal';
  const [scanMode, setScanMode] = useState<ScanMode>(requestedMode);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [voiceAnalyzing, setVoiceAnalyzing] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  // Latch so the live barcode scanner fires the lookup once, not on every frame.
  const barcodeLock = useRef(false);

  // The Scan tab stays mounted, so a previous session's photo / transcript would
  // still be on screen when the user comes back. Reset to a clean state each
  // time the tab regains focus, in whichever mode the log hub asked for —
  // re-mounting the voice panel is also what clears its transcript.
  useFocusEffect(
    React.useCallback(() => {
      setPendingUri(null);
      setScanMode(requestedMode);
      setVoiceListening(false);
      setVoiceAnalyzing(false);
      barcodeLock.current = false;
    }, [requestedMode]),
  );

  // Same nested-stack situation as Find a food: ScanCamera is the first route
  // of ScanNavigator, so the press has nothing to pop locally and would
  // otherwise close the app. Don't allow leaving mid-analysis.
  useAndroidBack(
    React.useCallback(() => {
      if (isAnalyzing) return true;
      navigation.getParent()?.goBack();
      return true;
    }, [isAnalyzing, navigation]),
  );

  const handleBarcode = async (code: string) => {
    if (barcodeLock.current) return;
    barcodeLock.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsAnalyzing(true);
    try {
      const { result, image_url } = await lookupBarcode(code, session!.access_token);
      const img = image_url ?? '';
      // Reuse the label result screen — same shape, same log path (no scan used).
      navigation.navigate('LabelResult', { imageUri: img, imageStorageUrl: img, result });
    } catch (err: any) {
      const notFound = err?.statusCode === 404;
      Alert.alert(
        notFound ? 'Product not found' : 'Lookup failed',
        notFound
          ? "This barcode isn't in the database yet. Try scanning the nutrition label instead."
          : err?.message ?? 'Please try again.',
        [{ text: 'OK', onPress: () => { barcodeLock.current = false; } }],
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCapture = async () => {
    if (!canScan) { showPaywall(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
    if (photo?.uri) {
      setPendingUri(photo.uri);
      // Straight to analysis — items are corrected on the result screen, which
      // is more direct than guessing what to describe before seeing the result.
      if (scanMode === 'label') processLabelPhoto(photo.uri);
      else processPhoto(photo.uri);
    }
  };

  const handlePickFromLibrary = async () => {
    if (!canScan) { showPaywall(); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPendingUri(uri);
      if (scanMode === 'label') processLabelPhoto(uri);
      else processPhoto(uri);
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

  const processPhoto = async (rawUri: string) => {
    setIsAnalyzing(true);
    try {
      const { compressedUri, signedUrl } = await uploadAndSign(rawUri);

      // Call backend (server enforces scan count gate)
      const { result } = await analyzeFood(signedUrl, session!.access_token);

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

  /** Log by description — no image, so no upload; straight to the text endpoint. */
  const processVoiceText = async (text: string) => {
    setVoiceAnalyzing(true);
    try {
      const { result } = await analyzeText(text, session!.access_token);
      consumeScan();
      navigation.navigate('ScanResult', {
        // No photo for a spoken log — the result screen handles a missing image.
        imageUri: '',
        imageStorageUrl: '',
        result,
      });
    } catch (err: any) {
      handleScanError(err);
    } finally {
      setVoiceAnalyzing(false);
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
            onPress={() => navigation.getParent()?.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={T.textSecondary} />
          </TouchableOpacity>

          <View style={styles.permissionContent}>
            <View style={styles.permissionIconWrap}>
              <Ionicons name="camera-outline" size={44} color={T.primary} />
            </View>

            <Text style={styles.permissionTitle}>Camera access needed</Text>
            <Text style={styles.permissionText}>
              CalSnap uses your camera to scan meals and packaged-food labels. Photos are only used
              to analyze nutrition.
            </Text>

            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.88}>
              <Ionicons name="lock-open-outline" size={18} color={T.textOnPrimary} />
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
      {/* Camera is unmounted in VOICE mode — no torch, no battery drain. */}
      {scanMode === 'voice' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} />
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={cameraType}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          // Live scanning only in barcode mode, and only until one is captured.
          onBarcodeScanned={
            scanMode === 'barcode' && !isAnalyzing ? (r) => handleBarcode(r.data) : undefined
          }
        />
      )}

      {/* Full-screen analyzing overlay — scans over the photo just taken */}
      {isAnalyzing && <AnalyzingOverlay imageUri={pendingUri} />}

      {/* Overlay UI */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.glassBtn}
            disabled={isAnalyzing}
            onPress={() => navigation.getParent()?.goBack()}
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
                'Point your camera at a plate of food and tap the shutter, or pick a photo from your gallery. After scanning you can edit each item, fix quantities, or add anything we missed.',
              )
            }
          >
            <Ionicons name="help-circle-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Scan counter badge for free users. Barcode is free, so no counter. */}
          {!isSubscribed && scanMode !== 'barcode' && (
            <TouchableOpacity onPress={showPaywall} style={styles.scanCountBadge}>
              <Text style={styles.scanCountText}>{scansRemaining} scan{scansRemaining !== 1 ? 's' : ''} left today</Text>
            </TouchableOpacity>
          )}

          {/* Viewfinder (camera modes) or the voice panel */}
        {scanMode === 'voice' ? (
          <View style={styles.viewfinderWrap}>
            <VoiceModePanel
              onSubmit={processVoiceText}
              analyzing={voiceAnalyzing}
              onListeningChange={setVoiceListening}
            />
          </View>
        ) : (
        <View style={styles.viewfinderWrap}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.hintWrap}>
            <Text style={styles.hint}>
              {scanMode === 'label'
                ? 'Point at the nutrition label'
                : scanMode === 'barcode'
                  ? 'Point at the barcode'
                  : 'Point at your food'}
            </Text>
          </View>
          {scanMode === 'barcode' && (
            <Text style={styles.barcodeSub}>Holds still? It scans automatically — no scan used.</Text>
          )}
        </View>
        )}

        {/* Mode toggle — outside the viewfinder branch so VOICE can be exited.
            Hidden while listening to keep focus on the transcript. */}
        {!voiceListening && (
          <View style={styles.modeToggleWrap}>
          <View style={styles.modeToggle}>
            {([
              { mode: 'meal',    icon: 'restaurant-outline',    label: 'MEAL' },
              { mode: 'barcode', icon: 'barcode-outline',       label: 'BARCODE' },
              { mode: 'label',   icon: 'document-text-outline', label: 'LABEL' },
              { mode: 'voice',   icon: 'mic-outline',           label: 'VOICE' },
            ] as const).map(({ mode, icon, label }) => {
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
                  <Ionicons name={icon} size={14} color={active ? T.textOnPrimary : T.textSecondary} />
                  <Text style={[styles.modePillText, active && styles.modePillTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          </View>
        )}

        {/* Bottom controls — photo modes only. Barcode auto-detects; voice has
            its own panel. */}
        {scanMode !== 'voice' && scanMode !== 'barcode' && (
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
        )}
      </SafeAreaView>


      <PaywallModal visible={paywallVisible} onDismiss={dismissPaywall} />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionRoot: { flex: 1, backgroundColor: T.bg },
  permissionContainer: { flex: 1, paddingHorizontal: 28 },
  permissionClose: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.divider,
    borderWidth: 1, borderColor: T.border,
    marginTop: 8,
  },
  permissionContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingBottom: 60 },
  permissionIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: T.primaryTint,
    borderWidth: 1, borderColor: 'rgba(133,211,218,0.35)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  permissionTitle: { color: T.textPrimary, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  permissionText: { color: T.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
  permissionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 54, borderRadius: 14, backgroundColor: T.primary,
    alignSelf: 'stretch', marginTop: 12,
  },
  permissionButtonText: { color: T.textOnPrimary, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  permissionSecondary: { paddingVertical: 8 },
  permissionSecondaryText: { color: T.primary, fontSize: 14, fontWeight: '600' },
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
    backgroundColor: T.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  titleBadge: {
    backgroundColor: T.scrim,
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
    // No border here on purpose — the four corner brackets ARE the frame. A
    // full outline boxed in the whole camera view and fought with the subject.
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: T.primary,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 40 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 40 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 40 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 40 },
  hintWrap: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 50,
  },
  hint: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modeToggleWrap: { alignItems: 'center', paddingBottom: 12, paddingHorizontal: 12 },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    padding: 4,
    gap: 2,
    borderWidth: 1,
    borderColor: T.border,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 50,
  },
  modePillActive: { backgroundColor: T.primary },
  modePillText: { color: T.textSecondary, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  modePillTextActive: { color: T.textOnPrimary },
  barcodeSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },

  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  sideButton: { alignItems: 'center', gap: 6 },
  proDot: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center',
  },
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

