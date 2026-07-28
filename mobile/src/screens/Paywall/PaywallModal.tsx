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
import { T } from '../../theme';
import {
  getCurrentOffering,
  purchasePackage,
  restorePurchases,
} from "../../services/purchases";

// Screen palette — derived from the shared design tokens so colours stay in
// sync app-wide (see theme/tokens.ts).
const C = {
  bg: T.bg,
  glass: T.surface,
  glassBorder: T.border,
  primary: T.primary,
  secondary: T.primary,
  primaryCont: T.primaryDeep,
  onPrimaryCont: T.primary,
  onPrimary: T.textOnPrimary,
  onSurface: T.textPrimary,
  onSurfaceVar: T.textSecondary,
  outline: T.textMuted,
  outlineVar: T.border,
  surfaceCont: T.surface2,
  header: T.bg,
};

const BENEFITS = [
  { icon: 'infinite-outline',     label: 'Unlimited AI Scans'        },
  { icon: 'stats-chart-outline',  label: 'Full Nutrition Breakdown'  },
  { icon: 'sparkles-outline',     label: 'AI Nutri-Insights'         },
  { icon: 'calendar-outline',     label: '30 & 90-Day History'       },
  { icon: 'download-outline',     label: 'Excel Data Export'         },
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
      Alert.alert("Unavailable", "Plans are still loading. Please try again in a moment.");
      return;
    }
    setIsLoading(true);
    try {
      const isPro = await purchasePackage(selectedPkg);
      if (isPro) {
        await activatePro("Welcome to Pro! 🎉", "Your CalSnap Pro subscription is now active. Scan unlimited food!");
      }
    } catch (err: any) {
      // RevenueCat sets userCancelled on user-dismissed purchases — stay silent.
      if (!err?.userCancelled) {
        Alert.alert("Payment failed", err?.message ?? "Please try again.");
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
        await activatePro("Purchases restored", "Your CalSnap Pro subscription is active again.");
      } else {
        Alert.alert("Nothing to restore", "We couldn't find an active subscription for this account.");
      }
    } catch (err: any) {
      Alert.alert("Restore failed", err?.message ?? "Please try again.");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDismiss}>
      <View style={styles.root}>
        {/* ── Top Bar ── */}
        <SafeAreaView edges={["top"]} style={styles.headerSafe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onDismiss} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={C.primary} />
            </TouchableOpacity>
            <Text style={styles.brand}>Cal<Text style={styles.brandSnap}>Snap</Text></Text>
            <View style={styles.headerAvatar}>
              {profile?.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={styles.headerAvatarImg} />
                : <View style={[styles.headerAvatarImg, { backgroundColor: C.outlineVar, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: C.primary, fontWeight: '700', fontSize: 12 }}>{(profile?.name ?? 'U')[0].toUpperCase()}</Text>
                  </View>
              }
            </View>
          </View>
        </SafeAreaView>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="star" size={32} color={C.primary} />
            </View>
            <Text style={styles.heroTitle}>CalSnap <Text style={styles.heroTitlePro}>Pro</Text></Text>
            <Text style={styles.heroSubtitle}>
              {scansRemaining === 0
                ? "You've used all your free scans"
                : "Precision nutrition for peak human performance."}
            </Text>
          </View>

          {/* ── Benefits ── */}
          <View style={styles.benefitsCard}>
            {BENEFITS.map((item, i) => (
              <View key={item.label} style={[styles.benefitRow, i > 0 && { marginTop: 16 }]}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={item.icon} size={18} color={C.onPrimaryCont} />
                </View>
                <Text style={styles.benefitLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Plan Selection ── */}
          <View style={styles.plansBlock}>
            {/* Monthly */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedPlan("monthly")}
              style={[styles.planCard, selectedPlan === "monthly" && styles.planCardActive]}
            >
              <View style={styles.planRow}>
                <View>
                  <Text style={[styles.planPeriodLabel, { color: C.outline }]}>MONTHLY</Text>
                  <View style={styles.planPriceRow}>
                    <Text style={styles.planPrice}>{monthlyPkg?.product.priceString ?? "—"}</Text>
                    <Text style={styles.planPriceSub}> / mo</Text>
                  </View>
                </View>
                <View style={[styles.radioOuter, selectedPlan === "monthly" && { borderColor: C.primary, backgroundColor: C.primary }]}>
                  {selectedPlan === "monthly" && <View style={[styles.radioInner, { backgroundColor: C.onPrimary }]} />}
                </View>
              </View>
            </TouchableOpacity>

            {/* Annual */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedPlan("annual")}
              style={[styles.planCard, selectedPlan === "annual" && styles.planCardActive]}
            >
              {/* Best Value badge */}
              <View style={styles.bestValueBadge}>
                <Text style={styles.bestValueText}>
                  {savingsPct !== null ? `SAVE ${savingsPct}%` : 'BEST VALUE'}
                </Text>
              </View>
              <View style={styles.planRow}>
                <View>
                  <Text style={[styles.planPeriodLabel, { color: selectedPlan === "annual" ? C.primary : C.outline }]}>ANNUAL</Text>
                  <View style={styles.planPriceRow}>
                    <Text style={styles.planPrice}>{annualPkg?.product.priceString ?? "—"}</Text>
                    <Text style={styles.planPriceSub}> / yr</Text>
                  </View>

                  {/* Same unit as the monthly card, so the two are comparable at a glance */}
                  {!!annualPerMonth && (
                    <Text style={styles.perMonthLabel}>
                      Just {annualPerMonth} / mo · billed yearly
                    </Text>
                  )}

                  {/* The rupee amount is what people actually decide on */}
                  {savingsPct !== null && annualPkg && (
                    <Text style={styles.savingsLabel}>
                      You save {money(savingsAmount, annualPkg)} a year
                    </Text>
                  )}
                  {savingsPct !== null && monthlyPkg && (
                    <Text style={styles.compareLabel}>
                      vs {money(yearAtMonthlyRate, monthlyPkg)} paying monthly
                    </Text>
                  )}
                </View>
                <View style={[styles.radioOuter, selectedPlan === "annual" && { borderColor: C.primary, backgroundColor: C.primary }]}>
                  {selectedPlan === "annual" && <View style={[styles.radioInner, { backgroundColor: C.onPrimary }]} />}
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Assurance / Restore ── */}
          <View style={styles.paymentMethods}>
            <View style={styles.paymentMethod}>
              <Ionicons name="shield-checkmark-outline" size={18} color={C.outline} />
              <Text style={styles.paymentMethodLabel}>CANCEL ANYTIME</Text>
            </View>
            <View style={styles.paymentDivider} />
            <TouchableOpacity
              style={styles.paymentMethod}
              onPress={handleRestore}
              disabled={isRestoring || isLoading}
              activeOpacity={0.7}
            >
              {isRestoring
                ? <ActivityIndicator size="small" color={C.primary} />
                : <Ionicons name="refresh-outline" size={18} color={C.primary} />}
              <Text style={[styles.paymentMethodLabel, { color: C.primary }]}>RESTORE</Text>
            </TouchableOpacity>
          </View>

          {/* ── CTA Button ── */}
          <TouchableOpacity
            style={[styles.ctaButton, (isLoading || loadingOffering || !selectedPkg) && { opacity: 0.7 }]}
            onPress={handleSubscribe}
            disabled={isLoading || loadingOffering || !selectedPkg}
            activeOpacity={0.88}
          >
            {isLoading || loadingOffering
              ? <ActivityIndicator size="small" color={C.onPrimary} />
              : <Ionicons name="lock-closed" size={20} color={C.onPrimary} />}
            <Text style={styles.ctaText}>
              {loadingOffering
                ? "Loading plans…"
                : isLoading
                ? "Processing…"
                : selectedPkg
                ? `Subscribe · ${selectedPkg.product.priceString}${selectedPlan === "annual" ? "/yr" : "/mo"}`
                : "Plans unavailable"}
            </Text>
          </TouchableOpacity>

          {/* ── Legal ── */}
          <Text style={styles.legalText}>
            By subscribing, you agree to our{" "}
            <Text style={styles.legalLink} onPress={() => setLegalDoc("terms")}>Terms of Service</Text>
            {" "}and{" "}
            <Text style={styles.legalLink} onPress={() => setLegalDoc("privacy")}>Privacy Policy</Text>.
            {" "}Payment is charged to your App Store / Google Play account and subscriptions auto-renew until cancelled in your store settings.
          </Text>

          <View style={{ height: 40 }} />
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
  root: { flex: 1, backgroundColor: C.bg },

  /* Header */
  headerSafe: { zIndex: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: C.header,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5, color: C.primary },
  brandSnap: { color: C.secondary },
  headerAvatar: {
    width: 32, height: 32, borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.primary + '33',
  },
  headerAvatarImg: { width: 32, height: 32, borderRadius: 16 },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 32, gap: 28 },

  /* Hero */
  hero: { alignItems: 'center', gap: 10 },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.primary + '1A',
    borderWidth: 1, borderColor: C.primary + '4D',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 24, fontWeight: '700', color: C.onSurface },
  heroTitlePro: { color: C.primary },
  heroSubtitle: { fontSize: 15, color: C.onSurfaceVar, textAlign: 'center', lineHeight: 22 },

  /* Benefits */
  benefitsCard: {
    backgroundColor: C.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
    padding: 20,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  benefitIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.primaryCont,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  benefitLabel: { fontSize: 16, fontWeight: '600', color: C.onSurface },

  /* Plans */
  plansBlock: { gap: 14 },
  planCard: {
    backgroundColor: C.glass,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.glassBorder,
    padding: 20,
    overflow: 'hidden',
  },
  planCardActive: { borderColor: C.primary },
  planCardAnnual: { borderColor: C.primary },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planPeriodLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline' },
  planPrice: { fontSize: 26, fontWeight: '800', color: C.onSurface },
  planPriceSub: { fontSize: 14, color: C.onSurfaceVar },
  perMonthLabel: { fontSize: 13, fontWeight: '700', color: C.onSurface, marginTop: 4 },
  savingsLabel:  { fontSize: 13, fontWeight: '800', color: C.primary, marginTop: 4 },
  compareLabel:  { fontSize: 12, fontWeight: '500', color: C.outline, marginTop: 2, textDecorationLine: 'line-through' },
  radioOuter: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: C.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.bg },
  bestValueBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: C.primary,
    paddingHorizontal: 12, paddingVertical: 5,
    borderBottomLeftRadius: 10,
  },
  bestValueText: { fontSize: 11, fontWeight: '800', color: C.onPrimary, letterSpacing: 0.5 },

  /* Payment */
  paymentSection: { gap: 10 },
  paymentLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paymentLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.outline, textTransform: 'uppercase' },
  paymentBrand: { fontSize: 13, fontWeight: '800', color: C.onSurface + 'CC', letterSpacing: 0.5 },
  paymentMethods: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: T.divider,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.divider,
    gap: 16,
  },
  paymentMethod: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  paymentMethodLabel: { fontSize: 11, fontWeight: '800', color: C.outline, letterSpacing: 0.5 },
  paymentDivider: { width: 1, height: 16, backgroundColor: T.border },

  /* CTA */
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 60,
    backgroundColor: C.primary,
    borderRadius: 16,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaText: { fontSize: 18, fontWeight: '700', color: C.onPrimary },

  /* Legal */
  legalText: {
    fontSize: 11,
    color: C.outline,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: C.onSurfaceVar,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});


