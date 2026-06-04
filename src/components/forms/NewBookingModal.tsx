/**
 * NewBookingModal — Create New Booking
 * Scrollable vehicle/driver pickers + section-grouped form layout.
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
  FlatList,
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
import type { Vehicle } from '../../types/dashboard';

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

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClientResult {
  id: string;
  client_id?: string | null;
  company_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone_number?: string | null;
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
type BookingType     = 'booking' | 'reservation';
type PaymentMethod   = '' | 'mtn_uganda' | 'airtel_uganda' | 'mpesa_kenya' | 'bank_transfer' | 'cash';
type VehicleSource   = 'fleet' | 'external';

const CURRENCIES: BookingCurrency[] = ['USD', 'UGX', 'KES'];
const STATUS_OPTIONS: BookingStatus[] = ['Confirmed', 'Pending', 'In-Progress', 'Completed', 'Cancelled'];
const BOOKING_TYPES: { value: BookingType; label: string }[] = [
  { value: 'booking',     label: 'Booking (Current)' },
  { value: 'reservation', label: 'Reservation (Future)' },
];
const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'mtn_uganda',    label: 'MTN Uganda' },
  { value: 'airtel_uganda', label: 'Airtel Uganda' },
  { value: 'mpesa_kenya',   label: 'M-PESA Kenya' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash',          label: 'Cash' },
];
const STATUS_COLOR: Record<BookingStatus, string> = {
  Confirmed:     C.success,
  Pending:       C.warning,
  'In-Progress': C.primary,
  Completed:     '#8366d7',
  Cancelled:     C.danger,
};
const VEHICLE_STATUS_COLOR: Record<string, string> = {
  available:   C.success,
  booked:      C.danger,
  maintenance: C.warning,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}
function countDays(start: string, end: string): number {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}
function getDailyRate(capacity: string): number | null {
  if (capacity.includes('7')) return 130;
  if (capacity.includes('5')) return 120;
  return null;
}
function normalizePhone(phone?: string | null): string { return (phone || '').trim(); }
function escapePostgrestSearch(v: string): string { return v.trim().replace(/[%,]/g, ''); }
function calculateBalance(total: string, paid: string): number {
  return Math.max(0, (parseFloat(total) || 0) - (parseFloat(paid) || 0));
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function CloseIcon({ color = C.muted }: { color?: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round"><Path d="M18 6L6 18M6 6l12 12" /></Svg>;
}
function CalendarIcon({ color = C.primary }: { color?: string }) {
  return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"><Rect x="3" y="4" width="18" height="18" rx="2" /><Path d="M16 2v4M8 2v4M3 10h18" /></Svg>;
}
function TruckIcon({ color = C.primary }: { color?: string }) {
  return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"><Path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" /><Circle cx="5.5" cy="18.5" r="2.5" /><Circle cx="18.5" cy="18.5" r="2.5" /></Svg>;
}
function UserIcon({ color = C.primary }: { color?: string }) {
  return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><Circle cx="12" cy="7" r="4" /></Svg>;
}
function SearchIcon({ color = C.muted }: { color?: string }) {
  return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"><Circle cx="11" cy="11" r="8" /><Path d="M21 21l-4.35-4.35" /></Svg>;
}
function CheckIcon({ color = C.success }: { color?: string }) {
  return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round"><Path d="M20 6L9 17l-5-5" /></Svg>;
}
function ChevronIcon({ open }: { open: boolean }) {
  return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2.5} strokeLinecap="round"><Path d={open ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} /></Svg>;
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ step, title, icon }: { step: string; title: string; icon?: React.ReactNode }) {
  return (
    <View style={sectionStyles.header}>
      <View style={sectionStyles.stepBadge}>
        <Text style={sectionStyles.stepText}>{step}</Text>
      </View>
      {icon}
      <Text style={sectionStyles.title}>{title}</Text>
    </View>
  );
}
const sectionStyles = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 6 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  stepText:  { fontSize: 11, fontWeight: '800', color: '#fff' },
  title:     { fontSize: 14, fontWeight: '800', color: C.text, letterSpacing: -0.2, flex: 1 },
});

// ─── Calendar Picker ──────────────────────────────────────────────────────────
interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  minDate?: Date;
  placeholder?: string;
  hasError?: boolean;
}
function DatePickerField({ label, value, onChange, minDate, placeholder = 'Select date', hasError }: DatePickerFieldProps) {
  const [open,   setOpen]   = useState(false);
  const [staged, setStaged] = useState<Date>(value ? new Date(value) : new Date());

  const handleOpen    = () => { setStaged(value ? new Date(value) : (minDate ?? new Date())); setOpen(true); };
  const handleConfirm = () => { onChange(toISO(staged)); setOpen(false); };
  const handleCancel  = () => setOpen(false);
  const handleChange  = (_: DateTimePickerEvent, d?: Date) => { if (d) setStaged(d); };

  return (
    <>
      <View style={fld.wrap}>
        <Text style={fld.label}>{label}</Text>
        <TouchableOpacity
          style={[fld.iconInput, hasError && { borderColor: C.danger }, open && { borderColor: C.primary }]}
          onPress={handleOpen} activeOpacity={0.8}
        >
          <CalendarIcon color={value ? C.primary : C.muted} />
          <Text style={[fld.iconInputText, !value && { color: C.muted, fontWeight: '400' }]}>
            {value ? formatDisplay(value) : placeholder}
          </Text>
          {value
            ? <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><CloseIcon color={C.muted} /></TouchableOpacity>
            : <ChevronIcon open={false} />}
        </TouchableOpacity>
      </View>
      <Modal visible={open} transparent animationType="slide" onRequestClose={handleCancel}>
        <Pressable style={pickerSt.backdrop} onPress={handleCancel} />
        <View style={pickerSt.sheet}>
          <View style={pickerSt.sheetHeader}>
            <TouchableOpacity onPress={handleCancel} style={pickerSt.headerBtn}><Text style={pickerSt.cancelText}>Cancel</Text></TouchableOpacity>
            <Text style={pickerSt.sheetTitle}>{label.replace(' *', '')}</Text>
            <TouchableOpacity onPress={handleConfirm} style={pickerSt.headerBtn}><Text style={pickerSt.confirmText}>Confirm</Text></TouchableOpacity>
          </View>
          <DateTimePicker value={staged} mode="date" display="inline" onChange={handleChange} minimumDate={minDate} themeVariant="light" accentColor={C.primary} style={pickerSt.picker} />
        </View>
      </Modal>
    </>
  );
}
const pickerSt = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:       { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  sheetTitle:  { fontSize: 16, fontWeight: '700', color: C.text },
  headerBtn:   { minWidth: 70 },
  cancelText:  { fontSize: 15, color: C.muted, fontWeight: '600' },
  confirmText: { fontSize: 15, color: C.primary, fontWeight: '800', textAlign: 'right' },
  picker:      { marginHorizontal: 4 },
});

// ─── Vehicle Picker Sheet ─────────────────────────────────────────────────────
function VehiclePickerSheet({
  visible, vehicles, selectedId, onSelect, onClose,
}: {
  visible: boolean;
  vehicles: Vehicle[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = vehicles.filter(v => {
    const q = query.toLowerCase();
    return !q || `${v.make} ${v.model} ${v.license_plate} ${v.capacity}`.toLowerCase().includes(q);
  });

  const available = filtered.filter(v => v.status === 'available');
  const other     = filtered.filter(v => v.status !== 'available');
  const ordered   = [...available, ...other];

  const handleSelect = (id: string) => { setQuery(''); onSelect(id); onClose(); };
  const handleClear  = () => { setQuery(''); onSelect(''); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[vpSt.container, { paddingTop: insets.top || 16 }]}>
        {/* Header */}
        <View style={vpSt.header}>
          <View>
            <Text style={vpSt.eyebrow}>Fleet</Text>
            <Text style={vpSt.title}>Select Vehicle</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={vpSt.closeBtn}><CloseIcon color="#b8ab95" /></TouchableOpacity>
        </View>

        {/* Search */}
        <View style={vpSt.searchWrap}>
          <SearchIcon />
          <TextInput
            style={vpSt.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by make, model, or plate…"
            placeholderTextColor={C.muted}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Count pill */}
        <View style={vpSt.countRow}>
          <Text style={vpSt.countText}>
            {available.length} available · {other.length} unavailable
          </Text>
          {selectedId && (
            <TouchableOpacity onPress={handleClear}>
              <Text style={vpSt.clearText}>Clear selection</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Scrollable list */}
        <FlatList
          data={ordered}
          keyExtractor={v => v.id}
          contentContainerStyle={vpSt.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={vpSt.empty}>
              <Text style={vpSt.emptyText}>No vehicles match your search</Text>
            </View>
          }
          renderItem={({ item: v }) => {
            const rate       = getDailyRate(v.capacity);
            const isSelected = v.id === selectedId;
            const statusClr  = VEHICLE_STATUS_COLOR[v.status] ?? C.muted;
            const available  = v.status === 'available';

            return (
              <TouchableOpacity
                style={[vpSt.card, isSelected && vpSt.cardSelected, !available && vpSt.cardUnavailable]}
                onPress={() => handleSelect(v.id)}
                activeOpacity={0.75}
                disabled={!available && !isSelected}
              >
                {/* Left: truck icon */}
                <View style={[vpSt.iconBox, { backgroundColor: isSelected ? C.primary + '20' : C.input }]}>
                  <TruckIcon color={isSelected ? C.primary : C.muted} />
                </View>

                {/* Middle: info */}
                <View style={{ flex: 1 }}>
                  <Text style={[vpSt.cardName, isSelected && { color: C.primary }]}>
                    {v.make} {v.model}
                  </Text>
                  <Text style={vpSt.cardPlate}>{v.license_plate}</Text>
                  <View style={vpSt.cardMeta}>
                    <Text style={vpSt.cardCap}>{v.capacity}</Text>
                    {rate !== null && (
                      <View style={vpSt.ratePill}>
                        <Text style={vpSt.rateText}>${rate}/day</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Right: status + check */}
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={[vpSt.statusPill, { backgroundColor: statusClr + '20' }]}>
                    <Text style={[vpSt.statusText, { color: statusClr }]}>
                      {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                    </Text>
                  </View>
                  {isSelected && <CheckIcon color={C.primary} />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}
const vpSt = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, backgroundColor: C.hero },
  eyebrow:        { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 2 },
  title:          { fontSize: 24, fontWeight: '800', color: '#fffaf3', letterSpacing: -0.6 },
  closeBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  searchWrap:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 14, marginHorizontal: 16, marginTop: 14, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: C.border },
  searchInput:    { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  countRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  countText:      { fontSize: 12, color: C.muted, fontWeight: '600' },
  clearText:      { fontSize: 12, color: C.danger, fontWeight: '700' },
  list:           { paddingHorizontal: 16, paddingBottom: 32 },
  empty:          { alignItems: 'center', paddingVertical: 40 },
  emptyText:      { fontSize: 14, color: C.muted, fontStyle: 'italic' },
  card:           { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border },
  cardSelected:   { borderColor: C.primary, backgroundColor: C.primary + '08' },
  cardUnavailable:{ opacity: 0.5 },
  iconBox:        { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardName:       { fontSize: 15, fontWeight: '700', color: C.text },
  cardPlate:      { fontSize: 12, color: C.muted, fontWeight: '500', marginTop: 1 },
  cardMeta:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cardCap:        { fontSize: 12, color: C.muted },
  ratePill:       { backgroundColor: C.success + '15', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  rateText:       { fontSize: 11, fontWeight: '800', color: C.success },
  statusPill:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:     { fontSize: 11, fontWeight: '800' },
});

// ─── Driver Picker Sheet ──────────────────────────────────────────────────────
type Guide = { id: string; full_name: string; phone?: string | null };
function DriverPickerSheet({
  visible, guides, selectedId, onSelect, onClose,
}: {
  visible: boolean;
  guides: Guide[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = guides.filter(g => !query || g.full_name.toLowerCase().includes(query.toLowerCase()) || (g.phone || '').includes(query));
  const handleSelect = (id: string) => { setQuery(''); onSelect(id); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[dpSt.container, { paddingTop: insets.top || 16 }]}>
        <View style={dpSt.header}>
          <View>
            <Text style={dpSt.eyebrow}>Safari Team</Text>
            <Text style={dpSt.title}>Select Driver / Guide</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={dpSt.closeBtn}><CloseIcon color="#b8ab95" /></TouchableOpacity>
        </View>

        <View style={dpSt.searchWrap}>
          <SearchIcon />
          <TextInput
            style={dpSt.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or phone…"
            placeholderTextColor={C.muted}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={g => g.id}
          contentContainerStyle={dpSt.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <TouchableOpacity
              style={[dpSt.card, !selectedId && dpSt.cardSelected]}
              onPress={() => { setQuery(''); onSelect(''); onClose(); }}
              activeOpacity={0.75}
            >
              <View style={[dpSt.avatar, { backgroundColor: C.muted + '20' }]}>
                <Text style={[dpSt.avatarText, { color: C.muted }]}>—</Text>
              </View>
              <Text style={dpSt.noneName}>No driver / guide assigned</Text>
              {!selectedId && <CheckIcon color={C.primary} />}
            </TouchableOpacity>
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={dpSt.empty}><Text style={dpSt.emptyText}>No guides found</Text></View>
          }
          renderItem={({ item: g }) => {
            const isSelected = g.id === selectedId;
            return (
              <TouchableOpacity
                style={[dpSt.card, isSelected && dpSt.cardSelected]}
                onPress={() => handleSelect(g.id)}
                activeOpacity={0.75}
              >
                <View style={[dpSt.avatar, isSelected && { backgroundColor: C.primary + '20' }]}>
                  <Text style={[dpSt.avatarText, isSelected && { color: C.primary }]}>
                    {g.full_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[dpSt.name, isSelected && { color: C.primary }]}>{g.full_name}</Text>
                  {!!g.phone && <Text style={dpSt.phone}>{g.phone}</Text>}
                </View>
                {isSelected && <CheckIcon color={C.primary} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}
const dpSt = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, backgroundColor: C.hero },
  eyebrow:      { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 2 },
  title:        { fontSize: 24, fontWeight: '800', color: '#fffaf3', letterSpacing: -0.6 },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 14, marginHorizontal: 16, marginTop: 14, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: C.border },
  searchInput:  { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  list:         { paddingHorizontal: 16, paddingBottom: 32 },
  empty:        { alignItems: 'center', paddingVertical: 40 },
  emptyText:    { fontSize: 14, color: C.muted, fontStyle: 'italic' },
  card:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 0 },
  cardSelected: { borderColor: C.primary, backgroundColor: C.primary + '08' },
  avatar:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.warning + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 15, fontWeight: '800', color: C.warning },
  name:         { fontSize: 15, fontWeight: '700', color: C.text },
  noneName:     { fontSize: 14, color: C.muted, flex: 1 },
  phone:        { fontSize: 12, color: C.muted, marginTop: 2 },
});

// ─── Client Search ────────────────────────────────────────────────────────────
function ClientSearch({ onSelect, selectedClient, onClear }: {
  onSelect: (c: ClientResult) => void;
  selectedClient: ClientResult | null;
  onClear: () => void;
}) {
  const [query, setQuery]             = useState('');
  const [results, setResults]         = useState<ClientResult[]>([]);
  const [searching, setSearching]     = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); setShowResults(false); return; }
    setSearching(true);
    try {
      const term = escapePostgrestSearch(q);
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_id, company_name, contact_person, email, phone_number')
        .or(`company_name.ilike.%${term}%,email.ilike.%${term}%,phone_number.ilike.%${term}%,contact_person.ilike.%${term}%,client_id.ilike.%${term}%`)
        .limit(8);
      if (!error && data) { setResults(data as ClientResult[]); setShowResults(true); }
    } finally { setSearching(false); }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 300);
  };
  const handleSelect = (c: ClientResult) => { setQuery(''); setResults([]); setShowResults(false); onSelect(c); };
  const handleClear  = () => { setQuery(''); setResults([]); setShowResults(false); onClear(); };

  if (selectedClient) {
    return (
      <View style={fld.wrap}>
        <Text style={fld.label}>Client</Text>
        <View style={srch.selectedPill}>
          <View style={srch.selectedLeft}>
            <CheckIcon />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={srch.selectedName}>{selectedClient.company_name}</Text>
              {(selectedClient.client_id || selectedClient.email || selectedClient.phone_number) && (
                <Text style={srch.selectedSub} numberOfLines={1}>
                  {[selectedClient.client_id, selectedClient.email, selectedClient.phone_number].filter(Boolean).join(' · ')}
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
    <View style={fld.wrap}>
      <Text style={fld.label}>Search Existing Client (Optional)</Text>
      <View style={[fld.iconInput, showResults && { borderColor: C.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
        <SearchIcon color={searching ? C.primary : C.muted} />
        <TextInput
          style={fld.iconInputText}
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
        <View style={srch.resultsBox}>
          {results.map((c, idx) => (
            <TouchableOpacity key={c.id} style={[srch.resultRow, idx < results.length - 1 && srch.resultBorder]} onPress={() => handleSelect(c)} activeOpacity={0.75}>
              <View style={srch.resultAvatar}>
                <Text style={srch.resultAvatarText}>{c.company_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={srch.resultName}>{c.company_name}</Text>
                {(c.client_id || c.email || c.phone_number) && (
                  <Text style={srch.resultSub} numberOfLines={1}>{[c.client_id, c.email, c.phone_number].filter(Boolean).join(' · ')}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {showResults && results.length === 0 && !searching && query.length >= 2 && (
        <View style={srch.noResults}><Text style={srch.noResultsText}>No clients found — enter details manually below</Text></View>
      )}
    </View>
  );
}
const srch = StyleSheet.create({
  resultsBox:       { backgroundColor: C.card, borderWidth: 1, borderTopWidth: 0, borderColor: C.primary, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden', maxHeight: 280 },
  resultRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  resultBorder:     { borderBottomWidth: 1, borderBottomColor: C.border },
  resultAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary + '20', alignItems: 'center', justifyContent: 'center' },
  resultAvatarText: { fontSize: 14, fontWeight: '800', color: C.primary },
  resultName:       { fontSize: 14, fontWeight: '700', color: C.text },
  resultSub:        { fontSize: 12, color: C.muted, marginTop: 2 },
  noResults:        { backgroundColor: C.card, borderWidth: 1, borderTopWidth: 0, borderColor: C.border, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  noResultsText:    { fontSize: 13, color: C.muted, fontStyle: 'italic' },
  selectedPill:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.success + '12', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.success + '40' },
  selectedLeft:     { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectedName:     { fontSize: 15, fontWeight: '700', color: C.text },
  selectedSub:      { fontSize: 12, color: C.muted, marginTop: 2 },
});

// ─── Autocomplete Name ────────────────────────────────────────────────────────
function AutocompleteName({ value, onChange, onSelect, isLinked }: {
  value: string;
  onChange: (text: string) => void;
  onSelect: (c: ClientResult) => void;
  isLinked: boolean;
}) {
  const [suggestions, setSuggestions]       = useState<ClientResult[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [showSuggest, setShowSuggest]       = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2 || isLinked) { setSuggestions([]); setShowSuggest(false); return; }
    setLoadingSuggest(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_id, company_name, contact_person, email, phone_number')
        .or(`company_name.ilike.%${escapePostgrestSearch(q)}%,email.ilike.%${escapePostgrestSearch(q)}%,contact_person.ilike.%${escapePostgrestSearch(q)}%`)
        .limit(5);
      if (!error && data && data.length > 0) { setSuggestions(data as ClientResult[]); setShowSuggest(true); }
      else { setSuggestions([]); setShowSuggest(false); }
    } finally { setLoadingSuggest(false); }
  }, [isLinked]);

  const handleTextChange = (text: string) => {
    onChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 250);
  };

  return (
    <View style={fld.wrap}>
      <Text style={fld.label}>Client Name *</Text>
      <View style={[fld.iconInput, isLinked && { borderColor: C.success + '60' }, showSuggest && { borderColor: C.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
        <UserIcon color={isLinked ? C.success : C.primary} />
        <TextInput
          style={fld.iconInputText}
          value={value}
          onChangeText={handleTextChange}
          onBlur={() => { setSuggestions([]); setShowSuggest(false); }}
          placeholder="Enter client or company name"
          placeholderTextColor={C.muted}
          autoCapitalize="words"
          returnKeyType="next"
        />
        {loadingSuggest && <ActivityIndicator size="small" color={C.primary} />}
      </View>
      {showSuggest && suggestions.length > 0 && (
        <View style={autoSt.box}>
          {suggestions.map((c, idx) => (
            <TouchableOpacity
              key={c.id}
              style={[autoSt.row, idx < suggestions.length - 1 && autoSt.border]}
              onPress={() => { setSuggestions([]); setShowSuggest(false); onSelect(c); }}
              activeOpacity={0.75}
            >
              <View style={autoSt.avatar}><Text style={autoSt.avatarText}>{c.company_name.charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={autoSt.name}>{c.company_name}</Text>
                {(c.email || c.phone_number) && <Text style={autoSt.sub} numberOfLines={1}>{[c.email, c.phone_number].filter(Boolean).join(' · ')}</Text>}
              </View>
              <Text style={autoSt.tag}>Tap to fill</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
const autoSt = StyleSheet.create({
  box:        { backgroundColor: C.card, borderWidth: 1, borderTopWidth: 0, borderColor: C.primary, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 10 },
  border:     { borderBottomWidth: 1, borderBottomColor: C.border },
  avatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: C.warning + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800', color: C.warning },
  name:       { fontSize: 14, fontWeight: '700', color: C.text },
  sub:        { fontSize: 11, color: C.muted, marginTop: 1 },
  tag:        { fontSize: 10, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.3 },
});

// ─── Shared field styles ──────────────────────────────────────────────────────
const fld = StyleSheet.create({
  wrap:          { marginBottom: 14 },
  label:         { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  iconInput:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  iconInputText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
});

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function NewBookingModal({ visible, onClose, onSuccess, vehicles, userId }: NewBookingModalProps) {
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);

  // Client
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [companyName,    setCompanyName]    = useState('');
  const [clientName,     setClientName]     = useState('');
  const [contactPerson,  setContactPerson]  = useState('');
  const [contact,        setContact]        = useState('');
  const [email,          setEmail]          = useState('');
  const [phoneNumber,    setPhoneNumber]    = useState('');

  // Booking
  const [startDate,      setStartDate]      = useState('');
  const [endDate,        setEndDate]        = useState('');
  const [packageType,    setPackageType]    = useState('');
  const [totalCost,      setTotalCost]      = useState('');
  const [dailyRate,      setDailyRate]      = useState('');
  const [amountPaid,     setAmountPaid]     = useState('');
  const [currency,       setCurrency]       = useState<BookingCurrency>('USD');
  const [status,         setStatus]         = useState<BookingStatus>('Pending');
  const [bookingType,    setBookingType]    = useState<BookingType>('booking');
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>('');
  const [transactionId,  setTransactionId]  = useState('');
  const [bankName,       setBankName]       = useState('');
  const [vehicleId,      setVehicleId]      = useState('');
  const [driverId,       setDriverId]       = useState('');
  const [notes,          setNotes]          = useState('');
  const [vehicleSource,  setVehicleSource]  = useState<VehicleSource>('fleet');
  const [vendorName,     setVendorName]     = useState('');
  const [vendorPlate,    setVendorPlate]    = useState('');
  const [vendorReason,   setVendorReason]   = useState('');
  const [costAutoCalc,   setCostAutoCalc]   = useState(false);

  // Picker visibility
  const [vehicleSheetOpen, setVehicleSheetOpen] = useState(false);
  const [driverSheetOpen,  setDriverSheetOpen]  = useState(false);

  const [guides, setGuides] = useState<Guide[]>([]);

  const minEndDate = startDate ? new Date(startDate) : undefined;

  useEffect(() => {
    if (!vehicleId || !startDate || !endDate) return;
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    const rate = getDailyRate(vehicle.capacity);
    if (rate === null) return;
    const days = countDays(startDate, endDate);
    setDailyRate(String(rate));
    setTotalCost(String(rate * days));
    setCostAutoCalc(true);
  }, [vehicleId, startDate, endDate, vehicles]);

  useEffect(() => {
    if (!visible) return;
    supabase.from('safari_guides').select('id, full_name, phone, status').eq('status', 'active').order('full_name')
      .then(({ data, error }) => { if (!error) setGuides((data || []) as Guide[]); });
  }, [visible]);

  const reset = useCallback(() => {
    setSelectedClient(null);
    setCompanyName(''); setClientName(''); setContactPerson(''); setContact(''); setEmail(''); setPhoneNumber('');
    setStartDate(''); setEndDate(''); setPackageType(''); setTotalCost(''); setDailyRate(''); setAmountPaid('');
    setCurrency('USD'); setStatus('Pending'); setBookingType('booking'); setPaymentMethod(''); setTransactionId(''); setBankName('');
    setVehicleId(''); setDriverId(''); setNotes('');
    setVehicleSource('fleet'); setVendorName(''); setVendorPlate(''); setVendorReason('');
    setCostAutoCalc(false); setVehicleSheetOpen(false); setDriverSheetOpen(false);
  }, []);

  const handleClientSelect = useCallback((c: ClientResult) => {
    setSelectedClient(c);
    setCompanyName(c.company_name);
    setClientName(c.contact_person || c.company_name);
    setContactPerson(c.contact_person || '');
    if (c.email) setEmail(c.email);
    if (c.phone_number) { setContact(c.phone_number); setPhoneNumber(c.phone_number); }
  }, []);

  const handleStartDateChange = useCallback((iso: string) => {
    setStartDate(iso);
    if (endDate && iso && endDate < iso) setEndDate('');
  }, [endDate]);

  const handleDailyRateChange = useCallback((text: string) => {
    setDailyRate(text);
    setCostAutoCalc(false);
    const days = countDays(startDate, endDate);
    const rate = parseFloat(text);
    if (days > 0 && !isNaN(rate) && rate > 0) setTotalCost(String(days * rate));
  }, [startDate, endDate]);

  const validate = useCallback((): string | null => {
    if (!companyName.trim())  return 'Company name is required.';
    if (!phoneNumber.trim())  return 'Phone number is required.';
    if (!clientName.trim())   return 'Contact person name is required.';
    if (!contact.trim())      return 'Contact phone is required.';
    if (!email.trim())        return 'Email is required.';
    if (!packageType.trim())  return 'Package type is required.';
    if (!dailyRate.trim())    return 'Daily rate is required.';
    if (!startDate)           return 'Please select a start date.';
    if (!endDate)             return 'Please select an end date.';
    if (endDate < startDate)  return 'End date must be on or after the start date.';
    const rate = parseFloat(dailyRate);
    if (isNaN(rate) || rate <= 0) return 'Daily rate must be a positive number.';
    const cost = parseFloat(totalCost);
    if (isNaN(cost) || cost <= 0) return 'Total cost must be a positive number.';
    const paid = parseFloat(amountPaid || '0');
    if (isNaN(paid) || paid < 0) return 'Amount paid cannot be negative.';
    if (paid > cost) return 'Amount paid cannot exceed total amount.';
    if ((paymentMethod === 'mtn_uganda' || paymentMethod === 'airtel_uganda' || paymentMethod === 'mpesa_kenya' || paymentMethod === 'bank_transfer') && !transactionId.trim())
      return 'Please enter transaction ID for the selected payment method.';
    if (paymentMethod === 'bank_transfer' && !bankName.trim()) return 'Please specify the bank.';
    return null;
  }, [companyName, phoneNumber, clientName, contact, email, packageType, dailyRate, startDate, endDate, totalCost, amountPaid, paymentMethod, transactionId, bankName]);

  const handleSubmit = useCallback(async () => {
    const err = validate();
    if (err) { Alert.alert('Validation Error', err); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let clientId = selectedClient?.id || null;
      if (!clientId) {
        const { data: resolvedClientId, error: clientError } = await supabase.rpc('find_or_create_client', {
          p_company_name:    companyName.trim(),
          p_phone_number:    normalizePhone(phoneNumber),
          p_contact_person:  clientName.trim(),
          p_email:           email.trim(),
          p_created_by:      user?.id || userId || null,
        });
        if (clientError) throw clientError;
        clientId = resolvedClientId as string;
      }
      const totalAmount  = parseFloat(totalCost);
      const paidAmount   = parseFloat(amountPaid || '0');
      const balanceDue   = totalAmount - paidAmount;
      const numberOfDays = countDays(startDate, endDate);

      const { data: bookingData, error } = await supabase.from('bookings').insert({
        booking_reference:   null,
        client_id:           clientId,
        client_name:         clientName.trim(),
        contact_person:      contactPerson.trim() || null,
        contact:             contact.trim()  || null,
        email:               email.trim()    || null,
        package_type:        packageType.trim(),
        start_date:          startDate,
        end_date:            endDate,
        date_range:          `${startDate} to ${endDate}`,
        daily_rate:          parseFloat(dailyRate),
        number_of_days:      numberOfDays,
        total_amount:        totalAmount,
        amount_paid:         paidAmount,
        balance_due:         balanceDue,
        currency,
        payment_method:      paymentMethod || null,
        transaction_id:      transactionId.trim() || null,
        bank_name:           bankName.trim() || null,
        status,
        contract_status:     'Pending',
        booking_type:        bookingType,
        notes:               notes.trim() || null,
        assigned_vehicle_id: vehicleSource === 'fleet' ? (vehicleId || null) : null,
        assigned_driver_id:  driverId || null,
        is_vendor_vehicle:   vehicleSource === 'external',
        vendor_vehicle_details: vehicleSource === 'external' ? { vendor_name: vendorName.trim() || null, license_plate: vendorPlate.trim() || null, reason: vendorReason.trim() || null } : null,
        assigned_to:         userId || user?.id || null,
        created_by:          user?.id || userId || null,
        vehicles:            [],
        created_at:          new Date().toISOString(),
      }).select('id, booking_reference').single();

      if (error) throw error;
      if (vehicleId) await supabase.from('vehicles').update({ status: 'booked' }).eq('id', vehicleId);
      if (paidAmount > 0) {
        await supabase.from('financial_transactions').insert({
          transaction_type: 'income',
          category:         'Booking Revenue',
          amount:           paidAmount,
          currency,
          description:      `Payment for booking ${bookingData?.booking_reference || 'new booking'} - ${clientName.trim()}`,
          reference_number: transactionId.trim() || bookingData?.booking_reference || null,
          booking_id:       bookingData?.id,
          payment_method:   paymentMethod || 'cash',
          payment_details:  { method: paymentMethod || 'cash', transaction_id: transactionId.trim() || null },
          status:           'completed',
          transaction_date: new Date().toISOString(),
          created_by:       user?.id || userId || null,
        });
      }
      reset();
      onSuccess();
      Alert.alert('Booking Created', `Booking ${bookingData?.booking_reference || 'new booking'} has been successfully created.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [validate, selectedClient, companyName, phoneNumber, clientName, contactPerson, contact, email, packageType, startDate, endDate, dailyRate, totalCost, amountPaid, currency, paymentMethod, transactionId, bankName, status, bookingType, vehicleId, vehicleSource, vendorName, vendorPlate, vendorReason, driverId, notes, userId, reset, onSuccess]);

  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const selectedGuide   = guides.find(g => g.id === driverId);

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[st.container, { paddingTop: insets.top || 12 }]}>

            {/* ── Header ── */}
            <View style={st.header}>
              <View>
                <Text style={st.headerEyebrow}>Bookings</Text>
                <Text style={st.headerTitle}>Create New Booking</Text>
              </View>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} style={st.closeBtn}>
                <CloseIcon color="#b8ab95" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">

              {/* ── Section 1: Client ── */}
              <SectionHeader step="1" title="Client Information" icon={<UserIcon color={C.primary} />} />

              <ClientSearch onSelect={handleClientSelect} selectedClient={selectedClient} onClear={() => setSelectedClient(null)} />

              <View style={st.divider}>
                <View style={st.dividerLine} />
                <Text style={st.dividerText}>{selectedClient ? 'Booking Details' : 'Or Enter Manually'}</Text>
                <View style={st.dividerLine} />
              </View>

              <View style={fld.wrap}>
                <Text style={fld.label}>Company Name *</Text>
                <TextInput style={st.input} value={companyName} onChangeText={t => { if (selectedClient) setSelectedClient(null); setCompanyName(t); }} placeholder="Enter company name" placeholderTextColor={C.muted} autoCapitalize="words" />
              </View>

              <View style={fld.wrap}>
                <Text style={fld.label}>Phone Number *</Text>
                <TextInput style={st.input} value={phoneNumber} onChangeText={t => { setPhoneNumber(t); if (!contact) setContact(t); }} placeholder="Company phone number" placeholderTextColor={C.muted} keyboardType="phone-pad" />
              </View>

              <AutocompleteName value={clientName} onChange={t => { if (selectedClient) setSelectedClient(null); setClientName(t); }} onSelect={handleClientSelect} isLinked={!!selectedClient} />

              <View style={st.row}>
                <View style={{ flex: 1 }}>
                  <View style={fld.wrap}>
                    <Text style={fld.label}>Contact</Text>
                    <TextInput style={st.input} value={contact} onChangeText={setContact} placeholder="Phone number" placeholderTextColor={C.muted} keyboardType="phone-pad" />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={fld.wrap}>
                    <Text style={fld.label}>Email *</Text>
                    <TextInput style={st.input} value={email} onChangeText={setEmail} placeholder="client@email.com" placeholderTextColor={C.muted} keyboardType="email-address" autoCapitalize="none" />
                  </View>
                </View>
              </View>

              <View style={fld.wrap}>
                <Text style={fld.label}>Contact Person (Optional)</Text>
                <TextInput style={st.input} value={contactPerson} onChangeText={setContactPerson} placeholder="Reference person at client organisation" placeholderTextColor={C.muted} autoCapitalize="words" />
              </View>

              {/* ── Section 2: Trip ── */}
              <View style={st.sectionGap} />
              <SectionHeader step="2" title="Trip Details" icon={<CalendarIcon color={C.primary} />} />

              <View style={fld.wrap}>
                <Text style={fld.label}>Package Type *</Text>
                <TextInput style={st.input} value={packageType} onChangeText={setPackageType} placeholder="e.g. 7-Day Safari Package" placeholderTextColor={C.muted} />
              </View>

              <View style={fld.wrap}>
                <Text style={fld.label}>Booking Type *</Text>
                <View style={st.segRow}>
                  {BOOKING_TYPES.map(opt => (
                    <TouchableOpacity key={opt.value} style={[st.seg, bookingType === opt.value && st.segActive]} onPress={() => { setBookingType(opt.value); setStatus('Pending'); }}>
                      <Text style={[st.segText, bookingType === opt.value && st.segTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={st.row}>
                <View style={{ flex: 1 }}>
                  <DatePickerField label="Start Date *" value={startDate} onChange={handleStartDateChange} placeholder="Select start date" />
                </View>
                <View style={{ flex: 1 }}>
                  <DatePickerField label="End Date *" value={endDate} onChange={setEndDate} minDate={minEndDate} placeholder="Select end date" />
                </View>
              </View>

              {startDate && endDate && (
                <View style={st.dateRangePill}>
                  <CalendarIcon color={C.primary} />
                  <Text style={st.dateRangeText}>
                    {formatDisplay(startDate)} → {formatDisplay(endDate)}{'  '}
                    <Text style={st.dateRangeDays}>({countDays(startDate, endDate)} {countDays(startDate, endDate) === 1 ? 'day' : 'days'})</Text>
                  </Text>
                </View>
              )}

              {/* ── Section 3: Pricing ── */}
              <View style={st.sectionGap} />
              <SectionHeader step="3" title="Pricing & Payment" />

              <View style={st.row}>
                <View style={{ flex: 1 }}>
                  <View style={fld.wrap}>
                    <Text style={fld.label}>Daily Rate *</Text>
                    <TextInput style={st.input} value={dailyRate} onChangeText={handleDailyRateChange} placeholder="0.00" placeholderTextColor={C.muted} keyboardType="decimal-pad" />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={fld.wrap}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={fld.label}>Total Amount</Text>
                      {costAutoCalc && <Text style={st.autoCalcTag}>Auto</Text>}
                    </View>
                    <TextInput style={st.input} value={totalCost} onChangeText={t => { setTotalCost(t); setCostAutoCalc(false); }} placeholder="0.00" placeholderTextColor={C.muted} keyboardType="decimal-pad" />
                  </View>
                </View>
              </View>

              <View style={st.row}>
                <View style={{ flex: 1 }}>
                  <View style={fld.wrap}>
                    <Text style={fld.label}>Amount Paid</Text>
                    <TextInput style={st.input} value={amountPaid} onChangeText={setAmountPaid} placeholder="0.00" placeholderTextColor={C.muted} keyboardType="decimal-pad" />
                  </View>
                </View>
                <View style={{ flex: 1, marginBottom: 14 }}>
                  <Text style={fld.label}>Balance Due</Text>
                  <View style={st.readOnlyBox}>
                    <Text style={[st.readOnlyText, calculateBalance(totalCost, amountPaid) > 0 && { color: C.danger }]}>
                      {currency} {calculateBalance(totalCost, amountPaid).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={fld.wrap}>
                <Text style={fld.label}>Currency</Text>
                <View style={st.segRow}>
                  {CURRENCIES.map(cur => (
                    <TouchableOpacity key={cur} style={[st.seg, currency === cur && st.segActive]} onPress={() => setCurrency(cur)}>
                      <Text style={[st.segText, currency === cur && st.segTextActive]}>{cur}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={fld.wrap}>
                <Text style={fld.label}>Status</Text>
                <View style={st.segRow}>
                  {STATUS_OPTIONS.map(s => (
                    <TouchableOpacity key={s} style={[st.seg, status === s && { ...st.segActive, backgroundColor: STATUS_COLOR[s] + '20', borderColor: STATUS_COLOR[s] }]} onPress={() => setStatus(s)}>
                      <Text style={[st.segText, status === s && { color: STATUS_COLOR[s], fontWeight: '800' }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={fld.wrap}>
                <Text style={fld.label}>Payment Method</Text>
                <View style={st.segRow}>
                  {PAYMENT_METHODS.map(m => (
                    <TouchableOpacity key={m.value} style={[st.seg, paymentMethod === m.value && st.segActive]} onPress={() => { setPaymentMethod(m.value); setTransactionId(''); setBankName(''); }}>
                      <Text style={[st.segText, paymentMethod === m.value && st.segTextActive]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {paymentMethod === 'bank_transfer' && (
                <View style={fld.wrap}>
                  <Text style={fld.label}>Bank *</Text>
                  <View style={st.segRow}>
                    {['stanbic_bank', 'im_bank'].map(bank => (
                      <TouchableOpacity key={bank} style={[st.seg, bankName === bank && st.segActive]} onPress={() => setBankName(bank)}>
                        <Text style={[st.segText, bankName === bank && st.segTextActive]}>{bank === 'stanbic_bank' ? 'Stanbic Bank' : 'I&M Bank'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {(paymentMethod === 'mtn_uganda' || paymentMethod === 'airtel_uganda' || paymentMethod === 'mpesa_kenya' || paymentMethod === 'bank_transfer') && (
                <View style={fld.wrap}>
                  <Text style={fld.label}>Transaction ID *</Text>
                  <TextInput style={st.input} value={transactionId} onChangeText={setTransactionId} placeholder="Enter transaction ID" placeholderTextColor={C.muted} autoCapitalize="characters" />
                </View>
              )}

              {/* ── Section 4: Assignment ── */}
              <View style={st.sectionGap} />
              <SectionHeader step="4" title="Vehicle & Driver Assignment" icon={<TruckIcon color={C.primary} />} />

              {/* Vehicle source toggle */}
              <View style={fld.wrap}>
                <Text style={fld.label}>Vehicle Source</Text>
                <View style={st.segRow}>
                  {([{ value: 'fleet', label: 'Fleet Vehicle' }, { value: 'external', label: 'External / Vendor' }] as { value: VehicleSource; label: string }[]).map(opt => (
                    <TouchableOpacity key={opt.value} style={[st.seg, vehicleSource === opt.value && st.segActive]} onPress={() => { setVehicleSource(opt.value); setVehicleId(''); setVendorName(''); setVendorPlate(''); setVendorReason(''); }}>
                      <Text style={[st.segText, vehicleSource === opt.value && st.segTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* External vendor fields */}
              {vehicleSource === 'external' && (
                <>
                  <View style={fld.wrap}>
                    <Text style={fld.label}>Vendor / Company Name</Text>
                    <TextInput style={st.input} value={vendorName} onChangeText={setVendorName} placeholder="e.g. Kampala Car Rentals Ltd" placeholderTextColor={C.muted} autoCapitalize="words" />
                  </View>
                  <View style={st.row}>
                    <View style={{ flex: 1 }}>
                      <View style={fld.wrap}>
                        <Text style={fld.label}>Vehicle Plate</Text>
                        <TextInput style={st.input} value={vendorPlate} onChangeText={setVendorPlate} placeholder="e.g. UAA 123B" placeholderTextColor={C.muted} autoCapitalize="characters" />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={fld.wrap}>
                        <Text style={fld.label}>Reason</Text>
                        <TextInput style={st.input} value={vendorReason} onChangeText={setVendorReason} placeholder="Why external vehicle?" placeholderTextColor={C.muted} />
                      </View>
                    </View>
                  </View>
                </>
              )}

              {/* Fleet vehicle selector — opens full-screen scrollable picker */}
              {vehicleSource === 'fleet' && (
                <View style={fld.wrap}>
                  <Text style={fld.label}>Assign Vehicle (Optional)</Text>
                  <TouchableOpacity
                    style={[fld.iconInput, vehicleId && { borderColor: C.primary }]}
                    onPress={() => setVehicleSheetOpen(true)}
                    activeOpacity={0.8}
                  >
                    <TruckIcon color={selectedVehicle ? C.primary : C.muted} />
                    <View style={{ flex: 1 }}>
                      {selectedVehicle ? (
                        <>
                          <Text style={[fld.iconInputText, { flex: 0, color: C.primary }]}>
                            {selectedVehicle.make} {selectedVehicle.model} · {selectedVehicle.license_plate}
                          </Text>
                          <Text style={st.vehicleSubLine}>
                            {selectedVehicle.capacity}
                            {getDailyRate(selectedVehicle.capacity) !== null ? ` · $${getDailyRate(selectedVehicle.capacity)}/day` : ''}
                          </Text>
                        </>
                      ) : (
                        <Text style={[fld.iconInputText, { color: C.muted }]}>
                          Tap to browse {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}…
                        </Text>
                      )}
                    </View>
                    {vehicleId
                      ? <TouchableOpacity onPress={() => setVehicleId('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><CloseIcon color={C.muted} /></TouchableOpacity>
                      : <ChevronIcon open={false} />}
                  </TouchableOpacity>
                </View>
              )}

              {/* Driver selector */}
              <View style={fld.wrap}>
                <Text style={fld.label}>Assign Driver / Guide (Optional)</Text>
                <TouchableOpacity
                  style={[fld.iconInput, driverId && { borderColor: C.primary }]}
                  onPress={() => setDriverSheetOpen(true)}
                  activeOpacity={0.8}
                >
                  <UserIcon color={driverId ? C.primary : C.muted} />
                  <Text style={[fld.iconInputText, !driverId && { color: C.muted }]}>
                    {selectedGuide ? selectedGuide.full_name : `Tap to browse ${guides.length} guide${guides.length !== 1 ? 's' : ''}…`}
                  </Text>
                  {driverId
                    ? <TouchableOpacity onPress={() => setDriverId('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><CloseIcon color={C.muted} /></TouchableOpacity>
                    : <ChevronIcon open={false} />}
                </TouchableOpacity>
              </View>

              {/* ── Section 5: Notes ── */}
              <View style={st.sectionGap} />
              <SectionHeader step="5" title="Additional Notes" />

              <View style={fld.wrap}>
                <TextInput
                  style={[st.input, st.textarea]}
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
              <TouchableOpacity style={[st.submitBtn, submitting && st.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={st.submitText}>Create Booking</Text>}
              </TouchableOpacity>

              <View style={{ height: insets.bottom + 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Scrollable vehicle picker sheet */}
      <VehiclePickerSheet
        visible={vehicleSheetOpen}
        vehicles={vehicles}
        selectedId={vehicleId}
        onSelect={setVehicleId}
        onClose={() => setVehicleSheetOpen(false)}
      />

      {/* Scrollable driver/guide picker sheet */}
      <DriverPickerSheet
        visible={driverSheetOpen}
        guides={guides}
        selectedId={driverId}
        onSelect={setDriverId}
        onClose={() => setDriverSheetOpen(false)}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, backgroundColor: C.hero },
  headerEyebrow:    { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 2 },
  headerTitle:      { fontSize: 24, fontWeight: '800', color: '#fffaf3', letterSpacing: -0.6 },
  closeBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  body:             { padding: 20 },
  row:              { flexDirection: 'row', gap: 12 },
  sectionGap:       { height: 8, marginBottom: 4 },
  input:            { backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border, fontWeight: '500' },
  textarea:         { minHeight: 88, paddingTop: 12 },
  readOnlyBox:      { backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border, minHeight: 46, justifyContent: 'center' },
  readOnlyText:     { fontSize: 15, color: C.text, fontWeight: '800' },
  vehicleSubLine:   { fontSize: 11, color: C.primary, fontWeight: '600', marginTop: 1 },
  autoCalcTag:      { fontSize: 10, fontWeight: '700', color: C.success, textTransform: 'uppercase', letterSpacing: 0.3 },
  divider:          { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine:      { flex: 1, height: 1, backgroundColor: C.border },
  dividerText:      { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 10 },
  dateRangePill:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary + '10', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: -6, marginBottom: 14, borderWidth: 1, borderColor: C.primary + '25' },
  dateRangeText:    { fontSize: 13, color: C.primary, fontWeight: '600', flex: 1 },
  dateRangeDays:    { fontWeight: '800', color: C.primary },
  segRow:           { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  seg:              { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  segActive:        { backgroundColor: C.primary + '18', borderColor: C.primary },
  segText:          { fontSize: 12, fontWeight: '600', color: C.muted },
  segTextActive:    { color: C.primary, fontWeight: '800' },
  submitBtn:        { backgroundColor: C.primary, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled:{ opacity: 0.6 },
  submitText:       { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});

export default NewBookingModal;
