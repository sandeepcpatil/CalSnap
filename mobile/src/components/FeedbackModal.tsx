import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/authStore';
import { useFoodLogStore } from '../store/foodLogStore';
import { supabase } from '../services/supabase';
import { T } from '../theme';

const C = {
  bg: T.bg,
  glass: T.surface,
  glassBorder: T.border,
  primary: T.primary,
  onSurface: T.textPrimary,
  onSurfaceVar: T.textSecondary,
  outline: T.textMuted,
  outlineVar: T.border,
  inputBg: T.surface2,
};

/** Mirrors the CHECK constraint on `feedback.category`. */
type Category = 'feature' | 'improvement' | 'bug' | 'other';

const CATEGORIES: { key: Category; label: string; icon: keyof typeof Ionicons.glyphMap; blurb: string }[] = [
  { key: 'feature', label: 'Feature idea', icon: 'bulb-outline', blurb: 'Something you wish CalSnap could do' },
  { key: 'improvement', label: 'Improvement', icon: 'trending-up-outline', blurb: 'Something that could work better' },
  { key: 'bug', label: 'Something broke', icon: 'bug-outline', blurb: 'A bug or something behaving oddly' },
  { key: 'other', label: 'Anything else', icon: 'chatbox-ellipses-outline', blurb: 'Praise, confusion, or a stray thought' },
];

const MIN_CHARS = 3;
const MAX_CHARS = 2000;

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * In-app feedback.
 *
 * Deliberately not a mailto (which Contact Support already covers): a mailto
 * silently fails when no mail client is configured, arrives unstructured, and
 * can't be counted or filtered. Writing to a table means feedback is triageable
 * by category, carries device/app context automatically, and shows up in the
 * admin panel — so it can actually be acted on rather than sitting in an inbox.
 */
export function FeedbackModal({ visible, onDismiss }: Props) {
  const { session, profile } = useAuthStore();
  const todayLogs = useFoodLogStore((s) => s.todayLogs);
  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const reset = () => {
    setCategory(null);
    setMessage('');
    setSending(false);
    setSent(false);
  };

  const close = () => {
    onDismiss();
    // Delay so the reset isn't visible during the dismiss animation.
    setTimeout(reset, 250);
  };

  const canSend = !!category && message.trim().length >= MIN_CHARS && !sending;

  const submit = async () => {
    if (!canSend || !session?.user.id) return;
    setSending(true);
    try {
      const version = Constants.expoConfig?.version ?? 'unknown';
      const { error } = await supabase.from('feedback').insert({
        user_id: session.user.id,
        category,
        message: message.trim().slice(0, MAX_CHARS),
        email: profile?.email ?? null,
        app_version: version,
        platform: `${Platform.OS} ${Platform.Version}`,
        // Captured automatically so we never have to ask "are you on Pro?" or
        // "how much do you log?" in a reply.
        context: {
          is_subscribed: profile?.is_subscribed ?? false,
          scan_count: profile?.scan_count ?? 0,
          logged_today: todayLogs.length,
          body_goal: profile?.body_goal ?? null,
        },
      });
      if (error) throw new Error(error.message);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (err) {
      Alert.alert(
        "Couldn't send",
        err instanceof Error ? err.message : 'Please check your connection and try again.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={close}>
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={close} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={C.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Send feedback</Text>
            <View style={{ width: 36 }} />
          </View>
        </SafeAreaView>

        {sent ? (
          <View style={styles.done}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark" size={34} color={T.textOnPrimary} />
            </View>
            <Text style={styles.doneTitle}>Thank you — genuinely</Text>
            <Text style={styles.doneBody}>
              This goes straight to the person building CalSnap and gets read. If it's something we
              can fix or add, it shapes what comes next.
            </Text>
            <TouchableOpacity style={styles.doneBtn} onPress={close} activeOpacity={0.88}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={reset} activeOpacity={0.7} style={styles.againBtn}>
              <Text style={styles.againText}>Send something else</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text style={styles.intro}>
                What would make CalSnap better for you? Feature ideas, things that annoy you, or
                anything that felt confusing — it all helps.
              </Text>

              <Text style={styles.label}>What's this about?</Text>
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.catRow, active && styles.catRowActive]}
                    onPress={() => { Haptics.selectionAsync(); setCategory(c.key); }}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[styles.catIcon, active && styles.catIconActive]}>
                      <Ionicons name={c.icon} size={18} color={active ? C.primary : C.outline} />
                    </View>
                    <View style={styles.catText}>
                      <Text style={[styles.catLabel, active && { color: C.primary }]}>{c.label}</Text>
                      <Text style={styles.catBlurb}>{c.blurb}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color={C.primary} />}
                  </TouchableOpacity>
                );
              })}

              <Text style={styles.label}>Tell us more</Text>
              <TextInput
                value={message}
                onChangeText={(t) => setMessage(t.slice(0, MAX_CHARS))}
                placeholder="The more specific, the more useful — what happened, or what you'd like to see."
                placeholderTextColor={C.outline}
                style={styles.input}
                multiline
                textAlignVertical="top"
                maxLength={MAX_CHARS}
              />
              <Text style={styles.counter}>{message.length}/{MAX_CHARS}</Text>

              <View style={styles.privacy}>
                <Ionicons name="information-circle-outline" size={15} color={C.outline} />
                <Text style={styles.privacyText}>
                  We also attach your app version and device type so we can reproduce issues. No
                  food photos or personal data are sent.
                </Text>
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={submit}
                disabled={!canSend}
                activeOpacity={0.88}
              >
                {sending ? (
                  <ActivityIndicator size={16} color={T.textOnPrimary} />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={17} color={T.textOnPrimary} />
                    <Text style={styles.sendText}>Send feedback</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  headerSafe: { zIndex: 10, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.onSurface },

  content: { padding: 20, gap: 10 },
  intro: { fontSize: 14, lineHeight: 21, color: C.onSurfaceVar, marginBottom: 4 },

  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.outline,
    marginTop: 10,
  },

  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  catRowActive: { borderColor: 'rgba(133,211,218,0.45)', backgroundColor: T.primaryTint },
  catIcon: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.surface2,
  },
  catIconActive: { backgroundColor: 'rgba(1,105,111,0.35)' },
  catText: { flex: 1, gap: 2 },
  catLabel: { fontSize: 14.5, fontWeight: '700', color: C.onSurface },
  catBlurb: { fontSize: 12, color: C.outline },

  input: {
    minHeight: 130,
    fontSize: 14.5,
    lineHeight: 21,
    color: C.onSurface,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 14,
    padding: 14,
  },
  counter: { fontSize: 11, color: C.outline, textAlign: 'right' },

  privacy: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 6 },
  privacyText: { flex: 1, fontSize: 11.5, lineHeight: 17, color: C.outline },

  footer: { padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.glassBorder },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 15,
    backgroundColor: C.primary,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { fontSize: 15, fontWeight: '800', color: T.textOnPrimary },

  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  doneIcon: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.primary, marginBottom: 4,
  },
  doneTitle: { fontSize: 20, fontWeight: '800', color: C.onSurface },
  doneBody: { fontSize: 14, lineHeight: 21, color: C.onSurfaceVar, textAlign: 'center' },
  doneBtn: {
    height: 50, paddingHorizontal: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.primary, marginTop: 12,
  },
  doneBtnText: { fontSize: 15, fontWeight: '800', color: T.textOnPrimary },
  againBtn: { paddingVertical: 10 },
  againText: { fontSize: 13.5, fontWeight: '600', color: C.primary },
});
