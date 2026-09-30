import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useWater } from '../hooks/useWater';
import { QUICK_ADD_ML, formatMl, waterProgress } from '../utils/water';
import { T, spacing, radius, type, HIT_TARGET, tabularNums } from '../theme';

interface Props {
  /** Opens the full Water screen. */
  onOpen: () => void;
}

/**
 * Water's permanent home on the Dashboard.
 *
 * The log hub sheet can also add water, but a hub-only entry point is too slow
 * for something people do eight times a day — this puts the two commonest
 * amounts one tap from the screen the app opens on.
 */
export function WaterCard({ onOpen }: Props) {
  const { consumedMl, goalMl, add } = useWater();
  const pct = waterProgress(consumedMl, goalMl);
  const met = consumedMl >= goalMl;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.head}
        onPress={onOpen}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Water: ${formatMl(consumedMl)} of ${formatMl(goalMl)}. Open water tracking.`}
      >
        <View style={styles.icon}>
          <Ionicons name="water-outline" size={18} color={T.textSecondary} />
        </View>
        <View style={styles.headText}>
          <Text style={styles.label}>Water</Text>
          <Text style={styles.value}>
            {formatMl(consumedMl)}
            <Text style={styles.goal}> / {formatMl(goalMl)}</Text>
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
      </TouchableOpacity>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%`, backgroundColor: met ? T.success : T.primary },
          ]}
        />
      </View>

      <View style={styles.quickRow}>
        {QUICK_ADD_ML.slice(0, 2).map((ml) => (
          <TouchableOpacity
            key={ml}
            style={styles.quickBtn}
            onPress={() => add(ml)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Add ${formatMl(ml)} of water`}
          >
            <Ionicons name="add" size={16} color={T.primary} />
            <Text style={styles.quickText}>{formatMl(ml)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: HIT_TARGET },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface2,
  },
  headText: { flex: 1, gap: 1 },
  label: { ...type.body, fontWeight: '600', color: T.textSecondary },
  value: { ...type.titleSm, fontSize: 19, fontWeight: '800', color: T.textPrimary, ...tabularNums },
  goal: { ...type.bodySm, fontWeight: '600', color: T.textSecondary },

  track: { height: 6, borderRadius: 3, backgroundColor: T.surface2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },

  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: HIT_TARGET,
    borderRadius: radius.md,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  quickText: { ...type.bodySm, fontWeight: '800', color: T.primary, ...tabularNums },
});
