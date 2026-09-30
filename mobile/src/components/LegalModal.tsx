import React from 'react';
import { View, StyleSheet, Modal, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TERMS, PRIVACY, LEGAL_LAST_UPDATED, type LegalSection } from '../content/legal';
import { ModalHeader } from './ModalHeader';
import { T, spacing } from '../theme';

export type LegalDoc = 'terms' | 'privacy';

interface LegalModalProps {
  visible: boolean;
  doc: LegalDoc;
  onClose: () => void;
}

export function LegalModal({ visible, doc, onClose }: LegalModalProps) {
  const sections: LegalSection[] = doc === 'terms' ? TERMS : PRIVACY;
  const heading = doc === 'terms' ? 'Terms of service' : 'Privacy policy';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <ModalHeader title={heading} onClose={onClose} />
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.updated}>Last updated: {LEGAL_LAST_UPDATED}</Text>
          {sections.map((s) => (
            <View key={s.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              <Text style={styles.sectionBody}>{s.body}</Text>
            </View>
          ))}
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
  updated: { fontSize: 13, color: T.textMuted, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: T.textPrimary, marginBottom: 6 },
  sectionBody: { fontSize: 15, lineHeight: 22, color: T.textSecondary },
});
