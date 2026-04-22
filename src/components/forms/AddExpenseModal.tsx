/**
 * AddExpenseModal
 * Collects expense/cash-requisition details and inserts into `cash_requisitions`.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Path, Rect } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import type { Currency } from '../../types/dashboard';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#f6f2eb',
  card:    '#fffdf9',
  hero:    '#171513',
  primary: '#1f4d45',
  danger:  '#c96d4d',
  warning: '#b8883f',
  text:    '#181512',
  muted:   '#7f7565',
  border:  '#e1d7c8',
  input:   '#f0ebe2',
};

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Operating Expense',
  'Petty Cash',
  'Fleet Supplies',
  'Admin Costs',
  'Safari Expense',
  'Fuel',
  'Accommodation',
  'Repairs & Maintenance',
  'Other',
];

const CURRENCIES: Currency[] = ['USD', 'UGX', 'KES'];

// ─── Icons ────────────────────────────────────────────────────────────────────
function CloseIcon({ color = C.muted }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  );
}

function CalendarIcon({ color = C.primary }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  );
}

const fieldStyles = StyleSheet.create({
  wrap:          { marginBottom: 14 },
  label:         { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  iconInput:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  iconInputText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
});

// ─── Date Input ───────────────────────────────────────────────────────────────
function DateInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [raw, setRaw] = useState(value || '');
  const handleChange = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 4) formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
    if (cleaned.length > 6) formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4, 6) + '-' + cleaned.slice(6, 8);
    setRaw(formatted);
    if (formatted.length === 10) onChange(formatted);
    else if (formatted.length === 0) onChange('');
  };
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={fieldStyles.iconInput}>
        <CalendarIcon />
        <TextInput
          style={fieldStyles.iconInputText}
          value={raw}
          onChangeText={handleChange}
          placeholder={placeholder || 'YYYY-MM-DD'}
          placeholderTextColor={C.muted}
          keyboardType="numeric"
          maxLength={10}
        />
      </View>
    </View>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId?: string;
  userName?: string;
}

export function AddExpenseModal({ visible, onClose, onSuccess, userId, userName }: AddExpenseModalProps) {
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);

  const [category,    setCategory]    = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [amount,      setAmount]      = useState('');
  const [currency,    setCurrency]    = useState<Currency>('USD');
  const [dateNeeded,  setDateNeeded]  = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [requestedBy, setRequestedBy] = useState(userName || '');

  const reset = useCallback(() => {
    setCategory(CATEGORIES[0]); setDescription(''); setAmount('');
    setCurrency('USD'); setRequestedBy(userName || '');
    const d = new Date();
    setDateNeeded(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }, [userName]);

  const validate = (): string | null => {
    if (!category) return 'Please select a category.';
    if (!description.trim()) return 'Description is required.';
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return 'Amount must be a positive number.';
    if (!dateNeeded.match(/^\d{4}-\d{2}-\d{2}$/)) return 'Date needed must be YYYY-MM-DD.';
    return null;
  };

  const handleSubmit = useCallback(async () => {
    const err = validate();
    if (err) { Alert.alert('Validation Error', err); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const cr_number = `CR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      const { error } = await supabase.from('cash_requisitions').insert({
        cr_number,
        expense_category: category,
        description:      description.trim(),
        total_cost:       parseFloat(amount),
        currency,
        date_needed:      dateNeeded,
        status:           'Pending',
        requested_by:     requestedBy.trim() || userName || user?.email || 'Staff',
        created_at:       new Date().toISOString(),
      });
      if (error) throw error;
      reset();
      onSuccess();
      Alert.alert('Requisition Submitted', `Cash Requisition ${cr_number} has been created and is pending approval.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [category, description, amount, currency, dateNeeded, requestedBy, userName, reset, onSuccess]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.container, { paddingTop: insets.top || 12 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerEyebrow}>Finance</Text>
              <Text style={styles.headerTitle}>Cash Requisition</Text>
            </View>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.closeBtn}>
              <CloseIcon />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

            {/* Category chips */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Category *</Text>
              <View style={styles.chipGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, category === cat && styles.chipActive]}
                    onPress={() => setCategory(cat)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe what this expense is for…"
                placeholderTextColor={C.muted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Amount + Currency */}
            <View style={styles.row}>
              <View style={{ flex: 2 }}>
                <View style={fieldStyles.wrap}>
                  <Text style={fieldStyles.label}>Amount *</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor={C.muted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={{ flex: 1, marginBottom: 14 }}>
                <Text style={fieldStyles.label}>Currency</Text>
                <View style={styles.segCol}>
                  {CURRENCIES.map(cur => (
                    <TouchableOpacity
                      key={cur}
                      style={[styles.seg, currency === cur && styles.segActive]}
                      onPress={() => setCurrency(cur)}
                    >
                      <Text style={[styles.segText, currency === cur && styles.segTextActive]}>{cur}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Date needed */}
            <DateInput
              label="Date Needed *"
              value={dateNeeded}
              onChange={setDateNeeded}
              placeholder="YYYY-MM-DD"
            />

            {/* Requested by */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Requested By</Text>
              <TextInput
                style={styles.input}
                value={requestedBy}
                onChangeText={setRequestedBy}
                placeholder="Your name"
                placeholderTextColor={C.muted}
                autoCapitalize="words"
              />
            </View>

            {/* Info notice */}
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                💡 This requisition will be submitted as Pending and must be approved by an authorised approver before funds are released.
              </Text>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>Submit Requisition</Text>}
            </TouchableOpacity>

            <View style={{ height: insets.bottom + 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: C.bg },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, backgroundColor: C.hero },
  headerEyebrow:     { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 2 },
  headerTitle:       { fontSize: 24, fontWeight: '800', color: '#fffaf3', letterSpacing: -0.6 },
  closeBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  body:              { padding: 20, gap: 0 },
  row:               { flexDirection: 'row', gap: 12 },
  input:             { backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border, fontWeight: '500' },
  textarea:          { minHeight: 88, paddingTop: 12 },
  chipGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:              { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  chipActive:        { backgroundColor: C.danger + '18', borderColor: C.danger },
  chipText:          { fontSize: 12, fontWeight: '600', color: C.muted },
  chipTextActive:    { color: C.danger, fontWeight: '800' },
  segCol:            { gap: 5 },
  seg:               { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  segActive:         { backgroundColor: C.primary + '18', borderColor: C.primary },
  segText:           { fontSize: 12, fontWeight: '600', color: C.muted },
  segTextActive:     { color: C.primary, fontWeight: '800' },
  notice:            { backgroundColor: '#f5e8ce', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#e8d0a0' },
  noticeText:        { fontSize: 13, color: '#7a5c2a', lineHeight: 19 },
  submitBtn:         { backgroundColor: C.danger, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});

export default AddExpenseModal;
