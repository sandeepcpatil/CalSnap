import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { SmartAlert, AlertTone } from '../utils/alerts';
import { useAuthStore } from '../store/authStore';
import { useRecapStore } from '../store/recapStore';
import type { WeeklyRecap } from '../services/api';
import { ModalHeader } from './ModalHeader';
import { T, spacing, radius, type, HIT_TARGET, tabularNums } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  alerts: SmartAlert[];
  /** Opens the paywall from the locked recap teaser. */
  onUpgrade?: () => void;
}

const TONE: Record<AlertTone, { bg: string; icon: string }> = {
  success: { bg: T.successTint, icon: T.success },
  warning: { bg: T.warningTint, icon: T.warning },
  info: { bg: T.primaryTint, icon: T.primary },
};

type Tab = 'alerts' | 'review';

export function AlertsModal({ visible, onClose, alerts, onUpgrade }: Props) {
  const token = useAuthStore((s) => s.session?.access_token);
  const { recap, locked, loading, error, fetch, markSeen, hasUnread } = useRecapStore();
  const [tab, setTab] = useState<Tab>('alerts');
  const unread = hasUnread();

  // Fetch the recap when the sheet opens, and mark it seen once shown.
  useEffect(() => {
    if (visible && token) fetch(token);
  }, [visible, token, fetch]);

  useEffect(() => {
    if (visible && tab === 'review' && recap) markSeen();
  }, [visible, tab, recap, markSeen]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <ModalHeader title="Alerts" onClose={onClose} />

          {/* Tabs */}
          <View style={styles.tabs}>
            <TabButton
              label="Alerts"
              active={tab === 'alerts'}
              badge={alerts.length}
              onPress={() => setTab('alerts')}
            />
            <TabButton label="Weekly review" active={tab === 'review'} dot={unread} onPress={() => setTab('review')} />
          </View>
        </SafeAreaView>

        {tab === 'review' ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {loading && !recap ? (
              <View style={styles.center}>
                <ActivityIndicator color={T.primary} />
                <Text style={styles.centerText}>Putting your week together…</Text>
              </View>
            ) : locked ? (
              <LockedTeaser onUpgrade={onUpgrade} />
            ) : recap ? (
              <RecapCard recap={recap} />
            ) : (
              <View style={styles.center}>
                <Ionicons name="mail-outline" size={44} color={T.textMuted} />
                <Text style={styles.emptyTitle}>No review yet</Text>
                <Text style={styles.emptyBody}>
                  {error
                    ? "Couldn't load your weekly review. Check your connection and reopen this."
                    : 'Your weekly review will appear here once you have a full week of logs.'}
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {alerts.length === 0 ? (
              <View style={styles.center}>
                <Ionicons name="checkmark-done-circle-outline" size={48} color={T.textMuted} />
                <Text style={styles.emptyTitle}>All clear</Text>
                <Text style={styles.emptyBody}>
                  No alerts right now. They appear here when today's log needs a look.
                </Text>
              </View>
            ) : (
              alerts.map((a) => {
                const tone = TONE[a.tone];
                return (
                  <View key={a.id} style={[styles.card, { backgroundColor: tone.bg }]}>
                    <View style={styles.iconWrap}>
                      <Ionicons name={a.icon} size={20} color={tone.icon} />
                    </View>
                    <View style={styles.cardText}>
                      <Text style={styles.cardTitle}>{a.title}</Text>
                      <Text style={styles.cardBody}>{a.body}</Text>
                    </View>
                  </View>
                );
              })
            )}
            <Text style={styles.footnote}>
              Alerts are generated from your own logs on this device.
            </Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function TabButton({ label, active, onPress, badge, dot }: { label: string; active: boolean; onPress: () => void; badge?: number; dot?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {dot && <View style={styles.tabDot} />}
      {!!badge && badge > 0 && (
        <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{badge}</Text></View>
      )}
    </TouchableOpacity>
  );
}

function LockedTeaser({ onUpgrade }: { onUpgrade?: () => void }) {
  return (
    <View style={styles.teaser}>
      <View style={styles.teaserIcon}>
        <Ionicons name="newspaper-outline" size={26} color={T.primary} />
      </View>
      <Text style={styles.teaserTitle}>Your week in review</Text>
      <Text style={styles.teaserBody}>
        Every Monday, a breakdown of your week: calories, protein, hydration and weight,
        with one thing to focus on next. Part of CalVue Pro.
      </Text>
      {onUpgrade && (
        <TouchableOpacity
          style={styles.teaserBtn}
          onPress={onUpgrade}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Unlock with Pro"
        >
          <Text style={styles.teaserBtnText}>Unlock with Pro</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function RecapCard({ recap }: { recap: WeeklyRecap }) {
  const { content, stats } = recap;
  const water =
    stats.days_with_water > 0 ? `${stats.days_water_goal_hit}/${stats.days_with_water}` : '—';
  const weight =
    stats.weight_change_kg == null ? null : `${stats.weight_change_kg > 0 ? '+' : stats.weight_change_kg < 0 ? '−' : ''}${Math.abs(stats.weight_change_kg)} kg`;

  return (
    <View style={styles.recap}>
      <View style={styles.recapHead}>
        <Ionicons name="newspaper-outline" size={15} color={T.textSecondary} />
        <Text style={styles.recapKicker}>Week in review · {stats.week_label}</Text>
      </View>
      <Text style={styles.recapHeadline}>{content.headline}</Text>

      {/* Stat strip */}
      <View style={styles.statStrip}>
        <Stat value={`${stats.days_logged}/7`} label="Days" />
        <Stat value={stats.avg_calories > 0 ? stats.avg_calories.toLocaleString('en-IN') : '—'} label="kcal/day" />
        <Stat value={stats.avg_protein > 0 ? `${stats.avg_protein}g` : '—'} label="Protein" />
        <Stat value={weight ?? water} label={weight ? 'Weight' : 'Water'} />
      </View>

      <Text style={styles.recapSummary}>{content.summary}</Text>

      {content.insights.map((ins, i) => (
        <View key={i} style={styles.insightRow}>
          <Ionicons name="ellipse" size={6} color={T.primary} style={{ marginTop: 7 }} />
          <Text style={styles.insightText}>{ins}</Text>
        </View>
      ))}

      <View style={styles.tipBox}>
        <Ionicons name="bulb-outline" size={16} color={T.primary} />
        <Text style={styles.tipText}>{content.tip}</Text>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  headerSafe: { zIndex: 10, backgroundColor: T.bg, borderBottomWidth: 1, borderBottomColor: T.border },

  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    paddingHorizontal: spacing.lg,
    minHeight: HIT_TARGET,
    borderRadius: radius.pill,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  tabActive: { backgroundColor: T.primaryTint, borderColor: T.primaryBorder },
  tabText: { ...type.body, fontWeight: '700', color: T.textSecondary },
  tabTextActive: { color: T.primary },
  tabDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.error },
  tabBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: radius.pill, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  tabBadgeText: { ...type.bodySm, fontWeight: '800', color: T.textOnPrimary, ...tabularNums },

  scroll: { padding: spacing.xl, gap: spacing.md },

  center: { alignItems: 'center', gap: 10, paddingVertical: 56, paddingHorizontal: spacing['2xl'] },
  centerText: { ...type.bodySm, color: T.textSecondary },
  emptyTitle: { ...type.titleSm, color: T.textPrimary },
  emptyBody: { ...type.body, color: T.textSecondary, textAlign: 'center' },

  /* Alert cards */
  card: { flexDirection: 'row', gap: 14, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: T.border, alignItems: 'flex-start' },
  iconWrap: { width: 40, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg },
  cardText: { flex: 1, gap: spacing.xs },
  cardTitle: { ...type.body, fontWeight: '700', color: T.textPrimary },
  cardBody: { ...type.bodySm, lineHeight: 19, color: T.textSecondary },
  footnote: { ...type.bodySm, fontSize: 12, color: T.textMuted, textAlign: 'center', marginTop: spacing.sm },

  /* Locked teaser */
  teaser: { alignItems: 'center', gap: spacing.md, padding: spacing['2xl'], borderRadius: radius.lg, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, marginTop: spacing.sm },
  teaserIcon: { width: 60, height: 60, borderRadius: radius.pill, backgroundColor: T.primaryTint, alignItems: 'center', justifyContent: 'center' },
  teaserTitle: { ...type.title, color: T.textPrimary },
  teaserBody: { ...type.body, color: T.textSecondary, textAlign: 'center' },
  teaserBtn: { alignItems: 'center', justifyContent: 'center', height: 48, paddingHorizontal: 22, borderRadius: radius.md, backgroundColor: T.primary, marginTop: spacing.xs },
  teaserBtnText: { ...type.body, fontWeight: '800', color: T.textOnPrimary },

  /* Recap card */
  recap: { padding: 18, borderRadius: radius.lg, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, gap: spacing.md },
  recapHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm - 2 },
  recapKicker: { ...type.bodySm, fontWeight: '600', color: T.textSecondary },
  recapHeadline: { ...type.title, color: T.textPrimary },

  statStrip: {
    flexDirection: 'row',
    backgroundColor: T.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...type.body, fontSize: 16, fontWeight: '800', color: T.textPrimary, ...tabularNums },
  statLabel: { ...type.bodySm, fontSize: 12, color: T.textMuted },

  recapSummary: { ...type.body, color: T.textSecondary },
  insightRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  insightText: { ...type.body, flex: 1, color: T.textPrimary },

  tipBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: T.primaryTint,
    borderWidth: 1,
    borderColor: T.primaryBorder,
    alignItems: 'flex-start',
    marginTop: 2,
  },
  tipText: { ...type.body, flex: 1, fontWeight: '600', color: T.textPrimary },
});
