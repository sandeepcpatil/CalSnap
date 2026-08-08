import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { SmartAlert, AlertTone } from '../utils/alerts';
import { useAuthStore } from '../store/authStore';
import { useRecapStore } from '../store/recapStore';
import type { WeeklyRecap } from '../services/api';
import { T } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  alerts: SmartAlert[];
  /** Opens the paywall from the locked recap teaser. */
  onUpgrade?: () => void;
}

const C = {
  bg: T.bg,
  glass: T.surface,
  glassBorder: T.border,
  primary: T.primary,
  onSurface: T.textPrimary,
  onSurfaceVar: T.textSecondary,
  outline: T.textMuted,
  header: T.bg,
};

const TONE: Record<AlertTone, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(122,220,166,0.14)', border: T.border, icon: T.success },
  warning: { bg: 'rgba(242,193,112,0.14)', border: T.border, icon: T.warning },
  info: { bg: T.primaryTint, border: T.border, icon: T.primary },
};

type Tab = 'messages' | 'reminders';

export function AlertsModal({ visible, onClose, alerts, onUpgrade }: Props) {
  const token = useAuthStore((s) => s.session?.access_token);
  const { recap, locked, loading, error, fetch, markSeen, hasUnread } = useRecapStore();
  const [tab, setTab] = useState<Tab>('messages');
  const unread = hasUnread();

  // Fetch the recap when the sheet opens, and mark it seen once shown.
  useEffect(() => {
    if (visible && token) fetch(token);
  }, [visible, token, fetch]);

  useEffect(() => {
    if (visible && tab === 'messages' && recap) markSeen();
  }, [visible, tab, recap, markSeen]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={C.onSurfaceVar} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TabButton label="Messages" active={tab === 'messages'} dot={unread} onPress={() => setTab('messages')} />
            <TabButton
              label="Reminders"
              active={tab === 'reminders'}
              badge={alerts.length}
              onPress={() => setTab('reminders')}
            />
          </View>
        </SafeAreaView>

        {tab === 'messages' ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {loading && !recap ? (
              <View style={styles.center}>
                <ActivityIndicator color={C.primary} />
                <Text style={styles.centerText}>Putting your week together…</Text>
              </View>
            ) : locked ? (
              <LockedTeaser onUpgrade={onUpgrade} />
            ) : recap ? (
              <RecapCard recap={recap} />
            ) : (
              <View style={styles.center}>
                <Ionicons name="mail-outline" size={44} color={C.outline} />
                <Text style={styles.emptyTitle}>No messages yet</Text>
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
                <Ionicons name="checkmark-done-circle-outline" size={48} color={C.outline} />
                <Text style={styles.emptyTitle}>All clear</Text>
                <Text style={styles.emptyBody}>
                  No reminders right now. Keep logging and we’ll surface anything worth your attention.
                </Text>
              </View>
            ) : (
              alerts.map((a) => {
                const tone = TONE[a.tone];
                return (
                  <View key={a.id} style={[styles.card, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                    <View style={[styles.iconWrap, { borderColor: tone.border }]}>
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
              Reminders are generated from your own logs on this device.
            </Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function TabButton({ label, active, onPress, badge, dot }: { label: string; active: boolean; onPress: () => void; badge?: number; dot?: boolean }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.8}>
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
        <Ionicons name="sparkles" size={26} color={C.primary} />
      </View>
      <Text style={styles.teaserTitle}>Your week in review</Text>
      <Text style={styles.teaserBody}>
        Every Monday, get a personal breakdown of your week — calories, protein, hydration and weight —
        with tips on what to focus on next. A CalSnap Pro feature.
      </Text>
      {onUpgrade && (
        <TouchableOpacity style={styles.teaserBtn} onPress={onUpgrade} activeOpacity={0.88}>
          <Ionicons name="star" size={16} color={T.textOnPrimary} />
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
        <Ionicons name="sparkles" size={15} color={C.primary} />
        <Text style={styles.recapKicker}>WEEK IN REVIEW · {stats.week_label}</Text>
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
          <Ionicons name="ellipse" size={6} color={C.primary} style={{ marginTop: 7 }} />
          <Text style={styles.insightText}>{ins}</Text>
        </View>
      ))}

      <View style={styles.tipBox}>
        <Ionicons name="bulb-outline" size={16} color={C.primary} />
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
  root: { flex: 1, backgroundColor: C.bg },
  headerSafe: { zIndex: 10, backgroundColor: C.header, borderBottomWidth: 1, borderBottomColor: C.glassBorder },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.onSurface, letterSpacing: 0.3 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 10 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  tabActive: { backgroundColor: T.primaryTint, borderColor: 'rgba(133,211,218,0.45)' },
  tabText: { fontSize: 13.5, fontWeight: '700', color: C.onSurfaceVar },
  tabTextActive: { color: C.primary },
  tabDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.error },
  tabBadge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  tabBadgeText: { fontSize: 11, fontWeight: '800', color: T.textOnPrimary },

  scroll: { padding: 20, gap: 12 },

  center: { alignItems: 'center', gap: 10, paddingVertical: 56, paddingHorizontal: 24 },
  centerText: { fontSize: 13.5, color: C.onSurfaceVar },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.onSurface },
  emptyBody: { fontSize: 14, lineHeight: 21, color: C.onSurfaceVar, textAlign: 'center' },

  /* Reminder cards */
  card: { flexDirection: 'row', gap: 14, padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'flex-start' },
  iconWrap: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)' },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  cardBody: { fontSize: 13, lineHeight: 19, color: C.onSurfaceVar },
  footnote: { fontSize: 11, color: C.outline, textAlign: 'center', marginTop: 8, lineHeight: 16 },

  /* Locked teaser */
  teaser: { alignItems: 'center', gap: 12, padding: 24, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, marginTop: 8 },
  teaserIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: T.primaryTint, alignItems: 'center', justifyContent: 'center' },
  teaserTitle: { fontSize: 19, fontWeight: '800', color: C.onSurface },
  teaserBody: { fontSize: 14, lineHeight: 21, color: C.onSurfaceVar, textAlign: 'center' },
  teaserBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 22, borderRadius: 14, backgroundColor: T.primary, marginTop: 4 },
  teaserBtnText: { fontSize: 15, fontWeight: '800', color: T.textOnPrimary },

  /* Recap card */
  recap: { padding: 18, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, gap: 12 },
  recapHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recapKicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: C.primary },
  recapHeadline: { fontSize: 20, fontWeight: '800', color: C.onSurface, letterSpacing: -0.3, lineHeight: 26 },

  statStrip: {
    flexDirection: 'row',
    backgroundColor: T.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 16, fontWeight: '800', color: C.onSurface },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: C.outline },

  recapSummary: { fontSize: 14.5, lineHeight: 22, color: C.onSurfaceVar },
  insightRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  insightText: { flex: 1, fontSize: 13.5, lineHeight: 20, color: C.onSurface },

  tipBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: T.primaryTint,
    borderWidth: 1,
    borderColor: 'rgba(133,211,218,0.30)',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  tipText: { flex: 1, fontSize: 13.5, lineHeight: 20, fontWeight: '600', color: C.onSurface },
});
