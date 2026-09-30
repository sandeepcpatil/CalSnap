import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Alert,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { useAuthStore } from "../../store/authStore";
import { LegalModal, type LegalDoc } from "../../components/LegalModal";
import { useSubscriptionGate } from "../../hooks/useSubscriptionGate";
import { supabase } from "../../services/supabase";
import { syncSubscription } from "../../services/api";
import { T, spacing, radius, type, HIT_TARGET } from '../../theme';
import {
  getCurrentOffering,
  purchasePackage,
  restorePurchases,
} from "../../services/purchases";

// The backend caps Pro at 20 scans a day and the Terms describe fair use, so
// the paywall must never say "unlimited".
const PRO_SCANS_PER_DAY = 20;

const BENEFITS = [
  { icon: 'camera-outline',       label: `Up to ${PRO_SCANS_PER_DAY} AI scans a day` },
  { icon: 'stats-chart-outline',  label: 'Full nutrition breakdown'  },
  { icon: 'sparkles-outline',     label: 'Daily insights'            },
  { icon: 'calendar-outline',     label: '30 and 90-day history'     },
  { icon: 'download-outline',     label: 'Export your data (spreadsheet)' },
] as const;

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function PaywallModal({ visible, onDismiss }: Props) {
  const { fetchProfile, profile } = useAuthStore();
  const { scansRemaining } = useSubscriptionGate();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("annual");
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  const monthlyPkg: PurchasesPackage | null = offering?.monthly ?? null;
  const annualPkg: PurchasesPackage | null = offering?.annual ?? null;

  // Load the store products (localized prices) when the paywall opens.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoadingOffering(true);
    getCurrentOffering()
      .then((o) => { if (active) setOffering(o); })
      .catch(() => { if (active) setOffering(null); })
      .finally(() => { if (active) setLoadingOffering(false); });
    return () => { active = false; };
  }, [visible]);

  // Fall back to whichever plan is available if the selected one isn't.
  const selectedPkg =
    selectedPlan === "annual" ? (annualPkg ?? monthlyPkg) : (monthlyPkg ?? annualPkg);

  // ── Annual vs monthly value ──────────────────────────────────────────────
  // A percentage alone is abstract; people decide on the rupee amount. Show
  // both, plus the effective per-month price so the two plans are comparable
  // on the same unit.
  const canCompare = !!monthlyPkg && !!annualPkg && monthlyPkg.product.price > 0;
  const yearAtMonthlyRate = canCompare ? monthlyPkg!.product.price * 12 : 0;
  const savingsAmount = canCompare ? yearAtMonthlyRate - annualPkg!.product.price : 0;
  const savingsPct =
    canCompare && savingsAmount > 0
      ? Math.round((savingsAmount / yearAtMonthlyRate) * 100)
      : null;

  /** Format a raw amount in the store's own currency (₹, $, …). */
  const money = (amount: number, pkg: PurchasesPackage): string => {
    const code = pkg.product.currencyCode;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      // Older RN/Hermes builds ship without full ICU. Reuse the symbol the
      // store already gave us (e.g. "₹1,299.00" → "₹") so the amount still
      // reads as money.
      const symbol = pkg.product.priceString.match(/^[^\d]*/)?.[0]?.trim() ?? '';
      return `${symbol}${Math.round(amount).toLocaleString()}`;
    }
  };

  const annualPerMonth =
    annualPkg ? money(annualPkg.product.price / 12, annualPkg) : null;

  // Push the fresh entitlement to the backend so the server-side scan gate
  // unlocks immediately, then refresh the local profile.
  const activatePro = useCallback(
    async (title: string, body: string) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        try {
          await syncSubscription(token);
        } catch {
          // The RevenueCat webhook reconciles shortly even if this call fails.
        }
      }
      await fetchProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDismiss();
      Alert.alert(title, body);
    },
    [fetchProfile, onDismiss],
  );

  const handleSubscribe = async () => {
    if (!selectedPkg) {
      Alert.alert("Plans still loading", "Please try again in a moment.");
      return;
    }
    setIsLoading(true);
    try {
      const isPro = await purchasePackage(selectedPkg);
      if (isPro) {
        await activatePro(
          "Welcome to Pro",
          `Your CalVue Pro subscription is active. You can now scan up to ${PRO_SCANS_PER_DAY} meals a day.`,
        );
      }
    } catch (err: any) {
      // RevenueCat sets userCancelled on user-dismissed purchases — stay silent.
      // Store error messages are not shown verbatim; they are logged by the SDK.
      if (!err?.userCancelled) {
        Alert.alert("Payment didn't go through", "You haven't been charged. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const isPro = await restorePurchases();
      if (isPro) {
        await activatePro("Purchases restored", "Your CalVue Pro subscription is active again.");
      } else {
        Alert.alert("Nothing to restore", "We couldn't find an active subscription for this account.");
      }
    } catch {
      Alert.alert("Couldn't restore purchases", "Check your connection and try again.");
    } finally {
      setIsRestoring(false);
    }
  };

  const busy = isLoading || loadingOffering || !selectedPkg;

  const renderPlan = (
    plan: "monthly" | "annual",
    pkg: PurchasesPackage | null,
  ) => {
    const active = selectedPlan === plan;
    const isAnnual = plan === "annual";
    const price = pkg?.product.priceString ?? "—";
    const unit = isAnnual ? "yr" : "mo";
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setSelectedPlan(plan)}
        style={[styles.planCard, active && styles.planCardActive]}
        accessibilityRole="radio"
        accessibilityState={{ selected: active, checked: active }}
        accessibilityLabel={`${isAnnual ? "Annual" : "Monthly"} plan, ${price} per ${isAnnual ? "year" : "month"}`}
      >
        {isAnnual && (
          <View style={styles.bestValueBadge}>
            <Text style={styles.bestValueText}>
              {savingsPct !== null ? `Save ${savingsPct}%` : 'Best value'}
            </Text>
          </View>
        )}
        <View style={styles.planRow}>
          <View style={styles.planInfo}>
            <Text style={[styles.planPeriodLabel, active && styles.planPeriodLabelActive]}>
              {isAnnual ? "Annual" : "Monthly"}
            </Text>
            <View style={styles.planPriceRow}>
              <Text style={styles.planPrice}>{price}</Text>
              <Text style={styles.planPriceSub}> / {unit}</Text>
            </View>

            {isAnnual && !!annualPerMonth && (
              // Same unit as the monthly card, so the two are comparable at a glance
              <Text style={styles.perMonthLabel}>
                {annualPerMonth} / mo, billed yearly
              </Text>
            )}
            {isAnnual && savingsPct !== null && annualPkg && (
              // The rupee amount is what people actually decide on
              <Text style={styles.savingsLabel}>
                You save {money(savingsAmount, annualPkg)} a year
              </Text>
            )}
            {isAnnual && savingsPct !== null && monthlyPkg && (
              <Text style={styles.compareLabel}>
                vs {money(yearAtMonthlyRate, monthlyPkg)} paying monthly
              </Text>
            )}
          </View>
          <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
            {active && <View style={styles.radioInner} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDismiss}>
      <View style={styles.root}>
        {/* ── Top Bar ── */}
        <SafeAreaView edges={["top"]} style={styles.headerSafe}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onDismiss}
              style={styles.closeBtn}
              hitSlop={8}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={T.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.brand}>Cal<Text style={styles.brandAccent}>Vue</Text></Text>
            <View style={styles.headerAvatar}>
              {profile?.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={styles.headerAvatarImg} accessibilityIgnoresInvertColors />
                : <View style={[styles.headerAvatarImg, styles.headerAvatarFallback]}>
                    <Text style={styles.headerAvatarInitial}>{(profile?.name ?? 'U')[0].toUpperCase()}</Text>
                  </View>
              }
            </View>
          </View>
        </SafeAreaView>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="star" size={32} color={T.primary} />
            </View>
            <Text style={styles.heroTitle}>CalVue <Text style={styles.heroTitlePro}>Pro</Text></Text>
            <Text style={styles.heroSubtitle}>
              {scansRemaining === 0
                ? "You've used all your free scans for today."
                : "Log meals faster and see the full picture."}
            </Text>
          </View>

          {/* ── Benefits ── */}
          <View style={styles.benefitsCard}>
            {BENEFITS.map((item, i) => (
              <View key={item.label} style={[styles.benefitRow, i > 0 && styles.benefitRowGap]}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={item.icon} size={18} color={T.primary} />
                </View>
                <Text style={styles.benefitLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Plan Selection ── */}
          <View style={styles.plansBlock} accessibilityRole="radiogroup">
            {renderPlan("monthly", monthlyPkg)}
            {renderPlan("annual", annualPkg)}
          </View>

          {/* ── CTA ── */}
          <View style={styles.ctaBlock}>
            <View style={styles.assuranceRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={T.textMuted} />
              <Text style={styles.assuranceText}>Cancel anytime</Text>
            </View>

            <TouchableOpacity
              style={[styles.ctaButton, busy && styles.ctaButtonDisabled]}
              onPress={handleSubscribe}
              disabled={busy}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy: isLoading || loadingOffering }}
            >
              {isLoading || loadingOffering
                ? <ActivityIndicator size="small" color={T.textOnPrimary} />
                : <Ionicons name="lock-closed" size={20} color={T.textOnPrimary} />}
              <Text style={styles.ctaText}>
                {loadingOffering
                  ? "Loading plans"
                  : isLoading
                  ? "Processing"
                  : selectedPkg
                  ? `Subscribe · ${selectedPkg.product.priceString}${selectedPlan === "annual" ? "/yr" : "/mo"}`
                  : "Plans unavailable"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreBtn}
              onPress={handleRestore}
              disabled={isRestoring || isLoading}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Restore purchases"
              accessibilityState={{ disabled: isRestoring || isLoading, busy: isRestoring }}
            >
              {isRestoring
                ? <ActivityIndicator size="small" color={T.textSecondary} />
                : <Text style={styles.restoreText}>Restore purchases</Text>}
            </TouchableOpacity>
          </View>

          {/* ── Legal ── */}
          <Text style={styles.legalText}>
            By subscribing, you agree to our{" "}
            <Text style={styles.legalLink} accessibilityRole="link" onPress={() => setLegalDoc("terms")}>Terms of Service</Text>
            {" "}and{" "}
            <Text style={styles.legalLink} accessibilityRole="link" onPress={() => setLegalDoc("privacy")}>Privacy Policy</Text>.
            {" "}Payment is charged to your App Store or Google Play account and subscriptions renew automatically until cancelled in your store settings.
          </Text>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <LegalModal
          visible={legalDoc !== null}
          doc={legalDoc ?? 'terms'}
          onClose={() => setLegalDoc(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  /* Header */
  headerSafe: { zIndex: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: T.bg,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  closeBtn: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5, color: T.textPrimary },
  brandAccent: { color: T.primary },
  headerAvatar: {
    width: 32, height: 32, borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.primaryBorder,
    marginHorizontal: (HIT_TARGET - 32) / 2,
  },
  headerAvatarImg: { width: 32, height: 32, borderRadius: radius.pill },
  headerAvatarFallback: { backgroundColor: T.surface2, alignItems: 'center', justifyContent: 'center' },
  headerAvatarInitial: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: T.primary },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing['3xl'], gap: spacing['2xl'] },

  /* Hero */
  hero: { alignItems: 'center', gap: spacing.sm },
  heroIcon: {
    width: 64, height: 64, borderRadius: radius.pill,
    backgroundColor: T.primaryTint,
    borderWidth: 1, borderColor: T.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { ...type.headline, color: T.textPrimary },
  heroTitlePro: { color: T.primary },
  heroSubtitle: { ...type.body, color: T.textSecondary, textAlign: 'center' },

  /* Benefits */
  benefitsCard: {
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
    padding: spacing.xl,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  benefitRowGap: { marginTop: spacing.lg },
  benefitIcon: {
    width: 36, height: 36, borderRadius: radius.pill,
    backgroundColor: T.primaryTint,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  benefitLabel: { ...type.body, fontSize: 16, fontWeight: '600', color: T.textPrimary, flex: 1 },

  /* Plans */
  plansBlock: { gap: spacing.md },
  planCard: {
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: T.border,
    padding: spacing.xl,
    overflow: 'hidden',
  },
  planCardActive: { borderColor: T.primary, backgroundColor: T.primaryTint },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  planInfo: { flex: 1 },
  planPeriodLabel: { ...type.bodySm, fontWeight: '700', color: T.textSecondary, marginBottom: spacing.xs },
  planPeriodLabelActive: { color: T.primary },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline' },
  planPrice: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: T.textPrimary },
  planPriceSub: { ...type.body, color: T.textSecondary },
  perMonthLabel: { ...type.bodySm, fontWeight: '700', color: T.textPrimary, marginTop: spacing.xs },
  savingsLabel:  { ...type.bodySm, fontWeight: '800', color: T.primary, marginTop: spacing.xs },
  compareLabel:  { ...type.bodySm, color: T.textMuted, marginTop: 2, textDecorationLine: 'line-through' },
  radioOuter: {
    width: 24, height: 24, borderRadius: radius.pill,
    borderWidth: 2, borderColor: T.textMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: T.primary, backgroundColor: T.primary },
  radioInner: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: T.textOnPrimary },
  bestValueBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: T.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderBottomLeftRadius: radius.sm,
  },
  bestValueText: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: T.textOnPrimary },

  /* CTA */
  ctaBlock: { gap: spacing.md },
  assuranceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  assuranceText: { ...type.bodySm, color: T.textMuted },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 56,
    backgroundColor: T.primary,
    borderRadius: radius.md,
  },
  ctaButtonDisabled: { opacity: 0.7 },
  ctaText: { ...type.titleSm, color: T.textOnPrimary },
  restoreBtn: { minHeight: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  restoreText: { ...type.body, color: T.textSecondary },

  /* Legal */
  legalText: {
    fontSize: 12,
    lineHeight: 18,
    color: T.textMuted,
    textAlign: 'center',
  },
  legalLink: {
    color: T.textSecondary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  bottomSpacer: { height: spacing['4xl'] },
});
