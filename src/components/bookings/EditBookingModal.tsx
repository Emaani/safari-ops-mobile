/**
 * EditBookingModal
 * Allows editing of Pending, Confirmed, and In-Progress bookings.
 * Completed and Cancelled bookings are read-only — the Edit button
 * is never shown for those statuses.
 *
 * On save: optimistic close → supabase UPDATE → realtime subscription
 * propagates the change to all connected clients automatically.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Pressable, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Svg, Path, Rect, Circle } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import {
  BOOKING_STATUS_CONFIG,
  ALLOWED_TRANSITIONS,
  getBookingStatusConfig,
} from '../../constants/bookingStatus';
import type { Booking, BookingStatus, Vehicle } from '../../types/dashboard';

// ─── Vehicle status colours ───────────────────────────────────────────────────
const VEHICLE_STATUS_COLOR: Record<string, string> = {
  available:      '#3d8f6a',
  booked:         '#c96d4d',
  rented:         '#8366d7',
  maintenance:    '#b8883f',
  out_of_service: '#6b7280',
};

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
  lock:    '#f5f0e8',
};

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
function CheckIcon({ color = C.success }: { color?: string }) {
  return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round"><Path d="M20 6L9 17l-5-5" /></Svg>;
}
function SearchIcon() {
  return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2} strokeLinecap="round"><Circle cx="11" cy="11" r="8" /><Path d="M21 21l-4.35-4.35" /></Svg>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}
function countDays(start: string, end: string): number {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

// ─── DatePickerField ──────────────────────────────────────────────────────────
function DatePickerField({
  label, value, onChange, minDate,
}: { label: string; value: string; onChange: (iso: string) => void; minDate?: Date }) {
  const [open, setOpen]     = useState(false);
  const [staged, setStaged] = useState<Date>(value ? new Date(value) : new Date());

  const handleOpen    = () => { setStaged(value ? new Date(value) : (minDate ?? new Date())); setOpen(true); };
  const handleConfirm = () => { onChange(toISO(staged)); setOpen(false); };
  const handleChange  = (_: DateTimePickerEvent, d?: Date) => { if (d) setStaged(d); };

  return (
    <>
      <View style={fld.wrap}>
        <Text style={fld.label}>{label}</Text>
        <TouchableOpacity style={[fld.input, open && { borderColor: C.primary }]} onPress={handleOpen} activeOpacity={0.8}>
          <CalendarIcon color={value ? C.primary : C.muted} />
          <Text style={[fld.inputText, !value && { color: C.muted }]}>{value ? fmtDate(value) : 'Select date'}</Text>
          {value && (
            <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <CloseIcon color={C.muted} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={ps.backdrop} onPress={() => setOpen(false)} />
        <View style={ps.sheet}>
          <View style={ps.header}>
            <TouchableOpacity onPress={() => setOpen(false)}><Text style={ps.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={ps.title}>{label}</Text>
            <TouchableOpacity onPress={handleConfirm}><Text style={ps.confirm}>Confirm</Text></TouchableOpacity>
          </View>
          <DateTimePicker value={staged} mode="date" display="inline" onChange={handleChange} minimumDate={minDate} themeVariant="light" accentColor={C.primary} style={{ marginHorizontal: 4 }} />
        </View>
      </Modal>
    </>
  );
}
const ps = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:    { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  title:    { fontSize: 16, fontWeight: '700', color: C.text },
  cancel:   { fontSize: 15, color: C.muted, fontWeight: '600' },
  confirm:  { fontSize: 15, color: C.primary, fontWeight: '800' },
});

const fld = StyleSheet.create({
  wrap:      { marginBottom: 14 },
  label:     { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  inputText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
});

// ─── Status Selector ──────────────────────────────────────────────────────────
function StatusSelector({
  current, allowed, onChange,
}: { current: BookingStatus; allowed: BookingStatus[]; onChange: (s: BookingStatus) => void }) {
  return (
    <View style={fld.wrap}>
      <Text style={fld.label}>Status</Text>
      <View style={st.segRow}>
        {allowed.map(s => {
          const cfg = BOOKING_STATUS_CONFIG[s];
          const active = current === s;
          return (
            <TouchableOpacity
              key={s}
              style={[st.seg, active && { backgroundColor: cfg.bg, borderColor: cfg.dot }]}
              onPress={() => onChange(s)}
            >
              <Text style={[st.segTxt, active && { color: cfg.text, fontWeight: '800' }]}>{cfg.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  segRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  seg:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  segTxt: { fontSize: 12, fontWeight: '600', color: C.muted },
});

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ step, title }: { step: string; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 6 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{step}</Text>
      </View>
      <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, flex: 1 }}>{title}</Text>
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface EditBookingModalProps {
  booking: Booking | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicles: Vehicle[];
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function EditBookingModal({ booking, visible, onClose, onSuccess, vehicles }: EditBookingModalProps) {
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  // Form state
  const [status,       setStatus]       = useState<BookingStatus>('Pending');
  const [startDate,    setStartDate]    = useState('');
  const [endDate,      setEndDate]      = useState('');
  const [packageType,  setPackageType]  = useState('');
  const [dailyRate,    setDailyRate]    = useState('');
  const [totalCost,    setTotalCost]    = useState('');
  const [amountPaid,   setAmountPaid]   = useState('');
  const [currency,     setCurrency]     = useState<'USD'|'UGX'|'KES'>('USD');
  const [vehicleId,    setVehicleId]    = useState('');
  const [notes,        setNotes]        = useState('');
  const [contact,      setContact]      = useState('');
  const [email,        setEmail]        = useState('');

  // Vehicle picker
  const [vehicleSheetOpen,       setVehicleSheetOpen]       = useState(false);
  const [vehicleQuery,           setVehicleQuery]           = useState('');
  const [conflictingVehicleIds,  setConflictingVehicleIds]  = useState<Set<string>>(new Set());
  const [loadingConflicts,       setLoadingConflicts]       = useState(false);

  // Pre-fill from booking whenever it changes
  useEffect(() => {
    if (!booking) return;
    const b = booking as any;
    setStatus(booking.status);
    setStartDate(booking.start_date?.slice(0, 10) ?? '');
    setEndDate(booking.end_date?.slice(0, 10) ?? '');
    setPackageType(b.package_type ?? '');
    setDailyRate(String(b.daily_rate ?? ''));
    setTotalCost(String(booking.total_amount ?? booking.total_cost ?? ''));
    setAmountPaid(String(booking.amount_paid ?? ''));
    setCurrency((booking.currency as 'USD'|'UGX'|'KES') ?? 'USD');
    setVehicleId(booking.assigned_vehicle_id ?? '');
    setNotes(b.notes ?? '');
    setContact(b.contact ?? '');
    setEmail(b.email ?? '');
  }, [booking]);

  // Recalculate total when rate or dates change
  const prevRateRef = useRef('');
  useEffect(() => {
    const rate = parseFloat(dailyRate);
    if (!isNaN(rate) && rate > 0 && startDate && endDate && dailyRate !== prevRateRef.current) {
      const days = countDays(startDate, endDate);
      setTotalCost(String(rate * days));
    }
    prevRateRef.current = dailyRate;
  }, [dailyRate, startDate, endDate]);

  // Fetch vehicles that are already assigned to overlapping bookings
  const fetchConflicts = useCallback(async () => {
    if (!startDate || !endDate || !booking) { setConflictingVehicleIds(new Set()); return; }
    setLoadingConflicts(true);
    try {
      const { data } = await supabase
        .from('bookings')
        .select('assigned_vehicle_id')
        .not('assigned_vehicle_id', 'is', null)
        .not('status', 'in', '("Cancelled","Completed")')
        .neq('id', booking.id)
        .lte('start_date', endDate)
        .gte('end_date', startDate);
      setConflictingVehicleIds(new Set((data ?? []).map((r: any) => r.assigned_vehicle_id as string)));
    } catch {
      setConflictingVehicleIds(new Set());
    } finally {
      setLoadingConflicts(false);
    }
  }, [startDate, endDate, booking]);

  useEffect(() => {
    if (vehicleSheetOpen) fetchConflicts();
  }, [vehicleSheetOpen, fetchConflicts]);

  const handleStartDateChange = useCallback((iso: string) => {
    setStartDate(iso);
    if (endDate && iso && endDate < iso) setEndDate('');
  }, [endDate]);

  const validate = useCallback((): string | null => {
    if (!startDate) return 'Start date is required.';
    if (!endDate)   return 'End date is required.';
    if (endDate < startDate) return 'End date must be on or after start date.';
    const cost = parseFloat(totalCost);
    if (isNaN(cost) || cost <= 0) return 'Total amount must be a positive number.';
    const paid = parseFloat(amountPaid || '0');
    if (isNaN(paid) || paid < 0) return 'Amount paid cannot be negative.';
    if (paid > cost) return 'Amount paid cannot exceed total amount.';
    return null;
  }, [startDate, endDate, totalCost, amountPaid]);

  const handleSave = useCallback(async () => {
    if (!booking) return;
    const err = validate();
    if (err) { Alert.alert('Validation Error', err); return; }

    setSaving(true);
    try {
      // ── Server-side availability gate (mirrors dashboard checkVehicleAvailability) ──
      // Run whenever a vehicle is being newly assigned or changed.
      if (vehicleId && vehicleId !== (booking.assigned_vehicle_id ?? '')) {
        const { data: avail, error: availErr } = await supabase
          .rpc('check_vehicle_availability', {
            p_vehicle_id: vehicleId,
            p_booking_id: booking.id,
          });
        if (!availErr && avail?.[0]?.is_available === false) {
          const conflictRef = avail[0].conflict_booking_reference || 'another booking';
          Alert.alert(
            'Vehicle Unavailable',
            `This vehicle is already assigned to ${conflictRef}. Please select a different vehicle.`,
            [{ text: 'OK' }],
          );
          setSaving(false);
          return;
        }
      }

      const totalAmount  = parseFloat(totalCost);
      const paidAmount   = parseFloat(amountPaid || '0');
      const balanceDue   = totalAmount - paidAmount;
      const numDays      = countDays(startDate, endDate);

      const { error } = await supabase
        .from('bookings')
        .update({
          status,
          start_date:          startDate,
          end_date:            endDate,
          date_range:          `${startDate} to ${endDate}`,
          package_type:        packageType.trim() || undefined,
          daily_rate:          parseFloat(dailyRate) || undefined,
          number_of_days:      numDays,
          total_amount:        totalAmount,
          amount_paid:         paidAmount,
          balance_due:         balanceDue,
          currency,
          assigned_vehicle_id: vehicleId || null,
          notes:               notes.trim() || null,
          contact:             contact.trim() || undefined,
          email:               email.trim() || undefined,
          updated_at:          new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (error) throw error;

      // Mirror dashboard logic exactly:
      // - Completed / Cancelled → release vehicle to 'available'
      // - All other active statuses → mark vehicle 'booked'
      // This runs regardless of whether the vehicle changed, ensuring
      // status-completions/cancellations never leave a vehicle stuck as 'booked'.
      const targetVehicleStatus: 'booked' | 'available' =
        (status === 'Completed' || status === 'Cancelled') ? 'available' : 'booked';

      if (vehicleId) {
        // Update assigned vehicle status based on booking status
        await supabase.from('vehicles').update({ status: targetVehicleStatus }).eq('id', vehicleId);
        // Release the previously-assigned vehicle if it was swapped out
        if (booking.assigned_vehicle_id && vehicleId !== booking.assigned_vehicle_id) {
          await supabase.from('vehicles').update({ status: 'available' }).eq('id', booking.assigned_vehicle_id);
        }
      } else if (booking.assigned_vehicle_id) {
        // Vehicle was unassigned — release it
        await supabase.from('vehicles').update({ status: 'available' }).eq('id', booking.assigned_vehicle_id);
      }

      onSuccess();
      onClose();
      Alert.alert('Booking Updated', `${booking.booking_reference || booking.booking_number || 'Booking'} has been updated successfully.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update booking. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [booking, status, startDate, endDate, packageType, dailyRate, totalCost, amountPaid, currency, vehicleId, notes, contact, email, validate, onSuccess, onClose]);

  if (!booking) return null;

  const allowedStatuses = ALLOWED_TRANSITIONS[booking.status] ?? [];
  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const balance = Math.max(0, (parseFloat(totalCost) || 0) - (parseFloat(amountPaid) || 0));
  const statusCfg = getBookingStatusConfig(booking.status);
  const clientName = (booking as any).client?.company_name || booking.client_name || 'Unknown Client';
  const ref = booking.booking_reference || booking.booking_number || `#${booking.id.slice(0, 8).toUpperCase()}`;

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.container, { paddingTop: insets.top || 12 }]}>

            {/* Header */}
            <View style={s.header}>
              <View>
                <Text style={s.headerEyebrow}>Edit Booking</Text>
                <Text style={s.headerTitle} numberOfLines={1}>{ref} · {clientName}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}><CloseIcon color="#b8ab95" /></TouchableOpacity>
            </View>

            {/* Current status banner */}
            <View style={[s.statusBanner, { backgroundColor: statusCfg.bg }]}>
              <View style={[s.statusDot, { backgroundColor: statusCfg.dot }]} />
              <Text style={[s.statusBannerText, { color: statusCfg.text }]}>
                Current status: {statusCfg.label}
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

              {/* Section 1: Status */}
              <SectionHeader step="1" title="Booking Status" />
              <StatusSelector
                current={status}
                allowed={allowedStatuses}
                onChange={setStatus}
              />

              {/* Section 2: Dates & Package */}
              <View style={s.gap} />
              <SectionHeader step="2" title="Trip Details" />

              <View style={fld.wrap}>
                <Text style={fld.label}>Package Type</Text>
                <TextInput style={s.input} value={packageType} onChangeText={setPackageType} placeholder="e.g. 7-Day Safari Package" placeholderTextColor={C.muted} />
              </View>

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <DatePickerField label="Start Date *" value={startDate} onChange={handleStartDateChange} />
                </View>
                <View style={{ flex: 1 }}>
                  <DatePickerField label="End Date *" value={endDate} onChange={setEndDate} minDate={startDate ? new Date(startDate) : undefined} />
                </View>
              </View>

              {startDate && endDate && (
                <View style={s.dateRangePill}>
                  <CalendarIcon color={C.primary} />
                  <Text style={s.dateRangeText}>
                    {fmtDate(startDate)} → {fmtDate(endDate)}{'  '}
                    <Text style={{ fontWeight: '800' }}>({countDays(startDate, endDate)} days)</Text>
                  </Text>
                </View>
              )}

              {/* Section 3: Pricing */}
              <View style={s.gap} />
              <SectionHeader step="3" title="Pricing & Payment" />

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <View style={fld.wrap}>
                    <Text style={fld.label}>Daily Rate</Text>
                    <TextInput style={s.input} value={dailyRate} onChangeText={setDailyRate} placeholder="0.00" placeholderTextColor={C.muted} keyboardType="decimal-pad" />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={fld.wrap}>
                    <Text style={fld.label}>Total Amount *</Text>
                    <TextInput style={s.input} value={totalCost} onChangeText={setTotalCost} placeholder="0.00" placeholderTextColor={C.muted} keyboardType="decimal-pad" />
                  </View>
                </View>
              </View>

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <View style={fld.wrap}>
                    <Text style={fld.label}>Amount Paid</Text>
                    <TextInput style={s.input} value={amountPaid} onChangeText={setAmountPaid} placeholder="0.00" placeholderTextColor={C.muted} keyboardType="decimal-pad" />
                  </View>
                </View>
                <View style={{ flex: 1, marginBottom: 14 }}>
                  <Text style={fld.label}>Balance Due</Text>
                  <View style={[s.readOnly, balance > 0 && { borderColor: C.danger + '40' }]}>
                    <Text style={[s.readOnlyText, balance > 0 && { color: C.danger }]}>
                      {currency} {balance.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={fld.wrap}>
                <Text style={fld.label}>Currency</Text>
                <View style={st.segRow}>
                  {(['USD','UGX','KES'] as const).map(cur => (
                    <TouchableOpacity key={cur} style={[st.seg, currency === cur && { backgroundColor: C.primary + '18', borderColor: C.primary }]} onPress={() => setCurrency(cur)}>
                      <Text style={[st.segTxt, currency === cur && { color: C.primary, fontWeight: '800' }]}>{cur}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Section 4: Vehicle */}
              <View style={s.gap} />
              <SectionHeader step="4" title="Vehicle Assignment" />

              <View style={fld.wrap}>
                <Text style={fld.label}>Assigned Vehicle (Optional)</Text>
                <TouchableOpacity style={[fld.input, vehicleId && { borderColor: C.primary }]} onPress={() => setVehicleSheetOpen(true)} activeOpacity={0.8}>
                  <TruckIcon color={selectedVehicle ? C.primary : C.muted} />
                  <Text style={[fld.inputText, !selectedVehicle && { color: C.muted }]}>
                    {selectedVehicle
                      ? `${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.license_plate}`
                      : `Tap to browse — ${vehicles.filter(v => v.status === 'available').length} of ${vehicles.length} available`}
                  </Text>
                  {vehicleId && (
                    <TouchableOpacity onPress={() => setVehicleId('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <CloseIcon color={C.muted} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>

              {/* Section 5: Contact & Notes */}
              <View style={s.gap} />
              <SectionHeader step="5" title="Contact & Notes" />

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <View style={fld.wrap}>
                    <Text style={fld.label}>Contact Phone</Text>
                    <TextInput style={s.input} value={contact} onChangeText={setContact} placeholder="+256 700 000 000" placeholderTextColor={C.muted} keyboardType="phone-pad" />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={fld.wrap}>
                    <Text style={fld.label}>Email</Text>
                    <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="client@email.com" placeholderTextColor={C.muted} keyboardType="email-address" autoCapitalize="none" />
                  </View>
                </View>
              </View>

              <View style={fld.wrap}>
                <TextInput style={[s.input, s.textarea]} value={notes} onChangeText={setNotes} placeholder="Special requirements, inclusions, or notes…" placeholderTextColor={C.muted} multiline numberOfLines={3} textAlignVertical="top" />
              </View>

              {/* Save button */}
              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>

              <View style={{ height: insets.bottom + 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Vehicle picker sheet — full search + sort + conflict-aware */}
      <Modal
        visible={vehicleSheetOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setVehicleSheetOpen(false); setVehicleQuery(''); }}
      >
        <View style={[s.container, { paddingTop: insets.top || 16 }]}>
          {/* Dark header */}
          <View style={s.header}>
            <View>
              <Text style={s.headerEyebrow}>Fleet</Text>
              <Text style={s.headerTitle}>Select Vehicle</Text>
            </View>
            <TouchableOpacity onPress={() => { setVehicleSheetOpen(false); setVehicleQuery(''); }} style={s.closeBtn}>
              <CloseIcon color="#b8ab95" />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={s.vpSearchWrap}>
            <SearchIcon />
            <TextInput
              style={s.vpSearchInput}
              value={vehicleQuery}
              onChangeText={setVehicleQuery}
              placeholder="Search make, model, or plate…"
              placeholderTextColor={C.muted}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Availability count row */}
          {(() => {
            const q = vehicleQuery.toLowerCase();
            const filtered = vehicles.filter(v =>
              !q || `${v.make} ${v.model} ${v.license_plate} ${v.capacity}`.toLowerCase().includes(q)
            );
            // Primary sort/count: status === 'available' (matches RPC logic)
            const avail   = filtered.filter(v => v.status === 'available');
            const unavail = filtered.filter(v => v.status !== 'available');
            const ordered = [...avail, ...unavail];

            return (
              <>
                <View style={s.vpCountRow}>
                  <Text style={s.vpCountText}>
                    {loadingConflicts
                      ? 'Checking availability…'
                      : `${avail.length} available · ${unavail.length} unavailable`}
                  </Text>
                  {vehicleId && (
                    <TouchableOpacity onPress={() => { setVehicleId(''); setVehicleSheetOpen(false); setVehicleQuery(''); }}>
                      <Text style={{ fontSize: 12, color: C.danger, fontWeight: '700' }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <FlatList
                  data={ordered}
                  keyExtractor={v => v.id}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                  showsVerticalScrollIndicator={false}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  ListEmptyComponent={
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Text style={{ fontSize: 14, color: C.muted, fontStyle: 'italic' }}>No vehicles match your search</Text>
                    </View>
                  }
                  renderItem={({ item: v }) => {
                    const isSelected  = v.id === vehicleId;
                    const hasConflict = conflictingVehicleIds.has(v.id);
                    // Primary gate: status === 'available' (matches check_vehicle_availability RPC)
                    const isAvail     = v.status === 'available';
                    // Date-conflict badge for extra context on booked vehicles
                    const statusClr   = (hasConflict && !isAvail) ? C.danger : (VEHICLE_STATUS_COLOR[v.status] ?? C.muted);
                    const statusLabel = hasConflict
                      ? 'Conflict'
                      : v.status.charAt(0).toUpperCase() + v.status.slice(1);

                    return (
                      <TouchableOpacity
                        style={[
                          s.vehicleCard,
                          isSelected && s.vehicleCardSelected,
                          !isAvail && !isSelected && { opacity: 0.45 },
                        ]}
                        onPress={() => { setVehicleId(v.id); setVehicleSheetOpen(false); setVehicleQuery(''); }}
                        activeOpacity={0.75}
                        disabled={!isAvail && !isSelected}
                      >
                        <View style={[s.vehicleIcon, { backgroundColor: isSelected ? C.primary + '20' : C.input }]}>
                          <TruckIcon color={isSelected ? C.primary : C.muted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.vehicleName, isSelected && { color: C.primary }]}>
                            {v.make} {v.model}
                          </Text>
                          <Text style={s.vehiclePlate}>{v.license_plate} · {v.capacity}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={[s.statusPill, { backgroundColor: statusClr + '20' }]}>
                            <Text style={[s.statusPillText, { color: statusClr }]}>{statusLabel}</Text>
                          </View>
                          {isSelected && <CheckIcon color={C.primary} />}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            );
          })()}
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, backgroundColor: C.hero },
  headerEyebrow:      { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 2 },
  headerTitle:        { fontSize: 20, fontWeight: '800', color: '#fffaf3', letterSpacing: -0.5, maxWidth: 280 },
  closeBtn:           { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  statusBanner:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  statusDot:          { width: 8, height: 8, borderRadius: 4 },
  statusBannerText:   { fontSize: 13, fontWeight: '700' },
  body:               { padding: 20 },
  row:                { flexDirection: 'row', gap: 12 },
  gap:                { height: 8, marginBottom: 4 },
  input:              { backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border, fontWeight: '500' },
  textarea:           { minHeight: 88, paddingTop: 12 },
  readOnly:           { backgroundColor: C.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border, minHeight: 46, justifyContent: 'center' },
  readOnlyText:       { fontSize: 15, color: C.text, fontWeight: '800' },
  dateRangePill:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary + '10', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: -6, marginBottom: 14, borderWidth: 1, borderColor: C.primary + '25' },
  dateRangeText:      { fontSize: 13, color: C.primary, fontWeight: '600', flex: 1 },
  saveBtn:            { backgroundColor: C.primary, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText:        { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  vehicleCard:        { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border },
  vehicleCardSelected:{ borderColor: C.primary, backgroundColor: C.primary + '08' },
  vehicleIcon:        { width: 42, height: 42, borderRadius: 12, backgroundColor: C.input, alignItems: 'center', justifyContent: 'center' },
  vehicleName:        { fontSize: 15, fontWeight: '700', color: C.text },
  vehiclePlate:       { fontSize: 12, color: C.muted, marginTop: 2 },
  statusPill:         { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText:     { fontSize: 11, fontWeight: '800' },
  // Vehicle picker search + count
  vpSearchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 14, marginHorizontal: 16, marginTop: 14, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: C.border },
  vpSearchInput: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  vpCountRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  vpCountText:   { fontSize: 12, color: C.muted, fontWeight: '600' },
});

export default EditBookingModal;
