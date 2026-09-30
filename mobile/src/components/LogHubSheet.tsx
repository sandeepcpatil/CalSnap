import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Animated, Easing } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useWater } from '../hooks/useWater';
import { QUICK_ADD_ML, formatMl } from '../utils/water';
import { T, withAlpha, type, spacing, radius, HIT_TARGET } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPhoto: () => void;
  onHistory: () => void;
  onVoice: () => void;
  onWaterMore: () => void;
}

/** How long the "+250 ml added" confirmation stays up before the sheet closes. */
const CONFIRM_MS = 850;

/**
 * The four ways to log, in one sheet.
 *
 * They are deliberately not a tidy 2×2 grid, because they aren't peers. Photo
 * is the most-used and gets visual primacy so the extra tap costs nothing.
 * Water is the most *frequent* (6–8× a day) and isn't calories at all, so it
 * resolves inside the sheet: two taps, no navigation. Only Photo opens the
 * camera.
 */
export function LogHubSheet({ visible, onClose, onPhoto, onHistory, onVoice, onWaterMore }: Props) {
  const { consumedMl, goalMl, add } = useWater();
  const [confirmedMl, setConfirmedMl] = useState<number | null>(null);
  const slide = useRef(new Animated.Value(0)).current;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 150,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
    if (!visible) setConfirmedMl(null);
  }, [visible, slide]);

  // A pending auto-close must not fire into an unmounted tree, or into a sheet
  // the user has since reopened.
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const quickAddWater = (ml: number) => {
    setConfirmedMl(ml);
    // Fire-and-forget: the store is optimistic and surfaces its own failure
    // alert, so the sheet shouldn't sit there waiting on the network.
    void add(ml);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(onClose, CONFIRM_MS);
  };

  const go = (action: () => void) => {
    onClose();
    action();
  };

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.grabber} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>Log something</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={T.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Photo, primary. The only tile with a tinted border. */}
          <TouchableOpacity
            style={styles.photoTile}
            onPress={() => go(onPhoto)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Take a photo of a meal or a nutrition label"
          >
            <View style={styles.photoIcon}>
              <Ionicons name="camera" size={24} color={T.primary} />
            </View>
            <View style={styles.tileText}>
              <Text style={styles.tileTitle}>Take a photo</Text>
              <Text style={styles.tileSub}>Meal or nutrition label</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>

          {/* Secondary pair */}
          <View style={styles.pairRow}>
            <TouchableOpacity
              style={styles.smallTile}
              onPress={() => go(onHistory)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Find a food from your history or saved meals. Uses no scan."
            >
              <Ionicons name="bookmark-outline" size={21} color={T.textPrimary} />
              <Text style={styles.smallTitle}>Find a food</Text>
              <Text style={styles.smallSub}>Recent and my meals</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smallTile}
              onPress={() => go(onVoice)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Describe what you ate by speaking or typing"
            >
              <Ionicons name="create-outline" size={21} color={T.textPrimary} />
              <Text style={styles.smallTitle}>Describe it</Text>
              <Text style={styles.smallSub}>Speak or type</Text>
            </TouchableOpacity>
          </View>

          {/* Water resolves in place, no navigation */}
          <View style={styles.waterCard}>
            <View style={styles.waterHead}>
              <View style={styles.waterIcon}>
                <Ionicons name="water" size={16} color={T.primary} />
              </View>
              <View style={styles.tileText}>
                <Text style={styles.tileTitle}>Water</Text>
                <Text style={styles.tileSub}>
                  {confirmedMl
                    ? `Added ${formatMl(confirmedMl)}`
                    : `${formatMl(consumedMl)} of ${formatMl(goalMl)} today`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => go(onWaterMore)}
                style={styles.moreBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="More water options"
              >
                <Text style={styles.moreText}>More</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickRow}>
              {QUICK_ADD_ML.map((ml) => {
                const done = confirmedMl === ml;
                return (
                  <TouchableOpacity
                    key={ml}
                    style={[styles.quickBtn, done && styles.quickBtnDone]}
                    onPress={() => quickAddWater(ml)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${formatMl(ml)} of water`}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={16} color={T.textOnPrimary} />
                    ) : (
                      <Text style={styles.quickText}>+{formatMl(ml)}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing['3xl'] + 2,
    gap: spacing.sm + 2,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.grabber,
    marginBottom: spacing.xs + 2,
  },

  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs },
  title: { flex: 1, ...type.title, color: T.textPrimary },
  closeBtn: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },

  tileText: { flex: 1, gap: 2 },
  tileTitle: { ...type.body, fontWeight: '800', color: T.textPrimary },
  tileSub: { ...type.bodySm, fontWeight: '600', color: T.textMuted },

  photoTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg - 2,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: T.primaryTint,
    borderWidth: 1,
    borderColor: T.primaryBorder,
  },
  photoIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(T.primaryDeep, 0.35),
  },

  pairRow: { flexDirection: 'row', gap: spacing.sm + 2 },
  smallTile: {
    flex: 1,
    gap: 3,
    padding: spacing.lg - 2,
    borderRadius: radius.lg,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  smallTitle: { ...type.body, fontWeight: '800', color: T.textPrimary, marginTop: spacing.xs },
  smallSub: { ...type.bodySm, fontWeight: '600', color: T.textMuted },

  waterCard: {
    gap: spacing.md,
    padding: spacing.lg - 2,
    borderRadius: radius.lg,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  waterHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  waterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primaryTint,
  },
  moreBtn: { minHeight: HIT_TARGET, paddingHorizontal: spacing.sm + 2, justifyContent: 'center' },
  moreText: { ...type.bodySm, fontWeight: '700', color: T.primary },

  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quickBtn: {
    flex: 1,
    height: HIT_TARGET,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surfaceOffset,
    borderWidth: 1,
    borderColor: T.border,
  },
  quickBtnDone: { backgroundColor: T.primary, borderColor: T.primary },
  quickText: { ...type.bodySm, fontWeight: '800', color: T.textPrimary },
});
