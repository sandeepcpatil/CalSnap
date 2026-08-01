import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing, ScrollView } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Voice, {
  type SpeechResultsEvent,
  type SpeechErrorEvent,
  type SpeechVolumeChangeEvent,
} from '@react-native-voice/voice';
import { T } from '../theme';

interface Props {
  /** Called with the transcript when the user confirms. */
  onSubmit: (text: string) => void;
  /** True while the backend is interpreting the description. */
  analyzing: boolean;
  /** Hides the mode toggle etc. while listening, per the design. */
  onListeningChange?: (listening: boolean) => void;
}

// Localised examples — a generic "a sandwich" teaches the wrong mental model.
const EXAMPLES = [
  'Two rotis, a bowl of dal and some curd',
  'Masala dosa with sambar, medium size',
];

const BARS = 12;
/** Android reports roughly -2…10 dB through onSpeechVolumeChanged. */
const DB_MIN = -2;
const DB_MAX = 10;

/**
 * VOICE mode — the "I forgot to photograph it" path.
 *
 * Lives inside the scan flow rather than as a separate screen, so the result
 * hands ScanResultScreen the same payload the photo path produces and nothing
 * downstream changes.
 */
export function VoiceModePanel({ onSubmit, analyzing, onListeningChange }: Props) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);

  // One Animated.Value per bar — driven by real mic amplitude, not a canned loop.
  const bars = useRef(Array.from({ length: BARS }, () => new Animated.Value(0.15))).current;
  const barCursor = useRef(0);

  useEffect(() => { onListeningChange?.(listening); }, [listening, onListeningChange]);

  useEffect(() => {
    Voice.onSpeechStart = () => { setListening(true); setError(null); };
    Voice.onSpeechEnd = () => setListening(false);

    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      if (e.value?.length) setPartial(e.value[0] ?? '');
    };
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (e.value?.length) { setTranscript(e.value[0] ?? ''); setPartial(''); }
    };

    // Amplitude → the next bar in a rolling window, so the waveform scrolls
    // with speech instead of pulsing uniformly.
    Voice.onSpeechVolumeChanged = (e: SpeechVolumeChangeEvent) => {
      const db = typeof e.value === 'number' ? e.value : DB_MIN;
      const level = Math.min(Math.max((db - DB_MIN) / (DB_MAX - DB_MIN), 0), 1);
      const target = 0.15 + level * 0.85;
      const bar = bars[barCursor.current % BARS];
      barCursor.current += 1;
      Animated.timing(bar, {
        toValue: target, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: false,
      }).start(() => {
        Animated.timing(bar, {
          toValue: 0.15, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: false,
        }).start();
      });
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      setListening(false);
      setPartial('');
      const code = e.error?.code ?? '';
      // 6 = speech timeout, 7 = no match. Both are ordinary silence.
      if (code === '7' || code === '6') setError(null);
      else setError('Could not hear that clearly. Try again.');
    };

    return () => { Voice.destroy().then(() => Voice.removeAllListeners()).catch(() => {}); };
  }, [bars]);

  const start = async () => {
    try {
      setError(null); setPartial('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Voice.start('en-IN'); // better on Indian dish names than en-US
    } catch {
      setError('Microphone unavailable. Check permissions in Settings.');
      setListening(false);
    }
  };

  const stop = async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); await Voice.stop(); } catch { /* already stopped */ }
    setListening(false);
    setPartial((p) => { if (p) setTranscript((t) => (t ? `${t} ${p}` : p)); return ''; });
  };

  const reset = () => { setTranscript(''); setPartial(''); setError(null); };

  const shown = [transcript, partial].filter(Boolean).join(' ').trim();
  const hasText = shown.length >= 3;

  // ── Listening ──────────────────────────────────────────────────────────────
  if (listening) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.stateLabel}>LISTENING</Text>

        <View style={styles.waveRow}>
          {bars.map((b, i) => (
            <Animated.View
              key={i}
              style={[
                styles.bar,
                {
                  height: b.interpolate({ inputRange: [0, 1], outputRange: [6, 56] }),
                  opacity: b.interpolate({ inputRange: [0.15, 1], outputRange: [0.45, 1] }),
                },
              ]}
            />
          ))}
        </View>

        <ScrollView style={styles.liveBox} contentContainerStyle={styles.liveInner}>
          <Text style={styles.liveText}>
            {transcript}
            {!!partial && <Text style={styles.livePartial}>{transcript ? ' ' : ''}{partial}…</Text>}
            {!shown && <Text style={styles.livePartial}>Listening…</Text>}
          </Text>
        </ScrollView>

        <TouchableOpacity style={styles.stopBtn} onPress={stop} activeOpacity={0.85}>
          <Ionicons name="stop" size={26} color={T.textOnPrimary} />
        </TouchableOpacity>
        <Text style={styles.helper}>Tap to stop</Text>
      </View>
    );
  }

  // ── Idle / review ──────────────────────────────────────────────────────────
  return (
    <View style={styles.wrap}>
      {hasText ? (
        <>
          <Text style={styles.stateLabel}>WE HEARD</Text>
          <ScrollView style={styles.liveBox} contentContainerStyle={styles.liveInner}>
            <Text style={styles.liveText}>“{shown}”</Text>
          </ScrollView>
          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.reviewActions}>
            <TouchableOpacity style={styles.retryBtn} onPress={() => { reset(); start(); }} disabled={analyzing} activeOpacity={0.8}>
              <Ionicons name="refresh" size={16} color={T.textSecondary} />
              <Text style={styles.retryText}>Redo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, analyzing && { opacity: 0.6 }]}
              onPress={() => onSubmit(shown)}
              disabled={analyzing}
              activeOpacity={0.85}
            >
              {analyzing
                ? <ActivityIndicator animating size={16} color={T.textOnPrimary} />
                : <Ionicons name="sparkles" size={16} color={T.textOnPrimary} />}
              <Text style={styles.confirmText}>{analyzing ? 'Matching…' : 'Continue'}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={styles.introIcon}>
            <Ionicons name="mic" size={30} color={T.primary} />
          </View>
          <Text style={styles.introTitle}>What did you eat?</Text>
          <Text style={styles.introSub}>Say it the way you'd tell a friend — quantities help.</Text>

          <View style={styles.exampleBox}>
            <Text style={styles.exampleLabel}>FOR EXAMPLE</Text>
            {EXAMPLES.map((e) => (
              <Text key={e} style={styles.exampleText}>“{e}”</Text>
            ))}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.micBtn} onPress={start} activeOpacity={0.85}>
            <Ionicons name="mic" size={30} color={T.textOnPrimary} />
          </TouchableOpacity>
          <Text style={styles.helper}>Tap to speak</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },

  stateLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: T.primary },

  introIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: T.primaryTint,
    borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  introTitle: { fontSize: 22, fontWeight: '800', color: T.textPrimary, textAlign: 'center' },
  introSub: { fontSize: 14, color: T.textSecondary, textAlign: 'center', lineHeight: 20 },

  exampleBox: {
    alignSelf: 'stretch', gap: 6, marginTop: 8,
    backgroundColor: T.glass, borderRadius: 14,
    borderWidth: 1, borderColor: T.border, padding: 16,
  },
  exampleLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: T.textMuted, marginBottom: 2 },
  exampleText: { fontSize: 13.5, color: T.textSecondary, fontStyle: 'italic', lineHeight: 19 },

  waveRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, height: 60, marginVertical: 4,
  },
  bar: { width: 4, borderRadius: 2, backgroundColor: T.primary },

  liveBox: {
    alignSelf: 'stretch', maxHeight: 150,
    backgroundColor: T.glass, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
  },
  liveInner: { padding: 16 },
  liveText: { fontSize: 17, lineHeight: 25, color: T.textPrimary, fontWeight: '500' },
  /** Unresolved words are dimmed so mishearings are visible before submitting. */
  livePartial: { color: T.textMuted },

  error: { fontSize: 13, color: T.error, fontWeight: '600', textAlign: 'center' },

  micBtn: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: T.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  stopBtn: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: T.error,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  helper: { fontSize: 12, color: T.textMuted, fontWeight: '600' },

  reviewActions: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginTop: 8 },
  retryBtn: {
    flex: 1, height: 52, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  retryText: { fontSize: 15, fontWeight: '700', color: T.textSecondary },
  confirmBtn: {
    flex: 2, height: 52, borderRadius: 14, backgroundColor: T.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  confirmText: { fontSize: 15, fontWeight: '800', color: T.textOnPrimary },
});
