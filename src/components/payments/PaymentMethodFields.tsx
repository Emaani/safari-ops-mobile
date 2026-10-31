import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { MOBILE_MONEY_PROVIDERS, type PaymentDetails, type PaymentMethod } from '../../lib/paymentMethods';

const BANK_OPTIONS = ['Stanbic Bank', 'I&M Bank'];

const C = {
  primary: '#8B6B3E',
  primarySoft: '#FEF0DC',
  text: '#1C1C1E',
  textMuted: '#6C6C70',
  border: '#E5E5EA',
  input: '#F2F2F7',
};

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.label}>{label}</Text>;
}

function Field({ value, onChange, placeholder, keyboardType, maxLength, autoCapitalize }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad'; maxLength?: number;
  autoCapitalize?: 'none' | 'characters';
}) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={C.textMuted}
      keyboardType={keyboardType || 'default'}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize || 'none'}
      autoCorrect={false}
      blurOnSubmit={false}
    />
  );
}

/** Dropdown for Bank Transfer's "Bank Name" — constrained to the two banks the business actually transacts with. */
function BankPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.selector} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[styles.selectorText, !value && { color: C.textMuted }]}>{value || 'Select bank'}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Select Bank</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {BANK_OPTIONS.map(bank => (
                <TouchableOpacity
                  key={bank}
                  style={[styles.option, value === bank && styles.optionActive]}
                  onPress={() => { onChange(bank); setOpen(false); }}
                >
                  <Text style={[styles.optionText, value === bank && styles.optionTextActive]}>{bank}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

interface PaymentMethodFieldsProps {
  method: PaymentMethod;
  details: PaymentDetails;
  onDetailsChange: (patch: Partial<PaymentDetails>) => void;
}

/**
 * Renders the method-specific fields the server's record_payment validates —
 * mirrors the web dashboard's PaymentMethodFields exactly, including that
 * neither one asks staff to manually type a reference/invoice number: the
 * server generates the permanent Transaction ID for every payment, and its
 * duplicate-payment check for Mobile Money matches on amount + provider +
 * phone number rather than a typed reference. A free-text reference field
 * used to sit here requiring only a non-empty value, which meant typing
 * just part of a real transaction number "worked" as readily as the full
 * one — removing manual entry removes that whole class of bad data.
 */
export function PaymentMethodFields({ method, details, onDetailsChange }: PaymentMethodFieldsProps) {
  switch (method) {
    case 'Mobile Money':
      return (
        <>
          <FieldLabel label="Provider *" />
          <View style={styles.providerRow}>
            {MOBILE_MONEY_PROVIDERS.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.providerChip, details.provider === p && styles.providerChipOn]}
                onPress={() => onDetailsChange({ provider: p })}
              >
                <Text style={[styles.providerChipT, details.provider === p && styles.providerChipTOn]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FieldLabel label="Phone Number *" />
          <Field value={details.phone_number || ''} onChange={v => onDetailsChange({ phone_number: v })} placeholder="e.g. 0772 123 456" keyboardType="phone-pad" />
          <Text style={styles.autoIdNotice}>The system generates the Transaction ID automatically; no reference is typed manually.</Text>
        </>
      );

    case 'Bank Transfer':
      return (
        <>
          <FieldLabel label="Bank Name *" />
          <BankPicker value={details.bank_name || ''} onChange={v => onDetailsChange({ bank_name: v })} />
          <FieldLabel label="Account Number (Last 4 Digits) *" />
          <Field value={details.account_number || ''} onChange={v => onDetailsChange({ account_number: v.replace(/\D/g, '').slice(0, 4) })} placeholder="1234" keyboardType="numeric" maxLength={4} />
          <Text style={styles.autoIdNotice}>The system generates the Transaction ID automatically; no reference is typed manually.</Text>
        </>
      );

    case 'Card':
      return (
        <>
          <Text style={styles.cardNotice}>Never enter a full card number or CVV — last 4 digits and the approval code only.</Text>
          <FieldLabel label="Payment Processor *" />
          <Field value={details.processor || ''} onChange={v => onDetailsChange({ processor: v })} placeholder="e.g. Visa, Flutterwave, Stripe" />
          <FieldLabel label="Card Last 4 Digits *" />
          <Field value={details.last_four || ''} onChange={v => onDetailsChange({ last_four: v.replace(/\D/g, '').slice(0, 4) })} placeholder="1234" keyboardType="numeric" maxLength={4} />
          <FieldLabel label="Approval / Auth Code *" />
          <Field value={details.approval_code || ''} onChange={v => onDetailsChange({ approval_code: v })} placeholder="Approval code" autoCapitalize="characters" />
        </>
      );

    case 'Cheque':
      return (
        <>
          <FieldLabel label="Cheque Number" />
          <Field value={details.cheque_number || ''} onChange={v => onDetailsChange({ cheque_number: v })} placeholder="Cheque number (optional)" autoCapitalize="characters" />
          <FieldLabel label="Issuing Bank *" />
          <Field value={details.bank_name || ''} onChange={v => onDetailsChange({ bank_name: v })} placeholder="e.g. Centenary Bank" />
          <FieldLabel label="Cheque Date *" />
          <Field value={details.cheque_date || ''} onChange={v => onDetailsChange({ cheque_date: v })} placeholder="YYYY-MM-DD" />
        </>
      );

    case 'Cash':
      return (
        <>
          <FieldLabel label="Receipt / Reference Note" />
          <Field value={details.receipt_note || ''} onChange={v => onDetailsChange({ receipt_note: v })} placeholder="Optional note" />
        </>
      );

    case 'Other':
    default:
      return (
        <>
          <FieldLabel label="Payment Details *" />
          <Field value={details.details || ''} onChange={v => onDetailsChange({ details: v })} placeholder="Describe how this payment was made" />
        </>
      );
  }
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text },
  providerRow: { flexDirection: 'row', gap: 8 },
  providerChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  providerChipOn: { backgroundColor: C.primarySoft, borderColor: C.primary },
  providerChipT: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  providerChipTOn: { color: C.primary },
  cardNotice: { fontSize: 11, color: '#B5482F', backgroundColor: '#FBEAE4', borderRadius: 8, padding: 10, marginTop: 10, lineHeight: 15 },
  autoIdNotice: { fontSize: 11, color: C.textMuted, fontStyle: 'italic', marginTop: 14, lineHeight: 15 },
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  selectorText: { fontSize: 14, color: C.text },
  chevron: { fontSize: 14, color: C.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '60%' },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  option: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  optionActive: { backgroundColor: C.primarySoft + '50', borderRadius: 8, paddingHorizontal: 8 },
  optionText: { fontSize: 15, color: C.text },
  optionTextActive: { color: C.primary, fontWeight: '700' },
});
