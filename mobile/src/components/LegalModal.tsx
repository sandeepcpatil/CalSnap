import React from 'react';
import { View, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TERMS, PRIVACY, LEGAL_LAST_UPDATED, type LegalSection } from '../content/legal';
import { T } from '../theme';

export type LegalDoc = 'terms' | 'privacy';

interface LegalModalProps {
  visible: boolean;
  doc: LegalDoc;
  onClose: () => void;
}

// Screen palette — derived from the shared design tokens so colours stay in
// sync app-wide (see theme/tokens.ts).
const C = {
  bg: T.bg,
  header: T.bg,
  border: T.border,
  primary: T.primary,
  title: T.textPrimary,
  body: T.textSecondary,
  muted: T.textMuted,
};

export function LegalModal({ visible, doc, onClose }: LegalModalProps) {
  const sections: LegalSection[] = doc === 'terms' ? TERMS : PRIVACY;
  const heading = doc === 'terms' ? 'Terms of Service' : 'Privacy Policy';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: C.header }}>
          <View style={styles.header}>
            <Text style={styles.heading}>{heading}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color={C.primary} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.updated}>Last updated: {LEGAL_LAST_UPDATED}</Text>
          {sections.map((s) => (
            <View key={s.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              <Text style={styles.sectionBody}>{s.body}</Text>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.header,
  },
  heading: { fontSize: 18, fontWeight: '800', color: C.title },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 22, paddingTop: 18 },
  updated: { fontSize: 12, color: C.muted, marginBottom: 18, fontStyle: 'italic' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.title, marginBottom: 6 },
  sectionBody: { fontSize: 14, lineHeight: 21, color: C.body },
});
