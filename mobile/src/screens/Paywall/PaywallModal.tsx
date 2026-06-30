import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Alert,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../services/supabase";
import { createSubscriptionOrder } from "../../services/api";
import { useSubscriptionGate } from "../../hooks/useSubscriptionGate";

const C = {
  bg:            '#101415',
  glass:         'rgba(15,23,42,0.80)',
  glassBorder:   'rgba(255,255,255,0.08)',
  primary:       '#85d3da',
  secondary:     '#bdf4ff',
  primaryCont:   '#01696f',
  onPrimaryCont: '#97e6ec',
  onPrimary:     '#00363a',
  onSurface:     '#e0e3e5',
  onSurfaceVar:  '#bec8c9',
  outline:       '#889393',
  outlineVar:    '#3f4949',
  surfaceCont:   '#1d2022',
  header:        'rgba(16,20,21,0.88)',
};

const BENEFITS = [
  { icon: 'camera-outline',       label: 'Unlimited AI Scans'       },
  { icon: 'stats-chart-outline',  label: 'Deep Macro Insights'      },
  { icon: 'restaurant-outline',   label: 'Personalized Meal Plans'  },
] as const;

const PAYMENT_METHODS = [
  { icon: 'qr-code-outline',   label: 'UPI'       },
  { icon: 'card-outline',      label: 'CARD'      },
  { icon: 'business-outline',  label: 'NETBANKING'},
] as const;

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function PaywallModal({ visible, onDismiss }: Props) {
  const { session, fetchProfile, profile } = useAuthStore();
  const { scansRemaining } = useSubscriptionGate();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("annual");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const {
        data: { session: freshSession },
        error: refreshError,
      } = await supabase.auth.refreshSession();
      if (refreshError || !freshSession?.access_token) {
        Alert.alert("Session expired", "Please sign out and sign back in, then try again.");
        return;
      }

      const order = await createSubscriptionOrder(selectedPlan, freshSession.access_token);

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RazorpayCheckout = require("react-native-razorpay").default;
      const options = {
        description: `CalSnap Pro - ${selectedPlan}`,
        name: "CalSnap",
        key: order.razorpayKeyId,
        subscription_id: order.subscriptionId,
        currency: "INR",
        prefill: { email: freshSession.user.email ?? "" },
        theme: { color: C.primary },
      };

      await RazorpayCheckout.open(options);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await fetchProfile();
      onDismiss();
      Alert.alert("Welcome to Pro! 🎉", "Your CalSnap Pro subscription is now active. Scan unlimited food!");
    } catch (err: any) {
      if (err?.code !== "PAYMENT_CANCELLED") {
        Alert.alert("Payment failed", err.message ?? "Please try again.");
      }
    } finally {
      setIsLoading(false);
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
                    <Text style={styles.planPrice}>₹149</Text>
                    <Text style={styles.planPriceSub}> / mo</Text>
                  </View>
                </View>
                <View style={[styles.radioOuter, selectedPlan === "monthly" && { borderColor: C.primary }]}>
                  {selectedPlan === "monthly" && <View style={styles.radioInner} />}
                </View>
              </View>
            </TouchableOpacity>

            {/* Annual */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedPlan("annual")}
              style={[styles.planCard, selectedPlan === "annual" && styles.planCardActive, styles.planCardAnnual]}
            >
              {/* Best Value badge */}
              <View style={styles.bestValueBadge}>
                <Text style={styles.bestValueText}>Best Value</Text>
              </View>
              <View style={styles.planRow}>
                <View>
                  <Text style={[styles.planPeriodLabel, { color: selectedPlan === "annual" ? C.primary : C.outline }]}>ANNUAL</Text>
                  <View style={styles.planPriceRow}>
                    <Text style={styles.planPrice}>₹999</Text>
                    <Text style={styles.planPriceSub}> / yr</Text>
                  </View>
                  <Text style={styles.savingsLabel}>Save 45% compared to monthly</Text>
                </View>
                <View style={[styles.radioOuter, { borderColor: C.primary, backgroundColor: C.primary }]}>
                  <View style={[styles.radioInner, { backgroundColor: C.onPrimary }]} />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Payment Methods ── */}
          <View style={styles.paymentSection}>
            <View style={styles.paymentLabelRow}>
              <Text style={styles.paymentLabel}>Secure Payment via</Text>
              <Text style={styles.paymentBrand}>RAZORPAY</Text>
            </View>
            <View style={styles.paymentMethods}>
              {PAYMENT_METHODS.map((m, i) => (
                <React.Fragment key={m.label}>
                  {i > 0 && <View style={styles.paymentDivider} />}
                  <View style={styles.paymentMethod}>
                    <Ionicons name={m.icon} size={18} color={C.outline} />
                    <Text style={styles.paymentMethodLabel}>{m.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* ── CTA Button ── */}
          <TouchableOpacity
            style={[styles.ctaButton, isLoading && { opacity: 0.7 }]}
            onPress={handleSubscribe}
            disabled={isLoading}
            activeOpacity={0.88}
          >
            <Ionicons name={isLoading ? "reload-outline" : "lock-closed"} size={20} color={C.onPrimary} />
            <Text style={styles.ctaText}>
              {isLoading ? "Processing…" : "Secure Checkout"}
            </Text>
          </TouchableOpacity>

          {/* ── Legal ── */}
          <Text style={styles.legalText}>
            By subscribing, you agree to our Terms of Service and Privacy Policy. Subscriptions auto-renew until cancelled in Settings.
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
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
  savingsLabel: { fontSize: 12, fontWeight: '600', color: C.primary, marginTop: 4 },
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
  bestValueText: { fontSize: 10, fontWeight: '800', color: C.onPrimary, letterSpacing: 0.5 },

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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 16,
  },
  paymentMethod: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  paymentMethodLabel: { fontSize: 10, fontWeight: '800', color: C.outline, letterSpacing: 0.5 },
  paymentDivider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.10)' },

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
});


