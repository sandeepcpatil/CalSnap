import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { ScanStackParamList } from '../../navigation/ScanNavigator';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { getMealTypeFromTime } from '../../utils/nutrition';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { PaywallModal } from '../Paywall/PaywallModal';
import { ProGate } from '../../components/ProGate';
import { T } from '../../theme';

type Props = {
  navigation: NativeStackNavigationProp<ScanStackParamList, 'LabelResult'>;
  route: RouteProp<ScanStackParamList, 'LabelResult'>;
};

// Screen palette — derived from the shared design tokens so colours stay in
// sync app-wide (see theme/tokens.ts).
const C = {
  bg: T.bg,
  glass: T.surface,
  glassBorder: T.border,
  primary: T.primary,
  secondary: T.primary,
  onSurface: T.textPrimary,
  onSurfaceVar: T.textSecondary,
  outline: T.textMuted,
  good: T.success,
  medium: T.warning,
  bad: T.error,
};

function scoreColor(score: number): string {
  if (score >= 76) return C.good;
  if (score >= 56) return C.medium;
  return C.bad;
}

// ── Score ring ───────────────────────────────────────────────────────────────
const RING_SIZE = 148;
const RING_STROKE = 12;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const color = scoreColor(score);
  const offset = RING_CIRC * (1 - score / 100);
  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          stroke="rgba(255,255,255,0.08)" strokeWidth={RING_STROKE} fill="none"
        />
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          stroke={color} strokeWidth={RING_STROKE} fill="none"
          strokeDasharray={`${RING_CIRC}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={[styles.ringScore, { color }]}>{score}</Text>
        <Text style={styles.ringOutOf}>/ 100</Text>
      </View>
      <View style={[styles.gradeChip, { backgroundColor: color }]}>
        <Text style={styles.gradeChipText}>{grade}</Text>
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export function LabelResultScreen({ navigation, route }: Props) {
  const { imageUri, imageStorageUrl, result } = route.params;
  const { session, fetchProfile } = useAuthStore();
  const { addLog } = useFoodLogStore();
  const { isSubscribed, paywallVisible, showPaywall, dismissPaywall } = useSubscriptionGate();
  const [isSaving, setIsSaving] = useState(false);

  const { health, per_100g } = result;
  // Log one serving when the pack states one; otherwise fall back to 100 g.
  const factor = result.serving_g > 0 ? result.serving_g / 100 : 1;
  const servingLabel = result.serving_g > 0 ? `${result.serving_g}g serving` : '100g';

  const handleLog = async () => {
    if (!session?.user.id) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('food_logs')
        .insert({
          user_id: session.user.id,
          image_url: imageStorageUrl,
          food_name: result.brand ? `${result.brand} ${result.product_name}` : result.product_name,
          calories: Math.round(per_100g.energy_kcal * factor),
          protein_g: Math.round(per_100g.protein_g * factor * 10) / 10,
          carbs_g: Math.round(per_100g.carbs_g * factor * 10) / 10,
          fat_g: Math.round(per_100g.total_fat_g * factor * 10) / 10,
          fiber_g: Math.round(per_100g.fiber_g * factor * 10) / 10,
          meal_type: getMealTypeFromTime(),
          raw_ai_response: result,
          logged_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      addLog(data);
      await fetchProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.getParent()?.navigate('Home');
    } catch (err: unknown) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const NUTRITION_ROWS: { label: string; value: string }[] = [
    { label: 'Energy',        value: `${Math.round(per_100g.energy_kcal)} kcal` },
    { label: 'Protein',       value: `${per_100g.protein_g} g` },
    { label: 'Carbohydrates', value: `${per_100g.carbs_g} g` },
    { label: '  of which sugars', value: `${per_100g.sugar_g} g` },
    { label: 'Fat',           value: `${per_100g.total_fat_g} g` },
    { label: '  of which saturates', value: `${per_100g.sat_fat_g} g` },
    { label: 'Fibre',         value: `${per_100g.fiber_g} g` },
    { label: 'Sodium',        value: `${Math.round(per_100g.sodium_mg)} mg` },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Health Score</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Product row */}
        <View style={styles.productRow}>
          <Image source={{ uri: imageUri }} style={styles.productImg} />
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>{result.product_name}</Text>
            {!!result.brand && <Text style={styles.productBrand}>{result.brand}</Text>}
            <View style={styles.tagRow}>
              {result.is_beverage && (
                <View style={styles.tag}><Text style={styles.tagText}>BEVERAGE</Text></View>
              )}
              <View style={styles.tag}><Text style={styles.tagText}>PER {servingLabel.toUpperCase()}</Text></View>
            </View>
          </View>
        </View>

        {/* Score */}
        <View style={styles.scoreCard}>
          <ScoreRing score={health.score} grade={health.grade} />
          <Text style={styles.scoreCaption}>
            {health.score >= 76 ? 'A healthy choice'
              : health.score >= 56 ? 'Okay in moderation'
              : 'Consider a healthier alternative'}
          </Text>
          {!!health.summary && (
            <Text style={styles.scoreSummary}>{health.summary}</Text>
          )}
          {result.confidence !== 'high' && (
            <Text style={styles.confidenceNote}>
              ⚠ Label was partially readable — double-check values against the pack.
            </Text>
          )}
        </View>

        {/* Breakdown — Pro feature */}
        <ProGate isSubscribed={isSubscribed} onUpgrade={showPaywall} label="Full Health Breakdown" borderRadius={16}>
          <View style={styles.breakdownCard}>
            {health.positives.length > 0 && (
              <View style={styles.factList}>
                {health.positives.map((p) => (
                  <View key={p} style={styles.factRow}>
                    <Ionicons name="checkmark-circle" size={18} color={C.good} />
                    <Text style={styles.factText}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
            {health.negatives.length > 0 && (
              <View style={styles.factList}>
                {health.negatives.map((n) => (
                  <View key={n} style={styles.factRow}>
                    <Ionicons name="alert-circle" size={18} color={C.bad} />
                    <Text style={styles.factText}>{n}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.divider} />
            <Text style={styles.tableTitle}>NUTRITION PER 100{result.is_beverage ? 'ML' : 'G'}</Text>
            {NUTRITION_ROWS.map((row) => (
              <View key={row.label} style={styles.nutRow}>
                <Text style={[styles.nutLabel, row.label.startsWith(' ') && styles.nutSubLabel]}>
                  {row.label.trim()}
                </Text>
                <Text style={styles.nutValue}>{row.value}</Text>
              </View>
            ))}

            {result.ingredients.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.tableTitle}>INGREDIENTS</Text>
                <Text style={styles.ingredientsText}>{result.ingredients.join(', ')}</Text>
              </>
            )}
          </View>
        </ProGate>

        <Text style={styles.disclaimer}>
          CalSnap Score is computed from the label using Nutri-Score-based rules. It is general guidance, not medical advice.
        </Text>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.doneBtn}
          contentStyle={styles.btnContent}
          textColor={C.onSurfaceVar}
        >
          Scan Another
        </Button>
        <Button
          mode="contained"
          onPress={handleLog}
          loading={isSaving}
          disabled={isSaving}
          style={styles.logBtn}
          contentStyle={styles.btnContent}
          buttonColor={C.primary}
          textColor={T.textOnPrimary}
          icon="plus"
        >
          Log {servingLabel}
        </Button>
      </View>

      <PaywallModal visible={paywallVisible} onDismiss={dismissPaywall} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.onSurface, letterSpacing: 0.3 },

  scroll: { paddingHorizontal: 16, gap: 16 },

  productRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  productImg: { width: 72, height: 72, borderRadius: 14, backgroundColor: C.glass },
  productInfo: { flex: 1, gap: 3 },
  productName: { fontSize: 18, fontWeight: '800', color: C.onSurface, lineHeight: 23 },
  productBrand: { fontSize: 13, color: C.onSurfaceVar, fontWeight: '600' },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 3 },
  tag: {
    backgroundColor: T.divider, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  tagText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: C.outline },

  scoreCard: {
    backgroundColor: C.glass, borderRadius: 20, borderWidth: 1, borderColor: C.glassBorder,
    alignItems: 'center', paddingVertical: 24, gap: 12,
  },
  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringScore: { fontSize: 44, fontWeight: '800', letterSpacing: -1, lineHeight: 48 },
  ringOutOf: { fontSize: 12, fontWeight: '600', color: C.outline },
  gradeChip: {
    position: 'absolute', bottom: 2, alignSelf: 'center',
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: C.bg,
  },
  gradeChipText: { fontSize: 16, fontWeight: '800', color: T.textOnPrimary },
  scoreCaption: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  scoreSummary: {
    fontSize: 13,
    color: C.onSurfaceVar,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 24,
  },
  confidenceNote: {
    fontSize: 12, color: C.medium, textAlign: 'center',
    paddingHorizontal: 24, lineHeight: 17,
  },

  breakdownCard: {
    backgroundColor: C.glass, borderRadius: 16, borderWidth: 1, borderColor: C.glassBorder,
    padding: 18, gap: 8,
  },
  factList: { gap: 8, marginBottom: 4 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factText: { flex: 1, fontSize: 14, color: C.onSurface, lineHeight: 19 },

  divider: { height: 1, backgroundColor: T.divider, marginVertical: 8 },
  tableTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: C.outline, marginBottom: 6 },
  nutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  nutLabel: { fontSize: 14, color: C.onSurfaceVar, fontWeight: '600' },
  nutSubLabel: { paddingLeft: 14, fontWeight: '400', color: C.outline },
  nutValue: { fontSize: 14, color: C.onSurface, fontWeight: '700' },
  ingredientsText: { fontSize: 12.5, color: C.onSurfaceVar, lineHeight: 19 },

  disclaimer: { fontSize: 11, color: C.outline, textAlign: 'center', lineHeight: 15, paddingHorizontal: 12 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12,
    padding: 16, paddingBottom: 32,
    backgroundColor: C.bg,
    borderTopWidth: 1, borderTopColor: C.glassBorder,
  },
  doneBtn: { flex: 1, borderColor: C.glassBorder },
  logBtn: { flex: 2, borderRadius: 12 },
  btnContent: { height: 52 },
});
