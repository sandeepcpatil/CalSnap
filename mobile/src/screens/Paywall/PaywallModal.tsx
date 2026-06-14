import React, { useState } from 'react';
import { View, StyleSheet, Modal, Alert } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/authStore';
import { createSubscriptionOrder } from '../../services/api';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const FEATURES = [
  'Unlimited food scans',
  'Full history & calendar',
  '7-day trend charts',
  'Priority AI analysis',
];

const PLANS = [
  {
    id: 'monthly' as const,
    label: 'Monthly',
    price: '₹150',
    period: '/month',
    savings: null,
    badge: null,
  },
  {
    id: 'annual' as const,
    label: 'Annual',
    price: '₹1,200',
    period: '/year',
    savings: 'Save ₹600/year',
    badge: '🔥 Best Value',
  },
];

export function PaywallModal({ visible, onDismiss }: Props) {
  const { session, fetchProfile } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!session?.access_token) return;
    setIsLoading(true);

    try {
      const order = await createSubscriptionOrder(selectedPlan, session.access_token);

      // Dynamic import to avoid bundling issues in Expo Go
      const RazorpayCheckout = (await import('react-native-razorpay')).default;

      const options = {
        description: `CalSnap Pro - ${selectedPlan}`,
        name: 'CalSnap',
        key: order.razorpayKeyId,
        subscription_id: order.subscriptionId,
        currency: 'INR',
        prefill: {
          email: session.user.email ?? '',
        },
        theme: { color: '#01696f' },
      };

      await RazorpayCheckout.open(options);
      // Payment successful — webhook will update subscription status
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await fetchProfile();
      onDismiss();
      Alert.alert('Welcome to Pro! 🎉', 'Your CalSnap Pro subscription is now active. Scan unlimited food!');
    } catch (err: any) {
      // User closed Razorpay checkout — not an error
      if (err?.code !== 'PAYMENT_CANCELLED') {
        Alert.alert('Payment failed', err.message ?? 'Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Close button */}
          <View style={styles.closeRow}>
            <Button mode="text" onPress={onDismiss} textColor="#90a4ae" compact>✕</Button>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>⭐</Text>
            <Text variant="headlineSmall" style={styles.title}>Upgrade to CalSnap Pro</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              You've used your 5 free scans
            </Text>
          </View>

          {/* Feature list */}
          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color="#01696f" />
                <Text variant="bodyMedium" style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Plan cards */}
          <View style={styles.plans}>
            {PLANS.map((plan) => (
              <View
                key={plan.id}
                style={[styles.planCard, selectedPlan === plan.id && styles.planCardSelected]}
              >
                {plan.badge && (
                  <View style={styles.planBadge}>
                    <Text variant="labelSmall" style={styles.planBadgeText}>{plan.badge}</Text>
                  </View>
                )}
                <Button
                  mode="text"
                  onPress={() => setSelectedPlan(plan.id)}
                  style={{ padding: 0 }}
                  contentStyle={{ flexDirection: 'column', height: 'auto', padding: 0 }}
                >
                  <View style={styles.planContent}>
                    <Text variant="titleMedium" style={[styles.planLabel, selectedPlan === plan.id && styles.planLabelSelected]}>
                      {plan.label}
                    </Text>
                    <Text variant="headlineMedium" style={[styles.planPrice, selectedPlan === plan.id && styles.planPriceSelected]}>
                      {plan.price}
                      <Text variant="bodySmall" style={styles.planPeriod}>{plan.period}</Text>
                    </Text>
                    {plan.savings && (
                      <Text variant="labelSmall" style={styles.planSavings}>{plan.savings}</Text>
                    )}
                  </View>
                </Button>
              </View>
            ))}
          </View>

          {/* CTA */}
          <Button
            mode="contained"
            onPress={handleSubscribe}
            loading={isLoading}
            disabled={isLoading}
            style={styles.ctaButton}
            contentStyle={styles.ctaContent}
            buttonColor="#01696f"
          >
            Continue with {selectedPlan === 'monthly' ? 'Monthly' : 'Annual'}
          </Button>

          <Text variant="bodySmall" style={styles.legal}>
            Cancel anytime · Billed via Razorpay · Secure payment
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 16,
  },
  closeRow: { alignItems: 'flex-end', paddingTop: 12 },
  header: { alignItems: 'center', gap: 6 },
  headerEmoji: { fontSize: 40 },
  title: { color: '#212121', fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#78909c', textAlign: 'center' },
  features: { gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { color: '#37474f' },
  plans: { flexDirection: 'row', gap: 12 },
  planCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    padding: 14,
    alignItems: 'center',
    position: 'relative',
  },
  planCardSelected: { borderColor: '#01696f', backgroundColor: '#e0f2f1' },
  planBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#01696f',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  planBadgeText: { color: '#fff', fontWeight: '700' },
  planContent: { alignItems: 'center', gap: 2 },
  planLabel: { color: '#546e7a', fontWeight: '600' },
  planLabelSelected: { color: '#01696f' },
  planPrice: { color: '#212121', fontWeight: '800' },
  planPriceSelected: { color: '#01696f' },
  planPeriod: { color: '#90a4ae', fontWeight: '400' },
  planSavings: { color: '#4caf50', fontWeight: '700' },
  ctaButton: { borderRadius: 14 },
  ctaContent: { height: 52 },
  legal: { color: '#bdbdbd', textAlign: 'center' },
});
