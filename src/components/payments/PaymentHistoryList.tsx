import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { formatCurrency, formatDateDDMMYY } from '../../lib/utils';
import { PAYMENT_METHODS } from '../../lib/paymentMethods';
import { usePaymentHistory, type PaymentEvent } from '../../hooks/usePaymentHistory';
import { usePaymentReversal } from '../../hooks/usePaymentReversal';
import { useUserRole } from '../../hooks/useUserRole';
import { TransactionIdBadge, ExternalReferenceBadge } from './TransactionIdBadge';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';

const C = {
  primary: '#8B6B3E',
  primarySoft: '#FEF0DC',
  success: '#34A853',
  danger: '#FF3B30',
  text: '#1C1C1E',
  textMuted: '#6C6C70',
  border: '#E5E5EA',
  card: '#FFFFFF',
  input: '#F2F2F7',
};

const methodLabel = (m: string) => PAYMENT_METHODS.find(pm => pm.value === m)?.label || m;

function ReversalSheet({ event, visible, onClose, onReversed }: {
  event: PaymentEvent | null; visible: boolean; onClose: () => void; onReversed: () => void;
}) {
  const { t } = useAppPreferences();
  const { reversePayment, reversing } = usePaymentReversal();
  const [reason, setReason] = useState('');

  const submit = useCallback(async () => {
    if (!event) return;
    if (!reason.trim()) { Alert.alert('Reason Required', 'Enter a reason for this reversal.'); return; }
    const result = await reversePayment(event.id, reason.trim());
    if (!result.ok) { Alert.alert('Reversal Failed', result.error || 'Could not reverse this payment.'); return; }
    setReason('');
    onReversed();
    onClose();
  }, [event, reason, reversePayment, onReversed, onClose]);

  if (!event) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Same fix as RecordPaymentSheet — without this the keyboard covers
          the Confirm/Cancel buttons the moment the reason field autofocuses. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={rs.backdrop} onPress={onClose}>
          <Pressable style={rs.sheet} onPress={() => {}}>
            <View style={rs.handle} />
            <Text style={rs.title}>{t('payments.reversePaymentTitle')}</Text>
            <Text style={rs.sub}>{event.system_transaction_id} · {formatCurrency(event.amount, event.currency)}</Text>
            <Text style={rs.warn}>{t('payments.permanentReverseWarning')}</Text>
            <Text style={rs.label}>{t('payments.reasonLabel')}</Text>
            <TextInput
              style={rs.input}
              value={reason}
              onChangeText={setReason}
              placeholder={t('payments.reasonPlaceholder')}
              placeholderTextColor={C.textMuted}
              multiline
            />
            <TouchableOpacity style={[rs.submitBtn, reversing && { opacity: 0.6 }]} onPress={submit} disabled={reversing}>
              {reversing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={rs.submitBtnT}>{t('payments.confirmReversal')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={rs.cancelBtn} onPress={onClose} disabled={reversing}>
              <Text style={rs.cancelBtnT}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface PaymentHistoryListProps {
  sourceId: string | null;
}

/** payment_events is read-only traceability — never aggregate this into revenue/expense totals. */
export function PaymentHistoryList({ sourceId }: PaymentHistoryListProps) {
  const { t } = useAppPreferences();
  const { events, loading, error, refresh } = usePaymentHistory({ sourceId });
  const { canReversePayments } = useUserRole();
  const [reversingEvent, setReversingEvent] = useState<PaymentEvent | null>(null);

  if (loading) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={C.primary} />
      </View>
    );
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  if (events.length === 0) {
    return (
      <View style={{ paddingVertical: 28, alignItems: 'center' }}>
        <Text style={styles.emptyText}>{t('payments.noPaymentsRecorded')}</Text>
      </View>
    );
  }

  return (
    <View>
      {events.map(e => {
        const isReversed = e.status === 'reversed';
        return (
          <View key={e.id} style={[styles.card, isReversed && styles.cardReversed]}>
            <View style={styles.row}>
              <TransactionIdBadge id={e.system_transaction_id} size="small" />
              {isReversed && (
                <View style={styles.reversedPill}><Text style={styles.reversedPillT}>{t('payments.reversedBadge')}</Text></View>
              )}
            </View>
            <View style={[styles.row, { marginTop: 8 }]}>
              <Text style={[styles.amount, isReversed && styles.amountReversed]}>{formatCurrency(e.amount, e.currency)}</Text>
              <Text style={styles.method}>{methodLabel(e.method)}</Text>
            </View>
            <Text style={styles.meta}>
              {formatDateDDMMYY(e.transaction_date)}
              {e.recorded_by_name ? ` · ${t('payments.recordedByPrefix', { name: e.recorded_by_name })}` : ''}
            </Text>
            {e.reference && (
              <View style={{ marginTop: 8 }}>
                <ExternalReferenceBadge reference={e.reference} />
              </View>
            )}
            {e.description ? <Text style={styles.description}>{e.description}</Text> : null}
            {e.receipt_document_id ? <Text style={styles.receiptNote}>{t('payments.receiptAttached')}</Text> : null}

            {!isReversed && canReversePayments && (
              <TouchableOpacity style={styles.reverseBtn} onPress={() => setReversingEvent(e)}>
                <Text style={styles.reverseBtnT}>{t('payments.reversePaymentBtn')}</Text>
              </TouchableOpacity>
            )}
            {isReversed && e.reversed_by_name && (
              <Text style={styles.reversedMeta}>{t('payments.reversedByPrefix', { name: e.reversed_by_name })}{e.reversed_at ? t('payments.onDateSuffix', { date: formatDateDDMMYY(e.reversed_at) }) : ''}</Text>
            )}
          </View>
        );
      })}

      <ReversalSheet
        event={reversingEvent}
        visible={reversingEvent != null}
        onClose={() => setReversingEvent(null)}
        onReversed={refresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardReversed: { opacity: 0.65 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { fontSize: 16, fontWeight: '800', color: C.text },
  amountReversed: { textDecorationLine: 'line-through', color: C.textMuted },
  method: { fontSize: 12, fontWeight: '700', color: C.primary, backgroundColor: C.primarySoft, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  meta: { fontSize: 11, color: C.textMuted, marginTop: 6 },
  description: { fontSize: 12, color: C.textMuted, marginTop: 6, fontStyle: 'italic' },
  receiptNote: { fontSize: 11, color: C.primary, marginTop: 6, fontWeight: '600' },
  reversedPill: { backgroundColor: '#FFEEED', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  reversedPillT: { fontSize: 9, fontWeight: '800', color: C.danger },
  reversedMeta: { fontSize: 11, color: C.danger, marginTop: 8, fontWeight: '600' },
  reverseBtn: { marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#FFEEED' },
  reverseBtnT: { fontSize: 12, fontWeight: '700', color: C.danger },
  errorText: { fontSize: 13, color: C.danger, textAlign: 'center', paddingVertical: 20 },
  emptyText: { fontSize: 13, color: C.textMuted },
});

const rs = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '90%' },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 4 },
  sub: { fontSize: 13, color: C.textMuted, marginBottom: 14 },
  warn: { fontSize: 12, color: C.danger, backgroundColor: '#FFEEED', borderRadius: 10, padding: 10, marginBottom: 14, lineHeight: 16 },
  label: { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, minHeight: 70, maxHeight: 140, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: C.danger, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  submitBtnT: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelBtnT: { fontSize: 14, fontWeight: '600', color: C.textMuted },
});
