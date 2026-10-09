import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const C = {
  primary: '#8B6B3E',
  primarySoft: '#FEF0DC',
  textMuted: '#6C6C70',
};

/**
 * Shows the permanent system transaction ID (e.g. JAA-PMT-20261007-000123), always
 * visually distinct from the external reference (MoMo ID / bank ref / cheque no.).
 */
export function TransactionIdBadge({ id, size = 'default' }: { id: string; size?: 'default' | 'small' }) {
  return (
    <View style={[styles.badge, size === 'small' && styles.badgeSmall]}>
      <Text style={[styles.label, size === 'small' && styles.labelSmall]}>TXN</Text>
      <Text style={[styles.id, size === 'small' && styles.idSmall]} selectable>{id}</Text>
    </View>
  );
}

export function ExternalReferenceBadge({ reference }: { reference: string }) {
  return (
    <View style={styles.refBadge}>
      <Text style={styles.refLabel}>REF</Text>
      <Text style={styles.refText} selectable>{reference}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  badgeSmall: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  label: { fontSize: 9, fontWeight: '800', color: C.primary, letterSpacing: 0.5 },
  labelSmall: { fontSize: 8 },
  id: { fontSize: 12, fontWeight: '700', color: C.primary, fontVariant: ['tabular-nums'] },
  idSmall: { fontSize: 10 },
  refBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  refLabel: { fontSize: 9, fontWeight: '800', color: C.textMuted, letterSpacing: 0.5 },
  refText: { fontSize: 12, fontWeight: '600', color: '#1C1C1E' },
});
