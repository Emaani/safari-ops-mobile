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
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import type {
  SafariBooking, SafariGuide, PermitCatalog, SafariPackage, SafariBookingPermit,
} from '../types/safari';

const { width: SW } = Dimensions.get('window');

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:          '#f6f2eb',
  card:        '#fffdf9',
  hero:        '#171513',
  heroMuted:   '#b8ab95',
  primary:     '#1f4d45',
  primarySoft: '#dce8e3',
  gold:        '#b8883f',
  goldSoft:    '#f5e8ce',
  success:     '#3d8f6a',
  danger:      '#c96d4d',
  text:        '#181512',
  textMuted:   '#7f7565',
  border:      '#e1d7c8',
  input:       '#f0ebe2',
};

const STATUS_CFG: Record<string, { bg: string; text: string; label: string }> = {
  draft:     { bg: '#f0ebe2', text: '#7f7565', label: 'Draft' },
  pending:   { bg: '#f5e8ce', text: '#b8883f', label: 'Pending' },
  confirmed: { bg: '#dce8f5', text: '#1a5a8f', label: 'Confirmed' },
  active:    { bg: '#dce8e3', text: '#1f4d45', label: 'Active' },
  completed: { bg: '#ede9e4', text: '#5c5048', label: 'Completed' },
  cancelled: { bg: '#fde8e0', text: '#c96d4d', label: 'Cancelled' },
};
const STATUS_KEYS = ['all', 'draft', 'pending', 'confirmed', 'active', 'completed', 'cancelled'];

const COUNTRIES = ['All', 'Uganda', 'Rwanda', 'Kenya', 'Tanzania', 'Multi-Country'];
const PERMIT_TYPES = ['Park Entry', 'Gorilla Permit', 'Chimp Permit', 'Activity Permit', 'Vehicle Entry', 'Other'];
const GUIDE_STATUSES = ['available', 'busy', 'on_leave', 'inactive'];
const PACKAGE_CATS = ['Wildlife Safari', 'Gorilla Trekking', 'Chimp Tracking', 'Beach & Safari', 'Cultural Tour', 'Adventure', 'Budget Safari', 'Luxury Safari', 'Custom'];

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
function getPaymentLabel(paid = 0, total = 0, deposit = 0): { label: string; color: string } {
  if (paid <= 0) return { label: 'Unpaid', color: C.danger };
  if (paid >= total) return { label: 'Fully Paid', color: C.success };
  if (paid >= deposit) return { label: 'Partial', color: C.gold };
  return { label: 'Deposit Pending', color: C.gold };
}

// ─── Shared tiny components ───────────────────────────────────────────────────
function LoadingView({ label }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 56 }}>
      <ActivityIndicator size="large" color={C.primary} />
      {label ? <Text style={{ marginTop: 12, fontSize: 14, color: C.textMuted }}>{label}</Text> : null}
    </View>
  );
}
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
  card: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border, shadowColor: '#201a13', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
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
  const [subTab, setSubTab] = useState<'overview' | 'ops' | 'permits'>('overview');
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([]);
  const [guides, setGuides] = useState<GuideOpt[]>([]);
  const [permits, setPermits] = useState<SafariBookingPermit[]>([]);
  const [selVehicle, setSelVehicle] = useState<VehicleOpt | null>(null);
  const [selGuide, setSelGuide] = useState<GuideOpt | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingOps, setLoadingOps] = useState(false);
  const [showVPicker, setShowVPicker] = useState(false);
  const [showGPicker, setShowGPicker] = useState(false);

  useEffect(() => {
    if (!visible || !booking) { setSubTab('overview'); return; }
    supabase.from('safari_booking_permits')
      .select('id, status, quantity, cost_per_permit, total_cost, currency, safari_permits(permit_name, permit_type, cost_usd)')
      .eq('booking_id', booking.id)
      .then(({ data }) => setPermits((data || []) as unknown as SafariBookingPermit[]));
  }, [visible, booking?.id]);

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
      if (booking.vehicle_id) setSelVehicle(vs.find(v => v.id === booking.vehicle_id) || null);
      if (booking.guide_id) setSelGuide(gs.find(g => g.id === booking.guide_id) || null);
    }).finally(() => setLoadingOps(false));
  }, [subTab, visible, booking?.id]);

  const saveOps = useCallback(async () => {
    if (!booking) return;
    setSaving(true);
    try {
      const u: Record<string, any> = {};
      if (selVehicle) u.vehicle_id = selVehicle.id;
      if (selGuide) u.guide_id = selGuide.id;
      const { error } = await supabase.from('safari_bookings').update(u).eq('id', booking.id);
      if (error) throw error;
      if (selVehicle && selVehicle.status === 'available') {
        try { await supabase.from('vehicles').update({ status: 'booked' }).eq('id', selVehicle.id); } catch { /* non-fatal */ }
      }
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={dm.header}>
          <View style={{ flex: 1 }}>
            <Text style={dm.headerRef}>{booking.booking_reference || booking.id.slice(0, 10).toUpperCase()}</Text>
            <Text style={dm.headerSub}>{booking.clients?.company_name || booking.customer_name || 'Safari Booking'}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={dm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
        </View>

        {/* Status row */}
        <View style={dm.statusRow}>
          <View style={[dm.stBadge, { backgroundColor: st.bg }]}><Text style={[dm.stText, { color: st.text }]}>{st.label}</Text></View>
          <Text style={dm.duration}>{calcDays(booking.start_date, booking.end_date)}</Text>
          <View style={[dm.payBadge, { backgroundColor: pay.color + '20' }]}><Text style={[dm.payText, { color: pay.color }]}>{pay.label}</Text></View>
        </View>

        {/* Sub-tabs */}
        <View style={dm.subBar}>
          {(['overview', 'ops', 'permits'] as const).map(t => (
            <TouchableOpacity key={t} style={[dm.subTab, subTab === t && dm.subTabOn]} onPress={() => setSubTab(t)}>
              <Text style={[dm.subTabT, subTab === t && dm.subTabTOn]}>
                {t === 'overview' ? 'Overview' : t === 'ops' ? 'Operations' : 'Permits'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          {/* Overview */}
          {subTab === 'overview' && <>
            <View style={dm.sect}>
              <Text style={dm.sectTitle}>Financial Summary</Text>
              {[
                { l: 'Total Revenue', v: formatCurrency(booking.total_price_usd || 0, 'USD'), big: true },
                { l: 'Amount Paid', v: formatCurrency(booking.amount_paid || 0, 'USD'), c: C.success },
                { l: 'Balance Due', v: formatCurrency(balance, 'USD'), c: balance > 0 ? C.danger : C.success },
                booking.deposit_amount ? { l: 'Deposit Required', v: formatCurrency(booking.deposit_amount, 'USD') } : null,
                booking.profit_margin != null ? { l: 'Profit Margin', v: `${(booking.profit_margin).toFixed(1)}%`, c: booking.profit_margin >= 0 ? C.success : C.danger } : null,
              ].filter(Boolean).map((row: any, i) => (
                <View key={i} style={dm.finRow}>
                  <Text style={dm.finL}>{row.l}</Text>
                  <Text style={[dm.finV, row.big && { fontSize: 17, color: C.primary }, row.c && { color: row.c }]}>{row.v}</Text>
                </View>
              ))}
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
              : permits.map(p => (
                <View key={p.id} style={dm.permitRow}>
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
              ))
            }
          </View>}
        </ScrollView>

        <PickerModal visible={showVPicker} title="Select Vehicle"
          options={vehicles.map(v => ({ value: v.id, label: v.license_plate, sub: `${v.make || ''} ${v.model || ''} · ${v.status || ''}`.trim() }))}
          selected={selVehicle?.id} onSelect={o => setSelVehicle(vehicles.find(v => v.id === o.value) || null)} onClose={() => setShowVPicker(false)} />
        <PickerModal visible={showGPicker} title="Select Safari Guide"
          options={guides.map(g => ({ value: g.id, label: g.full_name, sub: g.status }))}
          selected={selGuide?.id} onSelect={o => setSelGuide(guides.find(g => g.id === o.value) || null)} onClose={() => setShowGPicker(false)} />
      </SafeAreaView>
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
});

// ─── Bookings Tab ──────────────────────────────────────────────────────────────
function BookingsTab() {
  const [bookings, setBookings] = useState<SafariBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SafariBooking | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('safari_bookings')
      .select(`id, booking_reference, status, start_date, end_date, pax_count, total_price_usd, deposit_amount, amount_paid, booking_direction, profit_margin, customer_name, customer_email, vehicle_id, guide_id, client_id, package_id, created_at,
        clients(company_name, contact_person), safari_packages(name, category), vehicles(license_plate, make, model), safari_guides(full_name)`)
      .order('created_at', { ascending: false });
    if (error) console.error('[SafariBookings]', error.message);
    setBookings((data || []) as unknown as SafariBooking[]);
  }, []);

  useEffect(() => { setLoading(true); fetch().finally(() => setLoading(false)); }, [fetch]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetch(); setRefreshing(false); }, [fetch]);

  const filtered = useMemo(() => {
    let list = bookings;
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(b => b.booking_reference?.toLowerCase().includes(q) || b.customer_name?.toLowerCase().includes(q) || b.clients?.company_name?.toLowerCase().includes(q));
    }
    return list;
  }, [bookings, statusFilter, search]);

  if (loading) return <LoadingView label="Loading safari bookings…" />;

  return (
    <View style={{ flex: 1 }}>
      {/* Search */}
      <View style={ts.searchWrap}>
        <View style={ts.searchBox}>
          <Ico.Search s={15} c={C.textMuted} />
          <TextInput style={ts.searchInput} value={search} onChangeText={setSearch} placeholder="Search ref, client…" placeholderTextColor={C.textMuted} />
        </View>
      </View>
      {/* Status chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={ts.chipRow}>
        {STATUS_KEYS.map(s => {
          const active = statusFilter === s;
          const count = s === 'all' ? bookings.length : bookings.filter(b => b.status === s).length;
          const col = s === 'all' ? C.primary : (STATUS_CFG[s]?.text || C.textMuted);
          return (
            <TouchableOpacity key={s} style={[ts.chip, active ? { backgroundColor: col } : {}]} onPress={() => setStatusFilter(s)}>
              <Text style={[ts.chipT, active ? { color: '#fff' } : { color: col }]}>
                {s === 'all' ? 'All' : STATUS_CFG[s]?.label} {count > 0 ? `(${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <BookingCard b={item} onPress={() => { setSelected(item); setShowDetail(true); }} />}
        ListEmptyComponent={<EmptyView title="No bookings found" sub="Try adjusting filters or search." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      />
      <BookingDetailModal booking={selected} visible={showDetail} onClose={() => setShowDetail(false)} onRefetch={fetch} />
    </View>
  );
}

const ts = StyleSheet.create({
  searchWrap: { paddingHorizontal: 14, paddingVertical: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: C.text, paddingVertical: 0 },
  chipRow: { paddingHorizontal: 14, paddingVertical: 6, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  chipT: { fontSize: 12, fontWeight: '700' },
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
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
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
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
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
  const [subTab, setSubTab] = useState<'guides' | 'permits'>('guides');
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
      <View style={op.subBar}>
        <TouchableOpacity style={[op.subBtn, subTab === 'guides' && op.subBtnOn]} onPress={() => { setSubTab('guides'); setSearch(''); }}>
          <Text style={[op.subBtnT, subTab === 'guides' && op.subBtnTOn]}>Guides ({guides.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[op.subBtn, subTab === 'permits' && op.subBtnOn]} onPress={() => { setSubTab('permits'); setSearch(''); }}>
          <Text style={[op.subBtnT, subTab === 'permits' && op.subBtnTOn]}>Permit Catalog ({permits.length})</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={ts.searchWrap}>
        <View style={ts.searchBox}>
          <Ico.Search s={15} c={C.textMuted} />
          <TextInput style={ts.searchInput} value={search} onChangeText={setSearch}
            placeholder={subTab === 'guides' ? 'Search guides…' : 'Search permits…'} placeholderTextColor={C.textMuted} />
        </View>
      </View>

      {subTab === 'guides' && (
        <FlatList
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
                  <TouchableOpacity style={[op.iconBtn, { backgroundColor: '#fde8e0' }]} onPress={() => deleteGuide(g)}>
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

      {/* FAB */}
      <TouchableOpacity style={fabStyle.fab} onPress={() => {
        if (subTab === 'guides') { setEditGuide(null); setShowGuideModal(true); }
        else { setEditPermit(null); setShowPermitModal(true); }
      }}>
        <Ico.Plus s={22} c="#fff" />
      </TouchableOpacity>

      <AddEditGuideModal visible={showGuideModal} guide={editGuide} onClose={() => setShowGuideModal(false)} onSaved={fetchGuides} />
      <AddEditPermitModal visible={showPermitModal} permit={editPermit} onClose={() => setShowPermitModal(false)} onSaved={fetchPermits} />
    </View>
  );
}

const op = StyleSheet.create({
  subBar: { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 14 },
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
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
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
              <TouchableOpacity style={[op.iconBtn, { backgroundColor: '#fde8e0' }]} onPress={() => deletePkg(p)}>
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
    supabase.from('safari_bookings')
      .select('id, status, total_price_usd, amount_paid, deposit_amount, profit_margin, created_at, safari_packages(name)')
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
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
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
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

type MainTab = 'bookings' | 'ops' | 'packages' | 'analytics';

export function SafariManagementScreen() {
  const [tab, setTab] = useState<MainTab>('bookings');
  const insets = useSafeAreaInsets();

  const TABS: { key: MainTab; label: string }[] = [
    { key: 'bookings',  label: 'Bookings' },
    { key: 'ops',       label: 'Operations' },
    { key: 'packages',  label: 'Packages' },
    { key: 'analytics', label: 'Analytics' },
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
        {tab === 'packages'  && <PackagesTab />}
        {tab === 'analytics' && <AnalyticsTab />}
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  hero: { backgroundColor: C.hero, paddingHorizontal: 20, paddingBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  glowL: { position: 'absolute', top: -30, left: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: '#264a42', opacity: 0.3 },
  glowR: { position: 'absolute', right: -40, bottom: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: '#6c5228', opacity: 0.18 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 5 },
  heroTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: '#fffaf3', marginBottom: 14 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  tabPillOn: { backgroundColor: C.primary, borderColor: C.primary },
  tabPillT: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  tabPillTOn: { color: '#fff' },
});

export default SafariManagementScreen;
