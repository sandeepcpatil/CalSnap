import React from 'react';
import { View, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ModalHeader } from '../../components/ModalHeader';
import { T, type, spacing, radius, HIT_TARGET } from '../../theme';

/**
 * "Your data": the privacy policy as a table you can actually read.
 *
 * Every sentence here is checked against the code (backend/src/routes/account.ts,
 * analyze.ts, barcode.ts) and the in-app privacy policy. If one changes, change
 * the other.
 */

interface DataRow {
  key: string;
  label: string;
  usedFor: string;
  keptFor: string;
}

const DATA_ROWS: DataRow[] = [
  {
    key: 'photos',
    label: 'Meal photos',
    usedFor: 'Sent to Google Gemini to estimate the items, calories and macros in a meal.',
    keptFor: 'Deleted from our storage 90 days after upload.',
  },
  {
    key: 'voice',
    label: 'Voice clips',
    usedFor: 'Sent to Google Gemini to turn what you said into a meal entry.',
    keptFor: 'Not stored by us after the entry is created.',
  },
  {
    key: 'logs',
    label: 'Nutrition logs',
    usedFor: 'Your daily totals, history, insights and export.',
    keptFor: 'Until you delete the entry or your account.',
  },
  {
    key: 'water-weight',
    label: 'Water and weight',
    usedFor: 'Your hydration goal and weight trend.',
    keptFor: 'Until you delete the entry or your account.',
  },
  {
    key: 'profile',
    label: 'Profile',
    usedFor: 'Height, weight, age, activity and goal set your daily targets.',
    keptFor: 'Until you change it or delete your account.',
  },
  {
    key: 'account',
    label: 'Account',
    usedFor: 'Your Google sign-in (name, email, photo) keeps your data tied to you.',
    keptFor: 'Until you delete your account.',
  },
];

interface Recipient {
  key: string;
  name: string;
  purpose: string;
}

const RECIPIENTS: Recipient[] = [
  { key: 'gemini', name: 'Google Gemini', purpose: 'Analyses meal photos and transcribes voice clips.' },
  { key: 'supabase', name: 'Supabase', purpose: 'Hosts your account, logs and photos.' },
  { key: 'billing', name: 'RevenueCat and Google Play', purpose: 'Handle Pro subscriptions. We never see your card details.' },
  { key: 'off', name: 'Open Food Facts', purpose: 'Looks up packaged foods. It receives the barcode only.' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  /** "Delete everything" link. The parent closes this modal and scrolls to the Account section. */
  onDeleteEverything: () => void;
}

export function DataPrivacyScreen({ visible, onClose, onDeleteEverything }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <ModalHeader title="Your data" onClose={onClose} />
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            What CalVue keeps, what it is used for and how long it stays. We do not sell your personal data.
          </Text>

          {/* ── Data table ── */}
          <Text style={styles.sectionLabel}>What we keep</Text>
          <View style={styles.card}>
            {DATA_ROWS.map((row, i) => (
              <View key={row.key} style={[styles.dataRow, i > 0 && styles.rowDivider]}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <View style={styles.cell}>
                  <Text style={styles.cellHead}>What it is used for</Text>
                  <Text style={styles.cellBody}>{row.usedFor}</Text>
                </View>
                <View style={styles.cell}>
                  <Text style={styles.cellHead}>Kept for</Text>
                  <Text style={styles.cellBody}>{row.keptFor}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Who sees it ── */}
          <Text style={styles.sectionLabel}>Who sees it</Text>
          <View style={styles.card}>
            {RECIPIENTS.map((r, i) => (
              <View key={r.key} style={[styles.recipientRow, i > 0 && styles.rowDivider]}>
                <Text style={styles.rowLabel}>{r.name}</Text>
                <Text style={styles.cellBody}>{r.purpose}</Text>
              </View>
            ))}
          </View>

          {/* ── Delete ── */}
          <Text style={styles.sectionLabel}>Delete everything</Text>
          <View style={styles.card}>
            <Text style={[styles.cellBody, styles.deleteCopy]}>
              Deleting your account removes the account, every log and every photo. It cannot be undone.
            </Text>
            <TouchableOpacity
              style={styles.deleteLink}
              onPress={onDeleteEverything}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Delete everything. Opens the Account section of your profile."
            >
              <Text style={styles.deleteLinkText}>Go to Delete account</Text>
              <Ionicons name="chevron-forward" size={16} color={T.error} />
            </TouchableOpacity>
          </View>

          <View style={{ height: spacing['4xl'] }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  headerSafe: { backgroundColor: T.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  intro: { ...type.body, color: T.textSecondary, marginBottom: spacing.xl },
  sectionLabel: { ...type.bodySm, fontWeight: '700', color: T.textMuted, marginBottom: spacing.sm },
  card: {
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    marginBottom: spacing['2xl'],
  },
  dataRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  recipientRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 2 },
  rowDivider: { borderTopWidth: 1, borderTopColor: T.divider },
  rowLabel: { ...type.body, fontWeight: '700', color: T.textPrimary },
  cell: { gap: 2 },
  cellHead: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: T.textMuted },
  cellBody: { ...type.bodySm, color: T.textSecondary },
  deleteCopy: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: HIT_TARGET,
    paddingHorizontal: spacing.lg,
  },
  deleteLinkText: { ...type.body, fontWeight: '700', color: T.error },
});
