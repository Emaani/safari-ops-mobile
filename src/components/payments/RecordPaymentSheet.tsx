import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { formatCurrency } from '../../lib/utils';
import type { Currency } from '../../types/dashboard';
import {
  PAYMENT_METHODS, validatePaymentDetails,
  type PaymentDetails, type PaymentMethod, type PaymentSource,
} from '../../lib/paymentMethods';
import { usePaymentRecording, generateRequestId } from '../../hooks/usePaymentRecording';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { enqueuePayment } from '../../lib/paymentQueue';
import { PaymentMethodFields } from './PaymentMethodFields';
import { TransactionIdBadge } from './TransactionIdBadge';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';

const C = {
  primary: '#8B6B3E',
  primarySoft: '#FEF0DC',
  success: '#34A853',
  danger: '#FF3B30',
  text: '#1C1C1E',
  textMuted: '#6C6C70',
  border: '#E5E5EA',
  input: '#F2F2F7',
  card: '#FFFFFF',
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface RecordPaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  source: PaymentSource;
  sourceId: string;
  balanceDue: number;
  currency: Currency;
  subjectLabel: string; // e.g. "REF-00123 · Acme Safaris"
  onRecorded?: (result: { systemTransactionId?: string; amountPaid?: number; balanceDue?: number }) => void;
}

export function RecordPaymentSheet({
  visible, onClose, source, sourceId, balanceDue, currency, subjectLabel, onRecorded,
}: RecordPaymentSheetProps) {
  const { t } = useAppPreferences();
  const { recordPayment, submitting } = usePaymentRecording();
  const { isOnline } = useNetworkStatus();

  const [requestId, setRequestId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [details, setDetails] = useState<PaymentDetails>({});
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate] = useState(todayISO());
  const [confirmation, setConfirmation] = useState<{ systemTransactionId?: string; replayed?: boolean; queuedOffline?: boolean } | null>(null);
  const [queueing, setQueueing] = useState(false);

  // Generate the request_id ONCE when the sheet opens — reused across retries
  // of this same payment attempt so a network retry never double-records.
  useEffect(() => {
    if (visible) {
      setRequestId(generateRequestId());
      setAmount('');
      setMethod('cash');
      setDetails({});
      setReference('');
      setDescription('');
      setConfirmation(null);
    }
  }, [visible]);

  const handleDetailsChange = useCallback((patch: Partial<PaymentDetails>) => {
    setDetails(prev => ({ ...prev, ...patch }));
  }, []);

  const handleSubmit = useCallback(async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid payment amount.');
      return;
    }
    const validationError = validatePaymentDetails(method, details, reference || null);
    if (validationError) {
      Alert.alert('Missing Information', validationError);
      return;
    }

    const params = {
      source,
      sourceId,
      amount: value,
      method,
      reference: reference.trim() || null,
      paymentDetails: details,
      transactionDate,
      description: description.trim() || null,
      requestId,
    };

    // No signal right now — don't even attempt the RPC. Queue it with this
    // same request_id and let usePaymentQueueSync submit it the moment
    // connectivity returns, so a guide in the field doesn't lose the record.
    if (!isOnline) {
      setQueueing(true);
      await enqueuePayment(params, subjectLabel);
      setQueueing(false);
      setConfirmation({ queuedOffline: true });
      return;
    }

    const result = await recordPayment(params);

    if (!result.ok) {
      // Surface the server's own message verbatim (overpayment, duplicate
      // Mobile Money reference, cancelled invoice, invalid method, etc.)
      Alert.alert('Payment Not Recorded', result.error || 'Something went wrong.');
      return;
    }

    setConfirmation({ systemTransactionId: result.system_transaction_id, replayed: result.replayed });
    onRecorded?.({
      systemTransactionId: result.system_transaction_id,
      amountPaid: result.amount_paid,
      balanceDue: result.balance_due,
    });
  }, [amount, method, details, reference, description, transactionDate, requestId, source, sourceId, recordPayment, onRecorded]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Without this, the keyboard just overlaps the fixed-position sheet —
          fields below whichever one is focused (e.g. Bank Name) become
          unreachable. KeyboardAvoidingView pushes the whole sheet up by the
          keyboard's height; the sheet's own maxHeight + the ScrollView's
          flexShrink below mean it then shrinks and scrolls internally
          instead of being pushed off the top of the screen. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={confirmation ? undefined : onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />

            {confirmation ? (
              <View style={styles.confirmWrap}>
                <View style={[styles.confirmIcon, confirmation.queuedOffline && styles.confirmIconQueued]}>
                  <Text style={{ fontSize: 28 }}>{confirmation.queuedOffline ? '📡' : '✓'}</Text>
                </View>
                <Text style={styles.confirmTitle}>
                  {confirmation.queuedOffline ? t('payments.savedWillSubmit') : confirmation.replayed ? t('payments.paymentAlreadyRecorded') : t('payments.paymentRecorded')}
                </Text>
                {/* subjectLabel (e.g. "REF-00123 · Acme Safaris") was shown on the
                    form but dropped once the confirmation replaced it — leaving
                    the new Transaction ID with no client/booking context next to
                    it. Carry it through so the ID is identifiable at a glance,
                    same as it is on the form itself. */}
                <Text style={styles.confirmSub}>{subjectLabel}</Text>
                {confirmation.queuedOffline && (
                  <Text style={styles.confirmSub}>{t('payments.queuedOfflineMsg')}</Text>
                )}
                {confirmation.replayed && (
                  <Text style={styles.confirmSub}>{t('payments.replayedMsg')}</Text>
                )}
                {confirmation.systemTransactionId && (
                  <View style={{ marginTop: 14 }}>
                    <TransactionIdBadge id={confirmation.systemTransactionId} />
                  </View>
                )}
                <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                  <Text style={styles.doneBtnT}>{t('payments.doneLabel')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.title}>{t('payments.recordPayment')}</Text>
                <Text style={styles.sub}>{subjectLabel}</Text>

                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>{t('payments.currentBalanceDue')}</Text>
                  <Text style={styles.balanceValue}>{formatCurrency(balanceDue, currency)}</Text>
                </View>

                {/* flexShrink (not a fixed maxHeight) lets this give up space to
                    the keyboard gracefully — it's the only flexible child inside
                    the height-capped sheet, so it shrinks and scrolls internally
                    instead of pushing the submit button off-screen. */}
                <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.label}>{t('payments.amountReceived', { currency })}</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor={C.textMuted}
                    keyboardType="decimal-pad"
                    autoFocus
                  />

                  <Text style={styles.label}>{t('payments.paymentMethod')}</Text>
                  <View style={styles.methodRow}>
                    {PAYMENT_METHODS.map(m => (
                      <TouchableOpacity
                        key={m.value}
                        style={[styles.methodChip, method === m.value && styles.methodChipOn]}
                        onPress={() => { setMethod(m.value); setDetails({}); setReference(''); }}
                      >
                        <Text style={[styles.methodChipT, method === m.value && styles.methodChipTOn]}>{m.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <PaymentMethodFields
                    method={method}
                    details={details}
                    onDetailsChange={handleDetailsChange}
                    reference={reference}
                    onReferenceChange={setReference}
                  />

                  <Text style={styles.label}>{t('payments.descriptionNote')}</Text>
                  <TextInput
                    style={styles.input}
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t('payments.optional')}
                    placeholderTextColor={C.textMuted}
                  />

                  <View style={{ height: 8 }} />
                </ScrollView>

                {!isOnline && (
                  <Text style={styles.offlineHint}>{t('payments.offlineHint')}</Text>
                )}

                <TouchableOpacity
                  style={[styles.submitBtn, (submitting || queueing) && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={submitting || queueing}
                >
                  {(submitting || queueing)
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.submitBtnT}>{isOnline ? t('payments.savePayment') : t('payments.saveOffline')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting || queueing}>
                  <Text style={styles.cancelBtnT}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '90%' },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 4 },
  sub: { fontSize: 13, color: C.textMuted, marginBottom: 16 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, marginBottom: 14 },
  balanceLabel: { fontSize: 13, color: C.textMuted, fontWeight: '600' },
  balanceValue: { fontSize: 16, fontWeight: '800', color: C.danger },
  label: { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 14 },
  amountInput: { backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: '700', color: C.text },
  input: { backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  methodChipOn: { backgroundColor: C.primarySoft, borderColor: C.primary },
  methodChipT: { fontSize: 12.5, fontWeight: '600', color: C.textMuted },
  methodChipTOn: { color: C.primary },
  offlineHint: { fontSize: 11.5, color: C.primary, backgroundColor: C.primarySoft, borderRadius: 10, padding: 10, marginTop: 12, lineHeight: 16 },
  submitBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  submitBtnT: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelBtnT: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  confirmWrap: { alignItems: 'center', paddingVertical: 10 },
  confirmIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E8F7EE', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  confirmIconQueued: { backgroundColor: C.primarySoft },
  confirmTitle: { fontSize: 17, fontWeight: '800', color: C.text, textAlign: 'center' },
  confirmSub: { fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 6, paddingHorizontal: 20, lineHeight: 18 },
  doneBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 48, alignItems: 'center', marginTop: 20 },
  doneBtnT: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
