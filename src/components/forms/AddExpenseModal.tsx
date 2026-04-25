/**
 * AddExpenseModal — Cash Requisition Form
 * Mirrors the Jackal Dashboard → Financial Management → Cash Requisition workflow.
 *
 * Features:
 *  - Category chip selector
 *  - Native iOS calendar picker for Date Needed (no keyboard date entry)
 *  - Approver search with real-time dropdown from `profiles` table
 *  - approver_id linked to cash_requisitions on insert
 *  - Status starts as Pending; approver receives the assignment
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  Pressable,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Path, Rect, Circle } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { sendCRNotificationToUser } from '../../services/notificationService';
import { formatCurrency } from '../../lib/utils';
import type { Currency } from '../../types/dashboard';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#f6f2eb',
  card:    '#fffdf9',
  hero:    '#171513',
  primary: '#1f4d45',
  success: '#3d8f6a',
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

const DEPARTMENTS = [
  'Operations',
  'Administration',
  'Fleet',
  'Finance',
  'Safari',
  'Maintenance',
  'Management',
];

const PAYMENT_MODES = ['Cash', 'Mobile Money', 'Bank Transfer', 'Cheque'];

const CURRENCIES: Currency[] = ['USD', 'UGX', 'KES'];

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApproverProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId?: string;
  userName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}
function todayISO(): string {
  return toISO(new Date());
}
function displayName(p: ApproverProfile): string {
  return p.full_name?.trim() || p.email || 'Unknown';
}
function initials(p: ApproverProfile): string {
  const name = p.full_name?.trim() || p.email || '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

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
function SearchIcon({ color = C.muted }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx="11" cy="11" r="8" />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  );
}
function UserIcon({ color = C.primary }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}
function CheckIcon({ color = C.success }: { color?: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

// ─── Shared field styles ──────────────────────────────────────────────────────
const fieldStyles = StyleSheet.create({
  wrap:          { marginBottom: 14 },
  label:         { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  iconInput:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  iconInputText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
});

// ─── Native Calendar Date Picker ──────────────────────────────────────────────
interface DatePickerFieldProps {
  label:       string;
  value:       string;
  onChange:    (iso: string) => void;
  minDate?:    Date;
  placeholder?: string;
}

function DatePickerField({ label, value, onChange, minDate, placeholder = 'Select date' }: DatePickerFieldProps) {
  const [open,   setOpen]   = useState(false);
  const [staged, setStaged] = useState<Date>(value ? new Date(value) : new Date());

  const handleOpen = () => {
    setStaged(value ? new Date(value) : (minDate ?? new Date()));
    setOpen(true);
  };
  const handleConfirm = () => { onChange(toISO(staged)); setOpen(false); };
  const handleCancel  = () => { setOpen(false); };
  const handleChange  = (_: DateTimePickerEvent, selected?: Date) => {
    if (selected) setStaged(selected);
  };

  return (
    <>
      <View style={fieldStyles.wrap}>
        <Text style={fieldStyles.label}>{label}</Text>
        <TouchableOpacity
          style={[fieldStyles.iconInput, open && { borderColor: C.primary }]}
          onPress={handleOpen}
          activeOpacity={0.8}
        >
          <CalendarIcon color={value ? C.primary : C.muted} />
          <Text style={[fieldStyles.iconInputText, !value && { color: C.muted, fontWeight: '400' }]}>
            {value ? formatDisplay(value) : placeholder}
          </Text>
          {value ? (
            <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <CloseIcon color={C.muted} />
            </TouchableOpacity>
          ) : (
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2.5} strokeLinecap="round">
              <Path d="M6 9l6 6 6-6" />
            </Svg>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={handleCancel}>
        <Pressable style={pickerStyles.backdrop} onPress={handleCancel} />
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.sheetHeader}>
            <TouchableOpacity onPress={handleCancel} style={pickerStyles.headerBtn}>
              <Text style={pickerStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={pickerStyles.sheetTitle}>{label.replace(' *', '')}</Text>
            <TouchableOpacity onPress={handleConfirm} style={pickerStyles.headerBtn}>
              <Text style={pickerStyles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={staged}
            mode="date"
            display="inline"
            onChange={handleChange}
            minimumDate={minDate}
            themeVariant="light"
            accentColor={C.warning}
            style={pickerStyles.picker}
          />
        </View>
      </Modal>
    </>
  );
}

const pickerStyles = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:       { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  sheetTitle:  { fontSize: 16, fontWeight: '700', color: C.text },
  headerBtn:   { minWidth: 70 },
  cancelText:  { fontSize: 15, color: C.muted, fontWeight: '600' },
  confirmText: { fontSize: 15, color: C.warning, fontWeight: '800', textAlign: 'right' },
  picker:      { marginHorizontal: 4 },
});

// ─── Approver Search ──────────────────────────────────────────────────────────
// Only these three named administrators may approve Cash Requisitions.
const ADMIN_EMAILS = [
  'jackson.b@jackalwildadventures.com',
  'jackson.k@jackalwildadventures.com',
  'allan.m@jackalwildadventures.com',
];
function ApproverSearch({
  selected,
  onSelect,
  onClear,
}: {
  selected:  ApproverProfile | null;
  onSelect:  (p: ApproverProfile) => void;
  onClear:   () => void;
}) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<ApproverProfile[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch only the 3 authorised approvers; optionally filter by search term client-side
  const fetchAdmins = useCallback(async (q?: string): Promise<ApproverProfile[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('email', ADMIN_EMAILS)
      .order('full_name', { ascending: true });
    if (error || !data) return [];
    const admins = data as ApproverProfile[];
    if (q && q.trim().length > 0) {
      const term = q.trim().toLowerCase();
      return admins.filter(
        a => (a.full_name?.toLowerCase().includes(term) || a.email?.toLowerCase().includes(term))
      );
    }
    return admins;
  }, []);

  const search = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const admins = await fetchAdmins(q);
      setResults(admins);
      setShowResults(admins.length > 0);
    } finally {
      setSearching(false);
    }
  }, [fetchAdmins]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 280);
  };

  const handleSelect = (p: ApproverProfile) => {
    setQuery(''); setResults([]); setShowResults(false);
    onSelect(p);
  };

  const handleClear = () => {
    setQuery(''); setResults([]); setShowResults(false);
    onClear();
  };

  // Pre-load admin list on mount so dropdown opens instantly on focus
  useEffect(() => {
    if (selected) return;
    fetchAdmins().then(admins => {
      setResults(admins);
      // Don't auto-open — user taps to see the list
    });
  }, [fetchAdmins, selected]);

  if (selected) {
    return (
      <View style={fieldStyles.wrap}>
        <Text style={fieldStyles.label}>Assign Administrator Approver *</Text>
        <View style={approverStyles.selectedPill}>
          <View style={approverStyles.selectedLeft}>
            <View style={approverStyles.avatar}>
              <Text style={approverStyles.avatarText}>{initials(selected)}</Text>
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={approverStyles.selectedName}>{displayName(selected)}</Text>
              {selected.email && (
                <Text style={approverStyles.selectedSub} numberOfLines={1}>{selected.email}</Text>
              )}
            </View>
            <CheckIcon color={C.success} />
          </View>
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 8 }}>
            <CloseIcon color={C.muted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>Assign Administrator Approver *</Text>
      <View style={[
        fieldStyles.iconInput,
        showResults && results.length > 0 && { borderColor: C.warning, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
      ]}>
        <UserIcon color={C.warning} />
        <TextInput
          style={fieldStyles.iconInputText}
          value={query}
          onChangeText={handleQueryChange}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
            else search('');
          }}
          placeholder="Search administrators…"
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searching
          ? <ActivityIndicator size="small" color={C.warning} />
          : query.length > 0 && (
              <TouchableOpacity onPress={handleClear} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <CloseIcon color={C.muted} />
              </TouchableOpacity>
            )
        }
      </View>
      {showResults && results.length > 0 && (
        <View style={approverStyles.resultsBox}>
          {results.map((p, idx) => (
            <TouchableOpacity
              key={p.id}
              style={[approverStyles.resultRow, idx < results.length - 1 && approverStyles.resultBorder]}
              onPress={() => handleSelect(p)}
              activeOpacity={0.75}
            >
              <View style={approverStyles.avatar}>
                <Text style={approverStyles.avatarText}>{initials(p)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={approverStyles.resultName}>{displayName(p)}</Text>
                {p.email && (
                  <Text style={approverStyles.resultSub} numberOfLines={1}>{p.email}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {showResults && results.length === 0 && !searching && (
        <View style={approverStyles.noResults}>
          <Text style={approverStyles.noResultsText}>No approvers found</Text>
        </View>
      )}
    </View>
  );
}

const approverStyles = StyleSheet.create({
  selectedPill:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.success + '12', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.success + '40' },
  selectedLeft:   { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectedName:   { fontSize: 15, fontWeight: '700', color: C.text },
  selectedSub:    { fontSize: 12, color: C.muted, marginTop: 2 },
  avatar:         { width: 36, height: 36, borderRadius: 18, backgroundColor: C.warning + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 13, fontWeight: '800', color: C.warning },
  resultsBox:     { backgroundColor: C.card, borderWidth: 1, borderTopWidth: 0, borderColor: C.warning, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden', maxHeight: 260 },
  resultRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  resultBorder:   { borderBottomWidth: 1, borderBottomColor: C.border },
  resultName:     { fontSize: 14, fontWeight: '700', color: C.text },
  resultSub:      { fontSize: 12, color: C.muted, marginTop: 2 },
  noResults:      { backgroundColor: C.card, borderWidth: 1, borderTopWidth: 0, borderColor: C.border, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  noResultsText:  { fontSize: 13, color: C.muted, fontStyle: 'italic' },
});

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function AddExpenseModal({ visible, onClose, onSuccess, userId, userName }: AddExpenseModalProps) {
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);

  const [category,        setCategory]        = useState(CATEGORIES[0]);
  const [department,      setDepartment]      = useState(DEPARTMENTS[0]);
  const [description,     setDescription]     = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [amount,          setAmount]          = useState('');
  const [currency,        setCurrency]        = useState<Currency>('USD');
  const [paymentMode,     setPaymentMode]     = useState(PAYMENT_MODES[0]);
  const [payeeName,       setPayeeName]       = useState('');
  const [dateNeeded,      setDateNeeded]      = useState(todayISO);
  const [approver,        setApprover]        = useState<ApproverProfile | null>(null);

  const reset = useCallback(() => {
    setCategory(CATEGORIES[0]);
    setDepartment(DEPARTMENTS[0]);
    setDescription('');
    setItemDescription('');
    setAmount('');
    setCurrency('USD');
    setPaymentMode(PAYMENT_MODES[0]);
    setPayeeName('');
    setDateNeeded(todayISO());
    setApprover(null);
  }, []);

  const validate = (): string | null => {
    if (!category)                  return 'Please select a category.';
    if (!department)                return 'Please select a department.';
    if (!description.trim())        return 'Purpose / description is required.';
    if (!itemDescription.trim())    return 'Item description is required.';
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0)     return 'Amount must be a positive number.';
    if (!payeeName.trim())          return 'Payee / recipient name is required.';
    if (!dateNeeded)                return 'Please select the date needed.';
    if (!approver)                  return 'Please assign an approver for this requisition.';
    return null;
  };

  const handleSubmit = useCallback(async () => {
    const err = validate();
    if (err) { Alert.alert('Validation Error', err); return; }
    setSubmitting(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const requesterName =
        userName?.trim() ||
        authUser?.user_metadata?.full_name ||
        authUser?.email?.split('@')[0] ||
        'Staff';

      const cr_number = `CR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

      const requesterEmail = authUser?.email ?? '';
      const cost = parseFloat(amount);

      const payload: Record<string, unknown> = {
        cr_number,
        expense_category:  category,
        department,
        purpose:           description.trim(),
        item_description:  itemDescription.trim(),
        quantity:          1,
        unit_cost:         cost,
        total_cost:        cost,
        currency,
        selected_currency: currency,
        payment_mode:      paymentMode,
        payee_name:        payeeName.trim(),
        date_needed:       dateNeeded,
        date_raised:       new Date().toISOString().split('T')[0],
        submitted_at:      new Date().toISOString(),
        sla_due_date:      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        urgency:           'Routine',
        status:            'Pending',
        draft:             false,
        requester_name:    requesterName,
        requester_email:   requesterEmail,
        requester_id:      authUser?.id ?? null,
        approver_id:       approver?.id ?? null,
        soft_deleted:      false,
        created_at:        new Date().toISOString(),
      };

      const { error } = await supabase.from('cash_requisitions').insert(payload);
      if (error) throw error;

      // Notify the approver on their device
      if (approver?.id) {
        const approverName = displayName(approver);
        sendCRNotificationToUser(
          approver.id,
          '📝 Cash Requisition Awaiting Approval',
          `${requesterName} raised ${cr_number} for ${category} — ${formatCurrency(cost, currency)}. Tap to review.`,
          { cr_number, screen: 'Finance', category, amount: cost, currency },
          'cr_created',
        ).catch(console.error);
      }

      reset();
      Alert.alert(
        'Requisition Submitted',
        `${cr_number} has been raised and assigned to ${displayName(approver!)} for approval.\n\nStatus: Pending`,
        [{ text: 'OK', onPress: onSuccess }]
      );
    } catch (e: any) {
      Alert.alert('Submission Failed', e?.message || 'Failed to submit requisition. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [category, department, description, itemDescription, amount, currency, paymentMode, payeeName, dateNeeded, approver, userName, reset, onSuccess]);

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
              <CloseIcon color="#b8ab95" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Category ── */}
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
                    <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Department ── */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Department *</Text>
              <View style={styles.chipGrid}>
                {DEPARTMENTS.map(dep => (
                  <TouchableOpacity
                    key={dep}
                    style={[styles.chip, department === dep && styles.chipDeptActive]}
                    onPress={() => setDepartment(dep)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, department === dep && styles.chipTextDeptActive]}>{dep}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Purpose ── */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Purpose *</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Why are these funds needed? What is the objective?"
                placeholderTextColor={C.muted}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>

            {/* ── Item Description ── */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Item / Service Description *</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={itemDescription}
                onChangeText={setItemDescription}
                placeholder="Describe the specific item, service, or expense being requested…"
                placeholderTextColor={C.muted}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>

            {/* ── Amount + Currency ── */}
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

            {/* ── Payment Mode ── */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Payment Mode *</Text>
              <View style={styles.chipGrid}>
                {PAYMENT_MODES.map(mode => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.chip, paymentMode === mode && styles.chipPayActive]}
                    onPress={() => setPaymentMode(mode)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, paymentMode === mode && styles.chipTextPayActive]}>{mode}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Payee Name ── */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Payee / Recipient *</Text>
              <TextInput
                style={styles.input}
                value={payeeName}
                onChangeText={setPayeeName}
                placeholder="Name of person or company receiving the funds"
                placeholderTextColor={C.muted}
                autoCapitalize="words"
              />
            </View>

            {/* ── Date Needed (native calendar picker) ── */}
            <DatePickerField
              label="Date Needed *"
              value={dateNeeded}
              onChange={setDateNeeded}
              minDate={new Date()}
              placeholder="Select date funds are needed"
            />

            {/* ── Approver Assignment ── */}
            <ApproverSearch
              selected={approver}
              onSelect={setApprover}
              onClear={() => setApprover(null)}
            />

            {/* ── Workflow notice ── */}
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                📋 This requisition will be submitted as <Text style={{ fontWeight: '800' }}>Pending</Text> and routed to
                {approver ? ` ${displayName(approver)}` : ' the selected approver'} for review before funds are released.
              </Text>
            </View>

            {/* ── Submit ── */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: C.bg },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, backgroundColor: C.hero },
  headerEyebrow:     { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 2 },
  headerTitle:       { fontSize: 24, fontWeight: '800', color: '#fffaf3', letterSpacing: -0.6 },
  closeBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  body:              { padding: 20 },
  row:               { flexDirection: 'row', gap: 12 },
  input:             { backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border, fontWeight: '500' },
  textarea:          { minHeight: 88, paddingTop: 12 },
  chipGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:              { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  chipActive:            { backgroundColor: C.danger + '18', borderColor: C.danger },
  chipText:              { fontSize: 12, fontWeight: '600', color: C.muted },
  chipTextActive:        { color: C.danger, fontWeight: '800' },
  chipDeptActive:        { backgroundColor: C.primary + '18', borderColor: C.primary },
  chipTextDeptActive:    { color: C.primary, fontWeight: '800' },
  chipPayActive:         { backgroundColor: C.warning + '18', borderColor: C.warning },
  chipTextPayActive:     { color: C.warning, fontWeight: '800' },
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
