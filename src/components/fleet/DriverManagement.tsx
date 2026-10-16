/**
 * DriverManagement
 *
 * Fleet > Drivers. Mirrors the web app's Driver Management section — Roster
 * (add/edit drivers), Assign (link a driver to a vehicle), and Performance
 * (ratings, trips, incidents) sub-tabs.
 *
 * Every column/table this reads or writes was confirmed directly against
 * the live Supabase schema before being used here — drivers (full_name,
 * phone, email, license_number, license_expiry, status, rating,
 * total_trips), vehicles.current_driver_id, trip_reviews, driver_incidents.
 * No RPC exists for creating a driver or assigning one to a vehicle — the
 * web app itself writes these tables directly, so mobile mirrors that
 * exact pattern (same as safari_guides/safari_permits elsewhere in this
 * app) rather than inventing a server-side function that doesn't exist.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { devError } from '../../lib/devLog';
import { realtimeManager } from '../../lib/realtimeManager';
import { logEvent } from '../../lib/eventLogger';
import { EmptyState } from '../ui';
import type { Vehicle, Driver, DriverIncident, TripReview } from '../../types/dashboard';
import { getErrorMessage } from '../../lib/errors';

const C = {
  primary: '#8B6B3E',
  success: '#34A853',
  warning: '#F5A623',
  danger: '#FF3B30',
  gold: '#C6A563',
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  textMuted: '#6C6C70',
  border: '#E5E5EA',
  input: '#F2F2F7',
};

// ─── Icons ────────────────────────────────────────────────────────────────────
function PlusIcon({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}
function EditIcon({ size = 14, color = C.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20h9" /><Path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </Svg>
  );
}
function StarIcon({ size = 12, color = C.gold }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
    </Svg>
  );
}
function WarningIcon({ size = 12, color = C.danger }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <Path d="M12 9v4" /><Circle cx="12" cy="17" r="0.5" fill={color} />
    </Svg>
  );
}
function CloseIcon({ size = 18, color = C.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  );
}
function CheckIcon({ size = 16, color = C.success }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

function initialsOf(name: string) {
  return (name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}

// ─── Add / Edit Driver Modal ───────────────────────────────────────────────────
function AddEditDriverModal({ visible, driver, onClose, onSaved }: {
  visible: boolean; driver: Driver | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (driver) {
      setName(driver.full_name || '');
      setPhone(driver.phone || '');
      setEmail(driver.email || '');
      setLicenseNumber(driver.license_number || '');
      setLicenseExpiry(driver.license_expiry ? driver.license_expiry.slice(0, 10) : '');
    } else {
      setName(''); setPhone(''); setEmail(''); setLicenseNumber(''); setLicenseExpiry('');
    }
  }, [driver, visible]);

  const save = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Required', 'Full name is required.'); return; }
    if (licenseExpiry.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(licenseExpiry.trim())) {
      Alert.alert('Invalid Date', 'Enter the license expiry as YYYY-MM-DD.'); return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        full_name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        license_number: licenseNumber.trim() || null,
        license_expiry: licenseExpiry.trim() || null,
      };
      // New drivers start 'available' — status isn't surfaced as an editable
      // field here since its valid values couldn't be confirmed against the
      // live schema; only a safe, already-proven-valid default is set.
      if (!driver) payload.status = 'available';

      const { error } = driver
        ? await supabase.from('drivers').update(payload).eq('id', driver.id)
        : await supabase.from('drivers').insert(payload);
      if (error) throw error;
      Alert.alert('Saved', driver ? 'Driver updated.' : 'Driver added.');
      onSaved(); onClose();
    } catch (e: any) {
      devError('[DriverManagement] save driver error:', e?.message);
      Alert.alert('Error', getErrorMessage(e, 'Failed to save driver.'));
    } finally { setSaving(false); }
  }, [name, phone, email, licenseNumber, licenseExpiry, driver, onSaved, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.background }}>
          <View style={m.header}>
            <Text style={m.title}>{driver ? 'Edit Driver' : 'Add Driver'}</Text>
            <TouchableOpacity onPress={onClose} style={m.closeBtn}><CloseIcon /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={m.label}>Full Name *</Text>
            <TextInput style={m.input} value={name} onChangeText={setName} placeholder="e.g. John Musoke" placeholderTextColor={C.textMuted} />
            <Text style={m.label}>Phone</Text>
            <TextInput style={m.input} value={phone} onChangeText={setPhone} placeholder="+256 700 000000" placeholderTextColor={C.textMuted} keyboardType="phone-pad" />
            <Text style={m.label}>Email</Text>
            <TextInput style={m.input} value={email} onChangeText={setEmail} placeholder="driver@example.com" placeholderTextColor={C.textMuted} keyboardType="email-address" autoCapitalize="none" />
            <Text style={m.label}>License Number</Text>
            <TextInput style={m.input} value={licenseNumber} onChangeText={setLicenseNumber} placeholder="e.g. DL-00123456" placeholderTextColor={C.textMuted} autoCapitalize="characters" />
            <Text style={m.label}>License Expiry (YYYY-MM-DD)</Text>
            <TextInput style={m.input} value={licenseExpiry} onChangeText={setLicenseExpiry} placeholder="2027-06-30" placeholderTextColor={C.textMuted} keyboardType="numbers-and-punctuation" />
            <TouchableOpacity style={[m.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={m.saveBtnT}>{driver ? 'Update Driver' : 'Add Driver'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Assign Driver Picker ───────────────────────────────────────────────────────
function AssignDriverModal({ vehicle, drivers, onClose, onAssign }: {
  vehicle: Vehicle | null; drivers: Driver[]; onClose: () => void; onAssign: (driver: Driver | null) => void;
}) {
  if (!vehicle) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={onClose}>
        <View />
      </TouchableOpacity>
      <View style={m.sheetWrap}>
        <View style={m.sheet}>
          <Text style={m.sheetTitle}>Assign Driver</Text>
          <Text style={m.sheetSub}>{vehicle.license_plate} · {vehicle.make} {vehicle.model}</Text>
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={m.optionRow} onPress={() => onAssign(null)}>
              <Text style={[m.optionText, { color: C.textMuted }]}>Unassigned</Text>
              {!vehicle.current_driver_id && <CheckIcon />}
            </TouchableOpacity>
            {drivers.map(d => (
              <TouchableOpacity key={d.id} style={m.optionRow} onPress={() => onAssign(d)}>
                <Text style={m.optionText}>{d.full_name}</Text>
                {vehicle.current_driver_id === d.id && <CheckIcon />}
              </TouchableOpacity>
            ))}
            {drivers.length === 0 && <Text style={m.sheetSub}>No drivers on file yet — add one from the Roster tab first.</Text>}
          </ScrollView>
          <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
            <Text style={m.cancelBtnT}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  closeBtn: { padding: 8, backgroundColor: C.input, borderRadius: 20 },
  label: { fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text },
  saveBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  saveBtnT: { fontSize: 15, fontWeight: '700', color: '#fff' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  sheetSub: { fontSize: 13, color: C.textMuted, marginTop: 2, marginBottom: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  optionText: { fontSize: 14, fontWeight: '600', color: C.text },
  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  cancelBtnT: { fontSize: 14, fontWeight: '600', color: C.textMuted },
});

// ─── Main component ────────────────────────────────────────────────────────────

type SubTab = 'roster' | 'assign' | 'performance';

export function DriverManagement({ vehicles, onVehiclesChanged }: {
  vehicles: Vehicle[]; onVehiclesChanged: () => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>('roster');
  const [search, setSearch] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [assigningVehicle, setAssigningVehicle] = useState<Vehicle | null>(null);

  const [reviews, setReviews] = useState<TripReview[]>([]);
  const [incidents, setIncidents] = useState<DriverIncident[]>([]);
  const [perfFetched, setPerfFetched] = useState(false);
  const [perfLoading, setPerfLoading] = useState(false);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('drivers')
      .select('id, full_name, phone, email, license_number, license_expiry, status, rating, total_trips, created_at')
      .order('full_name');
    if (error) {
      // A permission/RLS failure here previously looked identical to a
      // genuinely empty roster ("No drivers yet") — surfacing the real
      // error distinguishes "the table has no rows" from "I'm not allowed
      // to read it," which otherwise looks exactly like drivers added on
      // the web never reached mobile.
      devError('[DriverManagement] fetch drivers error:', error.message);
      logEvent('driver_roster_fetch_failed', error.message);
      setDriversError(getErrorMessage(error, 'Failed to load drivers.'));
      setDrivers([]);
    } else {
      setDriversError(null);
      setDrivers((data || []) as Driver[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  // Live sync with web-app edits to the roster — 'drivers' is already a
  // registered table in the shared realtime multiplexer.
  useEffect(() => {
    const unsubscribe = realtimeManager.subscribe(['drivers'], fetchDrivers, 'DriverManagement');
    return unsubscribe;
  }, [fetchDrivers]);

  const fetchPerformanceData = useCallback(async () => {
    setPerfLoading(true);
    const [reviewsRes, incidentsRes] = await Promise.all([
      supabase.from('trip_reviews').select('id, driver_id, rating, client_name, created_at').order('created_at', { ascending: false }),
      supabase.from('driver_incidents').select('id, driver_id, incident_type, status, created_at'),
    ]);
    if (reviewsRes.error) devError('[DriverManagement] fetch trip_reviews error:', reviewsRes.error.message);
    if (incidentsRes.error) devError('[DriverManagement] fetch driver_incidents error:', incidentsRes.error.message);
    setReviews((reviewsRes.data || []) as TripReview[]);
    setIncidents((incidentsRes.data || []) as DriverIncident[]);
    setPerfFetched(true);
    setPerfLoading(false);
  }, []);

  useEffect(() => {
    if (subTab === 'performance' && !perfFetched) fetchPerformanceData();
  }, [subTab, perfFetched, fetchPerformanceData]);

  // Per-driver aggregates computed client-side from trip_reviews/driver_incidents
  // rows — same approach as the Finance Insights card: no new server function,
  // just arithmetic over data already fetched.
  const driverStats = useMemo(() => {
    const map: Record<string, { avgRating: number | null; reviewCount: number; incidentCount: number }> = {};
    drivers.forEach(d => { map[d.id] = { avgRating: null, reviewCount: 0, incidentCount: 0 }; });
    reviews.forEach(r => {
      const s = map[r.driver_id];
      if (!s) return;
      const priorTotal = (s.avgRating ?? 0) * s.reviewCount;
      s.reviewCount += 1;
      s.avgRating = (priorTotal + r.rating) / s.reviewCount;
    });
    incidents.forEach(i => { const s = map[i.driver_id]; if (s) s.incidentCount += 1; });
    return map;
  }, [drivers, reviews, incidents]);

  const vehicleByDriverId = useMemo(() => {
    const map: Record<string, Vehicle> = {};
    vehicles.forEach(v => { if (v.current_driver_id) map[v.current_driver_id] = v; });
    return map;
  }, [vehicles]);

  const filteredDrivers = useMemo(() => {
    if (!search.trim()) return drivers;
    const q = search.toLowerCase();
    return drivers.filter(d =>
      d.full_name.toLowerCase().includes(q) ||
      (d.phone || '').toLowerCase().includes(q) ||
      (d.license_number || '').toLowerCase().includes(q)
    );
  }, [drivers, search]);

  const filteredVehicles = useMemo(() => {
    if (!search.trim()) return vehicles;
    const q = search.toLowerCase();
    return vehicles.filter(v =>
      v.license_plate.toLowerCase().includes(q) ||
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      (v.drivers?.full_name || '').toLowerCase().includes(q)
    );
  }, [vehicles, search]);

  const assignDriver = useCallback(async (vehicle: Vehicle, driver: Driver | null) => {
    const { error } = await supabase.from('vehicles').update({ current_driver_id: driver?.id || null }).eq('id', vehicle.id);
    setAssigningVehicle(null);
    if (error) { Alert.alert('Error', getErrorMessage(error, 'Failed to update assignment.')); return; }
    onVehiclesChanged();
  }, [onVehiclesChanged]);

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tab bar */}
      <View style={s.subBar}>
        {([
          { key: 'roster', label: 'Roster' },
          { key: 'assign', label: 'Assign' },
          { key: 'performance', label: 'Performance' },
        ] as { key: SubTab; label: string }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.subBtn, subTab === t.key && s.subBtnOn]}
            onPress={() => { setSubTab(t.key); setSearch(''); }}
          >
            <Text style={[s.subBtnT, subTab === t.key && s.subBtnTOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={subTab === 'assign' ? 'Search vehicles...' : 'Search drivers...'}
          placeholderTextColor={C.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          blurOnSubmit={false}
          returnKeyType="search"
        />
      </View>

      {/* ROSTER */}
      {subTab === 'roster' && (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filteredDrivers}
          keyExtractor={i => i.id}
          renderItem={({ item: d }) => (
            <View style={s.driverCard}>
              <View style={s.avatar}><Text style={s.avatarT}>{initialsOf(d.full_name)}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.driverName} numberOfLines={1}>{d.full_name}</Text>
                <Text style={s.driverMeta} numberOfLines={1}>
                  {[d.phone, d.license_number ? `Lic. ${d.license_number}` : null].filter(Boolean).join(' · ') || 'No contact info on file'}
                </Text>
              </View>
              {vehicleByDriverId[d.id] && (
                <View style={s.pill}><Text style={s.pillT}>{vehicleByDriverId[d.id].license_plate}</Text></View>
              )}
              <TouchableOpacity style={s.iconBtn} onPress={() => { setEditDriver(d); setShowDriverModal(true); }}>
                <EditIcon />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={!loading ? (
            driversError ? (
              <EmptyState type="fleet" title="Couldn't load drivers" subtitle={driversError} secondaryLabel="Retry" onSecondary={fetchDrivers} />
            ) : (
              <EmptyState type="fleet" title={search ? 'No drivers match' : 'No drivers yet'} subtitle={search ? 'Try a different search.' : 'Add your first driver using the + button.'} />
            )
          ) : null}
          contentContainerStyle={s.listContent}
        />
      )}

      {/* ASSIGN */}
      {subTab === 'assign' && (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filteredVehicles}
          keyExtractor={i => i.id}
          renderItem={({ item: v }) => (
            <View style={s.vehicleCard}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.driverName} numberOfLines={1}>{v.license_plate}</Text>
                <Text style={s.driverMeta} numberOfLines={1}>{v.make} {v.model}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={[s.assignedName, !v.drivers?.full_name && { color: C.textMuted, fontStyle: 'italic' }]}>
                  {v.drivers?.full_name || 'Unassigned'}
                </Text>
                <TouchableOpacity style={s.assignBtn} onPress={() => setAssigningVehicle(v)}>
                  <Text style={s.assignBtnT}>{v.drivers?.full_name ? 'Change' : 'Assign'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyState type="fleet" title={search ? 'No vehicles match' : 'No vehicles yet'} subtitle={search ? 'Try a different search.' : 'Vehicles will appear here once added.'} />}
          contentContainerStyle={s.listContent}
        />
      )}

      {/* PERFORMANCE */}
      {subTab === 'performance' && (
        perfLoading && !perfFetched ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="small" color={C.primary} />
          </View>
        ) : (
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={filteredDrivers}
            keyExtractor={i => i.id}
            renderItem={({ item: d }) => {
              const stat = driverStats[d.id];
              const displayRating = stat?.avgRating ?? d.rating ?? null;
              return (
                <View style={s.driverCard}>
                  <View style={s.avatar}><Text style={s.avatarT}>{initialsOf(d.full_name)}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.driverName} numberOfLines={1}>{d.full_name}</Text>
                    <Text style={s.driverMeta} numberOfLines={1}>
                      {(d.total_trips ?? 0)} trip{d.total_trips === 1 ? '' : 's'}{stat && stat.reviewCount > 0 ? ` · ${stat.reviewCount} review${stat.reviewCount === 1 ? '' : 's'}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    {displayRating != null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <StarIcon /><Text style={s.ratingT}>{displayRating.toFixed(1)}</Text>
                      </View>
                    )}
                    {!!stat?.incidentCount && (
                      <View style={s.incidentPill}>
                        <WarningIcon />
                        <Text style={s.incidentPillT}>{stat.incidentCount} incident{stat.incidentCount === 1 ? '' : 's'}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={<EmptyState type="fleet" title="No drivers yet" subtitle="Performance data appears once drivers are added." />}
            contentContainerStyle={s.listContent}
          />
        )
      )}

      {/* FAB — Roster only */}
      {subTab === 'roster' && (
        <TouchableOpacity style={s.fab} onPress={() => { setEditDriver(null); setShowDriverModal(true); }}>
          <PlusIcon />
        </TouchableOpacity>
      )}

      <AddEditDriverModal
        visible={showDriverModal}
        driver={editDriver}
        onClose={() => setShowDriverModal(false)}
        onSaved={fetchDrivers}
      />
      <AssignDriverModal
        vehicle={assigningVehicle}
        drivers={drivers}
        onClose={() => setAssigningVehicle(null)}
        onAssign={(driver) => assigningVehicle && assignDriver(assigningVehicle, driver)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  subBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, backgroundColor: C.background },
  subBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  subBtnOn: { backgroundColor: C.primary, borderColor: C.primary },
  subBtnT: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  subBtnTOn: { color: '#fff' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 10, backgroundColor: C.background },
  searchInput: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  driverCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary + '18', alignItems: 'center', justifyContent: 'center' },
  avatarT: { fontSize: 15, fontWeight: '800', color: C.primary },
  driverName: { fontSize: 14, fontWeight: '700', color: C.text },
  driverMeta: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  pill: { backgroundColor: C.primary + '15', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  pillT: { fontSize: 11, fontWeight: '700', color: C.primary },
  iconBtn: { padding: 8, backgroundColor: C.input, borderRadius: 10 },
  assignedName: { fontSize: 13, fontWeight: '700', color: C.text },
  assignBtn: { backgroundColor: C.primary + '15', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  assignBtnT: { fontSize: 12, fontWeight: '700', color: C.primary },
  ratingT: { fontSize: 12, fontWeight: '700', color: C.gold },
  incidentPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.danger + '15', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  incidentPillT: { fontSize: 10, fontWeight: '700', color: C.danger },
  fab: { position: 'absolute', bottom: 24, right: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 8 },
});
