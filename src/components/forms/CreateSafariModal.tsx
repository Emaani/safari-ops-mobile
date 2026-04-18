/**
 * CreateSafariModal
 * Creates a new safari booking and inserts into `bookings` with safari-specific fields.
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
const SAFARI_TYPES = [
  'Game Drive',
  'Gorilla Trekking',
  'Chimpanzee Trekking',
  'Bird Watching',
  'Cultural Tour',
  'Mountain Hiking',
  'Boat Safari',
  'Photography Safari',
  'Custom Package',
];

const PARKS = [
  'Bwindi Impenetrable',
  'Queen Elizabeth NP',
  'Murchison Falls NP',
  'Kidepo Valley NP',
  'Lake Mburo NP',
  'Kibale NP',
  'Mgahinga Gorilla NP',
  'Rwenzori Mountains',
  'Other',
];

const CURRENCIES: Currency[] = ['USD', 'UGX', 'KES'];

const STATUSES = ['Confirmed', 'Pending', 'Provisional'] as const;
type SafariStatus = typeof STATUSES[number];

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

// ─── Props ────────────────────────────────────────────────────────────────────
interface Vehicle {
  id: string;
  name: string;
  plate_number?: string;
  status?: string;
}

interface CreateSafariModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicles?: Vehicle[];
  userId?: string;
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function CreateSafariModal({ visible, onClose, onSuccess, vehicles = [], userId }: CreateSafariModalProps) {
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);

  const [clientName,   setClientName]   = useState('');
  const [safariType,   setSafariType]   = useState(SAFARI_TYPES[0]);
  const [park,         setPark]         = useState(PARKS[0]);
  const [startDate,    setStartDate]    = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [endDate,      setEndDate]      = useState('');
  const [groupSize,    setGroupSize]    = useState('');
  const [totalCost,    setTotalCost]    = useState('');
  const [currency,     setCurrency]     = useState<Currency>('USD');
  const [status,       setStatus]       = useState<SafariStatus>('Pending');
  const [vehicleId,    setVehicleId]    = useState('');
  const [guideName,    setGuideName]    = useState('');
  const [notes,        setNotes]        = useState('');

  const reset = useCallback(() => {
    setClientName(''); setSafariType(SAFARI_TYPES[0]); setPark(PARKS[0]);
    const d = new Date();
    setStartDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setEndDate(''); setGroupSize(''); setTotalCost('');
    setCurrency('USD'); setStatus('Pending'); setVehicleId(''); setGuideName(''); setNotes('');
  }, []);

  const validate = (): string | null => {
    if (!clientName.trim()) return 'Client name is required.';
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) return 'Start date must be YYYY-MM-DD.';
    if (endDate && !endDate.match(/^\d{4}-\d{2}-\d{2}$/)) return 'End date must be YYYY-MM-DD.';
    if (endDate && endDate < startDate) return 'End date must be after start date.';
    const cost = parseFloat(totalCost);
    if (isNaN(cost) || cost <= 0) return 'Total cost must be a positive number.';
    return null;
  };

  const handleSubmit = useCallback(async () => {
    const err = validate();
    if (err) { Alert.alert('Validation Error', err); return; }
    setSubmitting(true);
    try {
      const booking_reference = `BK-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      const { error } = await supabase.from('bookings').insert({
        booking_reference,
        client_name:         clientName.trim(),
        start_date:          startDate,
        end_date:            endDate || null,
        total_amount:        parseFloat(totalCost),
        amount_paid:         0,
        currency,
        status,
        notes:               [
          safariType,
          park !== PARKS[0] ? `Park: ${park}` : null,
          groupSize ? `Group: ${groupSize} pax` : null,
          guideName.trim() ? `Guide: ${guideName.trim()}` : null,
          notes.trim() || null,
        ].filter(Boolean).join(' | '),
        assigned_vehicle_id: vehicleId || null,
        created_at:          new Date().toISOString(),
      });
      if (error) throw error;
      reset();
      onSuccess();
      Alert.alert('Safari Created', `Safari booking ${booking_reference} has been successfully created.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create safari booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [clientName, safariType, park, startDate, endDate, groupSize, totalCost, currency, status, vehicleId, guideName, notes, reset, onSuccess]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.container, { paddingTop: insets.top || 12 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerEyebrow}>Safari</Text>
              <Text style={styles.headerTitle}>Create Safari</Text>
            </View>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.closeBtn}>
              <CloseIcon />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

            {/* Client Name */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Client Name *</Text>
              <TextInput
                style={styles.input}
                value={clientName}
                onChangeText={setClientName}
                placeholder="Full name or group name"
                placeholderTextColor={C.muted}
                autoCapitalize="words"
              />
            </View>

            {/* Safari Type chips */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Safari Type *</Text>
              <View style={styles.chipGrid}>
                {SAFARI_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, safariType === t && styles.chipActive]}
                    onPress={() => setSafariType(t)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, safariType === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Park chips */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>National Park / Location</Text>
              <View style={styles.chipGrid}>
                {PARKS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.chip, park === p && styles.chipParkActive]}
                    onPress={() => setPark(p)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, park === p && styles.chipTextParkActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Dates */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <DateInput label="Start Date *" value={startDate} onChange={setStartDate} />
              </View>
              <View style={{ flex: 1 }}>
                <DateInput label="End Date" value={endDate} onChange={setEndDate} />
              </View>
            </View>

            {/* Group size + Cost */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <View style={fieldStyles.wrap}>
                  <Text style={fieldStyles.label}>Group Size</Text>
                  <TextInput
                    style={styles.input}
                    value={groupSize}
                    onChangeText={setGroupSize}
                    placeholder="# pax"
                    placeholderTextColor={C.muted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
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
            </View>

            {/* Currency */}
            <View style={fieldStyles.wrap}>
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

            {/* Status */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Status</Text>
              <View style={styles.segRow}>
                {STATUSES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.seg, status === s && styles.segStatusActive]}
                    onPress={() => setStatus(s)}
                  >
                    <Text style={[styles.segText, status === s && styles.segTextStatusActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Vehicle picker */}
            {vehicles.length > 0 && (
              <View style={fieldStyles.wrap}>
                <Text style={fieldStyles.label}>Assign Vehicle</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.vehicleChip, vehicleId === '' && styles.vehicleChipActive]}
                    onPress={() => setVehicleId('')}
                  >
                    <Text style={[styles.vehicleChipText, vehicleId === '' && styles.vehicleChipTextActive]}>None</Text>
                  </TouchableOpacity>
                  {vehicles.map(v => (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.vehicleChip, vehicleId === v.id && styles.vehicleChipActive]}
                      onPress={() => setVehicleId(v.id)}
                    >
                      <View style={[styles.statusDot, {
                        backgroundColor:
                          v.status === 'Available' ? '#3d8f6a' :
                          v.status === 'Hired'     ? '#b8883f' : '#c96d4d',
                      }]} />
                      <Text style={[styles.vehicleChipText, vehicleId === v.id && styles.vehicleChipTextActive]}>
                        {v.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Guide */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Guide / Ranger</Text>
              <TextInput
                style={styles.input}
                value={guideName}
                onChangeText={setGuideName}
                placeholder="Assigned guide name (optional)"
                placeholderTextColor={C.muted}
                autoCapitalize="words"
              />
            </View>

            {/* Notes */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Additional Notes</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Special requirements, inclusions, etc."
                placeholderTextColor={C.muted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Info notice */}
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                🌿 Safari bookings are logged as a booking record. You can update payment and status from the Bookings screen.
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
                : <Text style={styles.submitText}>Create Safari Booking</Text>}
            </TouchableOpacity>

            <View style={{ height: insets.bottom + 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: C.bg },
  header:                 { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, backgroundColor: C.hero },
  headerEyebrow:          { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 2 },
  headerTitle:            { fontSize: 24, fontWeight: '800', color: '#fffaf3', letterSpacing: -0.6 },
  closeBtn:               { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  body:                   { padding: 20, gap: 0 },
  row:                    { flexDirection: 'row', gap: 12 },
  input:                  { backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border, fontWeight: '500' },
  textarea:               { minHeight: 88, paddingTop: 12 },
  chipGrid:               { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:                   { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  chipActive:             { backgroundColor: C.primary + '18', borderColor: C.primary },
  chipParkActive:         { backgroundColor: C.warning + '18', borderColor: C.warning },
  chipText:               { fontSize: 12, fontWeight: '600', color: C.muted },
  chipTextActive:         { color: C.primary, fontWeight: '800' },
  chipTextParkActive:     { color: C.warning, fontWeight: '800' },
  segRow:                 { flexDirection: 'row', gap: 8 },
  seg:                    { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  segActive:              { backgroundColor: C.primary + '18', borderColor: C.primary },
  segStatusActive:        { backgroundColor: '#3d8f6a18', borderColor: '#3d8f6a' },
  segText:                { fontSize: 13, fontWeight: '600', color: C.muted },
  segTextActive:          { color: C.primary, fontWeight: '800' },
  segTextStatusActive:    { color: '#3d8f6a', fontWeight: '800' },
  vehicleChip:            { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  vehicleChipActive:      { backgroundColor: C.primary + '18', borderColor: C.primary },
  vehicleChipText:        { fontSize: 12, fontWeight: '600', color: C.muted },
  vehicleChipTextActive:  { color: C.primary, fontWeight: '800' },
  statusDot:              { width: 7, height: 7, borderRadius: 4 },
  notice:                 { backgroundColor: '#e8f0ec', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#c0d8cc' },
  noticeText:             { fontSize: 13, color: '#1f4d45', lineHeight: 19 },
  submitBtn:              { backgroundColor: C.primary, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled:      { opacity: 0.6 },
  submitText:             { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});

export default CreateSafariModal;
