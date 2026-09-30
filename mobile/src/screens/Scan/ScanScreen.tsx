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
  Linking,
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
import { analyzeFood, analyzeLabel, analyzeText, analyzeVoice, lookupBarcode } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { PaywallModal } from '../Paywall/PaywallModal';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { VoiceModePanel, type VoiceModePanelHandle } from '../../components/VoiceModePanel';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { T, withAlpha, type, spacing, radius, HIT_TARGET } from '../../theme';

type Props = {
  navigation: NativeStackNavigationProp<ScanStackParamList, 'ScanCamera'>;
  route: { params?: { mode?: ScanMode } };
};

const SCREEN_H = Dimensions.get('window').height;
const SWEEP_RANGE = SCREEN_H * 0.52;

// ─── Copy ────────────────────────────────────────────────────────────────────

const ANALYZING_COPY: Record<ScanMode, string> = {
  meal: 'Analysing your meal. This usually takes 5 to 10 seconds.',
  label: 'Reading the label. This usually takes 5 to 10 seconds.',
  barcode: 'Looking up that barcode. This is usually quick.',
  voice: 'Working out what you had. This usually takes 5 to 10 seconds.',
};

const ERROR_TITLE: Record<ScanMode, string> = {
  meal: "Couldn't analyse that",
  label: "Couldn't read that label",
  barcode: "Couldn't find that product",
  voice: "Couldn't work that out",
};

const RETAKE_LABEL: Record<ScanMode, string> = {
  meal: 'Retake photo',
  label: 'Retake photo',
  barcode: 'Scan again',
  voice: 'Go back',
};

/**
 * Every failure maps to a fixed sentence. Raw error text never reaches the
 * screen; the detail goes to the console for debugging.
 */
function scanErrorCopy(err: any, mode: ScanMode): string {
  const code = err?.code;
  const status = err?.statusCode;
  if (code === 'timeout') return 'That took too long. Check your connection and try again.';
  if (code === 'network') return "Couldn't reach CalVue. Check your connection.";
  if (mode === 'barcode' && status === 404) {
    return "This barcode isn't in the database yet. Try scanning the nutrition label instead.";
  }
  if (status === 422) {
    if (mode === 'label') return "We couldn't read a nutrition label in that photo. Try a clearer shot.";
    if (mode === 'voice') return "We couldn't make out any food in that. Try describing it again.";
    return "We couldn't find food in that photo. Try a clearer shot.";
  }
  return 'Something went wrong analysing that. Try again.';
}

// ─── Analyzing overlay ───────────────────────────────────────────────────────
// The user's photo with a beam sweeping over it, one honest status line and a
// way out. No fake progress: the line stays the same until the request ends.

function AnalyzingOverlay({
  imageUri, message, onCancel,
}: { imageUri: string | null; message: string; onCancel: () => void }) {
  const sweep = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const loopB = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.6, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loopA.start();
    loopB.start();
    return () => { loopA.stop(); loopB.stop(); };
  }, [sweep, glow]);

  const translateY = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, SWEEP_RANGE] });

  return (
    <View style={overlayStyles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={1} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} />
      )}
      <LinearGradient
        colors={[withAlpha(T.bg, 0.72), withAlpha(T.bg, 0.35), withAlpha(T.bg, 0.88)]}
        style={StyleSheet.absoluteFill}
      />

      {imageUri && (
        <View style={overlayStyles.sweepArea} pointerEvents="none">
          <Animated.View style={[overlayStyles.beam, { transform: [{ translateY }] }]}>
            <LinearGradient
              colors={[withAlpha(T.primary, 0), withAlpha(T.primary, 0.3)]}
              style={overlayStyles.beamTrail}
            />
            <View style={overlayStyles.beamLine} />
          </Animated.View>
          <Animated.View style={[overlayStyles.frame, { opacity: glow }]} pointerEvents="none">
            <View style={[overlayStyles.fCorner, overlayStyles.fTL]} />
            <View style={[overlayStyles.fCorner, overlayStyles.fTR]} />
            <View style={[overlayStyles.fCorner, overlayStyles.fBL]} />
            <View style={[overlayStyles.fCorner, overlayStyles.fBR]} />
          </Animated.View>
        </View>
      )}

      <View style={overlayStyles.card}>
        <View style={overlayStyles.statusRow}>
          <ActivityIndicator animating size={20} color={T.primary} />
          <Text style={overlayStyles.statusText} accessibilityLiveRegion="polite">{message}</Text>
        </View>
        <TouchableOpacity
          style={overlayStyles.cancelBtn}
          onPress={onCancel}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Cancel analysis"
        >
          <Text style={overlayStyles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Shown when a scan fails (slow network / timeout / server error) instead of
 * silently dropping the capture. The photo or recording is kept, so Retry
 * re-runs the analysis and nothing is lost to a bad connection.
 */
function ScanErrorOverlay({
  imageUri, title, message, retakeLabel, onRetry, onRetake,
}: {
  imageUri: string | null;
  title: string;
  message: string;
  retakeLabel: string;
  onRetry: () => void;
  onRetake: () => void;
}) {
  return (
    <View style={overlayStyles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={3} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} />
      )}
      <LinearGradient
        colors={[withAlpha(T.bg, 0.85), withAlpha(T.bg, 0.7), withAlpha(T.bg, 0.92)]}
        style={StyleSheet.absoluteFill}
      />
      <View style={errorStyles.card}>
        <View style={errorStyles.iconWrap}>
          <Ionicons name="cloud-offline-outline" size={30} color={T.warning} />
        </View>
        <Text style={errorStyles.title}>{title}</Text>
        <Text style={errorStyles.message}>{message}</Text>
        <TouchableOpacity style={errorStyles.retryBtn} onPress={onRetry} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="refresh" size={18} color={T.textOnPrimary} />
          <Text style={errorStyles.retryText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={errorStyles.retakeBtn} onPress={onRetake} activeOpacity={0.8} accessibilityRole="button">
          <Text style={errorStyles.retakeText}>{retakeLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  card: {
    position: 'absolute', left: spacing['2xl'] + 4, right: spacing['2xl'] + 4, top: '50%',
    transform: [{ translateY: -160 }],
    backgroundColor: T.surface, borderRadius: radius.lg, padding: spacing['2xl'],
    borderWidth: 1, borderColor: T.border, alignItems: 'center', gap: spacing.sm + 2,
  },
  iconWrap: {
    width: 60, height: 60, borderRadius: 30, marginBottom: spacing.xs,
    backgroundColor: T.warningTint, alignItems: 'center', justifyContent: 'center',
  },
  title: { ...type.titleSm, color: T.textPrimary, textAlign: 'center' },
  message: { ...type.body, color: T.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
  retryBtn: {
    alignSelf: 'stretch', height: 52, borderRadius: radius.md, backgroundColor: T.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  retryText: { ...type.body, fontWeight: '800', color: T.textOnPrimary },
  retakeBtn: { alignSelf: 'stretch', height: 48, alignItems: 'center', justifyContent: 'center' },
  retakeText: { ...type.body, fontWeight: '700', color: T.textSecondary },
});

/**
 * Reject if a promise takes too long, or as soon as `signal` aborts. Bounds
 * the image upload, which has no built-in timeout or abort of its own.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const fail = (code: 'timeout' | 'cancelled') => {
      const err = new Error(code);
      (err as any).code = code;
      reject(err);
    };
    const timer = setTimeout(() => fail('timeout'), ms);
    const onAbort = () => { clearTimeout(timer); fail('cancelled'); };
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener('abort', onAbort);
    const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); };
    promise.then(
      (v) => { done(); resolve(v); },
      (e) => { done(); reject(e); },
    );
  });
}

const UPLOAD_TIMEOUT_MS = 45_000;
/** After a cancelled barcode lookup, wait before the live scanner may fire again. */
const BARCODE_REARM_MS = 1_500;

const overlayStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'flex-end',
  },
  sweepArea: {
    position: 'absolute',
    top: SCREEN_H * 0.12,
    left: spacing['2xl'],
    right: spacing['2xl'],
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
  fCorner: { position: 'absolute', width: 30, height: 30, borderColor: withAlpha(T.primary, 0.9), borderWidth: 3 },
  fTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 18 },
  fTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 18 },
  fBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 18 },
  fBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 18 },

  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing['4xl'],
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusText: { flex: 1, ...type.body, color: T.textPrimary },
  cancelBtn: {
    alignSelf: 'stretch',
    minHeight: HIT_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { ...type.body, fontWeight: '700', color: T.textPrimary },
});

// ─────────────────────────────────────────────────────────────────────────────

interface ScanError {
  mode: ScanMode;
  message: string;
  /** Re-runs the same job with the same input. */
  retry: () => void;
}

export function ScanScreen({ navigation, route }: Props) {
  const { session } = useAuthStore();
  const { canScan, scansRemaining, isSubscribed, paywallVisible, showPaywall, dismissPaywall, consumeScan } = useSubscriptionGate();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [torch, setTorch] = useState(false);
  const requestedMode = route.params?.mode ?? 'meal';
  const [scanMode, setScanMode] = useState<ScanMode>(requestedMode);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingMode, setAnalyzingMode] = useState<ScanMode>('meal');
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [scanError, setScanError] = useState<ScanError | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const voiceRef = useRef<VoiceModePanelHandle>(null);
  // The in-flight request, so Cancel and hardware back can abort it.
  const abortRef = useRef<AbortController | null>(null);
  // Caches a successful upload for the current capture so a retry after a failed
  // *analysis* re-sends the URL, not the whole image again.
  const uploadedRef = useRef<{ rawUri: string; compressedUri: string; signedUrl: string } | null>(null);
  // Latch so the live barcode scanner fires the lookup once, not on every frame.
  const barcodeLock = useRef(false);
  const rearmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (rearmTimer.current) clearTimeout(rearmTimer.current);
  }, []);

  // The Scan tab stays mounted, so a previous session's photo / transcript would
  // still be on screen when the user comes back. Reset to a clean state each
  // time the tab regains focus, in whichever mode the log hub asked for.
  // Re-mounting the voice panel is also what clears its recording.
  useFocusEffect(
    React.useCallback(() => {
      setPendingUri(null);
      setScanError(null);
      uploadedRef.current = null;
      setScanMode(requestedMode);
      setVoiceListening(false);
      setIsAnalyzing(false);
      barcodeLock.current = false;
    }, [requestedMode]),
  );

  /** Abort the in-flight request and return to the camera. The capture is kept. */
  const cancelAnalysis = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsAnalyzing(false);
    // Re-arm the live barcode scanner after a pause, so a cancel doesn't
    // immediately re-fire on the same code still in frame.
    if (rearmTimer.current) clearTimeout(rearmTimer.current);
    rearmTimer.current = setTimeout(() => { barcodeLock.current = false; }, BARCODE_REARM_MS);
  }, []);

  const retakeScan = React.useCallback(() => {
    setScanError(null);
    setPendingUri(null);
    uploadedRef.current = null;
    barcodeLock.current = false;
  }, []);

  // Same nested-stack situation as Find a food: ScanCamera is the first route
  // of ScanNavigator, so the press has nothing to pop locally and would
  // otherwise close the app. Back while analysing means Cancel.
  useAndroidBack(
    React.useCallback(() => {
      if (isAnalyzing) { cancelAnalysis(); return true; }
      if (scanError) { retakeScan(); return true; }
      if (voiceListening) { voiceRef.current?.cancelRecording(); return true; }
      navigation.getParent()?.goBack();
      return true;
    }, [isAnalyzing, scanError, voiceListening, navigation, cancelAnalysis, retakeScan]),
  );

  /**
   * Runs one analysis job under a fresh AbortController with shared error
   * handling. Every mode goes through here, so timeouts, network failures and
   * cancellation behave identically whether it was a photo, label, barcode or
   * a recording.
   */
  const runAnalysis = async (
    mode: ScanMode,
    job: (signal: AbortSignal) => Promise<void>,
    retry: () => void,
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAnalyzingMode(mode);
    setIsAnalyzing(true);
    setScanError(null);
    try {
      await job(controller.signal);
    } catch (err: any) {
      if (controller.signal.aborted || err?.code === 'cancelled') return;
      if (err?.statusCode === 402 || err?.code === 'scan_limit_reached') {
        // Free user out of daily scans: nudge to Pro.
        showPaywall();
        return;
      }
      if (err?.statusCode === 429 || err?.code === 'daily_limit_reached') {
        // Pro/trial hit the fair-use ceiling: no paywall, just let them know.
        Alert.alert('Daily limit reached', "You've reached today's scan limit. It resets tomorrow.");
        return;
      }
      console.warn(`[scan:${mode}] failed`, err?.code ?? err?.statusCode ?? 'unknown', err?.message);
      // Recoverable: keep the capture so "Try again" is cheap and nothing is lost.
      setScanError({ mode, message: scanErrorCopy(err, mode), retry });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsAnalyzing(false);
      }
    }
  };

  /** Throws the shared "cancelled" error if the user backed out mid-job. */
  const assertActive = (signal: AbortSignal) => {
    if (signal.aborted) {
      const err = new Error('cancelled');
      (err as any).code = 'cancelled';
      throw err;
    }
  };

  const handleBarcode = (code: string) => {
    if (barcodeLock.current) return;
    barcodeLock.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    lookup(code);
  };

  const lookup = (code: string) => runAnalysis('barcode', async (signal) => {
    const { result, image_url } = await lookupBarcode(code, session!.access_token, signal);
    assertActive(signal);
    const img = image_url ?? '';
    // Reuse the label result screen: same shape, same log path (no scan used).
    navigation.navigate('LabelResult', { imageUri: img, imageStorageUrl: img, result });
  }, () => lookup(code));

  const handleCapture = async () => {
    if (!canScan) { showPaywall(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
    if (photo?.uri) {
      setPendingUri(photo.uri);
      // Straight to analysis. Items are corrected on the result screen, which
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

    // Read as base64: fetch(file://) fails on Android production builds
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

  /** Upload once per capture; a retry after a failed analysis reuses the URL. */
  const ensureUploaded = async (rawUri: string, signal: AbortSignal) => {
    let up = uploadedRef.current;
    if (!up || up.rawUri !== rawUri) {
      const { compressedUri, signedUrl } = await withTimeout(uploadAndSign(rawUri), UPLOAD_TIMEOUT_MS, signal);
      up = { rawUri, compressedUri, signedUrl };
      uploadedRef.current = up;
    }
    assertActive(signal);
    return up;
  };

  const processPhoto = (rawUri: string) => runAnalysis('meal', async (signal) => {
    const up = await ensureUploaded(rawUri, signal);
    // Call backend (server enforces scan count gate)
    const { result } = await analyzeFood(up.signedUrl, session!.access_token, undefined, signal);
    assertActive(signal);
    // Optimistically decrement the local "scans left" badge (server is authoritative).
    consumeScan();
    uploadedRef.current = null; // consumed; a fresh capture uploads again
    navigation.navigate('ScanResult', {
      imageUri: up.compressedUri,
      imageStorageUrl: up.signedUrl,
      result,
    });
  }, () => processPhoto(rawUri));

  const processLabelPhoto = (rawUri: string) => runAnalysis('label', async (signal) => {
    const up = await ensureUploaded(rawUri, signal);
    const { result } = await analyzeLabel(up.signedUrl, session!.access_token, signal);
    assertActive(signal);
    consumeScan();
    uploadedRef.current = null;
    navigation.navigate('LabelResult', {
      imageUri: up.compressedUri,
      imageStorageUrl: up.signedUrl,
      result,
    });
  }, () => processLabelPhoto(rawUri));

  /** Log by description: no image, so no upload; straight to the text endpoint. */
  const processVoiceText = (text: string) => runAnalysis('voice', async (signal) => {
    const { result } = await analyzeText(text, session!.access_token, signal);
    assertActive(signal);
    consumeScan();
    navigation.navigate('ScanResult', {
      // No photo for a described log; the result screen shows what was typed.
      imageUri: '',
      imageStorageUrl: '',
      result,
      voice: { source: 'typed', transcript: text },
    });
  }, () => processVoiceText(text));

  /** Log by voice: read the recorded clip and send the bytes to the backend. */
  const processVoiceAudio = (uri: string, mimeType: string, durationMs: number) =>
    runAnalysis('voice', async (signal) => {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      assertActive(signal);
      const { result } = await analyzeVoice(base64, mimeType, session!.access_token, signal);
      assertActive(signal);
      consumeScan();
      navigation.navigate('ScanResult', {
        imageUri: '',
        imageStorageUrl: '',
        result,
        // Only pass a transcript the API actually returned; never invent one.
        voice: { source: 'spoken', transcript: result.transcript || undefined, durationMs },
      });
    }, () => processVoiceAudio(uri, mimeType, durationMs));

  // ── Permission states ──────────────────────────────────────────────────────

  // Still resolving: a blank screen, not a flash of the denied state.
  if (!permission) {
    return <View style={styles.blank} />;
  }

  if (!permission.granted) {
    const canAsk = permission.canAskAgain;
    return (
      <View style={styles.permissionRoot}>
        <SafeAreaView style={styles.permissionContainer} edges={['top', 'bottom']}>
          <TouchableOpacity
            style={styles.permissionClose}
            onPress={() => navigation.getParent()?.goBack()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={T.textSecondary} />
          </TouchableOpacity>

          <View style={styles.permissionContent}>
            <View style={styles.permissionIconWrap}>
              <Ionicons name="camera-outline" size={44} color={T.primary} />
            </View>

            <Text style={styles.permissionTitle}>
              {canAsk ? 'Camera access needed' : 'Camera access is off'}
            </Text>
            <Text style={styles.permissionText}>
              {canAsk
                ? 'CalVue uses your camera to scan meals and packaged-food labels. Photos are only used to work out nutrition.'
                : 'Camera access for CalVue is turned off in your system settings. Turn it on there to scan meals and labels.'}
            </Text>

            {canAsk ? (
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestPermission}
                activeOpacity={0.88}
                accessibilityRole="button"
              >
                <Ionicons name="lock-open-outline" size={18} color={T.textOnPrimary} />
                <Text style={styles.permissionButtonText}>Allow camera access</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={() => { Linking.openSettings().catch(() => {}); }}
                activeOpacity={0.88}
                accessibilityRole="button"
              >
                <Ionicons name="settings-outline" size={18} color={T.textOnPrimary} />
                <Text style={styles.permissionButtonText}>Open Settings</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handlePickFromLibrary}
              activeOpacity={0.7}
              style={styles.permissionSecondary}
              accessibilityRole="button"
            >
              <Text style={styles.permissionSecondaryText}>Pick from gallery instead</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const controlsDisabled = isAnalyzing;

  return (
    <View style={styles.container}>
      {/* Camera is unmounted in voice mode: no torch, no battery drain. */}
      {scanMode === 'voice' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} />
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={cameraType}
          enableTorch={torch && cameraType === 'back'}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          // Live scanning only in barcode mode, and only until one is captured.
          onBarcodeScanned={
            scanMode === 'barcode' && !isAnalyzing && !scanError ? (r) => handleBarcode(r.data) : undefined
          }
        />
      )}

      {/* Full-screen analysing overlay over the photo just taken */}
      {isAnalyzing && (
        <AnalyzingOverlay
          imageUri={pendingUri}
          message={ANALYZING_COPY[analyzingMode]}
          onCancel={cancelAnalysis}
        />
      )}

      {!!scanError && !isAnalyzing && (
        <ScanErrorOverlay
          imageUri={pendingUri}
          title={ERROR_TITLE[scanError.mode]}
          message={scanError.message}
          retakeLabel={RETAKE_LABEL[scanError.mode]}
          onRetry={scanError.retry}
          onRetake={retakeScan}
        />
      )}

      {/* Overlay UI */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.glassBtn}
            disabled={controlsDisabled}
            onPress={() => navigation.getParent()?.goBack()}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <Ionicons name="close" size={22} color={T.onScrim} />
          </TouchableOpacity>

          {scanMode !== 'voice' && cameraType === 'back' ? (
            <TouchableOpacity
              style={[styles.glassBtn, torch && styles.glassBtnActive]}
              onPress={() => { Haptics.selectionAsync(); setTorch((t) => !t); }}
              disabled={controlsDisabled}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'}
              accessibilityState={{ selected: torch }}
            >
              <Ionicons name={torch ? 'flash' : 'flash-off'} size={20} color={torch ? T.textOnPrimary : T.onScrim} />
            </TouchableOpacity>
          ) : (
            <View style={styles.glassSpacer} />
          )}

          <TouchableOpacity
            style={styles.glassBtn}
            onPress={() =>
              Alert.alert(
                'How to scan',
                'Point your camera at a plate of food and tap the shutter, or pick a photo from your gallery. After scanning you can edit each item, fix quantities, or add anything we missed.',
              )
            }
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="How to scan"
          >
            <Ionicons name="help-circle-outline" size={22} color={T.onScrim} />
          </TouchableOpacity>
        </View>

        {/* Scan counter badge for free users. Barcode is free, so no counter. */}
        {!isSubscribed && scanMode !== 'barcode' && (
          <TouchableOpacity
            onPress={showPaywall}
            style={styles.scanCountBadge}
            accessibilityRole="button"
            accessibilityLabel={`${scansRemaining} scan${scansRemaining !== 1 ? 's' : ''} left today. See plans`}
          >
            <Text style={styles.scanCountText}>{scansRemaining} scan{scansRemaining !== 1 ? 's' : ''} left today</Text>
          </TouchableOpacity>
        )}

        {/* Viewfinder (camera modes) or the voice panel */}
        {scanMode === 'voice' ? (
          <View style={styles.viewfinderWrap}>
            <VoiceModePanel
              ref={voiceRef}
              onSubmit={processVoiceText}
              onSubmitAudio={processVoiceAudio}
              analyzing={isAnalyzing}
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
              <Text style={styles.barcodeSub}>Hold still, it reads on its own. Barcodes don't use a scan.</Text>
            )}
          </View>
        )}

        {/* Mode toggle, outside the viewfinder branch so voice can be exited.
            While recording it becomes a single Cancel, so there is always a way out. */}
        <View style={styles.modeToggleWrap}>
          {voiceListening ? (
            <TouchableOpacity
              style={styles.cancelPill}
              onPress={() => voiceRef.current?.cancelRecording()}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Cancel recording"
            >
              <Ionicons name="close" size={16} color={T.onScrim} />
              <Text style={styles.cancelPillText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.modeToggle}>
              {([
                { mode: 'meal',    icon: 'restaurant-outline',    label: 'Meal' },
                { mode: 'barcode', icon: 'barcode-outline',       label: 'Barcode' },
                { mode: 'label',   icon: 'document-text-outline', label: 'Label' },
                { mode: 'voice',   icon: 'mic-outline',           label: 'Voice' },
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
                    disabled={controlsDisabled}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} mode`}
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons name={icon} size={14} color={active ? T.textOnPrimary : T.textSecondary} />
                    <Text style={[styles.modePillText, active && styles.modePillTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Bottom controls, photo modes only. Barcode auto-detects; voice has
            its own panel. */}
        {scanMode !== 'voice' && scanMode !== 'barcode' && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              onPress={handlePickFromLibrary}
              style={styles.sideButton}
              disabled={controlsDisabled}
              accessibilityRole="button"
              accessibilityLabel="Pick a photo from your gallery"
            >
              <View style={styles.glassBtn}>
                <Ionicons name="images-outline" size={26} color={T.onScrim} />
              </View>
              <Text style={styles.sideLabel}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCapture}
              style={styles.captureButton}
              disabled={controlsDisabled}
              accessibilityRole="button"
              accessibilityLabel={scanMode === 'label' ? 'Take a photo of the label' : 'Take a photo of your meal'}
            >
              <View style={[styles.captureInner, controlsDisabled && styles.dimmed]} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCameraType(cameraType === 'back' ? 'front' : 'back')}
              style={styles.sideButton}
              disabled={controlsDisabled}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
            >
              <View style={styles.glassBtn}>
                <Ionicons name="camera-reverse-outline" size={26} color={T.onScrim} />
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
  container: { flex: 1, backgroundColor: T.bg },
  blank: { flex: 1, backgroundColor: T.bg },
  permissionRoot: { flex: 1, backgroundColor: T.bg },
  permissionContainer: { flex: 1, paddingHorizontal: spacing['2xl'] + 4 },
  permissionClose: {
    width: HIT_TARGET, height: HIT_TARGET, borderRadius: HIT_TARGET / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.divider,
    borderWidth: 1, borderColor: T.border,
    marginTop: spacing.sm,
  },
  permissionContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, paddingBottom: 60 },
  permissionIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: T.primaryTint,
    borderWidth: 1, borderColor: T.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  permissionTitle: { ...type.headline, fontSize: 24, lineHeight: 30, color: T.textPrimary, textAlign: 'center' },
  permissionText: { ...type.body, color: T.textSecondary, textAlign: 'center', paddingHorizontal: spacing.sm },
  permissionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm + 2,
    height: 54, borderRadius: radius.md, backgroundColor: T.primary,
    alignSelf: 'stretch', marginTop: spacing.md,
  },
  permissionButtonText: { ...type.body, fontWeight: '800', color: T.textOnPrimary },
  permissionSecondary: { minHeight: HIT_TARGET, justifyContent: 'center', paddingVertical: spacing.sm },
  permissionSecondaryText: { ...type.body, fontWeight: '600', color: T.primary },
  overlay: { flex: 1, justifyContent: 'space-between' },
  scanCountBadge: {
    alignSelf: 'center',
    backgroundColor: T.scrim,
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  scanCountText: { ...type.bodySm, fontWeight: '600', color: T.onScrim },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  glassBtn: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: HIT_TARGET / 2,
    backgroundColor: T.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.scrimBorder,
  },
  glassBtnActive: { backgroundColor: T.primary, borderColor: T.primary },
  glassSpacer: { width: HIT_TARGET, height: HIT_TARGET },

  viewfinderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing['2xl'] },
  viewfinder: {
    width: 280,
    height: 280,
    borderRadius: 40,
    // No border here on purpose: the four corner brackets ARE the frame. A
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
    backgroundColor: T.scrim,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  hint: { fontSize: 16, fontWeight: '700', color: T.onScrim },
  barcodeSub: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: T.onScrim,
    textAlign: 'center',
    paddingHorizontal: spacing['2xl'],
    marginTop: -spacing.sm,
  },

  modeToggleWrap: { alignItems: 'center', paddingBottom: spacing.md, paddingHorizontal: spacing.md },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: T.scrim,
    borderRadius: radius.pill,
    padding: spacing.xs,
    gap: 2,
    borderWidth: 1,
    borderColor: T.scrimBorder,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 1,
    minHeight: HIT_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  modePillActive: { backgroundColor: T.primary },
  modePillText: { ...type.bodySm, fontWeight: '700', color: T.textSecondary },
  modePillTextActive: { color: T.textOnPrimary },
  cancelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    minHeight: HIT_TARGET,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: T.scrim,
    borderWidth: 1,
    borderColor: T.scrimBorder,
  },
  cancelPillText: { ...type.body, fontWeight: '700', color: T.onScrim },

  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: spacing['3xl'],
    paddingHorizontal: spacing['2xl'],
  },
  sideButton: { alignItems: 'center', gap: spacing.xs + 2, minWidth: HIT_TARGET },
  sideLabel: { ...type.label, letterSpacing: 0.4, textTransform: 'none', color: T.onScrim },
  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: T.onScrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: T.onScrim },
  dimmed: { opacity: 0.4 },
});
