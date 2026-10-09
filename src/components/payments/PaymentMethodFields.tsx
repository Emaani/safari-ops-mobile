import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { MOBILE_MONEY_PROVIDERS, type PaymentDetails, type PaymentMethod } from '../../lib/paymentMethods';

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

interface PaymentMethodFieldsProps {
  method: PaymentMethod;
  details: PaymentDetails;
  onDetailsChange: (patch: Partial<PaymentDetails>) => void;
  reference: string;
  onReferenceChange: (v: string) => void;
}

/** Renders the method-specific fields the server's record_payment validates — mirrors web PaymentMethodFields. */
export function PaymentMethodFields({ method, details, onDetailsChange, reference, onReferenceChange }: PaymentMethodFieldsProps) {
  switch (method) {
    case 'mobile_money':
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
          <FieldLabel label="Transaction Reference *" />
          <Field value={reference} onChange={onReferenceChange} placeholder="Mobile Money transaction ID" autoCapitalize="characters" />
        </>
      );

    case 'bank_transfer':
      return (
        <>
          <FieldLabel label="Bank Name *" />
          <Field value={details.bank_name || ''} onChange={v => onDetailsChange({ bank_name: v })} placeholder="e.g. Stanbic Bank" />
          <FieldLabel label="Reference *" />
          <Field value={reference} onChange={onReferenceChange} placeholder="Bank transfer reference" autoCapitalize="characters" />
        </>
      );

    case 'card':
      return (
        <>
          <Text style={styles.cardNotice}>Never enter a full card number or CVV — last 4 digits and the approval code only.</Text>
          <FieldLabel label="Card Last 4 Digits *" />
          <Field value={details.last_four || ''} onChange={v => onDetailsChange({ last_four: v.replace(/\D/g, '').slice(0, 4) })} placeholder="1234" keyboardType="numeric" maxLength={4} />
          <FieldLabel label="Approval / Auth Code *" />
          <Field value={details.approval_code || ''} onChange={v => onDetailsChange({ approval_code: v })} placeholder="Approval code" autoCapitalize="characters" />
          <FieldLabel label="Reference" />
          <Field value={reference} onChange={onReferenceChange} placeholder="Optional reference" autoCapitalize="characters" />
        </>
      );

    case 'cheque':
      return (
        <>
          <FieldLabel label="Cheque Number *" />
          <Field value={details.cheque_number || ''} onChange={v => onDetailsChange({ cheque_number: v })} placeholder="Cheque number" autoCapitalize="characters" />
          <FieldLabel label="Issuing Bank *" />
          <Field value={details.cheque_bank || ''} onChange={v => onDetailsChange({ cheque_bank: v })} placeholder="e.g. Centenary Bank" />
        </>
      );

    case 'cash':
      return (
        <>
          <FieldLabel label="Receipt / Reference Note" />
          <Field value={details.receipt_note || ''} onChange={v => onDetailsChange({ receipt_note: v })} placeholder="Optional note" />
        </>
      );

    case 'other':
    default:
      return (
        <>
          <FieldLabel label="Reference" />
          <Field value={reference} onChange={onReferenceChange} placeholder="Optional reference" autoCapitalize="characters" />
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
});
