/**
 * SafariManagementScreen
 * Full Safari Management matching the Jackal Dashboard Safari tab.
 *
 * Tabs:
 *  1. Bookings  — safari_bookings list with status filters, detail modal
 *                 (Overview · Operations · Permits)
 *  2. Operations — Guides management + Permits Catalog
 *  3. Packages  — Safari packages by country, full CRUD
 *  4. Analytics — KPI cards + status breakdown + top packages
 */

import React, {
  useState, useCallback, useEffect, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, FlatList,
  TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert,
  Switch, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  Dimensions, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import * as Print from 'expo-print';
import { RecordPaymentSheet } from '../components/payments/RecordPaymentSheet';
import { PaymentHistoryList } from '../components/payments/PaymentHistoryList';
import { isSchemaError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { LoadingView } from '../components/system/JackalLoader';
import { formatCurrency } from '../lib/utils';
import type {
  SafariBooking, SafariGuide, PermitCatalog, SafariPackage, SafariBookingPermit,
  SafariFieldReport, SafariItineraryDay,
} from '../types/safari';

const { width: SW } = Dimensions.get('window');

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:          '#F2F2F7',
  card:        '#FFFFFF',
  hero:        '#1C1611',
  heroMuted:   '#C4A882',
  primary:     '#8B6B3E',
  primarySoft: '#FEF0DC',
  gold:        '#C6A563',
  goldSoft:    '#FDE8C0',
  success:     '#34A853',
  danger:      '#FF3B30',
  text:        '#1C1C1E',
  textMuted:   '#6C6C70',
  border:      '#E5E5EA',
  input:       '#F2F2F7',
};

const STATUS_CFG: Record<string, { bg: string; text: string; label: string }> = {
  draft:     { bg: '#F2F2F7', text: '#6C6C70', label: 'Draft' },
  pending:   { bg: '#FEF3DC', text: '#7a5000', label: 'Pending' },
  confirmed: { bg: '#E5F0FF', text: '#1a5a8f', label: 'Confirmed' },
  active:    { bg: '#E8F7EE', text: '#1A6B3C', label: 'Active' },
  completed: { bg: '#EDE8FE', text: '#5436CC', label: 'Completed' },
  cancelled: { bg: '#FFEEED', text: '#CC1400', label: 'Cancelled' },
};
const STATUS_KEYS = ['all', 'draft', 'pending', 'confirmed', 'active', 'completed', 'cancelled'];

const COUNTRIES = ['All', 'Uganda', 'Rwanda', 'Kenya', 'Tanzania', 'Multi-Country'];
const PERMIT_TYPES = ['Park Entry', 'Gorilla Permit', 'Chimp Permit', 'Activity Permit', 'Vehicle Entry', 'Other'];
const GUIDE_STATUSES = ['available', 'busy', 'on_leave', 'inactive'];
const PACKAGE_CATS = ['Wildlife Safari', 'Gorilla Trekking', 'Chimp Tracking', 'Beach & Safari', 'Cultural Tour', 'Adventure', 'Budget Safari', 'Luxury Safari', 'Custom'];

const PRETRIP_CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: 'fire_extinguisher',   label: 'Fire extinguisher on board' },
  { key: 'first_aid_kit',       label: 'First aid kit stocked' },
  { key: 'insurance_card',      label: 'Valid insurance card present' },
  { key: 'yellow_fever_certs',  label: 'Yellow fever certificates for all pax' },
  { key: 'spare_tire',          label: 'Spare tire and jack present' },
  { key: 'warning_triangle',    label: 'Warning triangle / reflectors' },
  { key: 'fuel_full',           label: 'Fuel tank filled' },
  { key: 'radio_comms',         label: 'Radio / communications check' },
  { key: 'vehicle_clean',       label: 'Vehicle cleaned and stocked with water' },
];

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ico = {
  Compass: ({ s = 20, c = C.primary }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}>
      <Circle cx="12" cy="12" r="10" /><Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </Svg>
  ),
  Plus: ({ s = 22, c = '#fff' }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.5} strokeLinecap="round"><Path d="M12 5v14M5 12h14" /></Svg>
  ),
  Search: ({ s = 16, c = C.textMuted }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Circle cx="11" cy="11" r="8" /><Path d="M21 21l-4.35-4.35" />
    </Svg>
  ),
  Edit: ({ s = 16, c = C.primary }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  ),
  Trash: ({ s = 16, c = C.danger }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2" />
    </Svg>
  ),
  Close: ({ s = 20, c = C.textMuted }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.5} strokeLinecap="round"><Path d="M18 6L6 18M6 6l12 12" /></Svg>
  ),
  ChevDown: ({ s = 16, c = C.textMuted }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round"><Path d="M6 9l6 6 6-6" /></Svg>
  ),
  User: ({ s = 16, c = C.textMuted }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><Circle cx="12" cy="7" r="4" />
    </Svg>
  ),
  Star: ({ s = 14, c = C.gold }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth={1}>
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  ),
  Car: ({ s = 15, c = C.textMuted }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l3-3h10l3 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
      <Circle cx="7" cy="17" r="2" /><Circle cx="17" cy="17" r="2" />
    </Svg>
  ),
  BarChart: ({ s = 20, c = C.primary }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Rect x="18" y="3" width="4" height="18" /><Rect x="10" y="8" width="4" height="13" /><Rect x="2" y="13" width="4" height="8" />
    </Svg>
  ),
  Filter: ({ s = 16, c = C.primary }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </Svg>
  ),
  Upload: ({ s = 20, c = '#fff' }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M17 8l-5-5-5 5" /><Path d="M12 3v12" />
    </Svg>
  ),
  Share: ({ s = 18, c = C.primary }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="18" cy="5" r="3" /><Circle cx="6" cy="12" r="3" /><Circle cx="18" cy="19" r="3" />
      <Path d="M8.6 10.5l6.8-3.9M8.6 13.5l6.8 3.9" />
    </Svg>
  ),
  FileText: ({ s = 20, c = C.primary }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </Svg>
  ),
  Eye: ({ s = 16, c = C.primary }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><Circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  Download: ({ s = 16, c = C.primary }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M7 10l5 5 5-5" /><Path d="M12 15V3" />
    </Svg>
  ),
  ClipboardCheck: ({ s = 28, c = C.primary }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <Rect x="9" y="3" width="6" height="4" rx="1" /><Path d="M9 12l2 2 4-4" />
    </Svg>
  ),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
function calcDays(start?: string, end?: string) {
  if (!start || !end) return '—';
  const d = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return `${d} day${d !== 1 ? 's' : ''}`;
}
function getPaymentLabel(paid = 0, total = 0, deposit = 0): { label: string; color: string; pct: number } {
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  if (paid <= 0) return { label: 'Unpaid', color: C.danger, pct: 0 };
  if (paid >= total) return { label: 'Fully Paid', color: C.success, pct: 100 };
  if (paid >= deposit) return { label: `${pct}% Paid`, color: C.gold, pct };
  return { label: `${pct}% – Deposit Due`, color: C.gold, pct };
}

// ─── Shared tiny components ───────────────────────────────────────────────────
function EmptyView({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Ico.Compass s={28} c={C.textMuted} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 }}>{sub}</Text> : null}
    </View>
  );
}

// Generic bottom-sheet picker
interface PickerOpt { value: string; label: string; sub?: string }
function PickerModal({ visible, title, options, selected, onSelect, onClose }: {
  visible: boolean; title: string; options: PickerOpt[]; selected?: string;
  onSelect: (o: PickerOpt) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pk.backdrop} onPress={onClose}>
        <View style={pk.sheet}>
          <View style={pk.handle} />
          <Text style={pk.title}>{title}</Text>
          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {options.map(o => (
              <TouchableOpacity key={o.value} style={[pk.opt, selected === o.value && pk.optActive]} onPress={() => { onSelect(o); onClose(); }}>
                <Text style={[pk.optLabel, selected === o.value && { color: C.primary, fontWeight: '700' }]}>{o.label}</Text>
                {o.sub ? <Text style={pk.optSub}>{o.sub}</Text> : null}
              </TouchableOpacity>
            ))}
            {options.length === 0 && <Text style={{ textAlign: 'center', color: C.textMuted, padding: 24 }}>No options available</Text>}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}
const pk = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  opt: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border + '80' },
  optActive: { backgroundColor: C.primarySoft + '50', borderRadius: 8, paddingHorizontal: 8 },
  optLabel: { fontSize: 15, color: C.text },
  optSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
});

// ─── Form field components ────────────────────────────────────────────────────
function FieldLabel({ label }: { label: string }) {
  return <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 }}>{label}</Text>;
}
function TextF({ value, onChange, placeholder, keyboardType, multiline }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: any; multiline?: boolean;
}) {
  return (
    <TextInput
      style={[fStyles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
      value={value} onChangeText={onChange} placeholder={placeholder || ''} placeholderTextColor={C.textMuted}
      keyboardType={keyboardType || 'default'} multiline={multiline}
    />
  );
}
const fStyles = StyleSheet.create({
  input: { backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text },
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKINGS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function BookingCard({ b, onPress }: { b: SafariBooking; onPress: () => void }) {
  const st = STATUS_CFG[b.status] || STATUS_CFG.pending;
  const client = b.clients?.company_name || b.customer_name || 'Unknown Client';
  const pay = getPaymentLabel(b.amount_paid, b.total_price_usd, b.deposit_amount);
  return (
    <TouchableOpacity style={bc.card} onPress={onPress} activeOpacity={0.78}>
      <View style={[bc.accent, { backgroundColor: st.text }]} />
      <View style={{ flex: 1, padding: 14 }}>
        <View style={bc.row}>
          <Text style={bc.ref}>{b.booking_reference || b.id.slice(0, 10).toUpperCase()}</Text>
          <View style={[bc.badge, { backgroundColor: st.bg }]}><Text style={[bc.badgeT, { color: st.text }]}>{st.label}</Text></View>
        </View>
        <Text style={bc.client} numberOfLines={1}>{client}</Text>
        <View style={[bc.row, { marginTop: 10 }]}>
          <Text style={bc.meta}>{fmtDate(b.start_date)} → {fmtDate(b.end_date)}</Text>
          {b.pax_count ? <Text style={bc.meta}>{b.pax_count} pax</Text> : null}
        </View>
        <View style={[bc.row, { marginTop: 6, gap: 6 }]}>
          {b.vehicles?.license_plate ? (
            <View style={bc.pill}><Ico.Car s={12} c={C.textMuted} /><Text style={bc.pillT}>{b.vehicles.license_plate}</Text></View>
          ) : null}
          <View style={[bc.pill, { backgroundColor: pay.color + '18' }]}>
            <Text style={[bc.pillT, { color: pay.color }]}>{pay.label}</Text>
          </View>
          {b.total_price_usd ? <Text style={bc.amt}>{formatCurrency(b.total_price_usd, 'USD')}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}
const bc = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border, shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  accent: { width: 5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ref: { fontSize: 14, fontWeight: '800', color: C.text, flex: 1, letterSpacing: -0.2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeT: { fontSize: 11, fontWeight: '700' },
  client: { fontSize: 13, color: C.textMuted, marginTop: 3 },
  meta: { fontSize: 12, color: C.textMuted },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.input, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  pillT: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
  amt: { fontSize: 13, fontWeight: '800', color: C.primary, marginLeft: 'auto' as any },
});

// ─── Booking Detail Modal ──────────────────────────────────────────────────────
interface VehicleOpt { id: string; license_plate: string; make?: string; model?: string; status?: string }
interface GuideOpt { id: string; full_name: string; status?: string }

function BookingDetailModal({ booking, visible, onClose, onRefetch }: {
  booking: SafariBooking | null; visible: boolean; onClose: () => void; onRefetch: () => void;
}) {
  const [subTab, setSubTab] = useState<'overview' | 'ops' | 'permits' | 'documents' | 'checklist' | 'payments'>('overview');
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([]);
  const [guides, setGuides] = useState<GuideOpt[]>([]);
  const [permits, setPermits] = useState<SafariBookingPermit[]>([]);
  const [selVehicle, setSelVehicle] = useState<VehicleOpt | null>(null);
  const [selGuide, setSelGuide] = useState<GuideOpt | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingOps, setLoadingOps] = useState(false);
  const [showVPicker, setShowVPicker] = useState(false);
  const [showGPicker, setShowGPicker] = useState(false);
  const [docReports, setDocReports] = useState<SafariFieldReport[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<SafariFieldReport | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [checklistMeta, setChecklistMeta] = useState<{ completed_by?: string; completed_at?: string } | null>(null);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [itinerary, setItinerary] = useState<SafariItineraryDay[]>([]);
  const [editingItinerary, setEditingItinerary] = useState(false);
  const [savingItinerary, setSavingItinerary] = useState(false);

  const fetchPermits = useCallback(() => {
    if (!booking) return;
    supabase.from('safari_booking_permits')
      .select('id, status, quantity, cost_per_permit, total_cost, currency, external_reference, authority_confirmed, safari_permits(permit_name, permit_type, cost_usd)')
      .eq('booking_id', booking.id)
      .then(({ data }) => setPermits((data || []) as unknown as SafariBookingPermit[]));
  }, [booking?.id]);

  useEffect(() => {
    if (!visible || !booking) { setSubTab('overview'); return; }
    fetchPermits();
    setItinerary(booking.itinerary_days || []);
    setEditingItinerary(false);
  }, [visible, booking?.id]);

  const [editingPermitId, setEditingPermitId] = useState<string | null>(null);
  const [refInput, setRefInput] = useState('');

  const addItineraryDay = useCallback(() => {
    setItinerary(prev => [...prev, { day: prev.length + 1, title: '', description: '' }]);
  }, []);

  const updateItineraryDay = useCallback((idx: number, patch: Partial<SafariItineraryDay>) => {
    setItinerary(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  }, []);

  const removeItineraryDay = useCallback((idx: number) => {
    setItinerary(prev => prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day: i + 1 })));
  }, []);

  const saveItinerary = useCallback(async () => {
    if (!booking) return;
    setSavingItinerary(true);
    try {
      const { error } = await supabase.from('safari_bookings').update({ itinerary_days: itinerary }).eq('id', booking.id);
      if (error) throw error;
      setEditingItinerary(false);
      onRefetch();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save itinerary.');
    } finally {
      setSavingItinerary(false);
    }
  }, [booking, itinerary, onRefetch]);

  const savePermitRef = useCallback(async (permitId: string) => {
    await supabase.from('safari_booking_permits').update({ external_reference: refInput.trim() || null }).eq('id', permitId);
    setEditingPermitId(null);
    fetchPermits();
  }, [refInput, fetchPermits]);

  const toggleAuthorityConfirmed = useCallback(async (permit: SafariBookingPermit) => {
    await supabase.from('safari_booking_permits').update({ authority_confirmed: !permit.authority_confirmed }).eq('id', permit.id);
    fetchPermits();
  }, [fetchPermits]);

  useEffect(() => {
    if (subTab !== 'ops' || !visible || !booking) return;
    setLoadingOps(true);
    Promise.all([
      supabase.from('vehicles').select('id, license_plate, make, model, status').in('status', ['available', 'booked']),
      supabase.from('safari_guides').select('id, full_name, status'),
    ]).then(([vr, gr]) => {
      const vs = (vr.data || []) as VehicleOpt[];
      const gs = (gr.data || []) as GuideOpt[];
      setVehicles(vs);
      setGuides(gs);
      // Pre-select based on FK id or enriched join data
      const vid = booking.vehicle_id || (booking as any).vehicles?.id;
      const gid = booking.guide_id   || (booking as any).safari_guides?.id;
      if (vid) setSelVehicle(vs.find(v => v.id === vid) || null);
      if (gid) setSelGuide(gs.find(g => g.id === gid) || null);
    }).finally(() => setLoadingOps(false));
  }, [subTab, visible, booking?.id]);

  useEffect(() => {
    if (subTab !== 'documents' || !visible || !booking) return;
    setLoadingDocs(true);
    supabase.from('safari_field_reports')
      .select('id, booking_id, file_name, file_url, file_size, file_type, notes, created_at')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDocReports((data || []) as SafariFieldReport[]);
        setLoadingDocs(false);
      });
  }, [subTab, visible, booking?.id]);

  useEffect(() => {
    if (subTab !== 'checklist' || !visible || !booking) return;
    setLoadingChecklist(true);
    supabase.from('safari_pretrip_checklists')
      .select('checklist, completed_by, completed_at')
      .eq('booking_id', booking.id)
      .maybeSingle()
      .then(({ data }) => {
        setChecklist((data?.checklist as Record<string, boolean>) || {});
        setChecklistMeta(data ? { completed_by: data.completed_by, completed_at: data.completed_at } : null);
        setLoadingChecklist(false);
      });
  }, [subTab, visible, booking?.id]);

  const toggleChecklistItem = useCallback((key: string) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const saveChecklist = useCallback(async (complete: boolean) => {
    if (!booking) return;
    setSavingChecklist(true);
    try {
      const payload: Record<string, any> = {
        booking_id: booking.id,
        checklist,
        updated_at: new Date().toISOString(),
      };
      if (complete) {
        payload.completed_by = 'Mobile App';
        payload.completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('safari_pretrip_checklists').upsert(payload, { onConflict: 'booking_id' });
      if (error) throw error;
      if (complete) setChecklistMeta({ completed_by: payload.completed_by, completed_at: payload.completed_at });
      if (complete) Alert.alert('Checklist Complete', 'Pre-trip checklist signed off.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save checklist.');
    } finally {
      setSavingChecklist(false);
    }
  }, [booking, checklist]);

  const saveOps = useCallback(async () => {
    if (!booking) return;
    setSaving(true);

    try {
      // Update vehicle_id (column always exists)
      if (selVehicle) {
        const { error } = await supabase
          .from('safari_bookings')
          .update({ vehicle_id: selVehicle.id })
          .eq('id', booking.id);
        if (error && !isSchemaError(error)) throw error;
      }

      // Update guide — try guide_id first, fall back to assigned_guide_id
      if (selGuide) {
        const { error: eg1 } = await supabase
          .from('safari_bookings')
          .update({ guide_id: selGuide.id })
          .eq('id', booking.id);
        if (eg1 && isSchemaError(eg1)) {
          const { error: eg2 } = await supabase
            .from('safari_bookings')
            .update({ assigned_guide_id: selGuide.id })
            .eq('id', booking.id);
          if (eg2 && !isSchemaError(eg2)) throw eg2;
        } else if (eg1) {
          throw eg1;
        }
      }

      // Vehicle availability is fully server-side now (database triggers on
      // safari_bookings react to vehicle_id/status changes) — mobile only
      // saves the assignment above; refetching shows the server-computed
      // vehicle status immediately rather than waiting for a realtime event.
      Alert.alert('Saved', 'Booking assignments updated.');
      onRefetch(); onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save.');
    } finally { setSaving(false); }
  }, [booking, selVehicle, selGuide, onRefetch, onClose]);

  if (!booking || !visible) return null;
  const st = STATUS_CFG[booking.status] || STATUS_CFG.pending;
  const pay = getPaymentLabel(booking.amount_paid, booking.total_price_usd, booking.deposit_amount);
  const balance = (booking.total_price_usd || 0) - (booking.amount_paid || 0);

  // Accurate profit margin: always compute from raw cost fields
  const totalRevenue  = booking.total_price_usd || 0;
  const totalCosts    = (booking.total_expenses_usd || 0) + (booking.vehicle_hire_cost_usd || 0);
  const netProfit     = totalRevenue - totalCosts;
  const profitMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null;

  const shareConfirmation = async () => {
    const ref = booking.booking_reference || booking.id.slice(0, 10).toUpperCase();
    const clientName = booking.clients?.company_name || booking.customer_name || 'Guest';

    // Receipt vs Invoice is determined purely by balance_due — never guessed client-side
    // beyond that single rule — and the document carries the payment's system transaction
    // ID(s) so it stays traceable back to payment_events on both web and mobile.
    const isReceipt = balance <= 0;
    const docLabel = isReceipt ? 'Payment Receipt' : 'Invoice';

    let paymentRows = '';
    try {
      const { data: events } = await supabase.rpc('search_payment_events', { p_search: booking.id });
      const completed = ((events || []) as any[]).filter(e => e.status !== 'reversed');
      if (completed.length > 0) {
        paymentRows = completed.map(e => `
          <tr>
            <td style="padding:6px 0;color:#6C6C70;">${fmtDate(e.transaction_date)}</td>
            <td style="padding:6px 0;font-family:monospace;font-size:11px;">${e.system_transaction_id}</td>
            <td style="padding:6px 0;text-transform:capitalize;">${String(e.method).replace('_', ' ')}</td>
            <td style="padding:6px 0;text-align:right;font-weight:700;">${formatCurrency(e.amount, e.currency)}</td>
          </tr>`).join('');
      }
    } catch { /* receipt still generates without payment rows if the RPC is unreachable */ }

    const html = `
      <html><body style="font-family:-apple-system,Helvetica,Arial,sans-serif;padding:32px;color:#1C1611;">
        <div style="border-bottom:3px solid #8B6B3E;padding-bottom:16px;margin-bottom:24px;">
          <div style="font-size:11px;letter-spacing:2px;color:#8B6B3E;font-weight:700;text-transform:uppercase;">Jackal Adventures</div>
          <div style="font-size:24px;font-weight:800;margin-top:4px;">${docLabel}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#6C6C70;width:40%;">Booking Reference</td><td style="padding:8px 0;font-weight:700;">${ref}</td></tr>
          <tr><td style="padding:8px 0;color:#6C6C70;">Client</td><td style="padding:8px 0;font-weight:700;">${clientName}</td></tr>
          <tr><td style="padding:8px 0;color:#6C6C70;">Start Date</td><td style="padding:8px 0;">${fmtDate(booking.start_date)}</td></tr>
          <tr><td style="padding:8px 0;color:#6C6C70;">End Date</td><td style="padding:8px 0;">${fmtDate(booking.end_date)}</td></tr>
          <tr><td style="padding:8px 0;color:#6C6C70;">Duration</td><td style="padding:8px 0;">${calcDays(booking.start_date, booking.end_date)}</td></tr>
          ${booking.pax_count ? `<tr><td style="padding:8px 0;color:#6C6C70;">Travellers</td><td style="padding:8px 0;">${booking.pax_count} pax</td></tr>` : ''}
          ${booking.safari_packages?.name ? `<tr><td style="padding:8px 0;color:#6C6C70;">Package</td><td style="padding:8px 0;">${booking.safari_packages.name}</td></tr>` : ''}
          ${booking.safari_guides?.full_name ? `<tr><td style="padding:8px 0;color:#6C6C70;">Guide</td><td style="padding:8px 0;">${booking.safari_guides.full_name}</td></tr>` : ''}
          ${booking.vehicles?.license_plate ? `<tr><td style="padding:8px 0;color:#6C6C70;">Vehicle</td><td style="padding:8px 0;">${booking.vehicles.license_plate}${booking.vehicles.make ? ` – ${booking.vehicles.make} ${booking.vehicles.model || ''}` : ''}</td></tr>` : ''}
        </table>
        <div style="margin-top:24px;padding:16px;background:#FEF0DC;border-radius:8px;">
          <table style="width:100%;font-size:14px;">
            <tr><td style="color:#6C6C70;">Total Cost</td><td style="text-align:right;font-weight:800;font-size:16px;">${formatCurrency(totalRevenue, 'USD')}</td></tr>
            <tr><td style="color:#6C6C70;">Amount Paid</td><td style="text-align:right;color:#34A853;font-weight:700;">${formatCurrency(booking.amount_paid || 0, 'USD')}</td></tr>
            <tr><td style="color:#6C6C70;">Balance Due</td><td style="text-align:right;color:${balance > 0 ? '#FF3B30' : '#34A853'};font-weight:700;">${formatCurrency(balance, 'USD')}</td></tr>
          </table>
        </div>
        ${paymentRows ? `
        <div style="margin-top:24px;">
          <div style="font-size:12px;font-weight:700;color:#1C1611;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Payments Applied</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr style="border-bottom:1px solid #E5E5EA;">
              <td style="padding:6px 0;color:#6C6C70;font-size:11px;">DATE</td>
              <td style="padding:6px 0;color:#6C6C70;font-size:11px;">TRANSACTION ID</td>
              <td style="padding:6px 0;color:#6C6C70;font-size:11px;">METHOD</td>
              <td style="padding:6px 0;color:#6C6C70;font-size:11px;text-align:right;">AMOUNT</td>
            </tr>
            ${paymentRows}
          </table>
        </div>` : ''}
        <div style="margin-top:32px;font-size:11px;color:#6C6C70;text-align:center;">Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · Jackal Adventures</div>
      </body></html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${docLabel} — ${ref}`, UTI: 'com.adobe.pdf' });
      }
    } catch (e: any) {
      Alert.alert('Share Failed', e?.message || 'Could not generate the document.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={dm.header}>
          <View style={{ flex: 1 }}>
            <Text style={dm.headerRef}>{booking.booking_reference || booking.id.slice(0, 10).toUpperCase()}</Text>
            <Text style={dm.headerSub}>{booking.clients?.company_name || booking.customer_name || 'Safari Booking'}</Text>
          </View>
          <TouchableOpacity onPress={shareConfirmation} style={dm.closeBtn}><Ico.Share s={17} c={C.primary} /></TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={[dm.closeBtn, { marginLeft: 8 }]}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
        </View>

        {/* Status row */}
        <View style={dm.statusRow}>
          <View style={[dm.stBadge, { backgroundColor: st.bg }]}><Text style={[dm.stText, { color: st.text }]}>{st.label}</Text></View>
          <Text style={dm.duration}>{calcDays(booking.start_date, booking.end_date)}</Text>
          <View style={[dm.payBadge, { backgroundColor: pay.color + '20' }]}><Text style={[dm.payText, { color: pay.color }]}>{pay.label}</Text></View>
        </View>

        {/* Sub-tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={dm.subBar}>
            {(['overview', 'ops', 'permits', 'payments', 'checklist', 'documents'] as const).map(t => (
              <TouchableOpacity key={t} style={[dm.subTab, subTab === t && dm.subTabOn]} onPress={() => setSubTab(t)}>
                <Text style={[dm.subTabT, subTab === t && dm.subTabTOn]}>
                  {t === 'overview' ? 'Overview' : t === 'ops' ? 'Operations' : t === 'permits' ? 'Permits' : t === 'payments' ? 'Payments' : t === 'checklist' ? 'Pre-Trip' : 'Documents'}
                  {t === 'documents' && docReports.length > 0 ? ` (${docReports.length})` : ''}
                  {t === 'checklist' && checklistMeta?.completed_at ? ' ✓' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <ScrollView
          keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          {/* Overview */}
          {subTab === 'overview' && <>
            <View style={dm.sect}>
              <Text style={dm.sectTitle}>Financial Summary</Text>
              {[
                { l: 'Total Revenue', v: formatCurrency(totalRevenue, 'USD'), big: true },
                totalCosts > 0 ? { l: 'Total Costs', v: formatCurrency(totalCosts, 'USD'), c: C.danger } : null,
                totalCosts > 0 ? { l: 'Net Profit', v: formatCurrency(netProfit, 'USD'), c: netProfit >= 0 ? C.success : C.danger } : null,
                { l: 'Amount Paid', v: formatCurrency(booking.amount_paid || 0, 'USD'), c: C.success },
                { l: 'Balance Due', v: formatCurrency(balance, 'USD'), c: balance > 0 ? C.danger : C.success },
                booking.deposit_amount ? { l: 'Deposit Required', v: formatCurrency(booking.deposit_amount, 'USD') } : null,
                profitMarginPct != null ? { l: 'Profit Margin', v: `${profitMarginPct.toFixed(1)}%`, c: profitMarginPct >= 0 ? C.success : C.danger } : null,
              ].filter(Boolean).map((row: any, i) => (
                <View key={i} style={dm.finRow}>
                  <Text style={dm.finL}>{row.l}</Text>
                  <Text style={[dm.finV, row.big && { fontSize: 17, color: C.primary }, row.c && { color: row.c }]}>{row.v}</Text>
                </View>
              ))}
              {balance > 0 && (
                <TouchableOpacity style={dm.recordPayBtn} onPress={() => setShowRecordPayment(true)}>
                  <Text style={dm.recordPayBtnT}>Record Payment</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={dm.sect}>
              <Text style={dm.sectTitle}>Trip Details</Text>
              {[
                { l: 'Start Date', v: fmtDate(booking.start_date) },
                { l: 'End Date', v: fmtDate(booking.end_date) },
                { l: 'Duration', v: calcDays(booking.start_date, booking.end_date) },
                booking.pax_count ? { l: 'Travellers', v: `${booking.pax_count} pax` } : null,
                booking.booking_direction ? { l: 'Direction', v: booking.booking_direction } : null,
                booking.safari_packages?.name ? { l: 'Package', v: booking.safari_packages.name } : null,
                booking.safari_guides?.full_name ? { l: 'Guide', v: booking.safari_guides.full_name } : null,
                booking.vehicles?.license_plate ? { l: 'Vehicle', v: `${booking.vehicles.license_plate}${booking.vehicles.make ? ` – ${booking.vehicles.make} ${booking.vehicles.model || ''}` : ''}` } : null,
                booking.customer_email ? { l: 'Email', v: booking.customer_email } : null,
              ].filter(Boolean).map((row: any, i) => (
                <View key={i} style={dm.detRow}>
                  <Text style={dm.detL}>{row.l}</Text>
                  <Text style={dm.detV} numberOfLines={2}>{row.v}</Text>
                </View>
              ))}
            </View>

            {/* Day-by-Day Itinerary */}
            <View style={dm.sect}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={[dm.sectTitle, { marginBottom: 0 }]}>Itinerary</Text>
                <TouchableOpacity onPress={() => setEditingItinerary(e => !e)}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary }}>{editingItinerary ? 'Done' : itinerary.length > 0 ? 'Edit' : '+ Add Days'}</Text>
                </TouchableOpacity>
              </View>

              {itinerary.length === 0 && !editingItinerary && (
                <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingVertical: 12 }}>No itinerary added yet</Text>
              )}

              {itinerary.map((d, idx) => (
                <View key={idx} style={dm.itinDay}>
                  <View style={dm.itinDayNum}><Text style={dm.itinDayNumT}>{d.day}</Text></View>
                  <View style={{ flex: 1 }}>
                    {editingItinerary ? (
                      <>
                        <TextInput
                          style={dm.itinTitleInput}
                          value={d.title}
                          onChangeText={v => updateItineraryDay(idx, { title: v })}
                          placeholder={`Day ${d.day} title…`}
                          placeholderTextColor={C.textMuted}
                        />
                        <TextInput
                          style={dm.itinDescInput}
                          value={d.description || ''}
                          onChangeText={v => updateItineraryDay(idx, { description: v })}
                          placeholder="Activity / location details…"
                          placeholderTextColor={C.textMuted}
                          multiline
                        />
                      </>
                    ) : (
                      <>
                        <Text style={dm.itinTitle}>{d.title || `Day ${d.day}`}</Text>
                        {d.description ? <Text style={dm.itinDesc}>{d.description}</Text> : null}
                      </>
                    )}
                  </View>
                  {editingItinerary && (
                    <TouchableOpacity onPress={() => removeItineraryDay(idx)} style={{ padding: 4 }}>
                      <Ico.Close s={14} c={C.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {editingItinerary && (
                <>
                  <TouchableOpacity style={dm.itinAddBtn} onPress={addItineraryDay}>
                    <Text style={dm.itinAddBtnT}>+ Add Day</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[dm.saveBtn, savingItinerary && { opacity: 0.6 }]} onPress={saveItinerary} disabled={savingItinerary}>
                    {savingItinerary ? <ActivityIndicator size="small" color="#fff" /> : <Text style={dm.saveBtnT}>Save Itinerary</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>}

          {/* Operations */}
          {subTab === 'ops' && <View style={dm.sect}>
            <Text style={dm.sectTitle}>Assign Vehicle & Guide</Text>
            {loadingOps ? <LoadingView label="Loading resources…" /> : <>
              <FieldLabel label="Vehicle" />
              <TouchableOpacity style={dm.selector} onPress={() => setShowVPicker(true)}>
                <Ico.Car s={16} c={C.primary} />
                <Text style={dm.selectorT} numberOfLines={1}>
                  {selVehicle ? `${selVehicle.license_plate}${selVehicle.make ? ` – ${selVehicle.make} ${selVehicle.model || ''}` : ''}` : 'Select vehicle…'}
                </Text>
                <Ico.ChevDown s={16} c={C.textMuted} />
              </TouchableOpacity>

              <FieldLabel label="Safari Guide" />
              <TouchableOpacity style={dm.selector} onPress={() => setShowGPicker(true)}>
                <Ico.User s={16} c={C.primary} />
                <Text style={dm.selectorT} numberOfLines={1}>{selGuide ? selGuide.full_name : 'Select guide…'}</Text>
                <Ico.ChevDown s={16} c={C.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={[dm.saveBtn, saving && { opacity: 0.6 }]} onPress={saveOps} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={dm.saveBtnT}>Save Assignments</Text>}
              </TouchableOpacity>
            </>}
          </View>}

          {/* Permits */}
          {subTab === 'permits' && <View style={dm.sect}>
            <Text style={dm.sectTitle}>Booking Permits</Text>
            {permits.length === 0
              ? <Text style={{ color: C.textMuted, textAlign: 'center', paddingVertical: 20, fontSize: 13 }}>No permits recorded for this booking</Text>
              : permits.map(p => {
                const typeLower = (p.safari_permits?.permit_type || p.safari_permits?.permit_name || '').toLowerCase();
                const highStakes = typeLower.includes('gorilla') || typeLower.includes('chimp');
                const unconfirmed = highStakes && !p.authority_confirmed;
                const isEditing = editingPermitId === p.id;
                return (
                  <View key={p.id} style={[dm.permitCard, unconfirmed && dm.permitCardWarn]}>
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={dm.permitName}>{p.safari_permits?.permit_name || '—'}</Text>
                        {p.safari_permits?.permit_type ? <Text style={dm.permitType}>{p.safari_permits.permit_type}</Text> : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {p.quantity && p.quantity > 1 ? <Text style={{ fontSize: 11, color: C.textMuted }}>×{p.quantity}</Text> : null}
                        {p.total_cost ? <Text style={{ fontSize: 14, fontWeight: '700', color: C.primary }}>{formatCurrency(p.total_cost, (p.currency as any) || 'USD')}</Text> : null}
                        {p.status ? <View style={[dm.permitBadge, { backgroundColor: p.status === 'active' ? C.primarySoft : C.input }]}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: p.status === 'active' ? C.primary : C.textMuted }}>{p.status.toUpperCase()}</Text>
                        </View> : null}
                      </View>
                    </View>

                    {unconfirmed && (
                      <View style={dm.permitWarnBanner}>
                        <Text style={dm.permitWarnText}>⚠ Not yet confirmed by the authority — trek is at risk without confirmation</Text>
                      </View>
                    )}

                    <View style={dm.permitFooter}>
                      <View style={{ flex: 1 }}>
                        <Text style={dm.permitFooterLabel}>Authority Reference</Text>
                        {isEditing ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <TextInput
                              style={dm.permitRefInput}
                              value={refInput}
                              onChangeText={setRefInput}
                              placeholder="e.g. UWA-2026-00123"
                              placeholderTextColor={C.textMuted}
                              autoCapitalize="characters"
                              autoCorrect={false}
                            />
                            <TouchableOpacity onPress={() => savePermitRef(p.id)}><Text style={dm.permitRefSave}>Save</Text></TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity onPress={() => { setEditingPermitId(p.id); setRefInput(p.external_reference || ''); }}>
                            <Text style={dm.permitFooterValue}>{p.external_reference || 'Tap to add reference…'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <Text style={dm.permitFooterLabel}>Confirmed</Text>
                        <Switch
                          value={!!p.authority_confirmed}
                          onValueChange={() => toggleAuthorityConfirmed(p)}
                          trackColor={{ false: C.border, true: C.success }}
                          thumbColor="#fff"
                        />
                      </View>
                    </View>
                  </View>
                );
              })
            }
          </View>}

          {/* Payments */}
          {subTab === 'payments' && (
            <View style={dm.sect}>
              <Text style={dm.sectTitle}>Payment History</Text>
              <PaymentHistoryList sourceId={booking.id} />
            </View>
          )}

          {/* Pre-Trip Checklist */}
          {subTab === 'checklist' && (
            loadingChecklist ? <LoadingView label="Loading checklist…" /> : (
              <View style={dm.sect}>
                <Text style={dm.sectTitle}>Pre-Trip Vehicle Checklist</Text>
                {checklistMeta?.completed_at ? (
                  <View style={dm.checklistDoneBanner}>
                    <Text style={dm.checklistDoneText}>
                      ✓ Signed off {new Date(checklistMeta.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {checklistMeta.completed_by ? ` by ${checklistMeta.completed_by}` : ''}
                    </Text>
                  </View>
                ) : null}
                {PRETRIP_CHECKLIST_ITEMS.map(item => (
                  <TouchableOpacity key={item.key} style={dm.checklistRow} onPress={() => toggleChecklistItem(item.key)} activeOpacity={0.7}>
                    <View style={[dm.checkbox, checklist[item.key] && dm.checkboxOn]}>
                      {checklist[item.key] ? <Text style={dm.checkboxTick}>✓</Text> : null}
                    </View>
                    <Text style={[dm.checklistLabel, checklist[item.key] && dm.checklistLabelDone]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[dm.saveBtn, savingChecklist && { opacity: 0.6 }]}
                  onPress={() => saveChecklist(PRETRIP_CHECKLIST_ITEMS.every(i => checklist[i.key]))}
                  disabled={savingChecklist}
                >
                  {savingChecklist
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={dm.saveBtnT}>
                        {PRETRIP_CHECKLIST_ITEMS.every(i => checklist[i.key]) ? 'Sign & Complete Checklist' : 'Save Progress'}
                      </Text>}
                </TouchableOpacity>
              </View>
            )
          )}

          {/* Documents */}
          {subTab === 'documents' && (
            loadingDocs ? <LoadingView label="Loading documents…" /> :
            docReports.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Ico.FileText s={24} c={C.textMuted} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 6 }}>No Field Reports</Text>
                <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 24, lineHeight: 18 }}>
                  Upload post-safari field reports from the Operations tab in Safari Management.
                </Text>
              </View>
            ) : docReports.map(r => {
              const isPdf = r.file_type?.includes('pdf') || r.file_name?.toLowerCase().endsWith('.pdf');
              return (
                <TouchableOpacity key={r.id} style={fr.card} onPress={() => setPreviewDoc(r)} activeOpacity={0.78}>
                  <View style={fr.iconWrap}><Ico.FileText s={22} c={C.primary} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={fr.fileName} numberOfLines={2}>{r.file_name}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                      {r.file_size ? <Text style={fr.meta}>{fmtBytes(r.file_size)}</Text> : null}
                      {r.created_at ? <Text style={fr.meta}>{fmtDate(r.created_at)}</Text> : null}
                      <View style={[fr.typePill, { backgroundColor: isPdf ? '#FFEEDD' : '#EEF0FF' }]}>
                        <Text style={[fr.typePillT, { color: isPdf ? '#8B4513' : '#3B5BDB' }]}>
                          {isPdf ? 'PDF' : (r.file_type?.split('/')[1]?.toUpperCase() || 'DOC')}
                        </Text>
                      </View>
                    </View>
                    {r.notes ? <Text style={fr.notes} numberOfLines={1}>{r.notes}</Text> : null}
                  </View>
                  <Ico.Eye s={15} c={C.primary} />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        <PickerModal visible={showVPicker} title="Select Vehicle"
          options={vehicles.map(v => ({ value: v.id, label: v.license_plate, sub: `${v.make || ''} ${v.model || ''} · ${v.status || ''}`.trim() }))}
          selected={selVehicle?.id} onSelect={o => setSelVehicle(vehicles.find(v => v.id === o.value) || null)} onClose={() => setShowVPicker(false)} />
        <PickerModal visible={showGPicker} title="Select Safari Guide"
          options={guides.map(g => ({ value: g.id, label: g.full_name, sub: g.status }))}
          selected={selGuide?.id} onSelect={o => setSelGuide(guides.find(g => g.id === o.value) || null)} onClose={() => setShowGPicker(false)} />
        <ReportPreviewModal report={previewDoc} visible={previewDoc != null} onClose={() => setPreviewDoc(null)} />
      </SafeAreaView>

      <RecordPaymentSheet
        visible={showRecordPayment}
        onClose={() => { setShowRecordPayment(false); onRefetch(); }}
        source="safari"
        sourceId={booking.id}
        balanceDue={balance}
        currency="USD"
        subjectLabel={`${booking.booking_reference || booking.id.slice(0, 10).toUpperCase()} · ${booking.clients?.company_name || booking.customer_name || 'Guest'}`}
      />
    </Modal>
  );
}

const dm = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', backgroundColor: C.card, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  headerRef: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  headerSub: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  closeBtn: { padding: 8, backgroundColor: C.input, borderRadius: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  stBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  stText: { fontSize: 12, fontWeight: '700' },
  duration: { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  payBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 'auto' as any },
  payText: { fontSize: 11, fontWeight: '700' },
  recordPayBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  recordPayBtnT: { fontSize: 14, fontWeight: '700', color: '#fff' },
  subBar: { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 12 },
  subTab: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  subTabOn: { borderBottomColor: C.primary },
  subTabT: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  subTabTOn: { color: C.primary },
  sect: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  sectTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12, letterSpacing: -0.2 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border + '60' },
  finL: { fontSize: 13, color: C.textMuted },
  finV: { fontSize: 14, fontWeight: '700', color: C.text },
  detRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border + '60' },
  detL: { fontSize: 13, color: C.textMuted, flex: 1 },
  detV: { fontSize: 13, fontWeight: '600', color: C.text, flex: 1.5, textAlign: 'right' },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.input, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: C.border },
  selectorT: { flex: 1, fontSize: 14, color: C.text },
  saveBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  saveBtnT: { fontSize: 15, fontWeight: '700', color: '#fff' },
  permitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border + '60' },
  permitName: { fontSize: 14, fontWeight: '600', color: C.text },
  permitType: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  permitBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  permitCard: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border + '60' },
  permitCardWarn: { backgroundColor: '#FFF5F3', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 10 },
  permitWarnBanner: { backgroundColor: '#FFEEED', borderRadius: 8, padding: 8, marginTop: 8 },
  permitWarnText: { fontSize: 11, fontWeight: '700', color: C.danger, lineHeight: 15 },
  permitFooter: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border + '50' },
  permitFooterLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  permitFooterValue: { fontSize: 13, fontWeight: '600', color: C.primary, marginTop: 3 },
  permitRefInput: { flex: 1, backgroundColor: C.input, borderWidth: 1, borderColor: C.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: C.text },
  permitRefSave: { fontSize: 12, fontWeight: '700', color: C.primary },
  checklistDoneBanner: { backgroundColor: '#E8F7EE', borderRadius: 10, padding: 12, marginBottom: 14 },
  checklistDoneText: { fontSize: 12, fontWeight: '700', color: '#1A6B3C' },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border + '60' },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: C.success, borderColor: C.success },
  checkboxTick: { color: '#fff', fontSize: 14, fontWeight: '800' },
  checklistLabel: { flex: 1, fontSize: 14, color: C.text },
  checklistLabelDone: { color: C.textMuted, textDecorationLine: 'line-through' },
  itinDay: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border + '60' },
  itinDayNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itinDayNumT: { fontSize: 12, fontWeight: '800', color: C.primary },
  itinTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  itinDesc: { fontSize: 12, color: C.textMuted, marginTop: 3, lineHeight: 17 },
  itinTitleInput: { fontSize: 14, fontWeight: '700', color: C.text, backgroundColor: C.input, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: C.border },
  itinDescInput: { fontSize: 12, color: C.text, backgroundColor: C.input, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: C.border, marginTop: 6, minHeight: 44, textAlignVertical: 'top' },
  itinAddBtn: { alignSelf: 'flex-start', paddingVertical: 8 },
  itinAddBtnT: { fontSize: 13, fontWeight: '700', color: C.primary },
});

// ─── Date-range helpers ───────────────────────────────────────────────────────
type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';
function presetRange(p: DatePreset): { from: string | null; to: string | null } {
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (p === 'today') return { from: fmt(today), to: fmt(today) };
  if (p === 'week') {
    const end = new Date(today); end.setDate(end.getDate() + 6);
    return { from: fmt(today), to: fmt(end) };
  }
  if (p === 'month') {
    const end = new Date(today); end.setDate(end.getDate() + 29);
    return { from: fmt(today), to: fmt(end) };
  }
  return { from: null, to: null };
}

// ─── Filter Sheet Modal ───────────────────────────────────────────────────────
interface FilterState {
  status: string;
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  guideId: string;
  vehicleId: string;
}
const DEFAULT_FILTERS: FilterState = {
  status: 'all', datePreset: 'all', dateFrom: '', dateTo: '', guideId: '', vehicleId: '',
};

function BookingFilterSheet({ visible, filters, guides, vehicles, onApply, onClose }: {
  visible: boolean;
  filters: FilterState;
  guides: { id: string; full_name: string }[];
  vehicles: { id: string; license_plate: string; make?: string; model?: string }[];
  onApply: (f: FilterState) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<FilterState>(filters);
  const set = (patch: Partial<FilterState>) => setLocal(prev => ({ ...prev, ...patch }));

  useEffect(() => { if (visible) setLocal(filters); }, [visible, filters]);

  const DATE_PRESETS: { key: DatePreset; label: string }[] = [
    { key: 'all',   label: 'All Dates' },
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'Next 7 Days' },
    { key: 'month', label: 'Next 30 Days' },
    { key: 'custom',label: 'Custom Range' },
  ];

  const activeFilterCount = [
    local.status !== 'all',
    local.datePreset !== 'all',
    !!local.guideId,
    !!local.vehicleId,
  ].filter(Boolean).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={onClose}>
        <View style={fs.sheet}>
          <View style={fs.handle} />
          <View style={fs.header}>
            <Text style={fs.title}>Filter Bookings</Text>
            <TouchableOpacity onPress={() => set(DEFAULT_FILTERS)}>
              <Text style={fs.reset}>Reset All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {/* Status */}
            <Text style={fs.sectionLabel}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {STATUS_KEYS.map(s => {
                const on = local.status === s;
                const col = s === 'all' ? C.primary : (STATUS_CFG[s]?.text || C.textMuted);
                return (
                  <TouchableOpacity key={s} style={[fs.chip, on && { backgroundColor: col, borderColor: col }]} onPress={() => set({ status: s })}>
                    <Text style={[fs.chipT, on && { color: '#fff' }]}>{s === 'all' ? 'All' : STATUS_CFG[s]?.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Date Range */}
            <Text style={fs.sectionLabel}>Date Range</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {DATE_PRESETS.map(p => (
                <TouchableOpacity key={p.key}
                  style={[fs.chip, local.datePreset === p.key && { backgroundColor: C.primary, borderColor: C.primary }]}
                  onPress={() => { set({ datePreset: p.key, ...presetRange(p.key) }); }}>
                  <Text style={[fs.chipT, local.datePreset === p.key && { color: '#fff' }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {local.datePreset === 'custom' && (
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={fs.inputLabel}>From (YYYY-MM-DD)</Text>
                  <TextInput style={fs.dateInput} value={local.dateFrom}
                    onChangeText={v => set({ dateFrom: v })} placeholder="2025-01-01"
                    placeholderTextColor={C.textMuted} keyboardType="numbers-and-punctuation" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={fs.inputLabel}>To (YYYY-MM-DD)</Text>
                  <TextInput style={fs.dateInput} value={local.dateTo}
                    onChangeText={v => set({ dateTo: v })} placeholder="2025-12-31"
                    placeholderTextColor={C.textMuted} keyboardType="numbers-and-punctuation" />
                </View>
              </View>
            )}

            {/* Guide */}
            <Text style={fs.sectionLabel}>Assigned Guide</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TouchableOpacity style={[fs.chip, !local.guideId && { backgroundColor: C.primary, borderColor: C.primary }]}
                onPress={() => set({ guideId: '' })}>
                <Text style={[fs.chipT, !local.guideId && { color: '#fff' }]}>Any Guide</Text>
              </TouchableOpacity>
              {guides.map(g => (
                <TouchableOpacity key={g.id}
                  style={[fs.chip, local.guideId === g.id && { backgroundColor: C.primary, borderColor: C.primary }]}
                  onPress={() => set({ guideId: g.id })}>
                  <Text style={[fs.chipT, local.guideId === g.id && { color: '#fff' }]} numberOfLines={1}>{g.full_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Vehicle */}
            <Text style={fs.sectionLabel}>Assigned Vehicle</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              <TouchableOpacity style={[fs.chip, !local.vehicleId && { backgroundColor: C.primary, borderColor: C.primary }]}
                onPress={() => set({ vehicleId: '' })}>
                <Text style={[fs.chipT, !local.vehicleId && { color: '#fff' }]}>Any Vehicle</Text>
              </TouchableOpacity>
              {vehicles.map(v => (
                <TouchableOpacity key={v.id}
                  style={[fs.chip, local.vehicleId === v.id && { backgroundColor: C.primary, borderColor: C.primary }]}
                  onPress={() => set({ vehicleId: v.id })}>
                  <Text style={[fs.chipT, local.vehicleId === v.id && { color: '#fff' }]}>{v.license_plate}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>

          <TouchableOpacity style={fs.applyBtn} onPress={() => { onApply(local); onClose(); }}>
            <Text style={fs.applyT}>Apply Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const fs = StyleSheet.create({
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '800', color: C.text },
  reset: { fontSize: 13, fontWeight: '700', color: C.danger },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  chipT: { fontSize: 12, fontWeight: '700', color: C.textMuted },
  inputLabel: { fontSize: 11, fontWeight: '700', color: C.textMuted, marginBottom: 4 },
  dateInput: { backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.text },
  applyBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  applyT: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

// ─── Bookings Tab ──────────────────────────────────────────────────────────────
function BookingsTab() {
  const [bookings, setBookings] = useState<SafariBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<SafariBooking | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [guides, setGuides] = useState<{ id: string; full_name: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; license_plate: string; make?: string; model?: string }[]>([]);

  const fetchLookups = useCallback(async () => {
    const [{ data: g }, { data: v }] = await Promise.all([
      supabase.from('safari_guides').select('id, full_name').eq('status', 'available').order('full_name'),
      supabase.from('vehicles').select('id, license_plate, make, model').order('license_plate'),
    ]);
    setGuides((g || []) as any);
    setVehicles((v || []) as any);
  }, []);

  const fetchBookings = useCallback(async () => {
    // Use select('*') — lets Supabase return whatever columns actually exist
    // so we never crash on a missing column name
    const { data: baseData, error: baseErr } = await supabase
      .from('safari_bookings')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(500);
    if (baseErr) { console.error('[SafariBookings]', baseErr.message); setBookings([]); return; }

    // Normalize: map any column variants into the SafariBooking interface shape
    const base: SafariBooking[] = (baseData || []).map((d: any) => ({
      id:                d.id,
      booking_reference: d.booking_reference || d.booking_ref || d.reference || '',
      status:            d.status || 'pending',
      start_date:        d.start_date || '',
      end_date:          d.end_date   || '',
      pax_count:         d.pax_count  ?? d.pax ?? d.num_passengers ?? undefined,
      total_price_usd:   d.total_price_usd ?? d.total_amount ?? d.price_usd ?? undefined,
      deposit_amount:    d.deposit_amount   ?? d.deposit      ?? undefined,
      amount_paid:       d.amount_paid      ?? d.paid         ?? undefined,
      booking_direction: d.booking_direction ?? d.direction   ?? undefined,
      profit_margin:        d.profit_margin        ?? undefined,
      total_expenses_usd:   d.total_expenses_usd   ?? undefined,
      vehicle_hire_cost_usd: d.vehicle_hire_cost_usd ?? undefined,
      customer_name:        d.customer_name        ?? d.client_name ?? undefined,
      customer_email:    d.customer_email    ?? d.email       ?? undefined,
      // FK ids — may or may not exist; store what we have
      vehicle_id:        d.vehicle_id        ?? d.assigned_vehicle_id ?? undefined,
      guide_id:          d.guide_id          ?? d.assigned_guide_id   ?? undefined,
      client_id:         d.client_id         ?? undefined,
      package_id:        d.package_id        ?? undefined,
      created_at:        d.created_at        ?? undefined,
      checklist_sent:    d.checklist_sent    ?? undefined,
    }));

    // Attempt FK-joined enrichment (relations may or may not be configured)
    if (base.length === 0) { setBookings([]); return; }
    try {
      const { data: rich } = await supabase
        .from('safari_bookings')
        .select('id, clients(company_name, contact_person), safari_packages(name, category), vehicles(license_plate, make, model), safari_guides(full_name)')
        .in('id', base.map(b => b.id));
      if (rich && rich.length > 0) {
        const map: Record<string, any> = {};
        (rich as any[]).forEach(r => { map[r.id] = r; });
        setBookings(base.map(b => ({ ...b, ...(map[b.id] || {}) })));
        return;
      }
    } catch { /* FK relations not configured — use flat data */ }
    setBookings(base);
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchBookings(), fetchLookups()]);
  }, [fetchBookings, fetchLookups]);

  useEffect(() => { setLoading(true); fetchAll().finally(() => setLoading(false)); }, [fetchAll]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); }, [fetchAll]);

  const filtered = useMemo(() => {
    let list = bookings;

    // Status
    if (filters.status !== 'all') list = list.filter(b => b.status === filters.status);

    // Date range — compare YYYY-MM-DD prefix regardless of time component
    if (filters.dateFrom) list = list.filter(b => b.start_date && b.start_date.slice(0, 10) >= filters.dateFrom);
    if (filters.dateTo)   list = list.filter(b => b.start_date && b.start_date.slice(0, 10) <= filters.dateTo);

    // Guide — match on id field OR enriched guide name
    if (filters.guideId) {
      const guideName = guides.find(g => g.id === filters.guideId)?.full_name?.toLowerCase() || '';
      list = list.filter(b =>
        b.guide_id === filters.guideId ||
        (b as any).safari_guides?.full_name?.toLowerCase() === guideName,
      );
    }

    // Vehicle — match on id field OR enriched plate
    if (filters.vehicleId) {
      const plate = vehicles.find(v => v.id === filters.vehicleId)?.license_plate?.toLowerCase() || '';
      list = list.filter(b =>
        b.vehicle_id === filters.vehicleId ||
        (b as any).vehicles?.license_plate?.toLowerCase() === plate,
      );
    }

    // Search across all text fields
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(b =>
        b.booking_reference?.toLowerCase().includes(q) ||
        b.customer_name?.toLowerCase().includes(q) ||
        b.customer_email?.toLowerCase().includes(q) ||
        b.clients?.company_name?.toLowerCase().includes(q) ||
        b.safari_guides?.full_name?.toLowerCase().includes(q) ||
        b.vehicles?.license_plate?.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [bookings, filters, search, guides, vehicles]);

  const activeFilterCount = [
    filters.status !== 'all',
    filters.datePreset !== 'all',
    !!filters.guideId,
    !!filters.vehicleId,
  ].filter(Boolean).length;

  if (loading) return <LoadingView label="Loading safari bookings…" />;

  return (
    <View style={{ flex: 1 }}>
      {/* Search + Filter row */}
      <View style={ts.searchWrap}>
        <View style={ts.searchBox}>
          <Ico.Search s={15} c={C.textMuted} />
          <TextInput style={ts.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search ref, client, email…" placeholderTextColor={C.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              blurOnSubmit={false}
              returnKeyType="search"
            />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ico.Close s={16} c={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={[ts.filterBtn, activeFilterCount > 0 && ts.filterBtnActive]} onPress={() => setShowFilters(true)}>
          <Ico.Filter s={16} c={activeFilterCount > 0 ? '#fff' : C.primary} />
          {activeFilterCount > 0 && <Text style={ts.filterCount}>{activeFilterCount}</Text>}
        </TouchableOpacity>
      </View>

      {/* Active filter summary chips */}
      {activeFilterCount > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 8 }}>
          {filters.status !== 'all' && (
            <View style={[ts.activeBadge, { backgroundColor: STATUS_CFG[filters.status]?.bg || C.input }]}>
              <Text style={[ts.activeBadgeT, { color: STATUS_CFG[filters.status]?.text || C.textMuted }]}>
                {STATUS_CFG[filters.status]?.label}
              </Text>
            </View>
          )}
          {filters.datePreset !== 'all' && (
            <View style={ts.activeBadge}>
              <Text style={ts.activeBadgeT}>
                {filters.datePreset === 'custom' ? `${filters.dateFrom} → ${filters.dateTo}` :
                 filters.datePreset === 'today' ? 'Today' :
                 filters.datePreset === 'week' ? 'Next 7 Days' : 'Next 30 Days'}
              </Text>
            </View>
          )}
          {filters.guideId && (
            <View style={ts.activeBadge}>
              <Text style={ts.activeBadgeT}>{guides.find(g => g.id === filters.guideId)?.full_name || 'Guide'}</Text>
            </View>
          )}
          {filters.vehicleId && (
            <View style={ts.activeBadge}>
              <Text style={ts.activeBadgeT}>{vehicles.find(v => v.id === filters.vehicleId)?.license_plate || 'Vehicle'}</Text>
            </View>
          )}
          <TouchableOpacity style={[ts.activeBadge, { backgroundColor: C.danger + '18', borderColor: C.danger + '30' }]}
            onPress={() => setFilters(DEFAULT_FILTERS)}>
            <Text style={[ts.activeBadgeT, { color: C.danger }]}>Clear All</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Results count */}
      <Text style={ts.resultCount}>{filtered.length} booking{filtered.length !== 1 ? 's' : ''}</Text>

      <FlatList
        keyboardShouldPersistTaps="handled"
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <BookingCard b={item} onPress={() => { setSelected(item); setShowDetail(true); }} />}
        ListEmptyComponent={<EmptyView title="No bookings found" sub="Try adjusting your filters or search." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      />

      <BookingDetailModal booking={selected} visible={showDetail} onClose={() => setShowDetail(false)} onRefetch={fetchBookings} />
      <BookingFilterSheet
        visible={showFilters}
        filters={filters}
        guides={guides}
        vehicles={vehicles}
        onApply={setFilters}
        onClose={() => setShowFilters(false)}
      />
    </View>
  );
}

const ts = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: C.text, paddingVertical: 0 },
  filterBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.primarySoft, borderWidth: 1, borderColor: C.primary + '40', alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterCount: { position: 'absolute', top: -4, right: -4, backgroundColor: C.gold, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  activeBadge: { backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeT: { fontSize: 11, fontWeight: '700', color: C.textMuted },
  resultCount: { fontSize: 11, fontWeight: '700', color: C.textMuted, paddingHorizontal: 14, marginBottom: 4 },
  chipRow: { paddingHorizontal: 14, paddingVertical: 6, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  chipT: { fontSize: 12, fontWeight: '700' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD REPORTS — upload, list, preview & download
// ═══════════════════════════════════════════════════════════════════════════════

const REPORT_BUCKET = 'safari-field-reports';

function fmtBytes(n?: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

// ── Upload modal ──────────────────────────────────────────────────────────────
function UploadReportModal({ visible, onClose, onUploaded }: {
  visible: boolean; onClose: () => void; onUploaded: () => void;
}) {
  const [bookings, setBookings] = useState<SafariBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<SafariBooking | null>(null);
  const [notes, setNotes] = useState('');
  const [pickedFile, setPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showBookingPicker, setShowBookingPicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    supabase.from('safari_bookings')
      .select('id, booking_reference, customer_name, start_date, end_date, status, clients(company_name)')
      .in('status', ['completed', 'active'])
      .order('end_date', { ascending: false })
      .limit(80)
      .then(({ data }) => setBookings((data || []) as unknown as SafariBooking[]));
  }, [visible]);

  const reset = useCallback(() => {
    setSelectedBooking(null); setPickedFile(null); setNotes('');
  }, []);

  const pickFile = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain', 'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!res.canceled && res.assets?.[0]) setPickedFile(res.assets[0]);
    } catch { Alert.alert('Error', 'Failed to open file picker.'); }
  }, []);

  const upload = useCallback(async () => {
    if (!selectedBooking) { Alert.alert('Required', 'Select a safari booking.'); return; }
    if (!pickedFile) { Alert.alert('Required', 'Choose a document to upload.'); return; }
    setUploading(true);
    try {
      const resp = await fetch(pickedFile.uri);
      const blob = await resp.blob();
      const storagePath = `${selectedBooking.id}/${Date.now()}_${pickedFile.name.replace(/\s+/g, '_')}`;
      const { error: storageErr } = await supabase.storage
        .from(REPORT_BUCKET)
        .upload(storagePath, blob, {
          contentType: pickedFile.mimeType || 'application/octet-stream',
          upsert: false,
        });
      if (storageErr) throw storageErr;
      const { data: { publicUrl } } = supabase.storage.from(REPORT_BUCKET).getPublicUrl(storagePath);
      const { error: dbErr } = await supabase.from('safari_field_reports').insert({
        booking_id: selectedBooking.id,
        file_name: pickedFile.name,
        file_url: publicUrl,
        file_size: pickedFile.size ?? null,
        file_type: pickedFile.mimeType || 'application/pdf',
        notes: notes.trim() || null,
      });
      if (dbErr) throw dbErr;
      Alert.alert('Uploaded', 'Field report saved successfully.');
      onUploaded(); onClose(); reset();
    } catch (e: any) {
      Alert.alert('Upload Failed', e?.message || 'Could not upload the report. Ensure the storage bucket "safari-field-reports" exists in your project.');
    } finally { setUploading(false); }
  }, [selectedBooking, pickedFile, notes, onUploaded, onClose, reset]);

  const bookingLabel = selectedBooking
    ? `${selectedBooking.booking_reference || selectedBooking.id.slice(0, 8)} — ${(selectedBooking as any).clients?.company_name || selectedBooking.customer_name || 'Client'}`
    : 'Select completed safari…';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={gm.header}>
            <Text style={gm.title}>Upload Field Report</Text>
            <TouchableOpacity onPress={() => { onClose(); reset(); }} style={gm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

            {/* Booking selector */}
            <FieldLabel label="Safari Booking *" />
            <TouchableOpacity style={gm.selector} onPress={() => setShowBookingPicker(true)}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: selectedBooking ? C.text : C.textMuted }} numberOfLines={1}>{bookingLabel}</Text>
              </View>
              <Ico.ChevDown s={16} c={C.textMuted} />
            </TouchableOpacity>

            {/* File picker */}
            <FieldLabel label="Document *" />
            <TouchableOpacity style={[gm.selector, { justifyContent: 'space-between' }]} onPress={pickFile}>
              <View style={{ flex: 1, marginRight: 8 }}>
                {pickedFile ? (
                  <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }} numberOfLines={2}>{pickedFile.name}</Text>
                ) : (
                  <Text style={{ fontSize: 14, color: C.textMuted }}>Tap to choose PDF / Word / Excel…</Text>
                )}
                {pickedFile?.size ? <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{fmtBytes(pickedFile.size)}</Text> : null}
              </View>
              <Ico.FileText s={18} c={C.primary} />
            </TouchableOpacity>

            {/* Notes */}
            <FieldLabel label="Notes (optional)" />
            <TextF value={notes} onChange={setNotes} placeholder="Summary observations, incidents, highlights…" multiline />

            <TouchableOpacity style={[gm.saveBtn, uploading && { opacity: 0.6 }]} onPress={upload} disabled={uploading}>
              {uploading
                ? <ActivityIndicator size="small" color="#fff" />
                : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ico.Upload s={18} c="#fff" />
                    <Text style={gm.saveBtnT}>Upload Report</Text>
                  </View>
                )}
            </TouchableOpacity>
          </ScrollView>

          <PickerModal
            visible={showBookingPicker}
            title="Select Safari Booking"
            options={bookings.map(b => ({
              value: b.id,
              label: `${b.booking_reference || b.id.slice(0, 8)} · ${(b as any).clients?.company_name || b.customer_name || 'Client'}`,
              sub: `${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} (${b.status})`,
            }))}
            selected={selectedBooking?.id}
            onSelect={o => setSelectedBooking(bookings.find(b => b.id === o.value) || null)}
            onClose={() => setShowBookingPicker(false)}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Preview & download modal ──────────────────────────────────────────────────
function ReportPreviewModal({ report, visible, onClose }: {
  report: SafariFieldReport | null; visible: boolean; onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  if (!report) return null;

  const isPdf = report.file_type?.includes('pdf') || report.file_name?.toLowerCase().endsWith('.pdf');

  const openPreview = useCallback(async () => {
    if (!report.file_url) return;
    // For PDFs, open via Google Docs viewer so it renders inline on mobile
    const viewerUrl = isPdf
      ? `https://docs.google.com/viewer?url=${encodeURIComponent(report.file_url)}&embedded=true`
      : report.file_url;
    await WebBrowser.openBrowserAsync(viewerUrl, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  }, [report.file_url, isPdf]);

  const download = useCallback(async () => {
    if (!report.file_url) return;
    setDownloading(true);
    try {
      const ext = report.file_name.includes('.') ? report.file_name.split('.').pop() : 'pdf';
      const localUri = FileSystem.documentDirectory + `field_report_${report.id.slice(0, 8)}.${ext}`;
      const { uri } = await FileSystem.downloadAsync(report.file_url, localUri);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: report.file_type || 'application/pdf',
          dialogTitle: report.file_name,
          UTI: isPdf ? 'com.adobe.pdf' : undefined,
        });
      } else {
        await Linking.openURL(report.file_url);
      }
    } catch (e: any) {
      Alert.alert('Download Failed', e?.message || 'Could not download the file.');
    } finally { setDownloading(false); }
  }, [report, isPdf]);

  const booking = report.safari_bookings;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={gm.header}>
          <View style={{ flex: 1 }}>
            <Text style={[gm.title, { fontSize: 16 }]} numberOfLines={2}>{report.file_name}</Text>
            {booking ? (
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                {booking.booking_reference} · {booking.clients?.company_name || booking.customer_name || ''}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={onClose} style={gm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {/* File info card */}
          <View style={rp.infoCard}>
            <View style={rp.iconWrap}><Ico.FileText s={32} c={C.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={rp.fileName} numberOfLines={3}>{report.file_name}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                {report.file_size ? <Text style={rp.meta}>{fmtBytes(report.file_size)}</Text> : null}
                {report.file_type ? <Text style={rp.meta}>{report.file_type.split('/')[1]?.toUpperCase() || report.file_type}</Text> : null}
                {report.created_at ? <Text style={rp.meta}>{fmtDate(report.created_at)}</Text> : null}
              </View>
            </View>
          </View>

          {/* Safari context */}
          {booking && (
            <View style={rp.contextCard}>
              <Text style={rp.contextLabel}>SAFARI</Text>
              <Text style={rp.contextVal}>{booking.booking_reference}</Text>
              {(booking.clients?.company_name || booking.customer_name) && (
                <Text style={rp.contextSub}>{booking.clients?.company_name || booking.customer_name}</Text>
              )}
              {(booking.start_date || booking.end_date) && (
                <Text style={rp.contextSub}>{fmtDate(booking.start_date)} → {fmtDate(booking.end_date)}</Text>
              )}
            </View>
          )}

          {/* Notes */}
          {report.notes ? (
            <View style={rp.contextCard}>
              <Text style={rp.contextLabel}>NOTES</Text>
              <Text style={{ fontSize: 14, color: C.text, lineHeight: 20, marginTop: 4 }}>{report.notes}</Text>
            </View>
          ) : null}

          {/* Action buttons */}
          <View style={{ gap: 12, marginTop: 8 }}>
            <TouchableOpacity style={rp.previewBtn} onPress={openPreview}>
              <Ico.Eye s={18} c={C.primary} />
              <Text style={rp.previewBtnT}>Preview Document</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[rp.downloadBtn, downloading && { opacity: 0.6 }]} onPress={download} disabled={downloading}>
              {downloading
                ? <ActivityIndicator size="small" color="#fff" />
                : (
                  <>
                    <Ico.Download s={18} c="#fff" />
                    <Text style={rp.downloadBtnT}>Download & Share</Text>
                  </>
                )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const rp = StyleSheet.create({
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  iconWrap: { width: 56, height: 56, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 15, fontWeight: '700', color: C.text, lineHeight: 20 },
  meta: { fontSize: 11, color: C.textMuted, backgroundColor: C.input, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  contextCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  contextLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: C.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  contextVal: { fontSize: 15, fontWeight: '700', color: C.text },
  contextSub: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.primary, backgroundColor: C.primarySoft },
  previewBtnT: { fontSize: 15, fontWeight: '700', color: C.primary },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: C.primary },
  downloadBtnT: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ── Field Reports list sub-tab ────────────────────────────────────────────────
function FieldReportsSubTab() {
  const [reports, setReports] = useState<SafariFieldReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [previewReport, setPreviewReport] = useState<SafariFieldReport | null>(null);
  const [search, setSearch] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('safari_field_reports')
      .select('*, safari_bookings(booking_reference, customer_name, start_date, end_date, clients(company_name))')
      .order('created_at', { ascending: false });
    setReports((data || []) as SafariFieldReport[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const filtered = useMemo(() => {
    if (!search.trim()) return reports;
    const q = search.toLowerCase();
    return reports.filter(r =>
      r.file_name?.toLowerCase().includes(q) ||
      r.safari_bookings?.booking_reference?.toLowerCase().includes(q) ||
      r.safari_bookings?.customer_name?.toLowerCase().includes(q) ||
      (r.safari_bookings as any)?.clients?.company_name?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    );
  }, [reports, search]);

  const deleteReport = useCallback((r: SafariFieldReport) => {
    Alert.alert('Delete Report', `Remove "${r.file_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        // Delete from storage
        const path = r.file_url.split(`/${REPORT_BUCKET}/`)[1];
        if (path) await supabase.storage.from(REPORT_BUCKET).remove([path]);
        await supabase.from('safari_field_reports').delete().eq('id', r.id);
        fetchReports();
      }},
    ]);
  }, [fetchReports]);

  if (loading) return <LoadingView label="Loading reports…" />;

  return (
    <View style={{ flex: 1 }}>
      {/* Search */}
      <View style={ts.searchWrap}>
        <View style={ts.searchBox}>
          <Ico.Search s={15} c={C.textMuted} />
          <TextInput style={ts.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search by booking, client, file…" placeholderTextColor={C.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              blurOnSubmit={false}
              returnKeyType="search"
            />
        </View>
      </View>

      <FlatList
        keyboardShouldPersistTaps="handled"
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item: r }) => {
          const booking = r.safari_bookings;
          const clientName = (booking as any)?.clients?.company_name || booking?.customer_name || '—';
          const isPdf = r.file_type?.includes('pdf') || r.file_name?.toLowerCase().endsWith('.pdf');
          return (
            <TouchableOpacity style={fr.card} onPress={() => setPreviewReport(r)} activeOpacity={0.78}>
              <View style={fr.iconWrap}>
                <Ico.FileText s={22} c={C.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={fr.fileName} numberOfLines={2}>{r.file_name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {booking?.booking_reference ? (
                    <View style={fr.refPill}><Text style={fr.refPillT}>{booking.booking_reference}</Text></View>
                  ) : null}
                  <Text style={fr.client} numberOfLines={1}>{clientName}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                  {r.file_size ? <Text style={fr.meta}>{fmtBytes(r.file_size)}</Text> : null}
                  {r.created_at ? <Text style={fr.meta}>{fmtDate(r.created_at)}</Text> : null}
                  <View style={[fr.typePill, { backgroundColor: isPdf ? '#FFEEDD' : '#EEF0FF' }]}>
                    <Text style={[fr.typePillT, { color: isPdf ? '#8B4513' : '#3B5BDB' }]}>
                      {isPdf ? 'PDF' : (r.file_type?.split('/')[1]?.toUpperCase() || 'DOC')}
                    </Text>
                  </View>
                </View>
                {r.notes ? <Text style={fr.notes} numberOfLines={1}>{r.notes}</Text> : null}
              </View>
              <View style={{ gap: 8, alignItems: 'flex-end' }}>
                <TouchableOpacity style={op.iconBtn} onPress={() => setPreviewReport(r)}>
                  <Ico.Eye s={14} c={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[op.iconBtn, { backgroundColor: '#FFEEED' }]} onPress={() => deleteReport(r)}>
                  <Ico.Trash s={14} c={C.danger} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Ico.ClipboardCheck s={28} c={C.textMuted} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 }}>No Field Reports</Text>
            <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 }}>
              Upload post-safari field reports using the + button. Reports are linked to completed bookings.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchReports} tintColor={C.primary} />}
      />

      {/* FAB */}
      <TouchableOpacity style={[fabStyle.fab, { backgroundColor: C.gold }]} onPress={() => setShowUpload(true)}>
        <Ico.Plus s={24} c="#fff" />
      </TouchableOpacity>

      <UploadReportModal visible={showUpload} onClose={() => setShowUpload(false)} onUploaded={fetchReports} />
      <ReportPreviewModal report={previewReport} visible={previewReport != null} onClose={() => setPreviewReport(null)} />
    </View>
  );
}

const fr = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 10, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fileName: { fontSize: 14, fontWeight: '700', color: C.text, lineHeight: 18 },
  refPill: { backgroundColor: '#E5EDFF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  refPillT: { fontSize: 10, fontWeight: '700', color: '#1a5a8f' },
  client: { fontSize: 12, color: C.textMuted, flex: 1 },
  meta: { fontSize: 11, color: C.textMuted },
  typePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typePillT: { fontSize: 10, fontWeight: '700' },
  notes: { fontSize: 12, color: C.textMuted, fontStyle: 'italic', marginTop: 4 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// OPERATIONS TAB — Guides + Permits Catalog
// ═══════════════════════════════════════════════════════════════════════════════

function AddEditGuideModal({ visible, guide, onClose, onSaved }: {
  visible: boolean; guide: SafariGuide | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [langs, setLangs] = useState('');
  const [status, setStatus] = useState('available');
  const [rating, setRating] = useState('');
  const [saving, setSaving] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  useEffect(() => {
    if (guide) {
      setName(guide.full_name || ''); setPhone(guide.phone || ''); setEmail(guide.email || '');
      setLangs(Array.isArray(guide.languages) ? guide.languages.join(', ') : '');
      setStatus(guide.status || 'available'); setRating(guide.rating?.toString() || '');
    } else {
      setName(''); setPhone(''); setEmail(''); setLangs(''); setStatus('available'); setRating('');
    }
  }, [guide, visible]);

  const save = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Required', 'Full name is required.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        full_name: name.trim(), phone: phone.trim() || null, email: email.trim() || null,
        languages: langs.trim() ? langs.split(',').map(l => l.trim()).filter(Boolean) : [],
        status, rating: rating ? parseFloat(rating) : null,
      };
      const { error } = guide
        ? await supabase.from('safari_guides').update(payload).eq('id', guide.id)
        : await supabase.from('safari_guides').insert(payload);
      if (error) throw error;
      Alert.alert('Saved', guide ? 'Guide updated.' : 'Guide added.');
      onSaved(); onClose();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }, [name, phone, email, langs, status, rating, guide, onSaved, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={gm.header}>
            <Text style={gm.title}>{guide ? 'Edit Guide' : 'Add Safari Guide'}</Text>
            <TouchableOpacity onPress={onClose} style={gm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <FieldLabel label="Full Name *" /><TextF value={name} onChange={setName} placeholder="e.g. John Musoke" />
            <FieldLabel label="Phone" /><TextF value={phone} onChange={setPhone} placeholder="+256 700 000000" keyboardType="phone-pad" />
            <FieldLabel label="Email" /><TextF value={email} onChange={setEmail} placeholder="guide@example.com" keyboardType="email-address" />
            <FieldLabel label="Languages (comma separated)" /><TextF value={langs} onChange={setLangs} placeholder="English, Swahili, French" />
            <FieldLabel label="Status" />
            <TouchableOpacity style={gm.selector} onPress={() => setShowStatusPicker(true)}>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>{status}</Text>
              <Ico.ChevDown s={16} c={C.textMuted} />
            </TouchableOpacity>
            <FieldLabel label="Rating (0–5)" /><TextF value={rating} onChange={setRating} placeholder="4.5" keyboardType="decimal-pad" />
            <TouchableOpacity style={[gm.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={gm.saveBtnT}>{guide ? 'Update Guide' : 'Add Guide'}</Text>}
            </TouchableOpacity>
          </ScrollView>
          <PickerModal visible={showStatusPicker} title="Guide Status"
            options={GUIDE_STATUSES.map(s => ({ value: s, label: s.replace('_', ' ') }))}
            selected={status} onSelect={o => setStatus(o.value)} onClose={() => setShowStatusPicker(false)} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const gm = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  closeBtn: { padding: 8, backgroundColor: C.input, borderRadius: 20 },
  selector: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  saveBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  saveBtnT: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

function AddEditPermitModal({ visible, permit, onClose, onSaved }: {
  visible: boolean; permit: PermitCatalog | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Park Entry');
  const [costUsd, setCostUsd] = useState('');
  const [costUgx, setCostUgx] = useState('');
  const [validity, setValidity] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  useEffect(() => {
    if (permit) {
      setName(permit.permit_name || ''); setType(permit.permit_type || 'Park Entry');
      setCostUsd(permit.cost_usd?.toString() || ''); setCostUgx(permit.cost_ugx?.toString() || '');
      setValidity(permit.validity_days?.toString() || ''); setActive(permit.is_active);
    } else { setName(''); setType('Park Entry'); setCostUsd(''); setCostUgx(''); setValidity(''); setActive(true); }
  }, [permit, visible]);

  const save = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Required', 'Permit name is required.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        permit_name: name.trim(), permit_type: type,
        cost_usd: costUsd ? parseFloat(costUsd) : null, cost_ugx: costUgx ? parseInt(costUgx) : null,
        validity_days: validity ? parseInt(validity) : null, is_active: active,
      };
      const { error } = permit
        ? await supabase.from('safari_permits').update(payload).eq('id', permit.id)
        : await supabase.from('safari_permits').insert(payload);
      if (error) throw error;
      Alert.alert('Saved', permit ? 'Permit updated.' : 'Permit added to catalog.');
      onSaved(); onClose();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }, [name, type, costUsd, costUgx, validity, active, permit, onSaved, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={gm.header}>
            <Text style={gm.title}>{permit ? 'Edit Permit' : 'Add Permit'}</Text>
            <TouchableOpacity onPress={onClose} style={gm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <FieldLabel label="Permit Name *" /><TextF value={name} onChange={setName} placeholder="e.g. Bwindi Gorilla Permit" />
            <FieldLabel label="Permit Type" />
            <TouchableOpacity style={gm.selector} onPress={() => setShowTypePicker(true)}>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>{type}</Text>
              <Ico.ChevDown s={16} c={C.textMuted} />
            </TouchableOpacity>
            <FieldLabel label="Cost (USD)" /><TextF value={costUsd} onChange={setCostUsd} placeholder="700.00" keyboardType="decimal-pad" />
            <FieldLabel label="Cost (UGX)" /><TextF value={costUgx} onChange={setCostUgx} placeholder="2600000" keyboardType="number-pad" />
            <FieldLabel label="Validity (days)" /><TextF value={validity} onChange={setValidity} placeholder="1" keyboardType="number-pad" />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <Text style={{ fontSize: 14, color: C.text, fontWeight: '600' }}>Active</Text>
              <Switch value={active} onValueChange={setActive} trackColor={{ true: C.primary }} />
            </View>
            <TouchableOpacity style={[gm.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={gm.saveBtnT}>{permit ? 'Update Permit' : 'Add to Catalog'}</Text>}
            </TouchableOpacity>
          </ScrollView>
          <PickerModal visible={showTypePicker} title="Permit Type"
            options={PERMIT_TYPES.map(t => ({ value: t, label: t }))}
            selected={type} onSelect={o => setType(o.value)} onClose={() => setShowTypePicker(false)} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function OperationsTab() {
  const [subTab, setSubTab] = useState<'guides' | 'permits' | 'reports'>('guides');
  const [guides, setGuides] = useState<SafariGuide[]>([]);
  const [permits, setPermits] = useState<PermitCatalog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editGuide, setEditGuide] = useState<SafariGuide | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [editPermit, setEditPermit] = useState<PermitCatalog | null>(null);
  const [showPermitModal, setShowPermitModal] = useState(false);

  const fetchGuides = useCallback(async () => {
    const { data } = await supabase.from('safari_guides').select('id, guide_id, full_name, phone, email, languages, status, rating').order('full_name');
    setGuides((data || []) as SafariGuide[]);
  }, []);

  const fetchPermits = useCallback(async () => {
    const { data } = await supabase.from('safari_permits').select('id, permit_id, permit_name, permit_type, cost_usd, cost_ugx, validity_days, is_active').order('permit_name');
    setPermits((data || []) as PermitCatalog[]);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchGuides(), fetchPermits()]).finally(() => setLoading(false));
  }, [fetchGuides, fetchPermits]);

  const deleteGuide = useCallback((g: SafariGuide) => {
    Alert.alert('Delete Guide', `Remove ${g.full_name} from the system?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('safari_guides').delete().eq('id', g.id);
        fetchGuides();
      }},
    ]);
  }, [fetchGuides]);

  const filteredGuides = useMemo(() => {
    if (!search.trim()) return guides;
    const q = search.toLowerCase();
    return guides.filter(g => g.full_name.toLowerCase().includes(q) || g.phone?.includes(q) || g.status?.includes(q));
  }, [guides, search]);

  const filteredPermits = useMemo(() => {
    if (!search.trim()) return permits;
    const q = search.toLowerCase();
    return permits.filter(p => p.permit_name.toLowerCase().includes(q) || p.permit_type?.toLowerCase().includes(q));
  }, [permits, search]);

  if (loading) return <LoadingView label="Loading resources…" />;

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tab toggle */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <View style={op.subBar}>
          <TouchableOpacity style={[op.subBtn, subTab === 'guides' && op.subBtnOn]} onPress={() => { setSubTab('guides'); setSearch(''); }}>
            <Text style={[op.subBtnT, subTab === 'guides' && op.subBtnTOn]}>Guides ({guides.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[op.subBtn, subTab === 'permits' && op.subBtnOn]} onPress={() => { setSubTab('permits'); setSearch(''); }}>
            <Text style={[op.subBtnT, subTab === 'permits' && op.subBtnTOn]}>Permit Catalog ({permits.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[op.subBtn, subTab === 'reports' && op.subBtnOn]} onPress={() => { setSubTab('reports'); setSearch(''); }}>
            <Text style={[op.subBtnT, subTab === 'reports' && op.subBtnTOn]}>Field Reports</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Field Reports sub-tab renders its own search & list */}
      {subTab === 'reports' && <FieldReportsSubTab />}

      {/* Search — only for Guides / Permits */}
      {subTab !== 'reports' && (
        <View style={ts.searchWrap}>
          <View style={ts.searchBox}>
            <Ico.Search s={15} c={C.textMuted} />
            <TextInput style={ts.searchInput} value={search} onChangeText={setSearch}
              placeholder={subTab === 'guides' ? 'Search guides…' : 'Search permits…'} placeholderTextColor={C.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
                blurOnSubmit={false}
                returnKeyType="search"
              />
          </View>
        </View>
      )}

      {subTab === 'guides' && (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filteredGuides}
          keyExtractor={i => i.id}
          renderItem={({ item: g }) => (
            <View style={op.guideCard}>
              <View style={op.guideAvatar}><Text style={op.guideInitial}>{g.full_name?.[0]?.toUpperCase() || '?'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={op.guideName}>{g.full_name}</Text>
                {g.phone ? <Text style={op.guideSub}>{g.phone}</Text> : null}
                {g.languages && g.languages.length > 0 ? <Text style={op.guideLangs}>{g.languages.join(' · ')}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                {g.rating != null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ico.Star s={12} c={C.gold} /><Text style={{ fontSize: 12, fontWeight: '700', color: C.gold }}>{g.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
                <View style={[op.stDot, { backgroundColor: g.status === 'available' ? C.success + '20' : C.gold + '20' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: g.status === 'available' ? C.success : C.gold }}>{g.status || 'unknown'}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={op.iconBtn} onPress={() => { setEditGuide(g); setShowGuideModal(true); }}>
                    <Ico.Edit s={14} c={C.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[op.iconBtn, { backgroundColor: '#FFEEED' }]} onPress={() => deleteGuide(g)}>
                    <Ico.Trash s={14} c={C.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyView title="No guides found" sub="Add safari guides using the + button." />}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        />
      )}

      {subTab === 'permits' && (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filteredPermits}
          keyExtractor={i => i.id}
          renderItem={({ item: p }) => (
            <View style={op.permitCard}>
              <View style={{ flex: 1 }}>
                <Text style={op.permitName}>{p.permit_name}</Text>
                {p.permit_type ? <Text style={op.permitType}>{p.permit_type}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                  {p.cost_usd ? <Text style={op.permitCost}>{formatCurrency(p.cost_usd, 'USD')}</Text> : null}
                  {p.validity_days ? <Text style={op.permitMeta}>{p.validity_days}d validity</Text> : null}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <View style={[op.stDot, { backgroundColor: p.is_active ? C.success + '20' : C.danger + '20' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: p.is_active ? C.success : C.danger }}>{p.is_active ? 'Active' : 'Inactive'}</Text>
                </View>
                <TouchableOpacity style={op.iconBtn} onPress={() => { setEditPermit(p); setShowPermitModal(true); }}>
                  <Ico.Edit s={14} c={C.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyView title="No permits in catalog" sub="Add permit types using the + button." />}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        />
      )}

      {/* FAB — guides & permits only; Field Reports tab has its own */}
      {subTab !== 'reports' && (
        <TouchableOpacity style={fabStyle.fab} onPress={() => {
          if (subTab === 'guides') { setEditGuide(null); setShowGuideModal(true); }
          else { setEditPermit(null); setShowPermitModal(true); }
        }}>
          <Ico.Plus s={22} c="#fff" />
        </TouchableOpacity>
      )}

      <AddEditGuideModal visible={showGuideModal} guide={editGuide} onClose={() => setShowGuideModal(false)} onSaved={fetchGuides} />
      <AddEditPermitModal visible={showPermitModal} permit={editPermit} onClose={() => setShowPermitModal(false)} onSaved={fetchPermits} />
    </View>
  );
}

const op = StyleSheet.create({
  subBar: { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 14, minWidth: '100%' },
  subBtn: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  subBtnOn: { borderBottomColor: C.primary },
  subBtnT: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  subBtnTOn: { color: C.primary },
  guideCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, gap: 12 },
  guideAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  guideInitial: { fontSize: 18, fontWeight: '800', color: C.primary },
  guideName: { fontSize: 15, fontWeight: '700', color: C.text },
  guideSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  guideLangs: { fontSize: 11, color: C.gold, marginTop: 3, fontWeight: '600' },
  stDot: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  permitCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  permitName: { fontSize: 14, fontWeight: '700', color: C.text },
  permitType: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  permitCost: { fontSize: 13, fontWeight: '700', color: C.primary },
  permitMeta: { fontSize: 12, color: C.textMuted },
});

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function PackageFormModal({ visible, pkg, onClose, onSaved }: {
  visible: boolean; pkg: SafariPackage | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [cat, setCat] = useState('Wildlife Safari');
  const [country, setCountry] = useState('Uganda');
  const [days, setDays] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [priceUgx, setPriceUgx] = useState('');
  const [capMin, setCapMin] = useState('');
  const [capMax, setCapMax] = useState('');
  const [desc, setDesc] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  useEffect(() => {
    if (pkg) {
      setName(pkg.name || ''); setCode(pkg.package_code || ''); setCat(pkg.category || 'Wildlife Safari');
      setCountry(pkg.country || 'Uganda'); setDays(pkg.duration_days?.toString() || '');
      setPriceUsd(pkg.price_usd?.toString() || ''); setPriceUgx(pkg.price_ugx?.toString() || '');
      setCapMin(pkg.capacity_min?.toString() || ''); setCapMax(pkg.capacity_max?.toString() || '');
      setDesc(pkg.description || ''); setActive(pkg.is_active);
    } else {
      setName(''); setCode(''); setCat('Wildlife Safari'); setCountry('Uganda');
      setDays(''); setPriceUsd(''); setPriceUgx(''); setCapMin(''); setCapMax(''); setDesc(''); setActive(true);
    }
  }, [pkg, visible]);

  const save = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Required', 'Package name is required.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(), package_code: code.trim() || null, category: cat, country,
        duration_days: days ? parseInt(days) : null, price_usd: priceUsd ? parseFloat(priceUsd) : null,
        price_ugx: priceUgx ? parseInt(priceUgx) : null, capacity_min: capMin ? parseInt(capMin) : null,
        capacity_max: capMax ? parseInt(capMax) : null, description: desc.trim() || null, is_active: active,
      };
      const { error } = pkg
        ? await supabase.from('safari_packages').update(payload).eq('id', pkg.id)
        : await supabase.from('safari_packages').insert(payload);
      if (error) throw error;
      Alert.alert('Saved', pkg ? 'Package updated.' : 'Package created.');
      onSaved(); onClose();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }, [name, code, cat, country, days, priceUsd, priceUgx, capMin, capMax, desc, active, pkg, onSaved, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={gm.header}>
            <Text style={gm.title}>{pkg ? 'Edit Package' : 'New Safari Package'}</Text>
            <TouchableOpacity onPress={onClose} style={gm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <FieldLabel label="Package Name *" /><TextF value={name} onChange={setName} placeholder="e.g. Uganda Gorilla Safari" />
            <FieldLabel label="Package Code" /><TextF value={code} onChange={setCode} placeholder="e.g. UG-GOR-3D" />
            <FieldLabel label="Category" />
            <TouchableOpacity style={gm.selector} onPress={() => setShowCatPicker(true)}>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>{cat}</Text><Ico.ChevDown s={16} c={C.textMuted} />
            </TouchableOpacity>
            <FieldLabel label="Country" />
            <TouchableOpacity style={gm.selector} onPress={() => setShowCountryPicker(true)}>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>{country}</Text><Ico.ChevDown s={16} c={C.textMuted} />
            </TouchableOpacity>
            <FieldLabel label="Duration (days)" /><TextF value={days} onChange={setDays} placeholder="3" keyboardType="number-pad" />
            <FieldLabel label="Price (USD)" /><TextF value={priceUsd} onChange={setPriceUsd} placeholder="1500.00" keyboardType="decimal-pad" />
            <FieldLabel label="Price (UGX)" /><TextF value={priceUgx} onChange={setPriceUgx} placeholder="5500000" keyboardType="number-pad" />
            <FieldLabel label="Capacity Min" /><TextF value={capMin} onChange={setCapMin} placeholder="2" keyboardType="number-pad" />
            <FieldLabel label="Capacity Max" /><TextF value={capMax} onChange={setCapMax} placeholder="12" keyboardType="number-pad" />
            <FieldLabel label="Description" /><TextF value={desc} onChange={setDesc} placeholder="Brief description of the package…" multiline />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <Text style={{ fontSize: 14, color: C.text, fontWeight: '600' }}>Active</Text>
              <Switch value={active} onValueChange={setActive} trackColor={{ true: C.primary }} />
            </View>
            <TouchableOpacity style={[gm.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={gm.saveBtnT}>{pkg ? 'Update Package' : 'Create Package'}</Text>}
            </TouchableOpacity>
          </ScrollView>
          <PickerModal visible={showCatPicker} title="Category" options={PACKAGE_CATS.map(c => ({ value: c, label: c }))} selected={cat} onSelect={o => setCat(o.value)} onClose={() => setShowCatPicker(false)} />
          <PickerModal visible={showCountryPicker} title="Country" options={COUNTRIES.filter(c => c !== 'All').map(c => ({ value: c, label: c }))} selected={country} onSelect={o => setCountry(o.value)} onClose={() => setShowCountryPicker(false)} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PackagesTab() {
  const [packages, setPackages] = useState<SafariPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [countryFilter, setCountryFilter] = useState('All');
  const [editPkg, setEditPkg] = useState<SafariPackage | null>(null);
  const [showPkgModal, setShowPkgModal] = useState(false);

  const fetchPkgs = useCallback(async () => {
    const { data } = await supabase.from('safari_packages')
      .select('id, package_code, name, description, category, country, duration_days, price_usd, price_ugx, capacity_min, capacity_max, is_active, portal_visible')
      .order('name');
    setPackages((data || []) as SafariPackage[]);
  }, []);

  useEffect(() => { setLoading(true); fetchPkgs().finally(() => setLoading(false)); }, [fetchPkgs]);

  const deletePkg = useCallback((p: SafariPackage) => {
    Alert.alert('Delete Package', `Remove "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('safari_packages').delete().eq('id', p.id);
        fetchPkgs();
      }},
    ]);
  }, [fetchPkgs]);

  const filtered = useMemo(() =>
    countryFilter === 'All' ? packages : packages.filter(p => p.country === countryFilter || p.category === countryFilter),
    [packages, countryFilter]
  );

  if (loading) return <LoadingView label="Loading packages…" />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={ts.chipRow}>
        {COUNTRIES.map(c => (
          <TouchableOpacity key={c} style={[ts.chip, countryFilter === c && { backgroundColor: C.primary }]} onPress={() => setCountryFilter(c)}>
            <Text style={[ts.chipT, countryFilter === c ? { color: '#fff' } : { color: C.textMuted }]}>{c} {c !== 'All' ? `(${packages.filter(p => p.country === c || (!p.country && c === 'Uganda')).length})` : `(${packages.length})`}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item: p }) => (
          <View style={pgStyles.card}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text style={pgStyles.name} numberOfLines={1}>{p.name}</Text>
                {p.package_code ? <Text style={pgStyles.code}>{p.package_code}</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                {p.category ? <View style={pgStyles.tag}><Text style={pgStyles.tagT}>{p.category}</Text></View> : null}
                {p.country ? <View style={[pgStyles.tag, { backgroundColor: C.goldSoft }]}><Text style={[pgStyles.tagT, { color: C.gold }]}>{p.country}</Text></View> : null}
                <View style={[pgStyles.tag, { backgroundColor: p.is_active ? C.primarySoft : C.input }]}>
                  <Text style={[pgStyles.tagT, { color: p.is_active ? C.primary : C.textMuted }]}>{p.is_active ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {p.duration_days ? <Text style={pgStyles.meta}>{p.duration_days} days</Text> : null}
                {p.price_usd ? <Text style={pgStyles.price}>{formatCurrency(p.price_usd, 'USD')}</Text> : null}
                {p.capacity_min && p.capacity_max ? <Text style={pgStyles.meta}>{p.capacity_min}–{p.capacity_max} pax</Text> : null}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <TouchableOpacity style={op.iconBtn} onPress={() => { setEditPkg(p); setShowPkgModal(true); }}>
                <Ico.Edit s={14} c={C.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={[op.iconBtn, { backgroundColor: '#FFEEED' }]} onPress={() => deletePkg(p)}>
                <Ico.Trash s={14} c={C.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyView title="No packages found" sub="Create safari packages using the + button." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
      />
      <TouchableOpacity style={fabStyle.fab} onPress={() => { setEditPkg(null); setShowPkgModal(true); }}>
        <Ico.Plus s={22} c="#fff" />
      </TouchableOpacity>
      <PackageFormModal visible={showPkgModal} pkg={editPkg} onClose={() => setShowPkgModal(false)} onSaved={fetchPkgs} />
    </View>
  );
}

const pgStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, gap: 10 },
  name: { fontSize: 14, fontWeight: '800', color: C.text, flex: 1, letterSpacing: -0.2 },
  code: { fontSize: 11, color: C.textMuted, fontWeight: '600', backgroundColor: C.input, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tag: { backgroundColor: C.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  tagT: { fontSize: 11, fontWeight: '700', color: C.primary },
  meta: { fontSize: 12, color: C.textMuted },
  price: { fontSize: 13, fontWeight: '800', color: C.primary },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const [bookings, setBookings] = useState<SafariBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This feeds revenue/profit totals, so truncating too aggressively would
    // silently produce wrong numbers rather than just being slow — this cap is
    // a safety net against a genuinely unbounded fetch, not a "recent window."
    // Switch to year-scoping (like Dashboard/Finance already do) before this
    // safari_bookings table approaches 2000 rows.
    supabase.from('safari_bookings')
      .select('id, status, total_price_usd, amount_paid, deposit_amount, profit_margin, created_at, safari_packages(name)')
      .limit(2000)
      .then(({ data }) => { setBookings((data || []) as unknown as SafariBooking[]); setLoading(false); });
  }, []);

  const stats = useMemo(() => {
    const total = bookings.length;
    const active = bookings.filter(b => b.status === 'active').length;
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    const pending = bookings.filter(b => b.status === 'pending').length;
    const revenue = bookings.reduce((s, b) => s + (b.total_price_usd || 0), 0);
    const paid = bookings.reduce((s, b) => s + (b.amount_paid || 0), 0);
    const pendingDeposit = bookings.filter(b => (b.amount_paid || 0) < (b.deposit_amount || 0) && b.status !== 'cancelled').length;
    const avgMargin = bookings.filter(b => b.profit_margin != null).reduce((s, b, _, a) => s + ((b.profit_margin || 0) / a.length), 0);

    const statusCounts: Record<string, number> = {};
    STATUS_KEYS.slice(1).forEach(s => { statusCounts[s] = bookings.filter(b => b.status === s).length; });
    const maxCount = Math.max(...Object.values(statusCounts), 1);

    return { total, active, confirmed, completed, pending, revenue, paid, pendingDeposit, avgMargin, statusCounts, maxCount };
  }, [bookings]);

  if (loading) return <LoadingView label="Computing analytics…" />;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {/* KPI Grid */}
      <Text style={an.sectionTitle}>Key Performance Indicators</Text>
      <View style={an.kpiGrid}>
        {[
          { l: 'Total Bookings', v: stats.total.toString(), c: C.primary },
          { l: 'Active Now', v: stats.active.toString(), c: C.success },
          { l: 'Confirmed', v: stats.confirmed.toString(), c: '#1a5a8f' },
          { l: 'Completed', v: stats.completed.toString(), c: C.textMuted },
          { l: 'Total Revenue', v: formatCurrency(stats.revenue, 'USD'), c: C.primary },
          { l: 'Total Collected', v: formatCurrency(stats.paid, 'USD'), c: C.success },
          { l: 'Pending Deposit', v: stats.pendingDeposit.toString(), c: C.gold },
          { l: 'Avg. Margin', v: `${stats.avgMargin.toFixed(1)}%`, c: stats.avgMargin >= 0 ? C.success : C.danger },
        ].map((k, i) => (
          <View key={i} style={an.kpiCard}>
            <Text style={an.kpiLabel}>{k.l}</Text>
            <Text style={[an.kpiValue, { color: k.c }]}>{k.v}</Text>
          </View>
        ))}
      </View>

      {/* Status Breakdown */}
      <Text style={[an.sectionTitle, { marginTop: 20 }]}>Bookings by Status</Text>
      <View style={an.chartCard}>
        {STATUS_KEYS.slice(1).map(s => {
          const cfg = STATUS_CFG[s];
          const count = stats.statusCounts[s] || 0;
          const pct = stats.maxCount > 0 ? (count / stats.maxCount) * 100 : 0;
          return (
            <View key={s} style={an.barRow}>
              <Text style={an.barLabel}>{cfg.label}</Text>
              <View style={an.barTrack}>
                <View style={[an.barFill, { width: `${Math.max(pct, 2)}%`, backgroundColor: cfg.text }]} />
              </View>
              <Text style={[an.barCount, { color: cfg.text }]}>{count}</Text>
            </View>
          );
        })}
      </View>

      {/* Revenue summary */}
      <Text style={[an.sectionTitle, { marginTop: 20 }]}>Revenue Summary</Text>
      <View style={an.revCard}>
        <View style={an.revRow}>
          <Text style={an.revLabel}>Total Billed</Text>
          <Text style={an.revValue}>{formatCurrency(stats.revenue, 'USD')}</Text>
        </View>
        <View style={an.revRow}>
          <Text style={an.revLabel}>Collected</Text>
          <Text style={[an.revValue, { color: C.success }]}>{formatCurrency(stats.paid, 'USD')}</Text>
        </View>
        <View style={an.revRow}>
          <Text style={an.revLabel}>Outstanding</Text>
          <Text style={[an.revValue, { color: stats.revenue - stats.paid > 0 ? C.danger : C.success }]}>
            {formatCurrency(Math.max(0, stats.revenue - stats.paid), 'USD')}
          </Text>
        </View>
        <View style={[an.revRow, { borderBottomWidth: 0 }]}>
          <Text style={an.revLabel}>Collection Rate</Text>
          <Text style={[an.revValue, { color: C.primary }]}>
            {stats.revenue > 0 ? `${((stats.paid / stats.revenue) * 100).toFixed(0)}%` : '—'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const an = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  kpiCard: { width: (SW - 44) / 2, backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  kpiLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600', marginBottom: 6 },
  kpiValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.6 },
  chartCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, gap: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 72, fontSize: 12, color: C.textMuted, fontWeight: '600' },
  barTrack: { flex: 1, height: 8, backgroundColor: C.input, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barCount: { width: 28, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  revCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  revRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border + '60' },
  revLabel: { fontSize: 13, color: C.textMuted },
  revValue: { fontSize: 15, fontWeight: '800', color: C.text },
});

// ─── FAB style ────────────────────────────────────────────────────────────────
const fabStyle = StyleSheet.create({
  fab: { position: 'absolute', bottom: 28, right: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 8 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// AIRPORTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface Airport {
  id: string;
  airport_name: string;
  code?: string;
  city?: string;
  country?: string;
  type?: string; // International / Domestic / Regional
  status?: string;
}

function AirportFormModal({ visible, airport, defaultCountry, onClose, onSaved }: {
  visible: boolean; airport: Airport | null; defaultCountry: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState(defaultCountry);
  const [type, setType] = useState('International');
  const [status, setStatus] = useState('Active');
  const [saving, setSaving] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  useEffect(() => {
    if (airport) {
      setName(airport.airport_name || ''); setCode(airport.code || '');
      setCity(airport.city || ''); setCountry(airport.country || defaultCountry);
      setType(airport.type || 'International'); setStatus(airport.status || 'Active');
    } else {
      setName(''); setCode(''); setCity(''); setCountry(defaultCountry);
      setType('International'); setStatus('Active');
    }
  }, [airport, visible, defaultCountry]);

  const save = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Required', 'Airport name is required.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        airport_name: name.trim(), code: code.trim() || null, city: city.trim() || null,
        country, type, status,
      };
      const { error } = airport
        ? await supabase.from('safari_airports').update(payload).eq('id', airport.id)
        : await supabase.from('safari_airports').insert(payload);
      if (error) throw error;
      Alert.alert('Saved', airport ? 'Airport updated.' : 'Airport added.');
      onSaved(); onClose();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }, [name, code, city, country, type, status, airport, onSaved, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={gm.header}>
            <Text style={gm.title}>{airport ? 'Edit Airport' : 'Add Airport'}</Text>
            <TouchableOpacity onPress={onClose} style={gm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <FieldLabel label="Airport Name *" /><TextF value={name} onChange={setName} placeholder="e.g. Entebbe International Airport" />
            <FieldLabel label="IATA Code" /><TextF value={code} onChange={setCode} placeholder="EBB" />
            <FieldLabel label="City" /><TextF value={city} onChange={setCity} placeholder="Entebbe" />
            <FieldLabel label="Country" />
            <TouchableOpacity style={gm.selector} onPress={() => setShowStatusPicker(true)}>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>{country}</Text><Ico.ChevDown s={16} c={C.textMuted} />
            </TouchableOpacity>
            <FieldLabel label="Type" />
            <TouchableOpacity style={gm.selector} onPress={() => setShowTypePicker(true)}>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>{type}</Text><Ico.ChevDown s={16} c={C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={[gm.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={gm.saveBtnT}>{airport ? 'Update' : 'Add Airport'}</Text>}
            </TouchableOpacity>
          </ScrollView>
          <PickerModal visible={showTypePicker} title="Airport Type"
            options={['International', 'Domestic', 'Regional'].map(t => ({ value: t, label: t }))}
            selected={type} onSelect={o => setType(o.value)} onClose={() => setShowTypePicker(false)} />
          <PickerModal visible={showStatusPicker} title="Country"
            options={['Uganda', 'Kenya', 'Tanzania', 'Rwanda'].map(c => ({ value: c, label: c }))}
            selected={country} onSelect={o => setCountry(o.value)} onClose={() => setShowStatusPicker(false)} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  International: { bg: '#dce8f5', text: '#1a5a8f' },
  Domestic:      { bg: C.primarySoft, text: C.primary },
  Regional:      { bg: C.goldSoft, text: C.gold },
};

function AirportsTab() {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [editAirport, setEditAirport] = useState<Airport | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchAirports = useCallback(async () => {
    const { data } = await supabase.from('safari_airports').select('*').order('airport_name');
    setAirports((data || []) as Airport[]);
  }, []);

  useEffect(() => { setLoading(true); fetchAirports().finally(() => setLoading(false)); }, [fetchAirports]);

  const deleteAirport = useCallback((a: Airport) => {
    Alert.alert('Delete Airport', `Remove ${a.airport_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('safari_airports').delete().eq('id', a.id);
        fetchAirports();
      }},
    ]);
  }, [fetchAirports]);

  const filtered = useMemo(() => {
    let list = airports;
    if (countryFilter !== 'All') list = list.filter(a => a.country === countryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.airport_name.toLowerCase().includes(q) || a.code?.toLowerCase().includes(q) || a.city?.toLowerCase().includes(q));
    }
    return list;
  }, [airports, countryFilter, search]);

  if (loading) return <LoadingView label="Loading airports…" />;

  return (
    <View style={{ flex: 1 }}>
      <View style={ts.searchWrap}>
        <View style={ts.searchBox}>
          <Ico.Search s={15} c={C.textMuted} />
          <TextInput style={ts.searchInput} value={search} onChangeText={setSearch} placeholder="Search airports, cities, codes…" placeholderTextColor={C.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            blurOnSubmit={false}
            returnKeyType="search"
          />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={ts.chipRow}>
        {['All', 'Uganda', 'Kenya', 'Tanzania', 'Rwanda'].map(c => (
          <TouchableOpacity key={c} style={[ts.chip, countryFilter === c && { backgroundColor: C.primary }]} onPress={() => setCountryFilter(c)}>
            <Text style={[ts.chipT, countryFilter === c ? { color: '#fff' } : { color: C.textMuted }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item: a }) => {
          const typeCfg = TYPE_BADGE[a.type || 'Domestic'] || TYPE_BADGE.Domestic;
          return (
            <View style={apStyle.card}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={apStyle.name}>{a.airport_name}</Text>
                  {a.code ? <View style={apStyle.codeBadge}><Text style={apStyle.codeText}>{a.code}</Text></View> : null}
                </View>
                <Text style={apStyle.city}>{[a.city, a.country].filter(Boolean).join(' · ')}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  {a.type ? <View style={[apStyle.typeBadge, { backgroundColor: typeCfg.bg }]}><Text style={[apStyle.typeText, { color: typeCfg.text }]}>{a.type}</Text></View> : null}
                  <View style={[apStyle.typeBadge, { backgroundColor: a.status === 'Active' ? C.primarySoft : C.input }]}>
                    <Text style={[apStyle.typeText, { color: a.status === 'Active' ? C.primary : C.textMuted }]}>{a.status || 'Active'}</Text>
                  </View>
                </View>
              </View>
              <View style={{ gap: 8 }}>
                <TouchableOpacity style={op.iconBtn} onPress={() => { setEditAirport(a); setShowModal(true); }}>
                  <Ico.Edit s={14} c={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[op.iconBtn, { backgroundColor: '#FFEEED' }]} onPress={() => deleteAirport(a)}>
                  <Ico.Trash s={14} c={C.danger} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<EmptyView title="No airports found" sub="Add airports using the + button below." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
      />
      <TouchableOpacity style={fabStyle.fab} onPress={() => { setEditAirport(null); setShowModal(true); }}>
        <Ico.Plus s={22} c="#fff" />
      </TouchableOpacity>
      <AirportFormModal visible={showModal} airport={editAirport} defaultCountry={countryFilter === 'All' ? 'Uganda' : countryFilter}
        onClose={() => setShowModal(false)} onSaved={fetchAirports} />
    </View>
  );
}

const apStyle = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, gap: 10 },
  name: { fontSize: 14, fontWeight: '800', color: C.text, flex: 1, letterSpacing: -0.2 },
  codeBadge: { backgroundColor: C.hero, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  codeText: { fontSize: 11, fontWeight: '800', color: '#fffaf3', letterSpacing: 1 },
  city: { fontSize: 12, color: C.textMuted },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  typeText: { fontSize: 11, fontWeight: '700' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// HOTELS & LODGES TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface Lodge {
  id: string;
  lodge_name: string;
  destination?: string;
  lodge_type?: string;
  price_double_usd?: number;
  price_single_usd?: number;
  price_sto_double_usd?: number;
  price_sto_single_usd?: number;
  updated_at?: string;
}

function LodgeFormModal({ visible, lodge, onClose, onSaved }: {
  visible: boolean; lodge: Lodge | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [dest, setDest] = useState('');
  const [type, setType] = useState('Lodge');
  const [pDouble, setPDouble] = useState('');
  const [pSingle, setPSingle] = useState('');
  const [pStoDouble, setPStoDouble] = useState('');
  const [pStoSingle, setPStoSingle] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  useEffect(() => {
    if (lodge) {
      setName(lodge.lodge_name || ''); setDest(lodge.destination || ''); setType(lodge.lodge_type || 'Lodge');
      setPDouble(lodge.price_double_usd?.toString() || ''); setPSingle(lodge.price_single_usd?.toString() || '');
      setPStoDouble(lodge.price_sto_double_usd?.toString() || ''); setPStoSingle(lodge.price_sto_single_usd?.toString() || '');
    } else {
      setName(''); setDest(''); setType('Lodge');
      setPDouble(''); setPSingle(''); setPStoDouble(''); setPStoSingle('');
    }
  }, [lodge, visible]);

  const save = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Required', 'Lodge name is required.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        lodge_name: name.trim(), destination: dest.trim() || null, lodge_type: type,
        price_double_usd: pDouble ? parseFloat(pDouble) : null,
        price_single_usd: pSingle ? parseFloat(pSingle) : null,
        price_sto_double_usd: pStoDouble ? parseFloat(pStoDouble) : null,
        price_sto_single_usd: pStoSingle ? parseFloat(pStoSingle) : null,
        updated_at: new Date().toISOString(),
      };
      const { error } = lodge
        ? await supabase.from('safari_lodges').update(payload).eq('id', lodge.id)
        : await supabase.from('safari_lodges').insert(payload);
      if (error) throw error;
      Alert.alert('Saved', lodge ? 'Lodge updated.' : 'Lodge added.');
      onSaved(); onClose();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }, [name, dest, type, pDouble, pSingle, pStoDouble, pStoSingle, lodge, onSaved, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={gm.header}>
            <Text style={gm.title}>{lodge ? 'Edit Lodge' : 'Add Hotel / Lodge'}</Text>
            <TouchableOpacity onPress={onClose} style={gm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            <FieldLabel label="Lodge / Hotel Name *" /><TextF value={name} onChange={setName} placeholder="e.g. Bwindi Forest Lodge" />
            <FieldLabel label="Destination" /><TextF value={dest} onChange={setDest} placeholder="e.g. Bwindi Impenetrable Forest" />
            <FieldLabel label="Type" />
            <TouchableOpacity style={gm.selector} onPress={() => setShowTypePicker(true)}>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>{type}</Text><Ico.ChevDown s={16} c={C.textMuted} />
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 16, marginBottom: 4, fontWeight: '700' }}>RACK RATES (USD)</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel label="Double" /><TextF value={pDouble} onChange={setPDouble} placeholder="350" keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel label="Single" /><TextF value={pSingle} onChange={setPSingle} placeholder="250" keyboardType="decimal-pad" />
              </View>
            </View>
            <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 16, marginBottom: 4, fontWeight: '700' }}>STO / CONTRACT RATES (USD)</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel label="STO Double" /><TextF value={pStoDouble} onChange={setPStoDouble} placeholder="280" keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel label="STO Single" /><TextF value={pStoSingle} onChange={setPStoSingle} placeholder="200" keyboardType="decimal-pad" />
              </View>
            </View>
            <TouchableOpacity style={[gm.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={gm.saveBtnT}>{lodge ? 'Update Lodge' : 'Add Lodge'}</Text>}
            </TouchableOpacity>
          </ScrollView>
          <PickerModal visible={showTypePicker} title="Lodge Type"
            options={['Lodge', 'Hotel', 'Tented Camp', 'Budget Hotel', 'Resort', 'Guesthouse', 'Hostel'].map(t => ({ value: t, label: t }))}
            selected={type} onSelect={o => setType(o.value)} onClose={() => setShowTypePicker(false)} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function HotelsLodgesTab() {
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editLodge, setEditLodge] = useState<Lodge | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchLodges = useCallback(async () => {
    const { data } = await supabase.from('safari_lodges')
      .select('id, destination, lodge_name, lodge_type, price_double_usd, price_single_usd, price_sto_double_usd, price_sto_single_usd, updated_at')
      .order('destination').order('lodge_name');
    setLodges((data || []) as Lodge[]);
  }, []);

  useEffect(() => { setLoading(true); fetchLodges().finally(() => setLoading(false)); }, [fetchLodges]);

  const deleteLodge = useCallback((l: Lodge) => {
    Alert.alert('Delete Lodge', `Remove "${l.lodge_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('safari_lodges').delete().eq('id', l.id);
        fetchLodges();
      }},
    ]);
  }, [fetchLodges]);

  const filtered = useMemo(() => {
    if (!search.trim()) return lodges;
    const q = search.toLowerCase();
    return lodges.filter(l => l.lodge_name.toLowerCase().includes(q) || l.destination?.toLowerCase().includes(q));
  }, [lodges, search]);

  if (loading) return <LoadingView label="Loading hotels & lodges…" />;

  return (
    <View style={{ flex: 1 }}>
      <View style={ts.searchWrap}>
        <View style={ts.searchBox}>
          <Ico.Search s={15} c={C.textMuted} />
          <TextInput style={ts.searchInput} value={search} onChangeText={setSearch} placeholder="Search lodges, destinations…" placeholderTextColor={C.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            blurOnSubmit={false}
            returnKeyType="search"
          />
        </View>
      </View>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item: l }) => (
          <View style={ldStyle.card}>
            <View style={{ flex: 1 }}>
              <Text style={ldStyle.name}>{l.lodge_name}</Text>
              {l.destination ? <Text style={ldStyle.dest}>{l.destination}</Text> : null}
              {l.lodge_type ? <View style={ldStyle.typeBadge}><Text style={ldStyle.typeText}>{l.lodge_type}</Text></View> : null}
              <View style={ldStyle.priceGrid}>
                {l.price_double_usd != null ? <View style={ldStyle.priceBox}><Text style={ldStyle.priceLabel}>Double</Text><Text style={ldStyle.priceVal}>${l.price_double_usd}</Text></View> : null}
                {l.price_single_usd != null ? <View style={ldStyle.priceBox}><Text style={ldStyle.priceLabel}>Single</Text><Text style={ldStyle.priceVal}>${l.price_single_usd}</Text></View> : null}
                {l.price_sto_double_usd != null ? <View style={ldStyle.priceBox}><Text style={ldStyle.priceLabel}>STO Dbl</Text><Text style={[ldStyle.priceVal, { color: C.gold }]}>${l.price_sto_double_usd}</Text></View> : null}
                {l.price_sto_single_usd != null ? <View style={ldStyle.priceBox}><Text style={ldStyle.priceLabel}>STO Sgl</Text><Text style={[ldStyle.priceVal, { color: C.gold }]}>${l.price_sto_single_usd}</Text></View> : null}
              </View>
            </View>
            <View style={{ gap: 8, paddingLeft: 10 }}>
              <TouchableOpacity style={op.iconBtn} onPress={() => { setEditLodge(l); setShowModal(true); }}>
                <Ico.Edit s={14} c={C.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={[op.iconBtn, { backgroundColor: '#FFEEED' }]} onPress={() => deleteLodge(l)}>
                <Ico.Trash s={14} c={C.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyView title="No lodges found" sub="Add hotels & lodges using the + button." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
      />
      <TouchableOpacity style={fabStyle.fab} onPress={() => { setEditLodge(null); setShowModal(true); }}>
        <Ico.Plus s={22} c="#fff" />
      </TouchableOpacity>
      <LodgeFormModal visible={showModal} lodge={editLodge} onClose={() => setShowModal(false)} onSaved={fetchLodges} />
    </View>
  );
}

const ldStyle = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  name: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 2, letterSpacing: -0.2 },
  dest: { fontSize: 12, color: C.textMuted, marginBottom: 6 },
  typeBadge: { backgroundColor: C.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 8 },
  typeText: { fontSize: 11, fontWeight: '700', color: C.primary },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceBox: { backgroundColor: C.input, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 72, alignItems: 'center' },
  priceLabel: { fontSize: 9, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  priceVal: { fontSize: 13, fontWeight: '800', color: C.primary },
});

// ═══════════════════════════════════════════════════════════════════════════════
// NATIONAL PARKS TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface NationalPark {
  id: string;
  park_name: string;
  country?: string;
  region?: string;
  category?: string;
  description?: string;
}

function NationalParksTab() {
  const [parks, setParks] = useState<NationalPark[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editPark, setEditPark] = useState<NationalPark | null>(null);
  // inline edit state
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<NationalPark>>({});
  const [saving, setSaving] = useState(false);

  const fetchParks = useCallback(async () => {
    const { data } = await supabase.from('national_parks').select('*').order('park_name');
    setParks((data || []) as NationalPark[]);
  }, []);

  useEffect(() => { setLoading(true); fetchParks().finally(() => setLoading(false)); }, [fetchParks]);

  const startEdit = (p: NationalPark) => { setEditing(p.id); setEditValues({ park_name: p.park_name, country: p.country, region: p.region, category: p.category, description: p.description }); };
  const cancelEdit = () => { setEditing(null); setEditValues({}); };

  const saveEdit = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('national_parks').update(editValues).eq('id', id);
      if (error) throw error;
      setParks(prev => prev.map(p => p.id === id ? { ...p, ...editValues } : p));
      setEditing(null); setEditValues({});
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }, [editValues]);

  const deletePark = useCallback((p: NationalPark) => {
    Alert.alert('Delete Park', `Remove "${p.park_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('national_parks').delete().eq('id', p.id);
        fetchParks();
      }},
    ]);
  }, [fetchParks]);

  const filtered = useMemo(() => {
    let list = parks;
    if (countryFilter !== 'All') list = list.filter(p => p.country === countryFilter);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(p => p.park_name.toLowerCase().includes(q) || p.region?.toLowerCase().includes(q)); }
    return list;
  }, [parks, countryFilter, search]);

  if (loading) return <LoadingView label="Loading national parks…" />;

  const CAT_COLORS: Record<string, { bg: string; text: string }> = {
    'A+': { bg: '#FFEEED', text: '#CC1400' },
    A: { bg: C.goldSoft, text: C.gold },
    B: { bg: C.primarySoft, text: C.primary },
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={ts.searchWrap}>
        <View style={ts.searchBox}>
          <Ico.Search s={15} c={C.textMuted} />
          <TextInput style={ts.searchInput} value={search} onChangeText={setSearch} placeholder="Search parks, regions…" placeholderTextColor={C.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            blurOnSubmit={false}
            returnKeyType="search"
          />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={ts.chipRow}>
        {['All', 'Uganda', 'Kenya', 'Tanzania', 'Rwanda'].map(c => (
          <TouchableOpacity key={c} style={[ts.chip, countryFilter === c && { backgroundColor: C.primary }]} onPress={() => setCountryFilter(c)}>
            <Text style={[ts.chipT, countryFilter === c ? { color: '#fff' } : { color: C.textMuted }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item: p }) => {
          const isEditing = editing === p.id;
          const catCfg = CAT_COLORS[p.category || ''];
          return (
            <View style={pkStyle.card}>
              {isEditing ? (
                <View style={{ flex: 1 }}>
                  <TextInput style={pkStyle.editInput} value={editValues.park_name || ''} onChangeText={v => setEditValues(e => ({ ...e, park_name: v }))} placeholder="Park name" />
                  <TextInput style={pkStyle.editInput} value={editValues.region || ''} onChangeText={v => setEditValues(e => ({ ...e, region: v }))} placeholder="Region" />
                  <TextInput style={pkStyle.editInput} value={editValues.description || ''} onChangeText={v => setEditValues(e => ({ ...e, description: v }))} placeholder="Description" multiline />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity style={[pkStyle.actionBtn, { backgroundColor: C.primary, flex: 1 }]} onPress={() => saveEdit(p.id)} disabled={saving}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{saving ? '...' : 'Save'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[pkStyle.actionBtn, { backgroundColor: C.input, flex: 1 }]} onPress={cancelEdit}>
                      <Text style={{ color: C.textMuted, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={pkStyle.name}>{p.park_name}</Text>
                      {catCfg ? <View style={[pkStyle.catBadge, { backgroundColor: catCfg.bg }]}><Text style={[pkStyle.catText, { color: catCfg.text }]}>{p.category}</Text></View> : null}
                    </View>
                    {p.region ? <Text style={pkStyle.region}>{p.region}{p.country ? ` · ${p.country}` : ''}</Text> : null}
                    {p.description ? <Text style={pkStyle.desc} numberOfLines={2}>{p.description}</Text> : null}
                  </View>
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity style={op.iconBtn} onPress={() => startEdit(p)}><Ico.Edit s={14} c={C.primary} /></TouchableOpacity>
                    <TouchableOpacity style={[op.iconBtn, { backgroundColor: '#FFEEED' }]} onPress={() => deletePark(p)}><Ico.Trash s={14} c={C.danger} /></TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<EmptyView title="No parks found" sub="Add national parks using the + button." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
      />
      <TouchableOpacity style={fabStyle.fab} onPress={async () => {
        const name = await new Promise<string | null>(res => Alert.prompt ? Alert.prompt('Add Park', 'Enter park name:', res, 'plain-text') : res(null));
        if (!name) return;
        const { error } = await supabase.from('national_parks').insert({ park_name: name.trim(), country: countryFilter === 'All' ? 'Uganda' : countryFilter });
        if (!error) fetchParks();
      }}>
        <Ico.Plus s={22} c="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const pkStyle = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, gap: 10 },
  name: { fontSize: 14, fontWeight: '800', color: C.text, flex: 1, letterSpacing: -0.2 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  catText: { fontSize: 11, fontWeight: '800' },
  region: { fontSize: 12, color: C.textMuted, marginBottom: 4 },
  desc: { fontSize: 12, color: C.textMuted, lineHeight: 17 },
  editInput: { backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: C.text, marginBottom: 6 },
  actionBtn: { paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface PaymentBooking {
  id: string;
  booking_reference: string;
  customer_name?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  total_price_usd?: number;
  amount_paid?: number;
  updated_at?: string;
  clients?: { company_name: string } | null;
  safari_packages?: { name: string; duration_days?: number } | null;
}

function PaymentsTab() {
  const [bookings, setBookings] = useState<PaymentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    supabase.from('safari_bookings')
      .select(`booking_reference, id, customer_name, status, start_date, end_date, total_price_usd, amount_paid, updated_at,
        clients(company_name), safari_packages(name, duration_days)`)
      .gte('amount_paid', 0)
      .order('updated_at', { ascending: false })
      .limit(300)
      .then(({ data }) => { setBookings((data || []) as unknown as PaymentBooking[]); setLoading(false); });
  }, []);

  const fullyPaid = useMemo(() => bookings.filter(b => (b.amount_paid || 0) >= (b.total_price_usd || 0) && (b.total_price_usd || 0) > 0), [bookings]);
  const totalRevenue = useMemo(() => fullyPaid.reduce((s, b) => s + (b.amount_paid || 0), 0), [fullyPaid]);
  const avgValue = fullyPaid.length > 0 ? totalRevenue / fullyPaid.length : 0;
  const activeCount = bookings.filter(b => b.status === 'active').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter(b => b.booking_reference?.toLowerCase().includes(q) || b.customer_name?.toLowerCase().includes(q) || b.clients?.company_name?.toLowerCase().includes(q));
  }, [bookings, search]);

  const getPayStatus = (b: PaymentBooking) => {
    const paid = b.amount_paid || 0; const total = b.total_price_usd || 0;
    if (paid <= 0) return { label: 'Unpaid', color: C.danger };
    if (paid >= total && total > 0) return { label: 'Fully Paid', color: C.success };
    return { label: 'Partial', color: C.gold };
  };

  if (loading) return <LoadingView label="Loading payment records…" />;

  return (
    <View style={{ flex: 1 }}>
      {/* Summary KPIs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
        {[
          { l: 'Fully Paid', v: fullyPaid.length.toString(), c: C.success },
          { l: 'Total Revenue', v: formatCurrency(totalRevenue, 'USD'), c: C.primary },
          { l: 'Avg. Value', v: formatCurrency(avgValue, 'USD'), c: C.primary },
          { l: 'Active', v: activeCount.toString(), c: C.gold },
          { l: 'Completed', v: completedCount.toString(), c: C.textMuted },
        ].map((k, i) => (
          <View key={i} style={paStyle.kpiCard}>
            <Text style={paStyle.kpiLabel}>{k.l}</Text>
            <Text style={[paStyle.kpiValue, { color: k.c }]}>{k.v}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={ts.searchWrap}>
        <View style={ts.searchBox}>
          <Ico.Search s={15} c={C.textMuted} />
          <TextInput style={ts.searchInput} value={search} onChangeText={setSearch} placeholder="Search bookings, customers…" placeholderTextColor={C.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            blurOnSubmit={false}
            returnKeyType="search"
          />
        </View>
      </View>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item: b }) => {
          const ps = getPayStatus(b);
          return (
            <View style={paStyle.card}>
              <View style={[paStyle.statusBar, { backgroundColor: ps.color }]} />
              <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={paStyle.ref}>{b.booking_reference}</Text>
                  <View style={[paStyle.payBadge, { backgroundColor: ps.color + '20' }]}>
                    <Text style={[paStyle.payText, { color: ps.color }]}>{ps.label}</Text>
                  </View>
                </View>
                <Text style={paStyle.client}>{b.clients?.company_name || b.customer_name || '—'}</Text>
                {b.safari_packages?.name ? <Text style={paStyle.pkg}>{b.safari_packages.name}{b.safari_packages.duration_days ? ` · ${b.safari_packages.duration_days} days` : ''}</Text> : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={paStyle.date}>{fmtDate(b.start_date)} → {fmtDate(b.end_date)}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={paStyle.paid}>{formatCurrency(b.amount_paid || 0, 'USD')}</Text>
                    {(b.total_price_usd || 0) > 0 ? <Text style={paStyle.total}>of {formatCurrency(b.total_price_usd || 0, 'USD')}</Text> : null}
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<EmptyView title="No payment records" sub="Payment records appear when safari bookings have amounts." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
      />
    </View>
  );
}

const paStyle = StyleSheet.create({
  kpiCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, minWidth: 120, alignItems: 'center' },
  kpiLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600', marginBottom: 4 },
  kpiValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  card: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  statusBar: { width: 5 },
  ref: { fontSize: 14, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  payBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  payText: { fontSize: 11, fontWeight: '700' },
  client: { fontSize: 13, color: C.textMuted, marginBottom: 2 },
  pkg: { fontSize: 12, color: C.gold, fontWeight: '600' },
  date: { fontSize: 11, color: C.textMuted },
  paid: { fontSize: 14, fontWeight: '800', color: C.success },
  total: { fontSize: 10, color: C.textMuted },
});

// ═══════════════════════════════════════════════════════════════════════════════
// SAFARI CLIENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface SafariClient {
  id: string;
  company_name: string;
  phone_number?: string;
  contact_person?: string;
  email?: string;
  address?: string;
  kyc_status?: string;
  notes?: string;
  created_at?: string;
  client_type?: string;
}

function ClientFormModal({ visible, client, onClose, onSaved }: {
  visible: boolean; client: SafariClient | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [kyc, setKyc] = useState('Incomplete');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showKycPicker, setShowKycPicker] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.company_name || ''); setContact(client.contact_person || '');
      setPhone(client.phone_number || ''); setEmail(client.email || '');
      setAddress(client.address || ''); setKyc(client.kyc_status || 'Incomplete'); setNotes(client.notes || '');
    } else { setName(''); setContact(''); setPhone(''); setEmail(''); setAddress(''); setKyc('Incomplete'); setNotes(''); }
  }, [client, visible]);

  const save = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Required', 'Customer name is required.'); return; }
    if (!email.trim()) { Alert.alert('Required', 'Email is required.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        company_name: name.trim(), contact_person: contact.trim() || null,
        phone_number: phone.trim() || null, email: email.trim(), address: address.trim() || null,
        kyc_status: kyc, notes: notes.trim() || null, updated_at: new Date().toISOString(),
      };
      if (!client) { payload.client_type = 'safari'; payload.created_at = new Date().toISOString(); }
      const { error } = client
        ? await supabase.from('clients').update(payload).eq('id', client.id)
        : await supabase.from('clients').insert(payload);
      if (error) throw error;
      Alert.alert('Saved', client ? 'Client updated.' : 'Client added.');
      onSaved(); onClose();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }, [name, contact, phone, email, address, kyc, notes, client, onSaved, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={gm.header}>
            <Text style={gm.title}>{client ? 'Edit Client' : 'Add Safari Client'}</Text>
            <TouchableOpacity onPress={onClose} style={gm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            <FieldLabel label="Customer Name *" /><TextF value={name} onChange={setName} placeholder="Client or company name" />
            <FieldLabel label="Contact Person" /><TextF value={contact} onChange={setContact} placeholder="Primary contact" />
            <FieldLabel label="Email *" /><TextF value={email} onChange={setEmail} placeholder="email@example.com" keyboardType="email-address" />
            <FieldLabel label="Phone Number" /><TextF value={phone} onChange={setPhone} placeholder="+256 700 000000" keyboardType="phone-pad" />
            <FieldLabel label="Address" /><TextF value={address} onChange={setAddress} placeholder="Physical address…" multiline />
            <FieldLabel label="KYC Status" />
            <TouchableOpacity style={gm.selector} onPress={() => setShowKycPicker(true)}>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>{kyc}</Text><Ico.ChevDown s={16} c={C.textMuted} />
            </TouchableOpacity>
            <FieldLabel label="Notes" /><TextF value={notes} onChange={setNotes} placeholder="Additional notes…" multiline />
            <TouchableOpacity style={[gm.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={gm.saveBtnT}>{client ? 'Update Client' : 'Add Client'}</Text>}
            </TouchableOpacity>
          </ScrollView>
          <PickerModal visible={showKycPicker} title="KYC Status"
            options={[{ value: 'Incomplete', label: 'Incomplete' }, { value: 'Pending Review', label: 'Pending Review' }, { value: 'Complete', label: 'Complete' }]}
            selected={kyc} onSelect={o => setKyc(o.value)} onClose={() => setShowKycPicker(false)} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const KYC_CFG: Record<string, { bg: string; text: string }> = {
  Complete:        { bg: C.primarySoft, text: C.primary },
  'Pending Review':{ bg: C.goldSoft,    text: C.gold    },
  Incomplete:      { bg: '#FFEEED',     text: C.danger  },
};

function ClientHistoryModal({ client, visible, onClose }: {
  client: SafariClient | null; visible: boolean; onClose: () => void;
}) {
  const [bookings, setBookings] = useState<SafariBooking[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !client) return;
    setLoading(true);
    supabase.from('safari_bookings')
      .select('id, booking_reference, status, start_date, end_date, total_price_usd, amount_paid')
      .eq('client_id', client.id)
      .order('start_date', { ascending: false })
      .then(({ data }) => { setBookings((data || []) as unknown as SafariBooking[]); setLoading(false); });
  }, [visible, client?.id]);

  if (!client) return null;
  const lifetimeSpend = bookings.reduce((s, b) => s + (b.total_price_usd || 0), 0);
  const lifetimePaid  = bookings.reduce((s, b) => s + (b.amount_paid || 0), 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={dm.header}>
          <View style={{ flex: 1 }}>
            <Text style={dm.headerRef}>{client.company_name}</Text>
            <Text style={dm.headerSub}>{client.email || client.phone_number || 'Client history'}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={dm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <View style={[paStyle.kpiCard, { flex: 1 }]}>
              <Text style={paStyle.kpiLabel}>Total Bookings</Text>
              <Text style={[paStyle.kpiValue, { color: C.primary, fontSize: 22 }]}>{bookings.length}</Text>
            </View>
            <View style={[paStyle.kpiCard, { flex: 1 }]}>
              <Text style={paStyle.kpiLabel}>Lifetime Value</Text>
              <Text style={[paStyle.kpiValue, { color: C.success, fontSize: 20 }]}>{formatCurrency(lifetimeSpend, 'USD')}</Text>
            </View>
          </View>
          {client.address ? (
            <View style={dm.sect}>
              <Text style={dm.sectTitle}>Contact</Text>
              <View style={dm.detRow}><Text style={dm.detL}>Contact Person</Text><Text style={dm.detV}>{client.contact_person || '—'}</Text></View>
              <View style={dm.detRow}><Text style={dm.detL}>Address</Text><Text style={dm.detV} numberOfLines={2}>{client.address}</Text></View>
            </View>
          ) : null}
          <View style={dm.sect}>
            <Text style={dm.sectTitle}>Booking History</Text>
            {loading ? <LoadingView label="Loading bookings…" /> : bookings.length === 0 ? (
              <Text style={{ color: C.textMuted, textAlign: 'center', paddingVertical: 20, fontSize: 13 }}>No bookings yet for this client</Text>
            ) : bookings.map(b => {
              const st = STATUS_CFG[b.status] || STATUS_CFG.pending;
              return (
                <View key={b.id} style={dm.detRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={dm.detL}>{b.booking_reference || b.id.slice(0, 8)}</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{fmtDate(b.start_date)} → {fmtDate(b.end_date)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={dm.detV}>{formatCurrency(b.total_price_usd || 0, 'USD')}</Text>
                    <View style={[dm.permitBadge, { backgroundColor: st.bg, marginTop: 4 }]}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: st.text }}>{st.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          {lifetimePaid < lifetimeSpend && bookings.length > 0 && (
            <Text style={{ fontSize: 12, color: C.danger, textAlign: 'center', marginTop: 4 }}>
              {formatCurrency(lifetimeSpend - lifetimePaid, 'USD')} outstanding across all bookings
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ClientsTab() {
  const [clients, setClients] = useState<SafariClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editClient, setEditClient] = useState<SafariClient | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [historyClient, setHistoryClient] = useState<SafariClient | null>(null);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase.from('clients')
      .select('id, company_name, phone_number, contact_person, email, address, kyc_status, notes, created_at, client_type')
      .or("client_type.eq.safari,client_type.is.null")
      .order('created_at', { ascending: false });
    setClients((data || []) as SafariClient[]);
  }, []);

  useEffect(() => { setLoading(true); fetchClients().finally(() => setLoading(false)); }, [fetchClients]);

  const deleteClient = useCallback((c: SafariClient) => {
    Alert.alert('Delete Client', `Remove "${c.company_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('clients').delete().eq('id', c.id);
        if (error) { Alert.alert('Cannot Delete', error.message.includes('foreign') ? 'This client has linked safari bookings and cannot be deleted.' : error.message); return; }
        fetchClients();
      }},
    ]);
  }, [fetchClients]);

  const totalCount = clients.length;
  const verifiedCount = clients.filter(c => c.kyc_status === 'Complete').length;
  const pendingCount = clients.filter(c => c.kyc_status === 'Pending Review').length;

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c => c.company_name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone_number?.includes(q));
  }, [clients, search]);

  if (loading) return <LoadingView label="Loading safari clients…" />;

  return (
    <View style={{ flex: 1 }}>
      {/* KPI row */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
        {[
          { l: 'Total Clients', v: totalCount.toString(), c: C.primary },
          { l: 'Verified',      v: verifiedCount.toString(), c: C.success },
          { l: 'Pending KYC',  v: pendingCount.toString(), c: C.gold },
        ].map((k, i) => (
          <View key={i} style={[paStyle.kpiCard, { flex: 1 }]}>
            <Text style={paStyle.kpiLabel}>{k.l}</Text>
            <Text style={[paStyle.kpiValue, { color: k.c, fontSize: 22 }]}>{k.v}</Text>
          </View>
        ))}
      </View>
      <View style={ts.searchWrap}>
        <View style={ts.searchBox}>
          <Ico.Search s={15} c={C.textMuted} />
          <TextInput style={ts.searchInput} value={search} onChangeText={setSearch} placeholder="Search clients, emails…" placeholderTextColor={C.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            blurOnSubmit={false}
            returnKeyType="search"
          />
        </View>
      </View>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item: c }) => {
          const kyc = KYC_CFG[c.kyc_status || 'Incomplete'] || KYC_CFG.Incomplete;
          return (
            <TouchableOpacity style={clStyle.card} onPress={() => setHistoryClient(c)} activeOpacity={0.78}>
              <View style={clStyle.avatar}><Text style={clStyle.avatarT}>{c.company_name?.[0]?.toUpperCase() || '?'}</Text></View>
              <View style={{ flex: 1, paddingHorizontal: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <Text style={clStyle.name} numberOfLines={1}>{c.company_name}</Text>
                  <View style={[clStyle.kycBadge, { backgroundColor: kyc.bg }]}>
                    <Text style={[clStyle.kycText, { color: kyc.text }]}>{c.kyc_status || 'Incomplete'}</Text>
                  </View>
                </View>
                {c.email ? <Text style={clStyle.sub}>{c.email}</Text> : null}
                {c.phone_number ? <Text style={clStyle.sub}>{c.phone_number}</Text> : null}
                {c.contact_person ? <Text style={clStyle.sub}>Contact: {c.contact_person}</Text> : null}
              </View>
              <View style={{ gap: 8 }}>
                <TouchableOpacity style={op.iconBtn} onPress={() => { setEditClient(c); setShowModal(true); }}>
                  <Ico.Edit s={14} c={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[op.iconBtn, { backgroundColor: '#FFEEED' }]} onPress={() => deleteClient(c)}>
                  <Ico.Trash s={14} c={C.danger} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<EmptyView title="No safari clients" sub="Add clients using the + button below." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
      />
      <TouchableOpacity style={fabStyle.fab} onPress={() => { setEditClient(null); setShowModal(true); }}>
        <Ico.Plus s={22} c="#fff" />
      </TouchableOpacity>
      <ClientFormModal visible={showModal} client={editClient} onClose={() => setShowModal(false)} onSaved={fetchClients} />
      <ClientHistoryModal client={historyClient} visible={historyClient != null} onClose={() => setHistoryClient(null)} />
    </View>
  );
}

const clStyle = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarT: { fontSize: 18, fontWeight: '800', color: C.primary },
  name: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },
  kycBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  kycText: { fontSize: 10, fontWeight: '700' },
  sub: { fontSize: 12, color: C.textMuted, marginTop: 1 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

type MainTab = 'bookings' | 'ops' | 'airports' | 'hotels' | 'parks' | 'payments' | 'analytics' | 'clients';

export function SafariManagementScreen() {
  const [tab, setTab] = useState<MainTab>('bookings');
  const insets = useSafeAreaInsets();

  const TABS: { key: MainTab; label: string }[] = [
    { key: 'bookings',  label: 'Bookings' },
    { key: 'ops',       label: 'Operations' },
    { key: 'airports',  label: 'Airports' },
    { key: 'hotels',    label: 'Hotels & Lodges' },
    { key: 'parks',     label: 'Parks' },
    { key: 'payments',  label: 'Payments' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'clients',   label: 'Clients' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Dark hero header */}
      <View style={[sc.hero, { paddingTop: insets.top + 10 }]}>
        <View style={sc.glowL} /><View style={sc.glowR} />
        <Text style={sc.eyebrow}>Operations</Text>
        <Text style={sc.heroTitle}>Safari Management</Text>
        {/* Tab pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[sc.tabPill, tab === t.key && sc.tabPillOn]} onPress={() => setTab(t.key)}>
              <Text style={[sc.tabPillT, tab === t.key && sc.tabPillTOn]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {tab === 'bookings'  && <BookingsTab />}
        {tab === 'ops'       && <OperationsTab />}
        {tab === 'airports'  && <AirportsTab />}
        {tab === 'hotels'    && <HotelsLodgesTab />}
        {tab === 'parks'     && <NationalParksTab />}
        {tab === 'payments'  && <PaymentsTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'clients'   && <ClientsTab />}
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  hero: { backgroundColor: C.hero, paddingHorizontal: 20, paddingBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  glowL: { position: 'absolute', top: -30, left: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: '#4A2E12', opacity: 0.3 },
  glowR: { position: 'absolute', right: -40, bottom: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: '#6c5228', opacity: 0.18 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', color: '#C4A882', marginBottom: 5 },
  heroTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: '#fffaf3', marginBottom: 14 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  tabPillOn: { backgroundColor: C.primary, borderColor: C.primary },
  tabPillT: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  tabPillTOn: { color: '#fff' },
});

export default SafariManagementScreen;
