import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
  IOSOutputFormat,
  AudioQuality,
  type RecordingOptions,
} from 'expo-audio';
import { T, type, spacing, radius, HIT_TARGET, tabularNums } from '../theme';

interface Props {
  /** Called with the typed description when the user submits the text field. */
  onSubmit: (text: string) => void;
  /** Called with the recorded clip's file uri, mime type and length when the user analyses it. */
  onSubmitAudio: (uri: string, mimeType: string, durationMs: number) => void;
  /** True while the backend is interpreting the description / recording. */
  analyzing: boolean;
  /** Lets the parent swap the mode toggle for a Cancel while recording. */
  onListeningChange?: (recording: boolean) => void;
}

/** Imperative surface so the screen's Cancel can stop a recording in progress. */
export interface VoiceModePanelHandle {
  cancelRecording: () => void;
}

// Localised examples. A generic "a sandwich" teaches the wrong mental model.
const EXAMPLES = [
  'Two rotis, a bowl of dal and some curd',
  'Masala dosa with sambar, medium size',
];

const MAX_RECORD_MS = 30_000; // hard cap: a spoken log is a sentence, not a monologue
const MIN_RECORD_MS = 600;    // below this there's nothing to transcribe
const BARS = 24;

/**
 * Recording format, chosen per platform so the bytes land in a container Gemini
 * accepts natively (AAC on Android, WAV on iOS): no transcoding, no on-device
 * speech engine. Speech only needs 16 kHz mono, which keeps the upload small.
 */
const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  extension: Platform.OS === 'ios' ? '.wav' : '.aac',
  sampleRate: 16_000,
  numberOfChannels: 1,
  bitRate: 64_000,
  android: { extension: '.aac', outputFormat: 'aac_adts', audioEncoder: 'aac' },
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

/** Matches the container recorded above; sent to the backend with the bytes. */
export const VOICE_MIME = Platform.OS === 'ios' ? 'audio/wav' : 'audio/aac';

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Describe mode: the "I forgot to photograph it" path, by voice or by typing.
 *
 * Voice records a short clip and hands it to the backend, which sends the audio
 * straight to Gemini for transcription + interpretation. The result is the same
 * payload the photo path produces, so ScanResultScreen renders it unchanged.
 */
export const VoiceModePanel = forwardRef<VoiceModePanelHandle, Props>(function VoiceModePanel(
  { onSubmit, onSubmitAudio, analyzing, onListeningChange },
  ref,
) {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const state = useAudioRecorderState(recorder, 100);

  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedMs, setRecordedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.08));

  // Typing is the same intent as speaking (describe the meal), routed through
  // the same analyse path, so nothing downstream changes.
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');

  const stoppingRef = useRef(false);

  useEffect(() => { onListeningChange?.(state.isRecording); }, [state.isRecording, onListeningChange]);

  // Feed the live meter into a rolling waveform, and enforce the hard cap.
  useEffect(() => {
    if (!state.isRecording) return;
    const db = state.metering ?? -60;
    const level = Math.min(Math.max((db + 60) / 55, 0.05), 1);
    setLevels((prev) => [...prev.slice(1), level]);
    if (state.durationMillis >= MAX_RECORD_MS) void stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.metering, state.durationMillis, state.isRecording]);

  // Stop a recording still running if the panel unmounts (e.g. mode switch).
  useEffect(() => {
    return () => { if (recorder.isRecording) recorder.stop().catch(() => {}); };
  }, [recorder]);

  const startRecording = async () => {
    setError(null);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone access is needed to record. Turn it on in Settings.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      setLevels(Array(BARS).fill(0.08));
      setRecordedUri(null);
      await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      recorder.record();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.warn('[voice] start failed', err);
      setError('Could not start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const duration = state.durationMillis;
    const tooShort = duration < MIN_RECORD_MS;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await recorder.stop();
      const uri = recorder.uri;
      if (tooShort) {
        setError('That was too short. Hold on a moment longer.');
      } else if (uri) {
        setRecordedMs(duration);
        setRecordedUri(uri);
      } else {
        setError('Recording failed. Please try again.');
      }
    } catch (err) {
      console.warn('[voice] stop failed', err);
      setError('Could not finish the recording. Please try again.');
    } finally {
      stoppingRef.current = false;
    }
  };

  /** Stop and throw the clip away: back to the idle prompt. */
  const cancelRecording = async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {
      // Nothing to keep either way.
    } finally {
      stoppingRef.current = false;
      setRecordedUri(null);
      setError(null);
    }
  };

  useImperativeHandle(ref, () => ({ cancelRecording: () => { void cancelRecording(); } }));

  const submitTyped = () => {
    const t = typed.trim();
    if (t.length < 3) return;
    Keyboard.dismiss();
    onSubmit(t);
  };

  // ── Type it ──────────────────────────────────────────────────────────────
  if (typing) {
    const canSubmit = typed.trim().length >= 3 && !analyzing;
    return (
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.introIcon}>
          <Ionicons name="create-outline" size={28} color={T.primary} />
        </View>
        <Text style={styles.introTitle}>Type what you ate</Text>
        <Text style={styles.introSub}>List the items with rough quantities.</Text>

        <TextInput
          style={styles.textInput}
          value={typed}
          onChangeText={setTyped}
          placeholder="e.g. 2 rotis, a bowl of dal and some curd"
          placeholderTextColor={T.textMuted}
          multiline
          autoFocus
          editable={!analyzing}
          maxLength={280}
          accessibilityLabel="What you ate"
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.reviewActions}>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { Keyboard.dismiss(); setTyping(false); setError(null); }}
            disabled={analyzing}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Speak instead"
          >
            <Ionicons name="mic-outline" size={16} color={T.textSecondary} />
            <Text style={styles.retryText}>Speak</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, !canSubmit && styles.dimmed]}
            onPress={submitTyped}
            disabled={!canSubmit}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {analyzing
              ? <ActivityIndicator animating size={16} color={T.textOnPrimary} />
              : <Ionicons name="sparkles" size={16} color={T.textOnPrimary} />}
            <Text style={styles.confirmText}>{analyzing ? 'Analysing…' : 'Analyse'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Recording ──────────────────────────────────────────────────────────────
  if (state.isRecording) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.stateLabel}>Recording</Text>

        <View style={styles.waveRow}>
          {levels.map((lv, i) => (
            <View key={i} style={[styles.bar, { height: 6 + lv * 50, opacity: 0.4 + lv * 0.6 }]} />
          ))}
        </View>

        <Text style={styles.timer}>{formatDuration(state.durationMillis)}</Text>

        <TouchableOpacity
          style={styles.stopBtn}
          onPress={stopRecording}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Stop recording"
        >
          <Ionicons name="stop" size={26} color={T.textOnPrimary} />
        </TouchableOpacity>
        <Text style={styles.helper}>Tap when you're done · up to 30 seconds</Text>
      </View>
    );
  }

  // ── Review a finished recording ──────────────────────────────────────────────
  if (recordedUri) {
    return (
      <View style={styles.wrap}>
        <View style={styles.introIcon}>
          <Ionicons name="checkmark-circle" size={30} color={T.primary} />
        </View>
        <Text style={styles.introTitle}>Recorded {formatDuration(recordedMs)}</Text>
        <Text style={styles.introSub}>Analyse it, or record again if you missed something.</Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.reviewActions}>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setRecordedUri(null); setError(null); startRecording(); }}
            disabled={analyzing}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Record again"
          >
            <Ionicons name="refresh" size={16} color={T.textSecondary} />
            <Text style={styles.retryText}>Redo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, analyzing && styles.dimmed]}
            onPress={() => onSubmitAudio(recordedUri, VOICE_MIME, recordedMs)}
            disabled={analyzing}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {analyzing
              ? <ActivityIndicator animating size={16} color={T.textOnPrimary} />
              : <Ionicons name="sparkles" size={16} color={T.textOnPrimary} />}
            <Text style={styles.confirmText}>{analyzing ? 'Analysing…' : 'Analyse'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Idle / intro ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.wrap}>
      <View style={styles.introIcon}>
        <Ionicons name="mic" size={30} color={T.primary} />
      </View>
      <Text style={styles.introTitle}>What did you eat?</Text>
      <Text style={styles.introSub}>Say it the way you'd tell a friend. Quantities help.</Text>

      <View style={styles.exampleBox}>
        <Text style={styles.exampleLabel}>For example</Text>
        {EXAMPLES.map((e) => (
          <Text key={e} style={styles.exampleText}>“{e}”</Text>
        ))}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={styles.micBtn}
        onPress={startRecording}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Start recording"
      >
        <Ionicons name="mic" size={30} color={T.textOnPrimary} />
      </TouchableOpacity>
      <Text style={styles.helper}>Tap to record</Text>

      <TouchableOpacity
        style={styles.typeInstead}
        onPress={() => { setError(null); setTyping(true); }}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <Ionicons name="create-outline" size={16} color={T.primary} />
        <Text style={styles.typeInsteadText}>Type it instead</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['2xl'] + 4, gap: spacing.md },

  stateLabel: { ...type.bodySm, fontWeight: '800', color: T.primary },

  introIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: T.primaryTint,
    borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs,
  },
  introTitle: { ...type.title, color: T.textPrimary, textAlign: 'center' },
  introSub: { ...type.body, color: T.textSecondary, textAlign: 'center' },

  exampleBox: {
    alignSelf: 'stretch', gap: spacing.xs + 2, marginTop: spacing.sm,
    backgroundColor: T.glass, borderRadius: radius.md,
    borderWidth: 1, borderColor: T.border, padding: spacing.lg,
  },
  exampleLabel: { ...type.label, color: T.textMuted, marginBottom: 2 },
  exampleText: { ...type.bodySm, color: T.textSecondary, fontStyle: 'italic' },

  waveRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 3, height: 60, marginVertical: spacing.xs,
  },
  bar: { width: 3, borderRadius: 2, backgroundColor: T.primary },
  timer: { ...type.headline, color: T.textPrimary, ...tabularNums },

  error: { ...type.bodySm, color: T.error, fontWeight: '600', textAlign: 'center' },

  micBtn: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
    shadowColor: T.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  stopBtn: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: T.error,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  helper: { ...type.bodySm, color: T.textMuted, fontWeight: '600' },

  textInput: {
    alignSelf: 'stretch', minHeight: 100, maxHeight: 168,
    backgroundColor: T.glass, borderRadius: radius.md,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg - 2, paddingBottom: spacing.lg - 2,
    fontSize: 16, lineHeight: 22, color: T.textPrimary,
    textAlignVertical: 'top',
  },
  typeInstead: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2,
    minHeight: HIT_TARGET,
    marginTop: spacing.xs + 2, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg - 2,
  },
  typeInsteadText: { ...type.body, fontWeight: '700', color: T.primary },

  reviewActions: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch', marginTop: spacing.sm },
  retryBtn: {
    flex: 1, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: T.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs + 2,
  },
  retryText: { ...type.body, fontWeight: '700', color: T.textSecondary },
  confirmBtn: {
    flex: 2, height: 52, borderRadius: radius.md, backgroundColor: T.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  confirmText: { ...type.body, fontWeight: '800', color: T.textOnPrimary },
  dimmed: { opacity: 0.6 },
});
