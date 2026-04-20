/**
 * NewBookingModal
 * Collects booking details, validates, and inserts into the `bookings` table.
 */
import React, { useState, useCallback, useEffect } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import type { Vehicle, Currency } from '../../types/dashboard';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:       '#f6f2eb',
  card:     '#fffdf9',
  hero:     '#171513',
  primary:  '#1f4d45',
  success:  '#3d8f6a',
  danger:   '#c96d4d',
  warning:  '#b8883f',
  text:     '#181512',
  muted:    '#7f7565',
  border:   '#e1d7c8',
  input:    '#f0ebe2',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface NewBookingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicles: Vehicle[];
  userId?: string;
}

// Match exactly the BookingStatus values used by the Jackal Dashboard
type BookingStatus = 'Confirmed' | 'Pending' | 'In-Progress' | 'Completed' | 'Cancelled';
type BookingCurrency = 'USD' | 'UGX' | 'KES';

const CURRENCIES: BookingCurrency[] = ['USD', 'UGX', 'KES'];
const STATUS_OPTIONS: BookingStatus[] = ['Confirmed', 'Pending', 'In-Progress', 'Completed', 'Cancelled'];
const STATUS_COLOR: Record<BookingStatus, string> = {
  Confirmed:    C.success,
  Pending:      C.warning,
  'In-Progress': C.primary,
  Completed:    '#8366d7',
  Cancelled:    C.danger,
};

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
function TruckIcon({ color = C.primary }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
      <Circle cx="5.5" cy="18.5" r="2.5" />
      <Circle cx="18.5" cy="18.5" r="2.5" />
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

// ─── Date Input ───────────────────────────────────────────────────────────────
function DateInput({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(value || '');

  useEffect(() => { setRaw(value); }, [value]);

  // Auto-format as YYYY-MM-DD
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

const fieldStyles = StyleSheet.create({
  wrap:          { marginBottom: 14 },
  label:         { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  iconInput:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  iconInputText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
});

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function NewBookingModal({ visible, onClose, onSuccess, vehicles, userId }: NewBookingModalProps) {
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);

  // Form state — mirrors the `bookings` table columns used by the Jackal Dashboard
  const [clientName,  setClientName]  = useState('');
  const [contact,     setContact]     = useState('');
  const [email,       setEmail]       = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [totalCost,   setTotalCost]   = useState('');
  const [currency,    setCurrency]    = useState<BookingCurrency>('USD');
  const [status,      setStatus]      = useState<BookingStatus>('Confirmed');
  const [vehicleId,   setVehicleId]   = useState('');
  const [notes,       setNotes]       = useState('');
  const [vehicleOpen, setVehicleOpen] = useState(false);

  const reset = useCallback(() => {
    setClientName(''); setContact(''); setEmail('');
    setStartDate(''); setEndDate(''); setTotalCost('');
    setCurrency('USD'); setStatus('Confirmed'); setVehicleId('');
    setNotes(''); setVehicleOpen(false);
  }, []);

  const validate = useCallback((): string | null => {
    if (!clientName.trim()) return 'Client name is required.';
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) return 'Start date must be YYYY-MM-DD.';
    if (!endDate.match(/^\d{4}-\d{2}-\d{2}$/)) return 'End date must be YYYY-MM-DD.';
    if (new Date(endDate) < new Date(startDate)) return 'End date must be after start date.';
    const cost = parseFloat(totalCost);
    if (isNaN(cost) || cost <= 0) return 'Total cost must be a positive number.';
    return null;
  }, [clientName, startDate, endDate, totalCost]);

  const handleSubmit = useCallback(async () => {
    const err = validate();
    if (err) { Alert.alert('Validation Error', err); return; }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Booking reference format matches the Jackal Dashboard convention
      const booking_reference = `BK-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

      const { error } = await supabase.from('bookings').insert({
        booking_reference,
        client_name:         clientName.trim(),
        contact:             contact.trim()  || null,
        email:               email.trim()    || null,
        start_date:          startDate,
        end_date:            endDate,
        total_amount:        parseFloat(totalCost),
        amount_paid:         0,
        currency,
        status,
        notes:               notes.trim()    || null,
        assigned_vehicle_id: vehicleId       || null,
        // 'assigned_to' is the column name used by the Jackal Dashboard
        assigned_to:         userId || user?.id || null,
        created_at:          new Date().toISOString(),
      });

      if (error) throw error;

      reset();
      onSuccess();
      Alert.alert('Booking Created', `Booking ${booking_reference} has been successfully created.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [validate, clientName, contact, email, startDate, endDate, totalCost, currency, status, vehicleId, notes, userId, reset, onSuccess]);

  const selectedVehicle = vehicles.find(v => v.id === vehicleId);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.container, { paddingTop: insets.top || 12 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerEyebrow}>Create</Text>
              <Text style={styles.headerTitle}>New Booking</Text>
            </View>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.closeBtn}>
              <CloseIcon />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

            {/* Client Name */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Client Name *</Text>
              <View style={fieldStyles.iconInput}>
                <UserIcon />
                <TextInput
                  style={fieldStyles.iconInputText}
                  value={clientName}
                  onChangeText={setClientName}
                  placeholder="Enter client or company name"
                  placeholderTextColor={C.muted}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Contact + Email */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <View style={fieldStyles.wrap}>
                  <Text style={fieldStyles.label}>Contact</Text>
                  <TextInput
                    style={styles.input}
                    value={contact}
                    onChangeText={setContact}
                    placeholder="Phone number"
                    placeholderTextColor={C.muted}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <View style={fieldStyles.wrap}>
                  <Text style={fieldStyles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="client@email.com"
                    placeholderTextColor={C.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </View>

            {/* Dates */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <DateInput label="Start Date *" value={startDate} onChange={setStartDate} placeholder="YYYY-MM-DD" />
              </View>
              <View style={{ flex: 1 }}>
                <DateInput label="End Date *" value={endDate} onChange={setEndDate} placeholder="YYYY-MM-DD" />
              </View>
            </View>

            {/* Cost + Currency */}
            <View style={styles.row}>
              <View style={{ flex: 2 }}>
                <View style={fieldStyles.wrap}>
                  <Text style={fieldStyles.label}>Total Cost *</Text>
                  <TextInput
                    style={styles.input}
                    value={totalCost}
                    onChangeText={setTotalCost}
                    placeholder="0.00"
                    placeholderTextColor={C.muted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={{ flex: 1, marginBottom: 14 }}>
                <Text style={fieldStyles.label}>Currency</Text>
                <View style={styles.segRow}>
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

            {/* Status */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Status</Text>
              <View style={styles.segRow}>
                {STATUS_OPTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.seg, status === s && { ...styles.segActive, backgroundColor: STATUS_COLOR[s] + '20', borderColor: STATUS_COLOR[s] }]}
                    onPress={() => setStatus(s)}
                  >
                    <Text style={[styles.segText, status === s && { color: STATUS_COLOR[s], fontWeight: '800' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Vehicle */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Assign Vehicle (Optional)</Text>
              <TouchableOpacity
                style={[fieldStyles.iconInput, vehicleOpen && { borderColor: C.primary }]}
                onPress={() => setVehicleOpen(!vehicleOpen)}
                activeOpacity={0.8}
              >
                <TruckIcon />
                <Text style={[fieldStyles.iconInputText, !selectedVehicle && { color: C.muted }]}>
                  {selectedVehicle
                    ? `${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.license_plate}`
                    : 'Select vehicle…'}
                </Text>
              </TouchableOpacity>
              {vehicleOpen && (
                <View style={styles.dropdown}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => { setVehicleId(''); setVehicleOpen(false); }}
                  >
                    <Text style={[styles.dropdownText, { color: C.muted }]}>No vehicle</Text>
                  </TouchableOpacity>
                  {vehicles.map(v => (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.dropdownItem, vehicleId === v.id && styles.dropdownItemActive]}
                      onPress={() => { setVehicleId(v.id); setVehicleOpen(false); }}
                    >
                      <Text style={[styles.dropdownText, vehicleId === v.id && { color: C.primary, fontWeight: '700' }]}>
                        {v.make} {v.model} · {v.license_plate}
                      </Text>
                      <View style={[styles.statusDot, {
                        backgroundColor: v.status === 'available' ? C.success : v.status === 'maintenance' ? C.warning : C.muted
                      }]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Notes */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any special requirements or notes…"
                placeholderTextColor={C.muted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
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
                : <Text style={styles.submitText}>Create Booking</Text>}
            </TouchableOpacity>

            <View style={{ height: insets.bottom + 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, backgroundColor: C.hero },
  headerEyebrow:   { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 2 },
  headerTitle:     { fontSize: 24, fontWeight: '800', color: '#fffaf3', letterSpacing: -0.6 },
  closeBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  body:            { padding: 20, gap: 0 },
  row:             { flexDirection: 'row', gap: 12 },
  input:           { backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border, fontWeight: '500' },
  textarea:        { minHeight: 88, paddingTop: 12 },
  segRow:          { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  seg:             { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  segActive:       { backgroundColor: C.primary + '18', borderColor: C.primary },
  segText:         { fontSize: 12, fontWeight: '600', color: C.muted },
  segTextActive:   { color: C.primary, fontWeight: '800' },
  dropdown:        { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginTop: 6, overflow: 'hidden', maxHeight: 220 },
  dropdownItem:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f0ebe0' },
  dropdownItemActive: { backgroundColor: C.primary + '0a' },
  dropdownText:    { fontSize: 14, color: C.text, flex: 1 },
  statusDot:       { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  submitBtn:       { backgroundColor: C.primary, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:      { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});

export default NewBookingModal;
