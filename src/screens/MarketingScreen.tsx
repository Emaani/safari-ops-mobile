/**
 * MarketingScreen — Portal Marketing & Visibility Control
 * Mirrors the Jackal Dashboard → Portal Marketing Admin tab.
 *
 * Tabs:
 *  1. Vehicle Catalog  — Toggle portal visibility per vehicle
 *  2. Safari Catalog   — Toggle portal visibility per safari package
 *  3. Promotions       — Create / toggle active / delete promotional banners
 */

import React, {
  useState, useCallback, useEffect, useMemo, useRef,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert,
  Switch, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { LoadingView } from '../components/system/JackalLoader';
import { formatCurrency } from '../lib/utils';
import type { PortalVehicle, Promotion, SafariPackage } from '../types/safari';
import { useGA4Analytics, type DatePreset } from '../hooks/useGA4Analytics';
import { useBlogAnalytics } from '../hooks/useBlogAnalytics';

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

const PROMO_TYPES = ['banner', 'featured_safari', 'featured_vehicle', 'seasonal', 'partner'];

// ─── Icons ─────────────────────────────────────────────────────────────────────
const Ico = {
  Close: ({ s = 20, c = C.textMuted }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  ),
  Plus: ({ s = 22, c = '#fff' }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Globe: ({ s = 18, c = C.primary }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Circle cx="12" cy="12" r="10" />
      <Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Svg>
  ),
  Eye: ({ s = 16, c = C.success }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  EyeOff: ({ s = 16, c = C.textMuted }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
    </Svg>
  ),
  Trash: ({ s = 16, c = C.danger }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2" />
    </Svg>
  ),
  ChevDown: ({ s = 16, c = C.textMuted }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  ),
  Tag: ({ s = 16, c = C.gold }) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <Circle cx="7" cy="7" r="1" fill={c} />
    </Svg>
  ),
};

// ─── Shared ───────────────────────────────────────────────────────────────────
function EmptyView({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Ico.Globe s={28} c={C.textMuted} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 }}>{sub}</Text> : null}
    </View>
  );
}

// Picker
interface PickerOpt { value: string; label: string }
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
          <ScrollView style={{ maxHeight: 300 }}>
            {options.map(o => (
              <TouchableOpacity key={o.value} style={[pk.opt, selected === o.value && pk.optOn]} onPress={() => { onSelect(o); onClose(); }}>
                <Text style={[pk.optT, selected === o.value && { color: C.primary, fontWeight: '700' }]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
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
  optOn: { backgroundColor: C.primarySoft + '50', borderRadius: 8, paddingHorizontal: 8 },
  optT: { fontSize: 15, color: C.text },
});

function FieldLabel({ label }: { label: string }) {
  return <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 }}>{label}</Text>;
}
function TextF({ value, onChange, placeholder, keyboardType, multiline }: {
  value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: any; multiline?: boolean;
}) {
  return (
    <TextInput
      style={[{ backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text }, multiline && { height: 80, textAlignVertical: 'top' }]}
      value={value} onChangeText={onChange} placeholder={placeholder || ''} placeholderTextColor={C.textMuted}
      keyboardType={keyboardType || 'default'} multiline={multiline}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE PORTAL EDIT MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const PORTAL_CATEGORIES = ['Safari 4x4', 'Luxury SUV', 'Minibus', 'Budget 4x4', 'Van', 'Sedan', 'Other'];

function VehicleEditModal({ vehicle, visible, onClose, onSaved }: {
  vehicle: PortalVehicle | null; visible: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);

  useEffect(() => {
    if (vehicle && visible) {
      setCategory(vehicle.portal_category || '');
      setDescription(vehicle.portal_description || '');
      setImageUrl(vehicle.portal_image_url || '');
      setDailyRate(vehicle.daily_rate_usd ? String(vehicle.daily_rate_usd) : '');
    }
  }, [vehicle, visible]);

  const save = useCallback(async () => {
    if (!vehicle) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('vehicles').update({
        portal_category: category.trim() || null,
        portal_description: description.trim() || null,
        portal_image_url: imageUrl.trim() || null,
        daily_rate_usd: dailyRate ? parseFloat(dailyRate) : null,
      }).eq('id', vehicle.id);
      if (error) throw error;
      onSaved(); onClose();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }, [vehicle, category, description, imageUrl, dailyRate, onSaved, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={pm.header}>
            <Text style={pm.headerTitle}>{vehicle?.license_plate} — Portal Settings</Text>
            <TouchableOpacity onPress={onClose} style={pm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            <View style={{ backgroundColor: C.primarySoft, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: C.primary, fontWeight: '600' }}>
                {vehicle?.make} {vehicle?.model}{vehicle?.capacity ? ` · ${vehicle.capacity} seats` : ''}
              </Text>
            </View>
            <FieldLabel label="Portal Category" />
            <TouchableOpacity style={pm.selector} onPress={() => setShowCatPicker(true)}>
              <Text style={{ flex: 1, fontSize: 14, color: category ? C.text : C.textMuted }}>{category || 'Select category…'}</Text>
              <Ico.ChevDown s={16} c={C.textMuted} />
            </TouchableOpacity>
            <FieldLabel label="Portal Description" />
            <TextF value={description} onChange={setDescription} placeholder="Brief description shown on the customer portal…" multiline />
            <FieldLabel label="Portal Image URL" />
            <TextF value={imageUrl} onChange={setImageUrl} placeholder="https://…" keyboardType="url" />
            <FieldLabel label="Daily Rate (USD)" />
            <TextF value={dailyRate} onChange={setDailyRate} placeholder="0.00" keyboardType="decimal-pad" />
            <TouchableOpacity style={[pm.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={pm.saveBtnT}>Save Portal Settings</Text>}
            </TouchableOpacity>
          </ScrollView>
          <PickerModal visible={showCatPicker} title="Portal Category"
            options={PORTAL_CATEGORIES.map(c => ({ value: c, label: c }))}
            selected={category} onSelect={o => setCategory(o.value)} onClose={() => setShowCatPicker(false)} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE CATALOG TAB
// ═══════════════════════════════════════════════════════════════════════════════

function VehicleCatalogTab() {
  const [vehicles, setVehicles] = useState<PortalVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [editVehicle, setEditVehicle] = useState<PortalVehicle | null>(null);

  const fetchVehicles = useCallback(async () => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, license_plate, make, model, capacity, status, portal_visible, portal_description, portal_image_url, portal_category, daily_rate_usd')
      .order('license_plate');
    if (error) console.error('[Marketing/Vehicles]', error.message);
    setVehicles((data || []) as PortalVehicle[]);
  }, []);

  useEffect(() => { setLoading(true); fetchVehicles().finally(() => setLoading(false)); }, [fetchVehicles]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchVehicles(); setRefreshing(false); }, [fetchVehicles]);

  const toggleVisibility = useCallback(async (v: PortalVehicle) => {
    setToggling(t => ({ ...t, [v.id]: true }));
    const newVal = !v.portal_visible;
    try {
      const { error } = await supabase.from('vehicles').update({ portal_visible: newVal }).eq('id', v.id);
      if (error) throw error;
      setVehicles(prev => prev.map(x => x.id === v.id ? { ...x, portal_visible: newVal } : x));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update visibility.');
    } finally {
      setToggling(t => { const n = { ...t }; delete n[v.id]; return n; });
    }
  }, []);

  const visibleCount = vehicles.filter(v => v.portal_visible).length;

  if (loading) return <LoadingView label="Loading vehicle catalog…" />;

  return (
    <View style={{ flex: 1 }}>
      <View style={vc.banner}>
        <Ico.Globe s={16} c={C.primary} />
        <Text style={vc.bannerText}>{visibleCount} of {vehicles.length} vehicles visible on customer portal</Text>
      </View>
      <FlatList
        data={vehicles}
        keyExtractor={i => i.id}
        renderItem={({ item: v }) => (
          <TouchableOpacity style={vc.card} onPress={() => setEditVehicle(v)} activeOpacity={0.82}>
            <View style={[vc.statusDot, { backgroundColor: v.status === 'available' ? C.success + '20' : C.gold + '20' }]}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: v.status === 'available' ? C.success : C.gold }}>{v.status?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={vc.plate}>{v.license_plate}</Text>
              <Text style={vc.model}>{v.make} {v.model}{v.capacity ? ` · ${v.capacity}` : ''}</Text>
              {v.portal_category ? <Text style={vc.cat}>{v.portal_category}</Text> : null}
              {v.daily_rate_usd ? <Text style={vc.rate}>{formatCurrency(v.daily_rate_usd, 'USD')} / day</Text> : null}
              {v.portal_description ? <Text style={vc.desc} numberOfLines={1}>{v.portal_description}</Text> : null}
            </View>
            <View style={vc.toggleWrap}>
              {toggling[v.id]
                ? <ActivityIndicator size="small" color={C.primary} />
                : <>
                  {v.portal_visible ? <Ico.Eye s={15} c={C.success} /> : <Ico.EyeOff s={15} c={C.textMuted} />}
                  <Switch
                    value={!!v.portal_visible}
                    onValueChange={() => toggleVisibility(v)}
                    trackColor={{ false: C.border, true: C.primary }}
                    thumbColor="#fff"
                    style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                  />
                </>
              }
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyView title="No vehicles found" sub="Add vehicles in the Fleet tab first." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      />
      <VehicleEditModal visible={!!editVehicle} vehicle={editVehicle} onClose={() => setEditVehicle(null)} onSaved={fetchVehicles} />
    </View>
  );
}

const vc = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primarySoft, marginHorizontal: 14, marginVertical: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  bannerText: { fontSize: 13, color: C.primary, fontWeight: '600', flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  statusDot: { width: 56, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  plate: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  model: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  cat: { fontSize: 11, color: C.gold, fontWeight: '600', marginTop: 3 },
  rate: { fontSize: 12, fontWeight: '700', color: C.primary, marginTop: 3 },
  desc: { fontSize: 11, color: C.textMuted, marginTop: 3, fontStyle: 'italic' },
  toggleWrap: { alignItems: 'center', gap: 4 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// SAFARI PACKAGE PORTAL EDIT MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function PackageEditModal({ pkg, visible, onClose, onSaved }: {
  pkg: SafariPackage | null; visible: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [highlight, setHighlight] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pkg && visible) {
      setHighlight(pkg.portal_highlight || '');
      setImageUrl(pkg.portal_image_url || '');
    }
  }, [pkg, visible]);

  const save = useCallback(async () => {
    if (!pkg) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('safari_packages').update({
        portal_highlight: highlight.trim() || null,
        portal_image_url: imageUrl.trim() || null,
      }).eq('id', pkg.id);
      if (error) throw error;
      onSaved(); onClose();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }, [pkg, highlight, imageUrl, onSaved, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={pm.header}>
            <Text style={pm.headerTitle} numberOfLines={1}>{pkg?.name} — Portal</Text>
            <TouchableOpacity onPress={onClose} style={pm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            <View style={{ backgroundColor: C.primarySoft, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: C.primary, fontWeight: '600' }}>
                {pkg?.category}{pkg?.country ? ` · ${pkg.country}` : ''}{pkg?.duration_days ? ` · ${pkg.duration_days} days` : ''}
              </Text>
            </View>
            <FieldLabel label="Portal Highlight" />
            <TextF value={highlight} onChange={setHighlight} placeholder="e.g. Best gorilla trekking experience in Uganda" />
            <FieldLabel label="Portal Image URL" />
            <TextF value={imageUrl} onChange={setImageUrl} placeholder="https://…" keyboardType="url" />
            <TouchableOpacity style={[pm.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={pm.saveBtnT}>Save Portal Settings</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAFARI CATALOG TAB
// ═══════════════════════════════════════════════════════════════════════════════

function SafariCatalogTab() {
  const [packages, setPackages] = useState<SafariPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [editPkg, setEditPkg] = useState<SafariPackage | null>(null);

  const fetchPkgs = useCallback(async () => {
    const { data, error } = await supabase
      .from('safari_packages')
      .select('id, package_code, name, description, category, country, duration_days, price_usd, is_active, portal_visible, portal_highlight, portal_image_url')
      .order('name');
    if (error) console.error('[Marketing/Packages]', error.message);
    setPackages((data || []) as SafariPackage[]);
  }, []);

  useEffect(() => { setLoading(true); fetchPkgs().finally(() => setLoading(false)); }, [fetchPkgs]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchPkgs(); setRefreshing(false); }, [fetchPkgs]);

  const toggleVisibility = useCallback(async (p: SafariPackage) => {
    setToggling(t => ({ ...t, [p.id]: true }));
    const newVal = !p.portal_visible;
    try {
      const { error } = await supabase.from('safari_packages').update({ portal_visible: newVal }).eq('id', p.id);
      if (error) throw error;
      setPackages(prev => prev.map(x => x.id === p.id ? { ...x, portal_visible: newVal } : x));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update visibility.');
    } finally {
      setToggling(t => { const n = { ...t }; delete n[p.id]; return n; });
    }
  }, []);

  const visibleCount = packages.filter(p => p.portal_visible).length;

  if (loading) return <LoadingView label="Loading safari packages…" />;

  return (
    <View style={{ flex: 1 }}>
      <View style={vc.banner}>
        <Ico.Globe s={16} c={C.primary} />
        <Text style={vc.bannerText}>{visibleCount} of {packages.length} packages visible on portal</Text>
      </View>
      <FlatList
        data={packages}
        keyExtractor={i => i.id}
        renderItem={({ item: p }) => (
          <TouchableOpacity style={sc2.card} onPress={() => setEditPkg(p)} activeOpacity={0.82}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text style={sc2.name} numberOfLines={1}>{p.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                {p.category ? <View style={sc2.tag}><Text style={sc2.tagT}>{p.category}</Text></View> : null}
                {p.country ? <View style={[sc2.tag, { backgroundColor: C.goldSoft }]}><Text style={[sc2.tagT, { color: C.gold }]}>{p.country}</Text></View> : null}
                {!p.is_active ? <View style={[sc2.tag, { backgroundColor: '#fde8e0' }]}><Text style={[sc2.tagT, { color: C.danger }]}>Inactive</Text></View> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {p.duration_days ? <Text style={sc2.meta}>{p.duration_days} days</Text> : null}
                {p.price_usd ? <Text style={sc2.price}>{formatCurrency(p.price_usd, 'USD')}</Text> : null}
              </View>
              {p.portal_highlight ? <Text style={sc2.highlight} numberOfLines={1}>★ {p.portal_highlight}</Text> : null}
            </View>
            <View style={vc.toggleWrap}>
              {toggling[p.id]
                ? <ActivityIndicator size="small" color={C.primary} />
                : <>
                  {p.portal_visible ? <Ico.Eye s={15} c={C.success} /> : <Ico.EyeOff s={15} c={C.textMuted} />}
                  <Switch
                    value={!!p.portal_visible}
                    onValueChange={() => toggleVisibility(p)}
                    trackColor={{ false: C.border, true: C.primary }}
                    thumbColor="#fff"
                    style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                  />
                </>
              }
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyView title="No packages found" sub="Create safari packages in the Safari Management screen." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      />
      <PackageEditModal visible={!!editPkg} pkg={editPkg} onClose={() => setEditPkg(null)} onSaved={fetchPkgs} />
    </View>
  );
}

const sc2 = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, gap: 10 },
  name: { fontSize: 14, fontWeight: '800', color: C.text, flex: 1, letterSpacing: -0.2 },
  tag: { backgroundColor: C.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  tagT: { fontSize: 11, fontWeight: '700', color: C.primary },
  meta: { fontSize: 12, color: C.textMuted },
  price: { fontSize: 13, fontWeight: '800', color: C.primary },
  highlight: { fontSize: 11, color: C.gold, marginTop: 4, fontStyle: 'italic' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE PROMOTION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function CreatePromotionModal({ visible, onClose, onSaved }: {
  visible: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [desc, setDesc] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [promoType, setPromoType] = useState('banner');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(''); setSubtitle(''); setDesc(''); setImageUrl('');
      setPromoType('banner'); setDisplayOrder('0'); setStartDate(''); setEndDate('');
    }
  }, [visible]);

  const save = useCallback(async () => {
    if (!title.trim()) { Alert.alert('Required', 'Promotion title is required.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        title: title.trim(), subtitle: subtitle.trim() || null, description: desc.trim() || null,
        image_url: imageUrl.trim() || null, promotion_type: promoType,
        display_order: displayOrder ? parseInt(displayOrder) : 0,
        start_date: startDate.trim() || null, end_date: endDate.trim() || null,
        is_active: true,
      };
      const { error } = await supabase.from('portal_promotions').insert(payload);
      if (error) throw error;
      Alert.alert('Created', `"${title}" promotion is now live.`);
      onSaved(); onClose();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to create promotion.'); }
    finally { setSaving(false); }
  }, [title, subtitle, desc, imageUrl, promoType, displayOrder, startDate, endDate, onSaved, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={pm.header}>
            <Text style={pm.headerTitle}>New Promotion</Text>
            <TouchableOpacity onPress={onClose} style={pm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            <FieldLabel label="Title *" />
            <TextF value={title} onChange={setTitle} placeholder="e.g. Gorilla Safari Special" />

            <FieldLabel label="Subtitle" />
            <TextF value={subtitle} onChange={setSubtitle} placeholder="e.g. Limited slots – book now" />

            <FieldLabel label="Description" />
            <TextF value={desc} onChange={setDesc} placeholder="Full promotion details…" multiline />

            <FieldLabel label="Image URL" />
            <TextF value={imageUrl} onChange={setImageUrl} placeholder="https://…" keyboardType="url" />

            <FieldLabel label="Promotion Type" />
            <TouchableOpacity style={pm.selector} onPress={() => setShowTypePicker(true)}>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>{promoType.replace('_', ' ')}</Text>
              <Ico.ChevDown s={16} c={C.textMuted} />
            </TouchableOpacity>

            <FieldLabel label="Display Order" />
            <TextF value={displayOrder} onChange={setDisplayOrder} placeholder="0" keyboardType="number-pad" />

            <FieldLabel label="Start Date (YYYY-MM-DD)" />
            <TextF value={startDate} onChange={setStartDate} placeholder="2025-06-01" />

            <FieldLabel label="End Date (YYYY-MM-DD)" />
            <TextF value={endDate} onChange={setEndDate} placeholder="2025-12-31" />

            <TouchableOpacity style={[pm.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={pm.saveBtnT}>Create Promotion</Text>}
            </TouchableOpacity>
          </ScrollView>
          <PickerModal visible={showTypePicker} title="Promotion Type"
            options={PROMO_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ') }))}
            selected={promoType} onSelect={o => setPromoType(o.value)} onClose={() => setShowTypePicker(false)} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const pm = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  closeBtn: { padding: 8, backgroundColor: C.input, borderRadius: 20 },
  selector: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  saveBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  saveBtnT: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROMOTIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  banner:           { bg: '#dce8f5', text: '#1a5a8f' },
  featured_safari:  { bg: C.primarySoft, text: C.primary },
  featured_vehicle: { bg: C.goldSoft, text: C.gold },
  seasonal:         { bg: '#f5dce8', text: '#8f1a5a' },
  partner:          { bg: '#e8f5dc', text: '#5a8f1a' },
};

function PromotionsTab() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchPromos = useCallback(async () => {
    const { data, error } = await supabase
      .from('portal_promotions')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) console.error('[Marketing/Promos]', error.message);
    setPromotions((data || []) as Promotion[]);
  }, []);

  useEffect(() => { setLoading(true); fetchPromos().finally(() => setLoading(false)); }, [fetchPromos]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchPromos(); setRefreshing(false); }, [fetchPromos]);

  const toggleActive = useCallback(async (p: Promotion) => {
    setToggling(t => ({ ...t, [p.id]: true }));
    const newVal = !p.is_active;
    try {
      const { error } = await supabase.from('portal_promotions').update({ is_active: newVal }).eq('id', p.id);
      if (error) throw error;
      setPromotions(prev => prev.map(x => x.id === p.id ? { ...x, is_active: newVal } : x));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update.');
    } finally {
      setToggling(t => { const n = { ...t }; delete n[p.id]; return n; });
    }
  }, []);

  const deletePromo = useCallback((p: Promotion) => {
    Alert.alert('Delete Promotion', `Remove "${p.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('portal_promotions').delete().eq('id', p.id);
        if (error) Alert.alert('Error', error.message);
        fetchPromos();
      }},
    ]);
  }, [fetchPromos]);

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  if (loading) return <LoadingView label="Loading promotions…" />;

  const activeCount = promotions.filter(p => p.is_active).length;

  return (
    <View style={{ flex: 1 }}>
      <View style={vc.banner}>
        <Ico.Tag s={16} c={C.gold} />
        <Text style={[vc.bannerText, { color: C.gold }]}>{activeCount} active promotion{activeCount !== 1 ? 's' : ''} on portal</Text>
      </View>
      <FlatList
        data={promotions}
        keyExtractor={i => i.id}
        renderItem={({ item: p }) => {
          const typeCfg = TYPE_COLORS[p.promotion_type] || { bg: C.input, text: C.textMuted };
          return (
            <View style={pr.card}>
              {/* Left: type badge + order */}
              <View style={pr.left}>
                <View style={[pr.typeBadge, { backgroundColor: typeCfg.bg }]}>
                  <Text style={[pr.typeText, { color: typeCfg.text }]}>{p.promotion_type.replace(/_/g, '\n')}</Text>
                </View>
                {p.display_order != null ? <Text style={pr.order}>#{p.display_order}</Text> : null}
              </View>
              {/* Center: title + dates */}
              <View style={{ flex: 1, paddingHorizontal: 12 }}>
                <Text style={pr.title} numberOfLines={1}>{p.title}</Text>
                {p.subtitle ? <Text style={pr.sub} numberOfLines={1}>{p.subtitle}</Text> : null}
                {p.start_date || p.end_date ? (
                  <Text style={pr.dates}>
                    {fmtDate(p.start_date) || '—'} → {fmtDate(p.end_date) || '—'}
                  </Text>
                ) : null}
              </View>
              {/* Right: toggle + delete */}
              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={[pr.activeBadge, { backgroundColor: p.is_active ? C.success + '20' : C.danger + '20' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: p.is_active ? C.success : C.danger }}>{p.is_active ? 'LIVE' : 'OFF'}</Text>
                </View>
                {toggling[p.id]
                  ? <ActivityIndicator size="small" color={C.primary} />
                  : <Switch
                      value={p.is_active}
                      onValueChange={() => toggleActive(p)}
                      trackColor={{ false: C.border, true: C.primary }}
                      thumbColor="#fff"
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                }
                <TouchableOpacity style={pr.delBtn} onPress={() => deletePromo(p)}>
                  <Ico.Trash s={14} c={C.danger} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<EmptyView title="No promotions yet" sub="Create your first portal promotion using the + button." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      />

      {/* FAB */}
      <TouchableOpacity style={fabSt.fab} onPress={() => setShowCreateModal(true)}>
        <Ico.Plus s={22} c="#fff" />
      </TouchableOpacity>

      <CreatePromotionModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onSaved={fetchPromos} />
    </View>
  );
}

const pr = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  left: { alignItems: 'center', gap: 6, width: 56 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10, alignItems: 'center' },
  typeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', textAlign: 'center', lineHeight: 12 },
  order: { fontSize: 11, color: C.textMuted, fontWeight: '700' },
  title: { fontSize: 14, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  sub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  dates: { fontSize: 11, color: C.textMuted, marginTop: 4 },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  delBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fde8e0', alignItems: 'center', justifyContent: 'center' },
});

const fabSt = StyleSheet.create({
  fab: { position: 'absolute', bottom: 28, right: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 8 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING COMMAND CENTER TAB  — GA4 + Supabase dual-source
// ═══════════════════════════════════════════════════════════════════════════════

const CHANNEL_COLORS: Record<string, string> = {
  Organic:  C.success,
  Direct:   C.primary,
  Social:   '#7c3aed',
  Paid:     C.gold,
  Referral: '#0891b2',
  Email:    '#d97706',
  Other:    C.textMuted,
};

const SOCIAL_ICONS: Record<string, string> = {
  facebook: 'fb', instagram: 'ig', tiktok: 'tt',
  twitter: 'tw', x: 'tw', linkedin: 'li', youtube: 'yt', pinterest: 'pt',
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: C.success,
  active:    C.primary,
  completed: C.gold,
  pending:   '#e09b2d',
  draft:     C.textMuted,
  cancelled: C.danger,
};

function MarketingCommandCenterTab() {
  const [period, setPeriod] = useState<DatePreset>('30d');

  // ── GA4 (Traffic & Engagement) ────────────────────────────────────────────
  const { data: ga4, loading: ga4Loading, refreshing: ga4Refreshing,
          stale, error: ga4Error, unavailable, refresh: ga4Refresh } = useGA4Analytics(period);

  // ── Supabase (Conversion Truth) ───────────────────────────────────────────
  const [dbStats, setDbStats] = useState({
    totalBookings: 0, confirmedBookings: 0, totalRevenue: 0,
    totalCollected: 0, totalOutstanding: 0,
    leads: 0, portalVehicles: 0, portalPackages: 0, activePromos: 0,
    topPackages: [] as { name: string; bookings: number; revenue: number; pct: number }[],
    funnel: [] as { label: string; count: number; pct: number; color: string }[],
  });
  const [dbLoading, setDbLoading]   = useState(true);
  const [dbRefreshing, setDbRef]    = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDb = useCallback(async (isRefresh = false) => {
    if (isRefresh) setDbRef(true); else setDbLoading(true);
    try {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 0;
      const cutoff = days > 0 ? new Date(Date.now() - days * 86400000).toISOString() : null;

      // Bookings + revenue
      let q = supabase.from('safari_bookings')
        .select('id,status,total_price_usd,amount_paid,package_id,created_at');
      if (cutoff) q = q.gte('created_at', cutoff);
      const { data: bkData } = await q;
      const bks = (bkData ?? []) as Record<string, any>[];

      const totalBookings    = bks.length;
      const totalRevenue     = bks.reduce((s, b) => s + (Number(b.total_price_usd) || 0), 0);
      const totalCollected   = bks.reduce((s, b) => s + (Number(b.amount_paid)     || 0), 0);
      const confirmedBookings = bks.filter(b => ['confirmed','active','completed'].includes(b.status ?? '')).length;
      const totalOutstanding  = totalRevenue - totalCollected;

      // Leads
      let leadsCount = 0;
      try {
        const { count } = await supabase.from('marketing_leads')
          .select('id', { count: 'exact', head: true });
        leadsCount = count ?? 0;
      } catch { /* table may not exist yet */ }

      // Portal catalog counts
      const [{ count: visVeh }, { count: visPkg }, { count: activeProm }] = await Promise.all([
        supabase.from('vehicles').select('id',         { count: 'exact', head: true }).eq('portal_visible', true),
        supabase.from('safari_packages').select('id',  { count: 'exact', head: true }).eq('portal_visible', true),
        supabase.from('portal_promotions').select('id',{ count: 'exact', head: true }).eq('is_active', true),
      ]);

      // Funnel
      const statusMap: Record<string, number> = {};
      bks.forEach(b => { const s = b.status || 'pending'; statusMap[s] = (statusMap[s] || 0) + 1; });
      const statusOrder = ['draft','pending','confirmed','active','completed','cancelled'];
      const funnelData = statusOrder
        .filter(s => (statusMap[s] || 0) > 0)
        .map(s => ({
          label: s.charAt(0).toUpperCase() + s.slice(1),
          count: statusMap[s] || 0,
          pct:   totalBookings > 0 ? Math.round(((statusMap[s] || 0) / totalBookings) * 100) : 0,
          color: STATUS_COLORS[s] || C.textMuted,
        }));

      // Top packages
      const pkgMap: Record<string, { count: number; rev: number }> = {};
      bks.forEach(b => {
        const pid = b.package_id; if (!pid) return;
        if (!pkgMap[pid]) pkgMap[pid] = { count: 0, rev: 0 };
        pkgMap[pid].count++;
        pkgMap[pid].rev += Number(b.total_price_usd) || 0;
      });
      const pkgIds = Object.keys(pkgMap);
      const pkgNames: Record<string, string> = {};
      if (pkgIds.length > 0) {
        const { data: pkgs } = await supabase.from('safari_packages').select('id,name').in('id', pkgIds.slice(0, 20));
        (pkgs ?? []).forEach((p: any) => { pkgNames[p.id] = p.name; });
      }
      const maxPkgBks = Math.max(...Object.values(pkgMap).map(v => v.count), 1);
      const topPkgData = Object.entries(pkgMap)
        .sort(([,a],[,b]) => b.count - a.count).slice(0, 5)
        .map(([pid, { count, rev }]) => ({
          name: pkgNames[pid] || 'Unknown', bookings: count, revenue: rev,
          pct: Math.round((count / maxPkgBks) * 100),
        }));

      setDbStats({
        totalBookings, confirmedBookings, totalRevenue, totalCollected, totalOutstanding,
        leads: leadsCount,
        portalVehicles: visVeh ?? 0, portalPackages: visPkg ?? 0, activePromos: activeProm ?? 0,
        topPackages: topPkgData, funnel: funnelData,
      });
      setLastUpdated(new Date());
    } catch (e) { console.error('[CommandCenter DB]', e); }
    finally { setDbLoading(false); setDbRef(false); }
  }, [period]);

  useEffect(() => { setDbLoading(true); fetchDb(); }, [fetchDb]);

  const loading    = ga4Loading && dbLoading;
  const refreshing = ga4Refreshing || dbRefreshing;
  const onRefresh  = useCallback(() => { ga4Refresh(); fetchDb(true); }, [ga4Refresh, fetchDb]);

  if (loading) return <LoadingView label="Loading Command Center…" />;

  const s = ga4?.summary;
  const ch = ga4?.channels;
  const totalChSessions = ch ? Object.values(ch).reduce((a, b) => a + b, 0) || 1 : 1;
  const collectedPct = dbStats.totalRevenue > 0
    ? Math.round((dbStats.totalCollected / dbStats.totalRevenue) * 100) : 0;
  const margin = dbStats.totalRevenue > 0
    ? ((dbStats.totalRevenue - dbStats.totalCollected < 0 ? 0 : (dbStats.totalRevenue - (dbStats.totalRevenue - dbStats.totalCollected))) / dbStats.totalRevenue * 100).toFixed(1)
    : '0.0';

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}>

      {/* Period selector */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['7d','30d','90d'] as DatePreset[]).map(p => (
          <TouchableOpacity key={p} style={[cc.periodBtn, period === p && cc.periodBtnOn]} onPress={() => setPeriod(p)}>
            <Text style={[cc.periodT, period === p && cc.periodTOn]}>
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </Text>
          </TouchableOpacity>
        ))}
        {lastUpdated ? (
          <Text style={{ fontSize: 10, color: C.textMuted, alignSelf: 'center', marginLeft: 4 }}>
            {stale ? '⚠ cached · ' : ''}Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : null}
      </View>

      {/* GA4 unavailable banner */}
      {unavailable && (
        <View style={cc.warnBanner}>
          <Text style={cc.warnText}>⚡ GA4 not configured — showing Supabase analytics only.</Text>
          <Text style={cc.warnSub}>Add GA4_SERVICE_ACCOUNT_JSON + GA4_PROPERTY_ID in Supabase Edge Function secrets.</Text>
        </View>
      )}
      {ga4Error && !unavailable && (
        <View style={[cc.warnBanner, { backgroundColor: '#fef3c7' }]}>
          <Text style={[cc.warnText, { color: '#92400e' }]}>⚠ {ga4Error}</Text>
        </View>
      )}

      {/* ── SECTION 1: GA4 Traffic KPIs ─────────────────────────────────────── */}
      <Text style={cc.sectionHeader}>🔵 Traffic & Engagement  <Text style={cc.sourceTag}>GA4</Text></Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Sessions',   value: s ? s.sessions.toLocaleString()        : '—', color: C.primary  },
          { label: 'Users',      value: s ? s.activeUsers.toLocaleString()     : '—', color: C.gold     },
          { label: 'New Users',  value: s ? s.newUsers.toLocaleString()        : '—', color: C.success  },
          { label: 'Page Views', value: s ? s.screenPageViews.toLocaleString() : '—', color: '#7c3aed'  },
          { label: 'Key Events', value: s ? s.keyEvents.toLocaleString()       : '—', color: C.danger   },
          { label: 'Avg Engage', value: s ? `${Math.round(s.userEngagementDuration / Math.max(s.sessions, 1))}s` : '—', color: '#0891b2' },
        ].map(k => (
          <View key={k.label} style={[cc.kpiCard, { borderLeftColor: k.color, borderLeftWidth: 3 }]}>
            <Text style={cc.kpiLabel}>{k.label}</Text>
            <Text style={[cc.kpiVal, { color: k.color }]}>{k.value}</Text>
          </View>
        ))}
      </View>

      {/* ── SECTION 2: Traffic Channels ─────────────────────────────────────── */}
      {ch && (
        <View style={cc.sect}>
          <Text style={cc.sectTitle}>Source / Medium Breakdown  <Text style={cc.sourceTagInline}>GA4</Text></Text>
          {(Object.entries(ch) as [string, number][])
            .filter(([, v]) => v > 0)
            .sort(([,a],[,b]) => b - a)
            .map(([channel, sessions]) => {
              const pct = Math.round((sessions / totalChSessions) * 100);
              const color = CHANNEL_COLORS[channel] || C.textMuted;
              return (
                <View key={channel} style={cc.funnelRow}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
                  <Text style={[cc.funnelLabel, { width: 72 }]}>{channel}</Text>
                  <View style={{ flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginHorizontal: 8 }}>
                    <View style={{ height: 6, width: `${pct}%` as any, backgroundColor: color, borderRadius: 3 }} />
                  </View>
                  <Text style={[cc.funnelCount, { color }]}>{sessions.toLocaleString()}</Text>
                  <Text style={[cc.kpiSub, { minWidth: 32, textAlign: 'right' }]}>{pct}%</Text>
                </View>
              );
            })}
        </View>
      )}

      {/* ── SECTION 3: Top Pages ────────────────────────────────────────────── */}
      {ga4 && ga4.topPages.length > 0 && (
        <View style={cc.sect}>
          <Text style={cc.sectTitle}>Top Pages  <Text style={cc.sourceTagInline}>GA4</Text></Text>
          {ga4.topPages.slice(0, 8).map((p, i) => (
            <View key={i} style={cc.pkgRow}>
              <View style={cc.pkgRank}><Text style={cc.pkgRankT}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={cc.pkgName} numberOfLines={1}>{p.path}</Text>
                <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, marginTop: 3 }}>
                  <View style={{ height: 4, width: `${p.pct}%` as any, backgroundColor: C.primary + '80', borderRadius: 2 }} />
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', minWidth: 56 }}>
                <Text style={cc.pkgBkgs}>{p.views.toLocaleString()}</Text>
                <Text style={cc.kpiSub}>views</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── SECTION 4: Social Traffic ───────────────────────────────────────── */}
      {ga4 && Object.keys(ga4.socialTraffic).length > 0 && (
        <View style={cc.sect}>
          <Text style={cc.sectTitle}>Social Traffic  <Text style={cc.sourceTagInline}>GA4</Text></Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {Object.entries(ga4.socialTraffic)
              .sort(([,a],[,b]) => b - a)
              .map(([platform, sessions]) => (
                <View key={platform} style={cc.socialCard}>
                  <Text style={cc.socialName}>{platform.charAt(0).toUpperCase() + platform.slice(1)}</Text>
                  <Text style={cc.socialVal}>{(sessions as number).toLocaleString()}</Text>
                  <Text style={cc.kpiSub}>sessions</Text>
                </View>
              ))}
          </View>
        </View>
      )}

      {/* ── SECTION 5: Audience ─────────────────────────────────────────────── */}
      {ga4 && (ga4.audience.countries.length > 0 || ga4.audience.devices.length > 0) && (
        <View style={cc.sect}>
          <Text style={cc.sectTitle}>Audience Insights  <Text style={cc.sourceTagInline}>GA4</Text></Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Countries */}
            <View style={{ flex: 1 }}>
              <Text style={[cc.kpiLabel, { marginBottom: 8 }]}>By Country</Text>
              {ga4.audience.countries.slice(0, 5).map((c, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={cc.pkgName} numberOfLines={1}>{c.label}</Text>
                    <View style={{ height: 3, backgroundColor: C.border, borderRadius: 2 }}>
                      <View style={{ height: 3, width: `${c.pct}%` as any, backgroundColor: C.primary, borderRadius: 2 }} />
                    </View>
                  </View>
                  <Text style={cc.kpiSub}>{c.pct}%</Text>
                </View>
              ))}
            </View>
            {/* Devices */}
            <View style={{ flex: 1 }}>
              <Text style={[cc.kpiLabel, { marginBottom: 8 }]}>By Device</Text>
              {ga4.audience.devices.map((d, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={cc.pkgName} numberOfLines={1}>{d.label}</Text>
                    <View style={{ height: 3, backgroundColor: C.border, borderRadius: 2 }}>
                      <View style={{ height: 3, width: `${d.pct}%` as any, backgroundColor: C.gold, borderRadius: 2 }} />
                    </View>
                  </View>
                  <Text style={cc.kpiSub}>{d.pct}%</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ── SECTION 6: Supabase Conversion KPIs ─────────────────────────────── */}
      <Text style={cc.sectionHeader}>🟣 Conversions & Revenue  <Text style={cc.sourceTag}>Supabase</Text></Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Bookings',    value: dbStats.totalBookings.toLocaleString(),     color: C.primary },
          { label: 'Confirmed',   value: dbStats.confirmedBookings.toLocaleString(), color: C.success },
          { label: 'Revenue',     value: `$${Math.round(dbStats.totalRevenue).toLocaleString()}`, color: C.gold },
          { label: 'Leads',       value: dbStats.leads.toLocaleString(),             color: '#7c3aed' },
        ].map(k => (
          <View key={k.label} style={[cc.kpiCard, { borderLeftColor: k.color, borderLeftWidth: 3 }]}>
            <Text style={cc.kpiLabel}>{k.label}</Text>
            <Text style={[cc.kpiVal, { color: k.color }]}>{k.value}</Text>
          </View>
        ))}
      </View>

      {/* Revenue collection bar */}
      <View style={cc.sect}>
        <Text style={cc.sectTitle}>Revenue Collection</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'Total Revenue', value: `$${Math.round(dbStats.totalRevenue).toLocaleString()}`, color: C.primary },
            { label: 'Collected',     value: `$${Math.round(dbStats.totalCollected).toLocaleString()}`, color: C.success },
            { label: 'Outstanding',   value: `$${Math.round(dbStats.totalOutstanding).toLocaleString()}`, color: C.danger },
          ].map(r => (
            <View key={r.label} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[cc.revVal, { color: r.color }]}>{r.value}</Text>
              <Text style={cc.revLabel}>{r.label}</Text>
            </View>
          ))}
        </View>
        <View style={cc.collBarTrack}>
          <View style={[cc.collBarFill, { width: `${collectedPct}%` as any }]} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
          <Text style={cc.kpiSub}>{collectedPct}% collected</Text>
        </View>
      </View>

      {/* Booking funnel */}
      {dbStats.funnel.length > 0 && (
        <View style={cc.sect}>
          <Text style={cc.sectTitle}>Booking Conversion Funnel  <Text style={cc.sourceTagInline}>Supabase</Text></Text>
          {dbStats.funnel.map(f => (
            <View key={f.label} style={cc.funnelRow}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: f.color, marginRight: 6 }} />
              <Text style={[cc.funnelLabel, { width: 80 }]}>{f.label}</Text>
              <View style={{ flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginHorizontal: 8 }}>
                <View style={{ height: 6, width: `${f.pct}%` as any, backgroundColor: f.color, borderRadius: 3 }} />
              </View>
              <Text style={[cc.funnelCount, { color: f.color, minWidth: 30, textAlign: 'right' }]}>{f.count}</Text>
              <Text style={[cc.kpiSub, { minWidth: 32, textAlign: 'right' }]}>{f.pct}%</Text>
            </View>
          ))}
        </View>
      )}

      {/* Portal catalog */}
      <View style={cc.sect}>
        <Text style={cc.sectTitle}>Portal Catalog — Live  <Text style={cc.sourceTagInline}>Supabase</Text></Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { label: 'Vehicles Live',  value: dbStats.portalVehicles,  color: C.primary },
            { label: 'Packages Live',  value: dbStats.portalPackages,  color: C.gold    },
            { label: 'Active Promos',  value: dbStats.activePromos,    color: C.success  },
          ].map(p => (
            <View key={p.label} style={cc.catalogCard}>
              <Text style={[cc.catalogVal, { color: p.color }]}>{p.value}</Text>
              <Text style={cc.catalogLabel}>{p.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Top packages */}
      {dbStats.topPackages.length > 0 && (
        <View style={cc.sect}>
          <Text style={cc.sectTitle}>Top Safari Packages  <Text style={cc.sourceTagInline}>Supabase</Text></Text>
          {dbStats.topPackages.map((p, i) => (
            <View key={i} style={cc.pkgRow}>
              <View style={cc.pkgRank}><Text style={cc.pkgRankT}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={cc.pkgName} numberOfLines={1}>{p.name}</Text>
                <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, marginTop: 3 }}>
                  <View style={{ height: 4, width: `${p.pct}%` as any, backgroundColor: C.primary + '90', borderRadius: 2 }} />
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
                <Text style={cc.pkgBkgs}>{p.bookings} bkg{p.bookings !== 1 ? 's' : ''}</Text>
                <Text style={cc.kpiSub}>${(p.revenue / 1000).toFixed(1)}k</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const cc = StyleSheet.create({
  periodBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  periodBtnOn:  { backgroundColor: C.primary, borderColor: C.primary },
  periodT:      { fontSize: 12, fontWeight: '600', color: C.textMuted },
  periodTOn:    { color: '#fff' },
  sectionHeader: { fontSize: 13, fontWeight: '800', color: C.text, letterSpacing: 0.3, marginBottom: 12, marginTop: 4 },
  sourceTag:    { fontSize: 11, fontWeight: '700', color: C.gold, backgroundColor: C.goldSoft, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  sourceTagInline: { fontSize: 10, fontWeight: '700', color: C.gold },
  warnBanner:   { backgroundColor: '#fde68a20', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#fbbf24' },
  warnText:     { fontSize: 12, fontWeight: '700', color: '#92400e', marginBottom: 2 },
  warnSub:      { fontSize: 11, color: '#78350f' },
  kpiCard:      { flex: 1, minWidth: '45%', backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  kpiLabel:     { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  kpiVal:       { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 },
  kpiSub:       { fontSize: 11, color: C.textMuted },
  sect:         { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  sectTitle:    { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  revVal:       { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  revLabel:     { fontSize: 10, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', marginTop: 2 },
  collBarTrack: { height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden' },
  collBarFill:  { height: 8, backgroundColor: C.success, borderRadius: 4 },
  funnelRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border + '40' },
  funnelLabel:  { fontSize: 12, fontWeight: '600', color: C.text },
  funnelCount:  { fontSize: 13, fontWeight: '700' },
  catalogCard:  { flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  catalogVal:   { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  catalogLabel: { fontSize: 10, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },
  pkgRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border + '40' },
  pkgRank:      { width: 24, height: 24, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pkgRankT:     { fontSize: 11, fontWeight: '800', color: C.primary },
  pkgName:      { fontSize: 13, fontWeight: '600', color: C.text },
  pkgBkgs:      { fontSize: 13, fontWeight: '700', color: C.primary },
  socialCard:   { backgroundColor: C.bg, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border, minWidth: 80 },
  socialName:   { fontSize: 11, fontWeight: '700', color: C.text, marginBottom: 2 },
  socialVal:    { fontSize: 18, fontWeight: '800', color: '#7c3aed', letterSpacing: -0.4 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSITE ANALYTICS TAB — GA4 + Supabase
// ═══════════════════════════════════════════════════════════════════════════════

function WebsiteAnalyticsTab() {
  const [period, setPeriod] = useState<DatePreset>('30d');
  const { data: ga4, loading, refreshing, stale, error, unavailable, refresh } = useGA4Analytics(period);

  if (loading) return <LoadingView label="Loading analytics…" />;

  const s  = ga4?.summary;
  const ch = ga4?.channels;
  const totalCh = ch ? Object.values(ch).reduce((a, b) => a + b, 0) || 1 : 1;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.primary} />}>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {(['7d','30d','90d'] as DatePreset[]).map(p => (
          <TouchableOpacity key={p} style={[cc.periodBtn, period === p && cc.periodBtnOn]} onPress={() => setPeriod(p)}>
            <Text style={[cc.periodT, period === p && cc.periodTOn]}>
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </Text>
          </TouchableOpacity>
        ))}
        {stale && <Text style={{ fontSize: 10, color: C.textMuted, alignSelf: 'center' }}>Cached</Text>}
      </View>

      {unavailable && (
        <View style={cc.warnBanner}>
          <Text style={cc.warnText}>GA4 Not Connected</Text>
          <Text style={cc.warnSub}>Set GA4_SERVICE_ACCOUNT_JSON and GA4_PROPERTY_ID in Supabase Edge Function secrets to enable live analytics.</Text>
        </View>
      )}
      {error && !unavailable && (
        <View style={[cc.warnBanner, { backgroundColor: '#fef3c7' }]}>
          <Text style={[cc.warnText, { color: '#92400e' }]}>{error}</Text>
        </View>
      )}

      {s && (
        <>
          {/* KPI strip */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Sessions',   value: s.sessions.toLocaleString(),        color: C.primary },
              { label: 'Users',      value: s.activeUsers.toLocaleString(),     color: C.gold    },
              { label: 'New Users',  value: s.newUsers.toLocaleString(),        color: C.success },
              { label: 'Page Views', value: s.screenPageViews.toLocaleString(), color: '#7c3aed' },
            ].map(k => (
              <View key={k.label} style={cc.kpiCard}>
                <Text style={cc.kpiLabel}>{k.label}</Text>
                <Text style={[cc.kpiVal, { color: k.color }]}>{k.value}</Text>
              </View>
            ))}
          </View>

          {/* Channels */}
          {ch && (
            <View style={cc.sect}>
              <Text style={cc.sectTitle}>Traffic by Channel</Text>
              {(Object.entries(ch) as [string, number][])
                .filter(([,v]) => v > 0).sort(([,a],[,b]) => b - a)
                .map(([ch_, sessions]) => {
                  const pct   = Math.round((sessions / totalCh) * 100);
                  const color = CHANNEL_COLORS[ch_] || C.textMuted;
                  return (
                    <View key={ch_} style={cc.funnelRow}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
                      <Text style={[cc.funnelLabel, { width: 68 }]}>{ch_}</Text>
                      <View style={{ flex: 1, height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginHorizontal: 8 }}>
                        <View style={{ height: 5, width: `${pct}%` as any, backgroundColor: color, borderRadius: 3 }} />
                      </View>
                      <Text style={[cc.funnelCount, { color, minWidth: 46, textAlign: 'right' }]}>{sessions.toLocaleString()}</Text>
                    </View>
                  );
                })}
            </View>
          )}

          {/* Top pages */}
          {ga4!.topPages.length > 0 && (
            <View style={cc.sect}>
              <Text style={cc.sectTitle}>Top Pages</Text>
              {ga4!.topPages.slice(0, 10).map((p, i) => (
                <View key={i} style={cc.pkgRow}>
                  <View style={cc.pkgRank}><Text style={cc.pkgRankT}>{i + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={cc.pkgName} numberOfLines={1}>{p.path}</Text>
                    <View style={{ height: 3, backgroundColor: C.border, borderRadius: 2, marginTop: 3 }}>
                      <View style={{ height: 3, width: `${p.pct}%` as any, backgroundColor: C.primary, borderRadius: 2 }} />
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', minWidth: 52 }}>
                    <Text style={cc.pkgBkgs}>{p.views.toLocaleString()}</Text>
                    <Text style={cc.kpiSub}>{p.engagedSessions} eng</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Audience */}
          {(ga4!.audience.countries.length > 0 || ga4!.audience.devices.length > 0) && (
            <View style={cc.sect}>
              <Text style={cc.sectTitle}>Audience Insights</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[cc.kpiLabel, { marginBottom: 8 }]}>Countries</Text>
                  {ga4!.audience.countries.slice(0, 5).map((c, i) => (
                    <View key={i} style={{ marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={cc.pkgName} numberOfLines={1}>{c.label}</Text>
                        <Text style={cc.kpiSub}>{c.pct}%</Text>
                      </View>
                      <View style={{ height: 3, backgroundColor: C.border, borderRadius: 2 }}>
                        <View style={{ height: 3, width: `${c.pct}%` as any, backgroundColor: C.primary, borderRadius: 2 }} />
                      </View>
                    </View>
                  ))}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[cc.kpiLabel, { marginBottom: 8 }]}>Devices</Text>
                  {ga4!.audience.devices.map((d, i) => (
                    <View key={i} style={{ marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={cc.pkgName} numberOfLines={1}>{d.label}</Text>
                        <Text style={cc.kpiSub}>{d.pct}%</Text>
                      </View>
                      <View style={{ height: 3, backgroundColor: C.border, borderRadius: 2 }}>
                        <View style={{ height: 3, width: `${d.pct}%` as any, backgroundColor: C.gold, borderRadius: 2 }} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </>
      )}

      {!s && !unavailable && (
        <View style={an.connectCard}>
          <Text style={an.connectTitle}>No Analytics Data</Text>
          <Text style={an.connectSub}>Pull down to refresh or check your GA4 configuration.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const an = StyleSheet.create({
  connectCard:  { backgroundColor: C.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  connectTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 8, textAlign: 'center' },
  connectSub:   { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  metCard:      { flex: 1, minWidth: '45%', backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  metLabel:     { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  metVal:       { fontSize: 24, fontWeight: '800', letterSpacing: -0.6, marginBottom: 2 },
  metSub:       { fontSize: 11, color: C.textMuted },
  sect:         { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  sectTitle:    { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  pageRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border + '50', gap: 12 },
  pagePath:     { fontSize: 12, color: C.text, fontWeight: '500' },
  pageViews:    { fontSize: 13, fontWeight: '700', color: C.primary, textAlign: 'right' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOG MANAGEMENT TAB
// ═══════════════════════════════════════════════════════════════════════════════

type BlogStatus = 'draft' | 'published' | 'archived';

interface BlogPost {
  id: string;
  title: string;
  excerpt?: string;
  content?: string;
  status: BlogStatus;
  cover_image_url?: string;
  tags?: string[];
  views?: number;
  author_name?: string;
  published_at?: string;
  created_at?: string;
}

const BLOG_STATUS_CFG: Record<BlogStatus, { bg: string; text: string; label: string }> = {
  draft:     { bg: C.input,      text: C.textMuted, label: 'Draft' },
  published: { bg: C.primarySoft, text: C.primary,  label: 'Published' },
  archived:  { bg: '#f5e8ce',    text: C.gold,      label: 'Archived' },
};

function BlogFormModal({ visible, post, onClose, onSaved }: {
  visible: boolean; post: BlogPost | null; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<BlogStatus>('draft');
  const [coverUrl, setCoverUrl] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(post?.title || '');
      setExcerpt(post?.excerpt || '');
      setContent(post?.content || '');
      setStatus(post?.status || 'draft');
      setCoverUrl(post?.cover_image_url || '');
      setTags((post?.tags || []).join(', '));
    }
  }, [visible, post]);

  const save = useCallback(async () => {
    if (!title.trim()) { Alert.alert('Required', 'Title is required.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        excerpt: excerpt.trim() || null,
        content: content.trim() || null,
        status,
        cover_image_url: coverUrl.trim() || null,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        published_at: status === 'published' ? new Date().toISOString() : null,
      };
      let err;
      if (post?.id) {
        ({ error: err } = await supabase.from('blog_posts').update(payload).eq('id', post.id));
      } else {
        ({ error: err } = await supabase.from('blog_posts').insert(payload));
      }
      if (err) throw err;
      onSaved(); onClose();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to save post.'); }
    finally { setSaving(false); }
  }, [title, excerpt, content, status, coverUrl, tags, post, onSaved, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={pm.header}>
            <Text style={pm.headerTitle}>{post ? 'Edit Post' : 'New Blog Post'}</Text>
            <TouchableOpacity onPress={onClose} style={pm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            <FieldLabel label="Title *" />
            <TextF value={title} onChange={setTitle} placeholder="Post title…" />
            <FieldLabel label="Excerpt" />
            <TextF value={excerpt} onChange={setExcerpt} placeholder="Brief description shown in listings…" multiline />
            <FieldLabel label="Content" />
            <TextF value={content} onChange={setContent} placeholder="Full article content…" multiline />
            <FieldLabel label="Cover Image URL" />
            <TextF value={coverUrl} onChange={setCoverUrl} placeholder="https://…" keyboardType="url" />
            <FieldLabel label="Tags (comma-separated)" />
            <TextF value={tags} onChange={setTags} placeholder="gorilla, safari, uganda" />
            <FieldLabel label="Status" />
            <TouchableOpacity style={pm.selector} onPress={() => setShowStatusPicker(true)}>
              <View style={[{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: BLOG_STATUS_CFG[status].bg }]}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: BLOG_STATUS_CFG[status].text }}>{BLOG_STATUS_CFG[status].label}</Text>
              </View>
              <Ico.ChevDown s={16} c={C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={[pm.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={pm.saveBtnT}>{post ? 'Save Changes' : 'Create Post'}</Text>}
            </TouchableOpacity>
          </ScrollView>
          <PickerModal visible={showStatusPicker} title="Post Status"
            options={(['draft','published','archived'] as BlogStatus[]).map(s => ({ value: s, label: BLOG_STATUS_CFG[s].label }))}
            selected={status} onSelect={o => setStatus(o.value as BlogStatus)} onClose={() => setShowStatusPicker(false)} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function BlogManagementTab() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BlogStatus | 'all'>('all');
  const [editPost, setEditPost] = useState<BlogPost | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('[Blog]', error.message);
    // Normalize flexible column names to BlogPost interface
    const posts = (data || []).map((d: any) => ({
      id: d.id,
      title: d.title || d.heading || '',
      excerpt: d.excerpt || d.summary || d.description || '',
      content: d.content || d.body || '',
      status: d.status || d.publish_status || 'draft',
      cover_image_url: d.cover_image_url || d.cover_image || d.thumbnail_url || d.image_url || '',
      tags: Array.isArray(d.tags) ? d.tags : (typeof d.tags === 'string' ? d.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []),
      views: d.views ?? d.view_count ?? d.page_views ?? 0,
      author_name: d.author_name || d.author || '',
      published_at: d.published_at || d.publish_date || '',
      created_at: d.created_at || '',
    })) as BlogPost[];
    setPosts(posts);
  }, []);

  useEffect(() => { setLoading(true); fetchPosts().finally(() => setLoading(false)); }, [fetchPosts]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchPosts(); setRefreshing(false); }, [fetchPosts]);

  const deletePost = useCallback((p: BlogPost) => {
    Alert.alert('Delete Post', `Remove "${p.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('blog_posts').delete().eq('id', p.id);
        if (error) Alert.alert('Error', error.message);
        else fetchPosts();
      }},
    ]);
  }, [fetchPosts]);

  const filtered = useMemo(() =>
    statusFilter === 'all' ? posts : posts.filter(p => p.status === statusFilter),
  [posts, statusFilter]);

  if (loading) return <LoadingView label="Loading blog posts…" />;

  return (
    <View style={{ flex: 1 }}>
      {/* Status filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10 }}>
        {(['all','published','draft','archived'] as const).map(f => (
          <TouchableOpacity key={f} style={[bl.filterPill, statusFilter === f && bl.filterPillOn]} onPress={() => setStatusFilter(f)}>
            <Text style={[bl.filterT, statusFilter === f && bl.filterTOn]}>{f === 'all' ? 'All' : BLOG_STATUS_CFG[f as BlogStatus].label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item: p }) => {
          const st = BLOG_STATUS_CFG[p.status] || BLOG_STATUS_CFG.draft;
          return (
            <TouchableOpacity style={bl.card} onPress={() => { setEditPost(p); setShowModal(true); }} activeOpacity={0.82}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={[bl.statusBadge, { backgroundColor: st.bg }]}>
                  <Text style={[bl.statusT, { color: st.text }]}>{st.label}</Text>
                </View>
                <TouchableOpacity style={bl.deleteBtn} onPress={() => deletePost(p)}>
                  <Ico.Trash s={14} c={C.danger} />
                </TouchableOpacity>
              </View>
              <Text style={bl.title} numberOfLines={2}>{p.title}</Text>
              {p.excerpt ? <Text style={bl.excerpt} numberOfLines={2}>{p.excerpt}</Text> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
                {p.views != null ? <Text style={bl.meta}>{p.views.toLocaleString()} views</Text> : null}
                {p.published_at ? <Text style={bl.meta}>{new Date(p.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text> : null}
                {(p.tags || []).slice(0, 2).map(t => (
                  <View key={t} style={bl.tag}><Text style={bl.tagT}>{t}</Text></View>
                ))}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<EmptyView title="No blog posts" sub="Create your first post using the + button." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      />

      <TouchableOpacity style={fabSt.fab} onPress={() => { setEditPost(null); setShowModal(true); }}>
        <Ico.Plus s={22} c="#fff" />
      </TouchableOpacity>
      <BlogFormModal visible={showModal} post={editPost} onClose={() => setShowModal(false)} onSaved={fetchPosts} />
    </View>
  );
}

const bl = StyleSheet.create({
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  filterPillOn: { backgroundColor: C.primary, borderColor: C.primary },
  filterT: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  filterTOn: { color: '#fff' },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusT: { fontSize: 11, fontWeight: '700' },
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fde8e0', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.3, marginBottom: 4 },
  excerpt: { fontSize: 12, color: C.textMuted, lineHeight: 17 },
  meta: { fontSize: 11, color: C.textMuted },
  tag: { backgroundColor: C.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  tagT: { fontSize: 10, fontWeight: '700', color: C.primary },
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOG ANALYTICS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function BlogAnalyticsTab() {
  const { posts, totalViews, totalLeads, totalBookings, loading, refreshing, error, refresh } = useBlogAnalytics();
  const maxViews = useMemo(() => Math.max(...posts.map(p => p.totalViews), 1), [posts]);
  const published = useMemo(() => posts.filter(p => p.status === 'published'), [posts]);

  if (loading) return <LoadingView label="Loading blog analytics…" />;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.primary} />}>

      {error ? (
        <View style={{ backgroundColor: '#fde8e0', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <Text style={{ fontSize: 12, color: C.danger }}>{error}</Text>
        </View>
      ) : null}

      {/* Summary KPI cards */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <View style={[an.metCard, { flex: 1 }]}>
          <Text style={an.metLabel}>Total Views</Text>
          <Text style={[an.metVal, { color: C.primary }]}>{totalViews.toLocaleString()}</Text>
        </View>
        <View style={[an.metCard, { flex: 1 }]}>
          <Text style={an.metLabel}>Live Posts</Text>
          <Text style={[an.metVal, { color: C.success }]}>{published.length}</Text>
        </View>
        <View style={[an.metCard, { flex: 1 }]}>
          <Text style={an.metLabel}>Leads</Text>
          <Text style={[an.metVal, { color: C.gold }]}>{totalLeads}</Text>
        </View>
        <View style={[an.metCard, { flex: 1 }]}>
          <Text style={an.metLabel}>Bookings</Text>
          <Text style={[an.metVal, { color: C.success }]}>{totalBookings}</Text>
        </View>
      </View>

      {posts.length === 0 ? (
        <EmptyView title="No blog data" sub="Publish blog posts to see analytics." />
      ) : (
        <View style={an.sect}>
          <Text style={an.sectTitle}>Post Performance</Text>
          {posts.map(p => {
            const barPct = maxViews > 0 ? p.totalViews / maxViews : 0;
            const st = BLOG_STATUS_CFG[p.status as BlogStatus] || BLOG_STATUS_CFG.draft;
            return (
              <View key={p.slug} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border + '50' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.text, flex: 1, marginRight: 12 }} numberOfLines={1}>{p.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[bl.statusBadge, { backgroundColor: st.bg }]}>
                      <Text style={[bl.statusT, { color: st.text }]}>{st.label}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: C.primary }}>{p.totalViews.toLocaleString()}</Text>
                  </View>
                </View>
                {/* Attribution row */}
                {(p.leads > 0 || p.bookings > 0 || p.conversionRate > 0) ? (
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
                    {p.leads > 0 ? <Text style={{ fontSize: 10, color: C.gold, fontWeight: '700' }}>{p.leads} lead{p.leads !== 1 ? 's' : ''}</Text> : null}
                    {p.bookings > 0 ? <Text style={{ fontSize: 10, color: C.success, fontWeight: '700' }}>{p.bookings} booking{p.bookings !== 1 ? 's' : ''}</Text> : null}
                    {p.conversionRate > 0 ? <Text style={{ fontSize: 10, color: C.textMuted }}>{p.conversionRate}% conv.</Text> : null}
                    {p.ga4Views > 0 ? <Text style={{ fontSize: 10, color: C.textMuted }}>GA4: {p.ga4Views.toLocaleString()}</Text> : null}
                  </View>
                ) : null}
                {/* Progress bar */}
                <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 6, width: `${barPct * 100}%` as any, backgroundColor: C.primary, borderRadius: 3 }} />
                </View>
                {p.published_at ? <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Published {new Date(p.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text> : null}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA MANAGEMENT TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface MediaAsset {
  id: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  public_url?: string;
  bucket?: string;
  folder?: string;
  uploaded_by?: string;
  created_at?: string;
}

// Known alternative table names for media assets across Supabase schemas
const MEDIA_TABLE_CANDIDATES = ['media_assets', 'media', 'assets', 'files', 'uploads', 'storage_files'];

function MediaManagementTab() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('image/jpeg');
  const [saving, setSaving] = useState(false);
  const [tableUnavailable, setTableUnavailable] = useState(false);
  const [activeTable, setActiveTable] = useState<string | null>(null);

  const normalizeRow = (d: any): MediaAsset => ({
    id:          d.id || String(Math.random()),
    file_name:   d.file_name   || d.name       || d.filename   || d.title    || 'Unnamed',
    file_type:   d.file_type   || d.mime_type  || d.type       || d.format   || '',
    file_size:   d.file_size   || d.size        || d.bytes      || 0,
    public_url:  d.public_url  || d.url         || d.storage_url || d.src    || d.link || '',
    bucket:      d.bucket      || d.bucket_name || '',
    folder:      d.folder      || d.directory   || d.path       || '',
    uploaded_by: d.uploaded_by || d.user_id     || d.created_by || '',
    created_at:  d.created_at  || d.uploaded_at || '',
  });

  const fetchAssets = useCallback(async () => {
    // Try each candidate table name until one works
    for (const table of MEDIA_TABLE_CANDIDATES) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error) {
        setActiveTable(table);
        setTableUnavailable(false);
        setAssets((data || []).map(normalizeRow));
        return;
      }

      // Skip to next candidate only on "table not found" errors
      const isNotFound = error.message.includes('does not exist') ||
                         error.message.includes('schema cache') ||
                         error.message.includes('relation') ||
                         error.code === '42P01';
      if (!isNotFound) {
        // Real error (auth, RLS, etc.) — stop and report
        console.error(`[Media/${table}]`, error.message);
        setTableUnavailable(false);
        setAssets([]);
        return;
      }
    }

    // None of the candidates exist
    console.warn('[Media] No media table found in schema. Showing empty state.');
    setTableUnavailable(true);
    setAssets([]);
  }, []);

  useEffect(() => { setLoading(true); fetchAssets().finally(() => setLoading(false)); }, [fetchAssets]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchAssets(); setRefreshing(false); }, [fetchAssets]);

  const deleteAsset = useCallback((a: MediaAsset) => {
    if (!activeTable) return;
    Alert.alert('Delete Asset', `Remove "${a.file_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from(activeTable).delete().eq('id', a.id);
        if (error) Alert.alert('Error', error.message);
        else fetchAssets();
      }},
    ]);
  }, [activeTable, fetchAssets]);

  const addAsset = useCallback(async () => {
    if (!newUrl.trim() || !newName.trim()) { Alert.alert('Required', 'File name and URL are required.'); return; }
    if (!activeTable) {
      Alert.alert('Table Unavailable', 'The media_assets table does not exist in the database yet. Please create it in your Supabase project first.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from(activeTable).insert({
        file_name: newName.trim(),
        file_type: newType.trim() || 'image/jpeg',
        public_url: newUrl.trim(),
      });
      if (error) throw error;
      setShowAddModal(false); setNewUrl(''); setNewName(''); setNewType('image/jpeg');
      fetchAssets();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to add asset.'); }
    finally { setSaving(false); }
  }, [activeTable, newUrl, newName, newType, fetchAssets]);

  const filtered = useMemo(() =>
    search ? assets.filter(a => a.file_name.toLowerCase().includes(search.toLowerCase())) : assets,
  [assets, search]);

  const fmtSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes > 1024)    return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const typeIcon = (type?: string) => {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.includes('pdf')) return '📕';
    return '📄';
  };

  if (loading) return <LoadingView label="Loading media…" />;

  // Table doesn't exist yet — helpful setup screen
  if (tableUnavailable) {
    return (
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}>
        <View style={md.unavailableCard}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>🖼️</Text>
          <Text style={md.unavailableTitle}>Media Library Not Set Up</Text>
          <Text style={md.unavailableSub}>
            The media assets table does not exist in your Supabase database yet.{'\n\n'}
            To enable this feature, run the following SQL in your Supabase SQL editor:
          </Text>
          <View style={md.sqlBox}>
            <Text style={md.sqlText}>{
`create table public.media_assets (
  id uuid default gen_random_uuid() primary key,
  file_name text not null,
  file_type text,
  file_size bigint,
  public_url text,
  bucket text,
  folder text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.media_assets
  enable row level security;

create policy "Authenticated users can manage media"
  on public.media_assets
  for all
  to authenticated
  using (true)
  with check (true);

grant all on public.media_assets to authenticated;
grant select on public.media_assets to anon;`
            }</Text>
          </View>
          <TouchableOpacity style={md.retryBtn} onPress={onRefresh}>
            <Text style={md.retryBtnT}>Retry After Setup</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Search bar */}
      <View style={md.searchRow}>
        <View style={md.searchBox}>
          <Ico.Globe s={14} c={C.textMuted} />
          <TextInput style={md.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search assets…" placeholderTextColor={C.textMuted} />
        </View>
        <View style={md.countBadge}>
          <Text style={md.countT}>{assets.length}</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item: a }) => (
          <View style={md.card}>
            <View style={md.iconBox}>
              <Text style={{ fontSize: 22 }}>{typeIcon(a.file_type)}</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={md.fileName} numberOfLines={1}>{a.file_name}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 3 }}>
                {a.file_type ? <Text style={md.meta}>{a.file_type.split('/')[1]?.toUpperCase()}</Text> : null}
                {a.file_size ? <Text style={md.meta}>{fmtSize(a.file_size)}</Text> : null}
                {a.folder ? <Text style={md.meta}>{a.folder}</Text> : null}
              </View>
              {a.public_url ? <Text style={md.url} numberOfLines={1}>{a.public_url}</Text> : null}
            </View>
            {activeTable && (
              <TouchableOpacity style={md.delBtn} onPress={() => deleteAsset(a)}>
                <Ico.Trash s={14} c={C.danger} />
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          <EmptyView
            title={search ? 'No results' : 'No media assets'}
            sub={search ? 'Try a different search term.' : 'Add your first asset using the + button.'}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      />

      <TouchableOpacity style={fabSt.fab} onPress={() => setShowAddModal(true)}>
        <Ico.Plus s={22} c="#fff" />
      </TouchableOpacity>

      {/* Add asset modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <View style={pm.header}>
              <Text style={pm.headerTitle}>Add Media Asset</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={pm.closeBtn}><Ico.Close s={18} c={C.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
              <FieldLabel label="File Name *" />
              <TextF value={newName} onChange={setNewName} placeholder="e.g. gorilla-trekking-hero.jpg" />
              <FieldLabel label="Public URL *" />
              <TextF value={newUrl} onChange={setNewUrl} placeholder="https://…" keyboardType="url" />
              <FieldLabel label="File Type" />
              <TextF value={newType} onChange={setNewType} placeholder="image/jpeg" />
              <TouchableOpacity style={[pm.saveBtn, saving && { opacity: 0.6 }]} onPress={addAsset} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={pm.saveBtnT}>Add Asset</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const md = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  countBadge: { backgroundColor: C.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  countT: { fontSize: 13, fontWeight: '700', color: C.primary },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  iconBox: { width: 44, height: 44, borderRadius: 10, backgroundColor: C.input, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 14, fontWeight: '700', color: C.text },
  meta: { fontSize: 11, color: C.textMuted },
  url: { fontSize: 10, color: C.gold, marginTop: 3, fontStyle: 'italic' },
  delBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fde8e0', alignItems: 'center', justifyContent: 'center' },
  // Setup / unavailable state
  unavailableCard: { backgroundColor: C.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  unavailableTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 10, textAlign: 'center' },
  unavailableSub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  sqlBox: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, width: '100%', marginBottom: 20 },
  sqlText: { fontSize: 10.5, color: '#7ec8a0', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 16 },
  retryBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 28, alignItems: 'center' },
  retryBtnT: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MARKETING SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

type MarketingTab = 'command-center' | 'vehicles' | 'safaris' | 'promotions' | 'analytics' | 'blog' | 'blog-analytics' | 'media';

export function MarketingScreen() {
  const [tab, setTab] = useState<MarketingTab>('command-center');
  const insets = useSafeAreaInsets();

  const TABS: { key: MarketingTab; label: string }[] = [
    { key: 'command-center',  label: 'Console' },
    { key: 'vehicles',        label: 'Vehicles' },
    { key: 'safaris',         label: 'Safaris' },
    { key: 'promotions',      label: 'Promotions' },
    { key: 'analytics',       label: 'Analytics' },
    { key: 'blog',            label: 'Blog' },
    { key: 'blog-analytics',  label: 'Blog Stats' },
    { key: 'media',           label: 'Media' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Hero header */}
      <View style={[ms.hero, { paddingTop: insets.top + 10 }]}>
        <View style={ms.glowL} /><View style={ms.glowR} />
        <Text style={ms.eyebrow}>Marketing Console</Text>
        <Text style={ms.heroTitle}>{tab === 'command-center' ? 'Command Center' : 'Marketing'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ms.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[ms.tabPill, tab === t.key && ms.tabPillOn]} onPress={() => setTab(t.key)}>
              <Text style={[ms.tabPillT, tab === t.key && ms.tabPillTOn]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {tab === 'command-center' && <MarketingCommandCenterTab />}
        {tab === 'vehicles'       && <VehicleCatalogTab />}
        {tab === 'safaris'        && <SafariCatalogTab />}
        {tab === 'promotions'     && <PromotionsTab />}
        {tab === 'analytics'      && <WebsiteAnalyticsTab />}
        {tab === 'blog'           && <BlogManagementTab />}
        {tab === 'blog-analytics' && <BlogAnalyticsTab />}
        {tab === 'media'          && <MediaManagementTab />}
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  hero: { backgroundColor: C.hero, paddingHorizontal: 20, paddingBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  glowL: { position: 'absolute', top: -30, left: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: '#6c5228', opacity: 0.3 },
  glowR: { position: 'absolute', right: -40, bottom: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: '#264a42', opacity: 0.18 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 5 },
  heroTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: '#fffaf3', marginBottom: 14 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  tabPillOn: { backgroundColor: C.gold, borderColor: C.gold },
  tabPillT: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  tabPillTOn: { color: '#fff' },
});

export default MarketingScreen;
