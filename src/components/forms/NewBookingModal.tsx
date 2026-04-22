/**
 * NewBookingModal
 * Collects booking details, validates, and inserts into the `bookings` table.
 *
 * Features:
 *  - Native calendar date pickers (no free-text date entry)
 *  - Dedicated "Search Existing Client" with debounced real-time search
 *  - Intelligent autocomplete on the Client Name field as the user types
 *  - Auto-population of email / phone on client selection
 *  - client_id linked to bookings table
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
interface ClientResult {
  id: string;
  company_name: string;
  email?: string | null;
  phone?: string | null;
}

interface NewBookingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicles: Vehicle[];
  userId?: string;
}

type BookingStatus   = 'Confirmed' | 'Pending' | 'In-Progress' | 'Completed' | 'Cancelled';
type BookingCurrency = 'USD' | 'UGX' | 'KES';

const CURRENCIES: BookingCurrency[] = ['USD', 'UGX', 'KES'];
const STATUS_OPTIONS: BookingStatus[] = ['Confirmed', 'Pending', 'In-Progress', 'Completed', 'Cancelled'];
const STATUS_COLOR: Record<BookingStatus, string> = {
  Confirmed:     C.success,
  Pending:       C.warning,
  'In-Progress': C.primary,
  Completed:     '#8366d7',
  Cancelled:     C.danger,
};

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

// ─── Calendar Picker ──────────────────────────────────────────────────────────
// Shows a tappable field; on press reveals a bottom-sheet with the native
// iOS inline calendar. Confirm button commits the selection.
interface DatePickerFieldProps {
  label:       string;
  value:       string;           // ISO yyyy-mm-dd or ''
  onChange:    (iso: string) => void;
  minDate?:    Date;
  placeholder?: string;
  hasError?:   boolean;
}

function DatePickerField({ label, value, onChange, minDate, placeholder = 'Select date', hasError }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  // Keep a "staged" date while the picker sheet is open
  const [staged, setStaged] = useState<Date>(value ? new Date(value) : new Date());

  const handleOpen = () => {
    setStaged(value ? new Date(value) : (minDate ?? new Date()));
    setOpen(true);
  };

  const handleConfirm = () => {
    onChange(toISO(staged));
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (selected) setStaged(selected);
  };

  return (
    <>
      <View style={fieldStyles.wrap}>
        <Text style={fieldStyles.label}>{label}</Text>
        <TouchableOpacity
          style={[
            fieldStyles.iconInput,
            hasError && { borderColor: C.danger },
            open   && { borderColor: C.primary },
          ]}
          onPress={handleOpen}
          activeOpacity={0.8}
        >
          <CalendarIcon color={value ? C.primary : C.muted} />
          <Text style={[fieldStyles.iconInputText, !value && { color: C.muted, fontWeight: '400' }]}>
            {value ? formatDisplay(value) : placeholder}
          </Text>
          {value ? (
            <TouchableOpacity
              onPress={() => onChange('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <CloseIcon color={C.muted} />
            </TouchableOpacity>
          ) : (
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2.5} strokeLinecap="round">
              <Path d="M6 9l6 6 6-6" />
            </Svg>
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom-sheet calendar */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={handleCancel}>
        <Pressable style={pickerStyles.backdrop} onPress={handleCancel} />
        <View style={pickerStyles.sheet}>
          {/* Sheet header */}
          <View style={pickerStyles.sheetHeader}>
            <TouchableOpacity onPress={handleCancel} style={pickerStyles.headerBtn}>
              <Text style={pickerStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={pickerStyles.sheetTitle}>{label.replace(' *', '')}</Text>
            <TouchableOpacity onPress={handleConfirm} style={pickerStyles.headerBtn}>
              <Text style={pickerStyles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
          {/* Native calendar */}
          <DateTimePicker
            value={staged}
            mode="date"
            display="inline"
            onChange={handleChange}
            minimumDate={minDate}
            themeVariant="light"
            accentColor={C.primary}
            style={pickerStyles.picker}
          />
        </View>
      </Modal>
    </>
  );
}

const pickerStyles = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:        { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, overflow: 'hidden' },
  sheetHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  sheetTitle:   { fontSize: 16, fontWeight: '700', color: C.text },
  headerBtn:    { minWidth: 70 },
  cancelText:   { fontSize: 15, color: C.muted, fontWeight: '600' },
  confirmText:  { fontSize: 15, color: C.primary, fontWeight: '800', textAlign: 'right' },
  picker:       { marginHorizontal: 4 },
});

// ─── Shared field styles ──────────────────────────────────────────────────────
const fieldStyles = StyleSheet.create({
  wrap:          { marginBottom: 14 },
  label:         { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  iconInput:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  iconInputText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
});

// ─── Dedicated Client Search ──────────────────────────────────────────────────
// Separate search field that finds a client by name / email / phone
// and populates all client fields in one tap.
function ClientSearch({
  onSelect,
  selectedClient,
  onClear,
}: {
  onSelect:       (c: ClientResult) => void;
  selectedClient: ClientResult | null;
  onClear:        () => void;
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
                <Text style={srchStyles.selectedSub} numberOfLines={1}>
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
      <View style={[
        fieldStyles.iconInput,
        showResults && { borderColor: C.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
      ]}>
        <SearchIcon color={searching ? C.primary : C.muted} />
        <TextInput
          style={fieldStyles.iconInputText}
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Search by name, email, or phone…"
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
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
              style={[srchStyles.resultRow, idx < results.length - 1 && srchStyles.resultBorder]}
              onPress={() => handleSelect(c)}
              activeOpacity={0.75}
            >
              <View style={srchStyles.resultAvatar}>
                <Text style={srchStyles.resultAvatarText}>{c.company_name.charAt(0).toUpperCase()}</Text>
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
          <Text style={srchStyles.noResultsText}>No clients found — enter details manually below</Text>
        </View>
      )}
    </View>
  );
}

const srchStyles = StyleSheet.create({
  resultsBox:      { backgroundColor: C.card, borderWidth: 1, borderTopWidth: 0, borderColor: C.primary, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden', maxHeight: 280 },
  resultRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  resultBorder:    { borderBottomWidth: 1, borderBottomColor: C.border },
  resultAvatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary + '20', alignItems: 'center', justifyContent: 'center' },
  resultAvatarText:{ fontSize: 14, fontWeight: '800', color: C.primary },
  resultName:      { fontSize: 14, fontWeight: '700', color: C.text },
  resultSub:       { fontSize: 12, color: C.muted, marginTop: 2 },
  noResults:       { backgroundColor: C.card, borderWidth: 1, borderTopWidth: 0, borderColor: C.border, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  noResultsText:   { fontSize: 13, color: C.muted, fontStyle: 'italic' },
  selectedPill:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.success + '12', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.success + '40' },
  selectedLeft:    { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectedName:    { fontSize: 15, fontWeight: '700', color: C.text },
  selectedSub:     { fontSize: 12, color: C.muted, marginTop: 2 },
});

// ─── Client Name Autocomplete ─────────────────────────────────────────────────
// When user types in the "Client Name" field, show live suggestions beneath it.
interface AutocompleteNameProps {
  value:          string;
  onChange:       (text: string) => void;
  onSelect:       (c: ClientResult) => void;
  isLinked:       boolean;          // true = a client is selected via search
}

function AutocompleteName({ value, onChange, onSelect, isLinked }: AutocompleteNameProps) {
  const [suggestions,    setSuggestions]    = useState<ClientResult[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [showSuggest,    setShowSuggest]    = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2 || isLinked) {
      setSuggestions([]); setShowSuggest(false); return;
    }
    setLoadingSuggest(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, email, phone')
        .ilike('company_name', `%${q.trim()}%`)
        .limit(5);
      if (!error && data && data.length > 0) {
        setSuggestions(data as ClientResult[]);
        setShowSuggest(true);
      } else {
        setSuggestions([]); setShowSuggest(false);
      }
    } finally {
      setLoadingSuggest(false);
    }
  }, [isLinked]);

  const handleTextChange = (text: string) => {
    onChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 250);
  };

  const handleSuggestionSelect = (c: ClientResult) => {
    setSuggestions([]); setShowSuggest(false);
    onSelect(c);
  };

  const dismissSuggestions = () => {
    setSuggestions([]); setShowSuggest(false);
  };

  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>Client Name *</Text>
      <View style={[
        fieldStyles.iconInput,
        isLinked && { borderColor: C.success + '60' },
        showSuggest && { borderColor: C.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
      ]}>
        <UserIcon color={isLinked ? C.success : C.primary} />
        <TextInput
          style={fieldStyles.iconInputText}
          value={value}
          onChangeText={handleTextChange}
          onBlur={dismissSuggestions}
          placeholder="Enter client or company name"
          placeholderTextColor={C.muted}
          autoCapitalize="words"
          returnKeyType="next"
        />
        {loadingSuggest && <ActivityIndicator size="small" color={C.primary} />}
      </View>
      {showSuggest && suggestions.length > 0 && (
        <View style={autoStyles.box}>
          {suggestions.map((c, idx) => (
            <TouchableOpacity
              key={c.id}
              style={[autoStyles.row, idx < suggestions.length - 1 && autoStyles.border]}
              onPress={() => handleSuggestionSelect(c)}
              activeOpacity={0.75}
            >
              <View style={autoStyles.avatar}>
                <Text style={autoStyles.avatarText}>{c.company_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={autoStyles.name}>{c.company_name}</Text>
                {(c.email || c.phone) && (
                  <Text style={autoStyles.sub} numberOfLines={1}>
                    {[c.email, c.phone].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              <Text style={autoStyles.tag}>Tap to fill</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const autoStyles = StyleSheet.create({
  box:        { backgroundColor: C.card, borderWidth: 1, borderTopWidth: 0, borderColor: C.primary, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 10 },
  border:     { borderBottomWidth: 1, borderBottomColor: C.border },
  avatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: C.warning + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800', color: C.warning },
  name:       { fontSize: 14, fontWeight: '700', color: C.text },
  sub:        { fontSize: 11, color: C.muted, marginTop: 1 },
  tag:        { fontSize: 10, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.3 },
});

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function NewBookingModal({ visible, onClose, onSuccess, vehicles, userId }: NewBookingModalProps) {
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);

  // Client state
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [clientName,     setClientName]     = useState('');
  const [contact,        setContact]        = useState('');
  const [email,          setEmail]          = useState('');

  // Booking fields
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [totalCost,   setTotalCost]   = useState('');
  const [currency,    setCurrency]    = useState<BookingCurrency>('USD');
  const [status,      setStatus]      = useState<BookingStatus>('Confirmed');
  const [vehicleId,   setVehicleId]   = useState('');
  const [notes,       setNotes]       = useState('');
  const [vehicleOpen, setVehicleOpen] = useState(false);

  // Derived min date for end date picker
  const minEndDate = startDate ? new Date(startDate) : undefined;

  const reset = useCallback(() => {
    setSelectedClient(null);
    setClientName(''); setContact(''); setEmail('');
    setStartDate(''); setEndDate(''); setTotalCost('');
    setCurrency('USD'); setStatus('Confirmed');
    setVehicleId(''); setNotes(''); setVehicleOpen(false);
  }, []);

  // Called when a client is chosen from either the dedicated Search or the autocomplete
  const handleClientSelect = useCallback((c: ClientResult) => {
    setSelectedClient(c);
    setClientName(c.company_name);
    if (c.email) setEmail(c.email);
    if (c.phone) setContact(c.phone);
  }, []);

  const handleClientClear = useCallback(() => {
    setSelectedClient(null);
  }, []);

  // If user edits client name manually after linking, break the link
  const handleClientNameChange = useCallback((text: string) => {
    if (selectedClient) setSelectedClient(null);
    setClientName(text);
  }, [selectedClient]);

  // Auto-clear end date if it's before the new start date
  const handleStartDateChange = useCallback((iso: string) => {
    setStartDate(iso);
    if (endDate && iso && endDate < iso) setEndDate('');
  }, [endDate]);

  const validate = useCallback((): string | null => {
    if (!clientName.trim())  return 'Client name is required.';
    if (!startDate)          return 'Please select a start date.';
    if (!endDate)            return 'Please select an end date.';
    if (endDate < startDate) return 'End date must be on or after the start date.';
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
      const booking_reference = `BK-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

      const { error } = await supabase.from('bookings').insert({
        booking_reference,
        client_id:           selectedClient?.id || null,
        client_name:         clientName.trim(),
        contact:             contact.trim()  || null,
        email:               email.trim()    || null,
        start_date:          startDate,
        end_date:            endDate,
        total_amount:        parseFloat(totalCost),
        amount_paid:         0,
        currency,
        status,
        notes:               notes.trim() || null,
        assigned_vehicle_id: vehicleId    || null,
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
  }, [validate, selectedClient, clientName, contact, email, startDate, endDate, totalCost, currency, status, vehicleId, notes, userId, reset, onSuccess]);

  const selectedVehicle = vehicles.find(v => v.id === vehicleId);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.container, { paddingTop: insets.top || 12 }]}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerEyebrow}>Create</Text>
              <Text style={styles.headerTitle}>New Booking</Text>
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

            {/* ── Dedicated client search ── */}
            <ClientSearch
              onSelect={handleClientSelect}
              selectedClient={selectedClient}
              onClear={handleClientClear}
            />

            {/* ── Divider ── */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>
                {selectedClient ? 'Booking Details' : 'Or Enter Client Details'}
              </Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Client Name with autocomplete ── */}
            <AutocompleteName
              value={clientName}
              onChange={handleClientNameChange}
              onSelect={handleClientSelect}
              isLinked={!!selectedClient}
            />

            {/* ── Contact + Email ── */}
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

            {/* ── Date pickers ── */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <DatePickerField
                  label="Start Date *"
                  value={startDate}
                  onChange={handleStartDateChange}
                  placeholder="Select start date"
                />
              </View>
              <View style={{ flex: 1 }}>
                <DatePickerField
                  label="End Date *"
                  value={endDate}
                  onChange={setEndDate}
                  minDate={minEndDate}
                  placeholder="Select end date"
                />
              </View>
            </View>

            {/* Date range summary */}
            {startDate && endDate && (
              <View style={styles.dateRangePill}>
                <CalendarIcon color={C.primary} />
                <Text style={styles.dateRangeText}>
                  {formatDisplay(startDate)} → {formatDisplay(endDate)}
                  {' '}
                  <Text style={styles.dateRangeDays}>
                    ({Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)} {Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) === 0 ? 'day' : 'days'})
                  </Text>
                </Text>
              </View>
            )}

            {/* ── Cost + Currency ── */}
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

            {/* ── Status ── */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Status</Text>
              <View style={styles.segRow}>
                {STATUS_OPTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.seg, status === s && {
                      ...styles.segActive,
                      backgroundColor: STATUS_COLOR[s] + '20',
                      borderColor: STATUS_COLOR[s],
                    }]}
                    onPress={() => setStatus(s)}
                  >
                    <Text style={[styles.segText, status === s && { color: STATUS_COLOR[s], fontWeight: '800' }]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Vehicle ── */}
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
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2.5} strokeLinecap="round">
                  <Path d={vehicleOpen ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
                </Svg>
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
                        backgroundColor: v.status === 'available' ? C.success : v.status === 'maintenance' ? C.warning : C.muted,
                      }]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* ── Notes ── */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Special requirements, inclusions, or notes…"
                placeholderTextColor={C.muted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
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
                : <Text style={styles.submitText}>Create Booking</Text>}
            </TouchableOpacity>

            <View style={{ height: insets.bottom + 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, backgroundColor: C.hero },
  headerEyebrow:      { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 2 },
  headerTitle:        { fontSize: 24, fontWeight: '800', color: '#fffaf3', letterSpacing: -0.6 },
  closeBtn:           { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  body:               { padding: 20 },
  row:                { flexDirection: 'row', gap: 12 },
  input:              { backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border, fontWeight: '500' },
  textarea:           { minHeight: 88, paddingTop: 12 },

  // Divider
  divider:            { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine:        { flex: 1, height: 1, backgroundColor: C.border },
  dividerText:        { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 10 },

  // Date range summary pill
  dateRangePill:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary + '10', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: -6, marginBottom: 14, borderWidth: 1, borderColor: C.primary + '25' },
  dateRangeText:      { fontSize: 13, color: C.primary, fontWeight: '600', flex: 1 },
  dateRangeDays:      { fontWeight: '800', color: C.primary },

  // Segments
  segRow:             { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  segCol:             { gap: 5 },
  seg:                { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  segActive:          { backgroundColor: C.primary + '18', borderColor: C.primary },
  segText:            { fontSize: 12, fontWeight: '600', color: C.muted },
  segTextActive:      { color: C.primary, fontWeight: '800' },

  // Vehicle dropdown
  dropdown:           { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginTop: 6, overflow: 'hidden', maxHeight: 220 },
  dropdownItem:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f0ebe0' },
  dropdownItemActive: { backgroundColor: C.primary + '0a' },
  dropdownText:       { fontSize: 14, color: C.text, flex: 1 },
  statusDot:          { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },

  // Submit
  submitBtn:          { backgroundColor: C.primary, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled:  { opacity: 0.6 },
  submitText:         { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});

export default NewBookingModal;
