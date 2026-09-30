import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Animated,
  Keyboard,
  Platform,
  type KeyboardEvent,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/authStore';
import {
  getChatHistory,
  sendChatMessage,
  clearChatHistory,
  type ChatMessage,
} from '../../services/api';
import { T, HIT_TARGET, tabularNums } from '../../theme';

interface Props {
  navigation: { goBack: () => void };
}

/** Openers so nobody faces a blank box — each one only works because we have their data. */
const SUGGESTIONS = [
  "How am I doing this week?",
  "What should I eat for dinner?",
  "Am I getting enough protein?",
  "Why is my sodium high?",
];

const MAX_CHARS = 800;

type HistoryStatus = 'loading' | 'ready' | 'error';

/**
 * Animates a bottom offset that tracks the keyboard height.
 *
 * On Android 15+ (targetSdk 35+) the app runs edge-to-edge and the window no
 * longer resizes for the keyboard, so `windowSoftInputMode=adjustResize` and a
 * bare `KeyboardAvoidingView` do nothing — the composer draws behind the
 * keyboard. Driving the offset from `Keyboard` events (which still fire with a
 * correct height edge-to-edge) works reliably on both platforms. It rests at the
 * safe-area inset and rises to sit exactly on top of the keyboard.
 */
function useKeyboardOffset(restingInset: number): Animated.Value {
  const offset = useRef(new Animated.Value(restingInset)).current;
  useEffect(() => {
    const animateTo = (to: number, duration: number) =>
      Animated.timing(offset, { toValue: to, duration: duration || 200, useNativeDriver: false }).start();

    const onShow = (e: KeyboardEvent) => animateTo(e.endCoordinates.height, e.duration);
    const onHide = (e: KeyboardEvent) => animateTo(restingInset, e.duration);

    // iOS fires *Will* events (smooth, pre-animation); Android only *Did*.
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => { s.remove(); h.remove(); };
  }, [offset, restingInset]);
  return offset;
}

/**
 * The AI nutrition coach.
 *
 * Grounded on server-computed aggregates of the user's own logs — it can only
 * talk about numbers the backend calculated, never ones it invented. Explicitly
 * a coach, not a medical professional; the backend declines medical questions
 * and intercepts crisis language before the model is ever called.
 */
export function CoachScreen({ navigation }: Props) {
  const token = useAuthStore((s) => s.session?.access_token);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>('loading');
  const [sending, setSending] = useState(false);
  const [usage, setUsage] = useState({ used: 0, limit: 30 });
  const scrollRef = useRef<ScrollView>(null);
  // Own the bottom inset ourselves (SafeAreaView top-only) so the same value
  // rests below the composer and animates up with the keyboard.
  const insets = useSafeAreaInsets();
  const kbOffset = useKeyboardOffset(insets.bottom);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // A failed history load is an error state, not a first run: showing the
  // intro would invite a duplicate conversation on top of one that exists.
  const loadHistory = useCallback(async () => {
    if (!token) return;
    setHistoryStatus('loading');
    try {
      const h = await getChatHistory(token);
      setMessages(h.messages);
      setUsage({ used: h.used_today, limit: h.daily_limit });
      setHistoryStatus('ready');
      scrollToEnd();
    } catch (err) {
      console.warn('[coach] history load failed', err);
      setHistoryStatus('error');
    }
  }, [token, scrollToEnd]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || sending || !token) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    setSending(true);
    // Show the user's turn immediately — waiting for the round-trip feels broken.
    setMessages((prev) => [...prev, { role: 'user', content: msg, created_at: new Date().toISOString() }]);
    scrollToEnd();

    try {
      const r = await sendChatMessage(msg, token);
      setMessages((prev) => [...prev, { role: 'assistant', content: r.reply, created_at: new Date().toISOString() }]);
      setUsage({ used: r.used_today, limit: r.daily_limit });
    } catch (err) {
      const e = err as { statusCode?: number };
      console.warn('[coach] send failed', err);
      // Roll the optimistic turn back so the transcript matches the server.
      setMessages((prev) => prev.slice(0, -1));
      setInput(msg);
      if (e.statusCode === 429) {
        Alert.alert('Daily limit reached', "You've used all your Coach messages for today. Try again tomorrow.");
      } else {
        Alert.alert("Couldn't send", 'Check your connection and try again.');
      }
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  const confirmClear = () => {
    Alert.alert('Clear conversation?', 'This deletes your chat history with Coach. Your food logs are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await clearChatHistory(token);
            setMessages([]);
          } catch (err) {
            console.warn('[coach] clear failed', err);
            Alert.alert("Couldn't clear", 'Check your connection and try again.');
          }
        },
      },
    ]);
  };

  const atLimit = usage.used >= usage.limit;
  const canSend = !!input.trim() && !sending;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigation.goBack} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={T.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Coach</Text>
          <View style={styles.betaTag}><Text style={styles.betaText}>Beta</Text></View>
        </View>
        <TouchableOpacity onPress={confirmClear} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Clear conversation">
          <Ionicons name="trash-outline" size={19} color={T.textMuted} />
        </TouchableOpacity>
      </View>

      {/* paddingBottom tracks the keyboard height (see useKeyboardOffset) so the
          composer sits on top of the keyboard on both platforms — including
          edge-to-edge Android 15+, where adjustResize/KeyboardAvoidingView no
          longer resize the window. */}
      <Animated.View style={[styles.flex, { paddingBottom: kbOffset }]}>
        {/* flex:1 on the ScrollView itself (not just the content) is essential:
            without it the list grows to its content height and shoves the
            composer off the bottom of the screen — where the keyboard hides it.
            With it, the list fills the space above a bottom-pinned composer. */}
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
        >
          {historyStatus === 'loading' ? (
            <View style={styles.center}><ActivityIndicator color={T.primary} /></View>
          ) : historyStatus === 'error' ? (
            <View style={styles.retryRow}>
              <Ionicons name="cloud-offline-outline" size={18} color={T.textMuted} />
              <Text style={styles.retryText}>Couldn't load your conversation.</Text>
              <TouchableOpacity
                onPress={() => void loadHistory()}
                style={styles.retryBtn}
                accessibilityRole="button"
                accessibilityLabel="Retry loading conversation"
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.intro}>
              <View style={styles.introIcon}>
                <Ionicons name="chatbubbles" size={26} color={T.primary} />
              </View>
              <Text style={styles.introTitle}>Ask me about your food</Text>
              <Text style={styles.introBody}>
                I can see what you've logged — your calories, protein, water and weight — so ask me
                anything about it. I'm a nutrition coach, not a doctor, so I'll point you to a
                professional for anything medical.
              </Text>
            </View>
          ) : (
            messages.map((m, i) => (
              <View
                key={`${m.created_at}-${i}`}
                style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleCoach]}
              >
                <Text style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextUser]}>
                  {m.content}
                </Text>
              </View>
            ))
          )}

          {sending && (
            <View style={[styles.bubble, styles.bubbleCoach, styles.typing]}>
              <ActivityIndicator size={14} color={T.textMuted} />
              <Text style={styles.typingText}>Coach is thinking…</Text>
            </View>
          )}

          {/* Suggestions only while the conversation is genuinely empty. */}
          {historyStatus === 'ready' && messages.length === 0 && (
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity key={s} style={styles.chip} onPress={() => send(s)} activeOpacity={0.85} accessibilityRole="button">
                  <Text style={styles.chipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.composer}>
          {atLimit ? (
            <Text style={styles.limitNote}>
              You've used all {usage.limit} messages for today. Resets tomorrow.
            </Text>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={(t) => setInput(t.slice(0, MAX_CHARS))}
                placeholder="Ask about your nutrition…"
                placeholderTextColor={T.textMuted}
                style={styles.input}
                multiline
                maxLength={MAX_CHARS}
                editable={!sending}
                accessibilityLabel="Message to Coach"
              />
              <TouchableOpacity
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={() => send(input)}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: !canSend }}
              >
                <Ionicons name="arrow-up" size={20} color={T.textOnPrimary} />
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.disclaimer}>
            Coach gives general nutrition guidance, not medical advice.{' '}
            <Text style={styles.disclaimerCount}>{usage.used}/{usage.limit}</Text> messages used today.
          </Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  flex: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.2 },
  betaTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: T.primaryTint },
  betaText: { fontSize: 12, fontWeight: '700', color: T.primary },

  // flexGrow:1 so short conversations still fill the height (empty-state
  // intro + suggestions sit correctly above the composer).
  scroll: { flexGrow: 1, padding: 16, gap: 10, paddingBottom: 8 },
  center: { paddingVertical: 60, alignItems: 'center' },

  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  retryText: { flex: 1, fontSize: 14, color: T.textSecondary },
  retryBtn: { minHeight: HIT_TARGET, minWidth: HIT_TARGET, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: T.primaryTint },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: T.primary },

  intro: { alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 12 },
  introIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: T.primaryTint, alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontSize: 18, fontWeight: '800', color: T.textPrimary },
  introBody: { fontSize: 14, lineHeight: 21, color: T.textSecondary, textAlign: 'center' },

  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: T.primary, borderBottomRightRadius: 6 },
  bubbleCoach: { alignSelf: 'flex-start', backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: 15, lineHeight: 22, color: T.textPrimary },
  bubbleTextUser: { color: T.textOnPrimary, fontWeight: '600' },

  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { fontSize: 13, color: T.textMuted, fontStyle: 'italic' },

  suggestions: { gap: 8, marginTop: 4 },
  chip: {
    alignSelf: 'flex-start',
    minHeight: HIT_TARGET,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.primaryBorder,
    justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: T.primary },

  composer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, borderTopWidth: 1, borderTopColor: T.border, gap: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1,
    maxHeight: 120,
    fontSize: 15,
    color: T.textPrimary,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  sendBtn: { width: HIT_TARGET, height: HIT_TARGET, borderRadius: HIT_TARGET / 2, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  limitNote: { fontSize: 14, color: T.textSecondary, textAlign: 'center', paddingVertical: 12 },
  disclaimer: { fontSize: 12, color: T.textMuted, textAlign: 'center', lineHeight: 16 },
  disclaimerCount: { fontSize: 13, color: T.textMuted, ...tabularNums },
});
