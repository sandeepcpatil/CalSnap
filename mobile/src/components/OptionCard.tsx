import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { T, spacing, radius, HIT_TARGET, type } from '../theme';

interface Props {
  label: string;
  description?: string;
  /** Ionicons glyph shown in a tinted well on the left. */
  icon: React.ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  onPress: () => void;
}

/**
 * A single "pick one" row used by the onboarding steps and anywhere else a
 * short list of exclusive choices appears.
 *
 * Replaces two hand-built variants (ActivityStep, GoalStep) that disagreed on
 * padding, radius, label size and how selection was shown, and the emoji
 * glyphs that rendered differently per OS and were read aloud by screen
 * readers. Selection is a tinted border plus a checkmark, so it does not rely
 * on colour alone.
 */
export function OptionCard({ label, description, icon, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, selected && styles.cardSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
    >
      <View style={[styles.well, selected && styles.wellSelected]}>
        <Ionicons name={icon} size={22} color={selected ? T.textOnPrimary : T.primary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? T.primary : T.textMuted}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT_TARGET + spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  cardSelected: {
    borderColor: T.primaryBorder,
    backgroundColor: T.primaryTint,
  },
  well: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface2,
  },
  wellSelected: {
    backgroundColor: T.primary,
  },
  text: { flex: 1, gap: 2 },
  label: { ...type.body, fontWeight: '700', color: T.textPrimary },
  desc: { ...type.bodySm, color: T.textSecondary },
});
