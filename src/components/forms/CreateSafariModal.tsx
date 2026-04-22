/**
 * CreateSafariModal
 * Creates a new safari booking and inserts into `bookings` with safari-specific fields.
 * Aligned with the Jackal Dashboard's Create Safari workflow.
 */
import React, { useState, useCallback, useRef } from 'react';
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
import type { Currency } from '../../types/dashboard';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#f6f2eb',
  card:    '#fffdf9',
  hero:    '#171513',
  primary: '#1f4d45',
  danger:  '#c96d4d',
  warning: '#b8883f',
  success: '#3d8f6a',
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

type SafariStatus = 'Confirmed' | 'Pending' | 'In-Progress' | 'Completed' | 'Cancelled';
const STATUSES: SafariStatus[] = ['Confirmed', 'Pending', 'In-Progress', 'Completed', 'Cancelled'];
const STATUS_COLOR: Record<SafariStatus, string> = {
  Confirmed:     C.success,
  Pending:       C.warning,
  'In-Progress': C.primary,
  Completed:     '#8366d7',
  Cancelled:     C.danger,
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
function SearchIcon({ color = C.muted }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx="11" cy="11" r="8" />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  );
}
function CheckIcon({ color = C.success }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

// ─── Field styles ─────────────────────────────────────────────────────────────
const fieldStyles = StyleSheet.create({
  wrap:          { marginBottom: 14 },
  label:         { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  iconInput:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  iconInputText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

// ─── Calendar Picker Field ────────────────────────────────────────────────────
function DatePickerField({ label, value, onChange, minDate, placeholder = 'Select date' }: {
  label: string; value: string; onChange: (iso: string) => void; minDate?: Date; placeholder?: string;
}) {
  const [open,   setOpen]   = useState(false);
  const [staged, setStaged] = useState<Date>(value ? new Date(value) : new Date());

  const handleOpen = () => {
    setStaged(value ? new Date(value) : (minDate ?? new Date()));
    setOpen(true);
  };
  const handleChange = (_: DateTimePickerEvent, d?: Date) => { if (d) setStaged(d); };
  const handleConfirm = () => { onChange(toISO(staged)); setOpen(false); };
  const handleCancel  = () => setOpen(false);

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
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2.5} strokeLinecap="round">
                <Path d="M18 6L6 18M6 6l12 12" />
              </Svg>
            </TouchableOpacity>
          ) : (
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2.5} strokeLinecap="round">
              <Path d="M6 9l6 6 6-6" />
            </Svg>
          )}
        </TouchableOpacity>
      </View>
      <Modal visible={open} transparent animationType="slide" onRequestClose={handleCancel}>
        <Pressable style={pickerSheet.backdrop} onPress={handleCancel} />
        <View style={pickerSheet.sheet}>
          <View style={pickerSheet.header}>
            <TouchableOpacity onPress={handleCancel}><Text style={pickerSheet.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={pickerSheet.title}>{label.replace(' *', '')}</Text>
            <TouchableOpacity onPress={handleConfirm}><Text style={pickerSheet.confirm}>Confirm</Text></TouchableOpacity>
          </View>
          <DateTimePicker
            value={staged}
            mode="date"
            display="inline"
            onChange={handleChange}
            minimumDate={minDate}
            themeVariant="light"
            accentColor={C.primary}
            style={pickerSheet.picker}
          />
        </View>
      </Modal>
    </>
  );
}

const pickerSheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:    { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, overflow: 'hidden' },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  title:    { fontSize: 16, fontWeight: '700', color: C.text },
  cancel:   { fontSize: 15, color: C.muted, fontWeight: '600', minWidth: 60 },
  confirm:  { fontSize: 15, color: C.primary, fontWeight: '800', textAlign: 'right', minWidth: 60 },
  picker:   { marginHorizontal: 4 },
});

// ─── Client Search (same pattern as NewBookingModal) ─────────────────────────
interface ClientResult {
  id: string;
  company_name: string;
  email?: string | null;
  phone?: string | null;
}

function ClientSearch({
  onSelect,
  selectedClient,
  onClear,
}: {
  onSelect: (c: ClientResult) => void;
  selectedClient: ClientResult | null;
  onClear: () => void;
}) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<ClientResult[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); setShowResults(false); return; }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, email, phone')
        .or(`company_name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%`)
        .limit(8);
      if (!error && data) { setResults(data as ClientResult[]); setShowResults(true); }
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 300);
  };

  const handleSelect = (c: ClientResult) => {
    setQuery(''); setResults([]); setShowResults(false);
    onSelect(c);
  };
  const handleClear = () => {
    setQuery(''); setResults([]); setShowResults(false);
    onClear();
  };

  if (selectedClient) {
    return (
      <View style={fieldStyles.wrap}>
        <Text style={fieldStyles.label}>Client</Text>
        <View style={srchStyles.selectedPill}>
          <View style={srchStyles.selectedLeft}>
            <CheckIcon />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={srchStyles.selectedName}>{selectedClient.company_name}</Text>
              {(selectedClient.email || selectedClient.phone) && (
                <Text style={srchStyles.selectedSub}>
                  {[selectedClient.email, selectedClient.phone].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <CloseIcon color={C.muted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>Search Existing Client (Optional)</Text>
      <View style={[fieldStyles.iconInput, showResults && { borderColor: C.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
        <SearchIcon color={searching ? C.primary : C.muted} />
        <TextInput
          style={fieldStyles.iconInputText}
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Search by name, email, or phone…"
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size="small" color={C.primary} />}
        {query.length > 0 && !searching && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <CloseIcon color={C.muted} />
          </TouchableOpacity>
        )}
      </View>
      {showResults && results.length > 0 && (
        <View style={srchStyles.resultsBox}>
          {results.map((c, idx) => (
            <TouchableOpacity
              key={c.id}
              style={[srchStyles.resultRow, idx < results.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
              onPress={() => handleSelect(c)}
              activeOpacity={0.75}
            >
              <View style={srchStyles.avatar}>
                <Text style={srchStyles.avatarText}>{c.company_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={srchStyles.resultName}>{c.company_name}</Text>
                {(c.email || c.phone) && (
                  <Text style={srchStyles.resultSub} numberOfLines={1}>
                    {[c.email, c.phone].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {showResults && results.length === 0 && !searching && query.length >= 2 && (
        <View style={srchStyles.noResults}>
          <Text style={srchStyles.noResultsText}>No clients found — enter details below</Text>
        </View>
      )}
    </View>
  );
}

const srchStyles = StyleSheet.create({
  resultsBox:    { backgroundColor: C.card, borderWidth: 1, borderTopWidth: 0, borderColor: C.primary, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden', maxHeight: 240 },
  resultRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 12 },
  avatar:        { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText:    { fontSize: 13, fontWeight: '800', color: C.primary },
  resultName:    { fontSize: 14, fontWeight: '700', color: C.text },
  resultSub:     { fontSize: 12, color: C.muted, marginTop: 1 },
  noResults:     { backgroundColor: C.card, borderWidth: 1, borderTopWidth: 0, borderColor: C.border, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  noResultsText: { fontSize: 13, color: C.muted, fontStyle: 'italic' },
  selectedPill:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.success + '12', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.success + '40' },
  selectedLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectedName:  { fontSize: 15, fontWeight: '700', color: C.text },
  selectedSub:   { fontSize: 12, color: C.muted, marginTop: 1 },
});

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

  // Client link
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);

  // Form fields
  const [safariName,  setSafariName]  = useState('');
  const [clientName,  setClientName]  = useState('');
  const [contact,     setContact]     = useState('');
  const [email,       setEmail]       = useState('');
  const [safariType,  setSafariType]  = useState(SAFARI_TYPES[0]);
  const [park,        setPark]        = useState(PARKS[0]);
  const [startDate,   setStartDate]   = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [endDate,     setEndDate]     = useState('');
  const [groupSize,   setGroupSize]   = useState('');
  const [totalCost,   setTotalCost]   = useState('');
  const [currency,    setCurrency]    = useState<Currency>('USD');
  const [status,      setStatus]      = useState<SafariStatus>('Confirmed');
  const [vehicleId,   setVehicleId]   = useState('');
  const [guideName,   setGuideName]   = useState('');
  const [itinerary,   setItinerary]   = useState('');

  const reset = useCallback(() => {
    setSelectedClient(null);
    setSafariName(''); setClientName(''); setContact(''); setEmail('');
    setSafariType(SAFARI_TYPES[0]); setPark(PARKS[0]);
    const d = new Date();
    setStartDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setEndDate(''); setGroupSize(''); setTotalCost('');
    setCurrency('USD'); setStatus('Confirmed'); setVehicleId('');
    setGuideName(''); setItinerary('');
  }, []);

  const handleClientSelect = useCallback((c: ClientResult) => {
    setSelectedClient(c);
    setClientName(c.company_name);
    if (c.email)  setEmail(c.email);
    if (c.phone)  setContact(c.phone);
  }, []);

  const handleClientClear = useCallback(() => {
    setSelectedClient(null);
  }, []);

  const handleClientNameChange = useCallback((text: string) => {
    if (selectedClient) setSelectedClient(null);
    setClientName(text);
  }, [selectedClient]);

  const minEndDate = startDate ? new Date(startDate) : undefined;

  const handleStartDateChange = useCallback((iso: string) => {
    setStartDate(iso);
    if (endDate && iso && endDate < iso) setEndDate('');
  }, [endDate]);

  const validate = (): string | null => {
    if (!clientName.trim()) return 'Client name is required.';
    if (!startDate) return 'Please select a start date.';
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
      const { data: { user } } = await supabase.auth.getUser();
      const booking_reference = `BK-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

      // Compose notes: safari name + type + park + group size + guide + itinerary
      const notesParts = [
        safariName.trim()    ? `Safari: ${safariName.trim()}` : null,
        safariType,
        park !== PARKS[0]    ? `Park: ${park}` : null,
        groupSize.trim()     ? `Group: ${groupSize.trim()} pax` : null,
        guideName.trim()     ? `Guide: ${guideName.trim()}` : null,
        itinerary.trim()     ? itinerary.trim() : null,
      ].filter(Boolean);

      const { error } = await supabase.from('bookings').insert({
        booking_reference,
        client_id:           selectedClient?.id   || null,
        client_name:         clientName.trim(),
        contact:             contact.trim()        || null,
        email:               email.trim()          || null,
        start_date:          startDate,
        end_date:            endDate               || null,
        total_amount:        parseFloat(totalCost),
        amount_paid:         0,
        currency,
        status,
        notes:               notesParts.join(' | ') || null,
        assigned_vehicle_id: vehicleId             || null,
        assigned_to:         userId || user?.id    || null,
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
  }, [safariName, selectedClient, clientName, contact, email, safariType, park, startDate, endDate, groupSize, totalCost, currency, status, vehicleId, guideName, itinerary, userId, reset, onSuccess]);

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
              <CloseIcon color="#b8ab95" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

            {/* Safari Name / Trip Title */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Safari / Trip Title (Optional)</Text>
              <TextInput
                style={styles.input}
                value={safariName}
                onChangeText={setSafariName}
                placeholder="e.g. Bwindi Gorilla Trek 2026"
                placeholderTextColor={C.muted}
                autoCapitalize="words"
              />
            </View>

            {/* ── Client search ── */}
            <ClientSearch
              onSelect={handleClientSelect}
              selectedClient={selectedClient}
              onClear={handleClientClear}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{selectedClient ? 'Safari Details' : 'Or Enter Client Details'}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Client Name */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Client Name *</Text>
              <TextInput
                style={[styles.input, selectedClient && { borderColor: C.success + '60' }]}
                value={clientName}
                onChangeText={handleClientNameChange}
                placeholder="Full name or group name"
                placeholderTextColor={C.muted}
                autoCapitalize="words"
              />
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
                    placeholder="Phone"
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

            {/* Park / Location chips */}
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
                <DatePickerField label="Start Date *" value={startDate} onChange={handleStartDateChange} placeholder="Select start" />
              </View>
              <View style={{ flex: 1 }}>
                <DatePickerField label="End Date" value={endDate} onChange={setEndDate} minDate={minEndDate} placeholder="Select end" />
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
                    style={[styles.seg, status === s && { ...styles.segActive, backgroundColor: STATUS_COLOR[s] + '20', borderColor: STATUS_COLOR[s] }]}
                    onPress={() => setStatus(s)}
                  >
                    <Text style={[styles.segText, status === s && { color: STATUS_COLOR[s], fontWeight: '800' }]}>{s}</Text>
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
                          v.status === 'Available' || v.status === 'available' ? C.success :
                          v.status === 'Hired'     || v.status === 'maintenance' ? C.warning : C.danger,
                      }]} />
                      <Text style={[styles.vehicleChipText, vehicleId === v.id && styles.vehicleChipTextActive]}>
                        {v.name}{v.plate_number ? ` · ${v.plate_number}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Guide / Ranger */}
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

            {/* Itinerary / Notes */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Itinerary / Notes</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={itinerary}
                onChangeText={setItinerary}
                placeholder="Day-by-day itinerary, inclusions, special requirements…"
                placeholderTextColor={C.muted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Info notice */}
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                🌿 This creates a booking record. Update payment and status from the Bookings screen after creation.
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
  container:             { flex: 1, backgroundColor: C.bg },
  header:                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, backgroundColor: C.hero },
  headerEyebrow:         { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 2 },
  headerTitle:           { fontSize: 24, fontWeight: '800', color: '#fffaf3', letterSpacing: -0.6 },
  closeBtn:              { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  body:                  { padding: 20 },
  row:                   { flexDirection: 'row', gap: 12 },
  input:                 { backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border, fontWeight: '500' },
  textarea:              { minHeight: 100, paddingTop: 12 },
  divider:               { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine:           { flex: 1, height: 1, backgroundColor: C.border },
  dividerText:           { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 10 },
  chipGrid:              { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:                  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  chipActive:            { backgroundColor: C.primary + '18', borderColor: C.primary },
  chipParkActive:        { backgroundColor: C.warning + '18', borderColor: C.warning },
  chipText:              { fontSize: 12, fontWeight: '600', color: C.muted },
  chipTextActive:        { color: C.primary, fontWeight: '800' },
  chipTextParkActive:    { color: C.warning, fontWeight: '800' },
  segRow:                { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  seg:                   { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  segActive:             { backgroundColor: C.primary + '18', borderColor: C.primary },
  segText:               { fontSize: 12, fontWeight: '600', color: C.muted },
  segTextActive:         { color: C.primary, fontWeight: '800' },
  vehicleChip:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  vehicleChipActive:     { backgroundColor: C.primary + '18', borderColor: C.primary },
  vehicleChipText:       { fontSize: 12, fontWeight: '600', color: C.muted },
  vehicleChipTextActive: { color: C.primary, fontWeight: '800' },
  statusDot:             { width: 7, height: 7, borderRadius: 4 },
  notice:                { backgroundColor: '#e8f0ec', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#c0d8cc' },
  noticeText:            { fontSize: 13, color: C.primary, lineHeight: 19 },
  submitBtn:             { backgroundColor: C.primary, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled:     { opacity: 0.6 },
  submitText:            { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});

export default CreateSafariModal;
