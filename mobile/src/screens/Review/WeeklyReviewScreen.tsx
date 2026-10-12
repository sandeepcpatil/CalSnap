import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useRecapStore } from '../../store/recapStore';
import { ModalHeader } from '../../components/ModalHeader';
import { WeeklyReviewCard } from '../../components/WeeklyReviewCard';
import {
  buildWeeklyReviewData,
  buildWeeklyReviewText,
  type ReviewLog,
  type WeeklyReviewData,
} from '../../utils/weeklyReview';
import { T, spacing, radius, type, HIT_TARGET } from '../../theme';

interface Props {
  navigation: { goBack: () => void };
}

type Status = 'loading' | 'ready' | 'error';

/** Widest the 4:5 card gets on a tablet; on a phone it fills the gutter. */
const CARD_MAX_WIDTH = 400;

/**
 * "Your week": the shareable review card with a Share button under it.
 *
 * The card is free for everyone and is built from the last seven days of logs
 * on the device. Pro users whose server recap exists get the recap's numbers
 * and its written advice instead. Sharing is plain text through the system
 * sheet; there is no image capture dependency in the project.
 */
export function WeeklyReviewScreen({ navigation }: Props) {
  const { session, profile } = useAuthStore();
  const token = session?.access_token;
  const userId = session?.user.id;
  const { recap, locked, loading: recapLoading, fetch: fetchRecap } = useRecapStore();

  const [status, setStatus] = useState<Status>('loading');
  const [logs, setLogs] = useState<ReviewLog[]>([]);

  useEffect(() => {
    if (token) fetchRecap(token);
  }, [token, fetchRecap]);

  const loadLogs = useCallback(async () => {
    if (!userId) { setStatus('ready'); return; }
    setStatus('loading');
    const from = new Date();
    from.setDate(from.getDate() - 6);
    const startISO = from.toISOString().slice(0, 10) + 'T00:00:00.000Z';

    const { data, error } = await supabase
      .from('food_logs')
      .select('logged_at, calories, protein_g')
      .eq('user_id', userId)
      .gte('logged_at', startISO)
      .order('logged_at', { ascending: true });

    if (error || !data) {
      console.warn('[weekly-review] load failed', error);
      setStatus('error');
      return;
    }
    setLogs(
      (data as ReviewLog[]).map((l) => ({
        logged_at: l.logged_at,
        calories: Number(l.calories) || 0,
        protein_g: Number(l.protein_g) || 0,
      })),
    );
    setStatus('ready');
  }, [userId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // The recap is only used when the server actually sent one (Pro). A locked
  // response falls through to the free, on-device card.
  const usableRecap = !locked && recap ? recap : null;
  const data: WeeklyReviewData | null =
    status === 'ready'
      ? buildWeeklyReviewData({
          recap: usableRecap,
          logs,
          calorieGoal: profile?.daily_calorie_goal ?? null,
          proteinGoal: profile?.daily_protein_goal ?? null,
        })
      : null;
  const shareText = data ? buildWeeklyReviewText(data) : null;
  const waitingForRecap = recapLoading && !recap && !locked;

  const onShare = async () => {
    if (!shareText) return;
    try {
      await Share.share({ message: shareText });
    } catch (err: unknown) {
      // The sheet being dismissed is not an error worth surfacing.
      console.warn('[weekly-review] share failed', err);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ModalHeader title="Your week" onClose={navigation.goBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {status === 'loading' || (status === 'ready' && waitingForRecap) ? (
          <View style={styles.center} accessibilityLabel="Loading your week">
            <ActivityIndicator color={T.primary} />
          </View>
        ) : status === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Couldn't load your week.</Text>
            <TouchableOpacity
              onPress={loadLogs}
              style={styles.textAction}
              accessibilityRole="button"
              accessibilityLabel="Retry loading your week"
            >
              <Text style={styles.textActionLabel}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : data ? (
          <>
            <View style={styles.cardWrap}>
              <WeeklyReviewCard data={data} />
            </View>

            <TouchableOpacity
              style={[styles.shareBtn, !shareText && styles.shareBtnDisabled]}
              onPress={onShare}
              disabled={!shareText}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Share your week"
              accessibilityState={{ disabled: !shareText }}
            >
              <Text style={[styles.shareBtnText, !shareText && styles.shareBtnTextDisabled]}>Share</Text>
            </TouchableOpacity>

            <Text style={styles.note}>
              {data.source === 'recap'
                ? 'Numbers from your written weekly review.'
                : 'Shared as text. Numbers are from the last seven days on this device.'}
            </Text>

            {locked && (
              <Text style={styles.proNote}>Pro adds a written review of your week.</Text>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: spacing.xl, paddingBottom: spacing['4xl'], alignItems: 'center', gap: spacing.lg },

  center: { width: '100%', alignItems: 'center', gap: spacing.md, paddingVertical: spacing['4xl'] },
  errorText: { ...type.body, color: T.textSecondary },
  textAction: { minHeight: HIT_TARGET, minWidth: HIT_TARGET, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  textActionLabel: { ...type.body, fontWeight: '700', color: T.primary },

  cardWrap: { width: '100%', maxWidth: CARD_MAX_WIDTH },

  shareBtn: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    minHeight: HIT_TARGET + 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: T.primary,
  },
  shareBtnDisabled: { backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border },
  shareBtnText: { ...type.body, fontWeight: '800', color: T.textOnPrimary },
  shareBtnTextDisabled: { color: T.textMuted },

  note: { ...type.bodySm, color: T.textMuted, textAlign: 'center', maxWidth: CARD_MAX_WIDTH },
  proNote: { ...type.bodySm, color: T.textSecondary, textAlign: 'center', maxWidth: CARD_MAX_WIDTH },
});
