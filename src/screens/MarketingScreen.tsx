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
  Dimensions, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { LoadingView } from '../components/system/JackalLoader';
import { formatCurrency } from '../lib/utils';
import type { PortalVehicle, Promotion, SafariPackage } from '../types/safari';
import { useGA4Analytics, type DatePreset } from '../hooks/useGA4Analytics';
import { useBlogAnalytics } from '../hooks/useBlogAnalytics';
import { getErrorMessage } from '../lib/errors';
import { useAppPreferences } from '../contexts/AppPreferencesContext';

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
    } catch (e: any) { Alert.alert('Error', getErrorMessage(e, 'Failed to save.')); }
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
          <ScrollView
            keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
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
  const { t } = useAppPreferences();
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
      Alert.alert('Error', getErrorMessage(e, 'Failed to update visibility.'));
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
        keyboardShouldPersistTaps="handled"
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
        ListEmptyComponent={<EmptyView title={t('marketing.noVehiclesFound')} sub={t('marketing.noVehiclesSub')} />}
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
    } catch (e: any) { Alert.alert('Error', getErrorMessage(e, 'Failed to save.')); }
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
          <ScrollView
            keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
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
  const { t } = useAppPreferences();
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
      Alert.alert('Error', getErrorMessage(e, 'Failed to update visibility.'));
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
        keyboardShouldPersistTaps="handled"
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
                {!p.is_active ? <View style={[sc2.tag, { backgroundColor: '#FFEEED' }]}><Text style={[sc2.tagT, { color: C.danger }]}>Inactive</Text></View> : null}
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
        ListEmptyComponent={<EmptyView title={t('marketing.noPackagesFound')} sub={t('marketing.noPackagesSub')} />}
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

const pm = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  closeBtn: { padding: 8, backgroundColor: C.input, borderRadius: 20 },
  selector: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  saveBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  saveBtnT: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING COMMAND CENTER TAB  — GA4 + Supabase dual-source
// ═══════════════════════════════════════════════════════════════════════════════

const CHANNEL_COLORS: Record<string, string> = {
  // Grouped channels (from ga4.channels)
  Organic:   C.success,
  Direct:    C.primary,
  Social:    '#7c3aed',
  Paid:      C.gold,
  Referral:  '#0891b2',
  Email:     '#d97706',
  Other:     C.textMuted,
  // Individual sources (from ga4.sourceMedium rows)
  google:    C.success,
  bing:      '#0078D4',
  yahoo:     '#6001D2',
  facebook:  '#1877F2',
  instagram: '#E1306C',
  tiktok:    '#010101',
  twitter:   '#1DA1F2',
  x:         '#1DA1F2',
  linkedin:  '#0A66C2',
  youtube:   '#FF0000',
  pinterest: '#E60023',
  '(direct)': C.primary,
  '(none)':   C.textMuted,
};

function formatEngagement(totalSeconds: number, sessions: number): string {
  const secs = Math.round(totalSeconds / Math.max(sessions, 1));
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

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

// ═══════════════════════════════════════════════════════════════════════════════
// UTM LINK GENERATOR — build trackable share links for campaigns
// ═══════════════════════════════════════════════════════════════════════════════

const UTM_SOURCE_PRESETS = ['whatsapp', 'facebook', 'instagram', 'email', 'agent'];
const UTM_MEDIUM_PRESETS = ['social', 'referral', 'email', 'campaign'];

function UTMLinkGenerator() {
  const [expanded, setExpanded]   = useState(false);
  const [baseUrl, setBaseUrl]     = useState('https://jackaladventures.com');
  const [path, setPath]           = useState('/');
  const [source, setSource]       = useState('whatsapp');
  const [medium, setMedium]       = useState('social');
  const [campaign, setCampaign]   = useState('');

  const generatedUrl = useMemo(() => {
    try {
      const url = new URL(path.startsWith('/') ? path : `/${path}`, baseUrl.trim() || 'https://jackaladventures.com');
      if (source.trim())   url.searchParams.set('utm_source', source.trim());
      if (medium.trim())   url.searchParams.set('utm_medium', medium.trim());
      if (campaign.trim()) url.searchParams.set('utm_campaign', campaign.trim());
      return url.toString();
    } catch {
      return '';
    }
  }, [baseUrl, path, source, medium, campaign]);

  const shareLink = useCallback(async () => {
    if (!generatedUrl) return;
    try {
      await Share.share({ message: generatedUrl });
    } catch { /* user cancelled */ }
  }, [generatedUrl]);

  return (
    <View style={ug.card}>
      <TouchableOpacity style={ug.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.75}>
        <View style={{ flex: 1 }}>
          <Text style={ug.title}>Trackable Share Link</Text>
          <Text style={ug.sub}>Generate a UTM link for WhatsApp, agent emails or social posts</Text>
        </View>
        <Ico.ChevDown s={18} c={C.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <View style={ug.body}>
          <FieldLabel label="Destination URL" />
          <TextF value={baseUrl} onChange={setBaseUrl} placeholder="https://jackaladventures.com" keyboardType="url" />

          <FieldLabel label="Page Path" />
          <TextF value={path} onChange={setPath} placeholder="/safaris/gorilla-trekking" />

          <FieldLabel label="Source" />
          <View style={ug.chipRow}>
            {UTM_SOURCE_PRESETS.map(s => (
              <TouchableOpacity key={s} style={[ug.chip, source === s && ug.chipOn]} onPress={() => setSource(s)}>
                <Text style={[ug.chipT, source === s && ug.chipTOn]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextF value={source} onChange={setSource} placeholder="Custom source…" />

          <FieldLabel label="Medium" />
          <View style={ug.chipRow}>
            {UTM_MEDIUM_PRESETS.map(m => (
              <TouchableOpacity key={m} style={[ug.chip, medium === m && ug.chipOn]} onPress={() => setMedium(m)}>
                <Text style={[ug.chipT, medium === m && ug.chipTOn]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextF value={medium} onChange={setMedium} placeholder="Custom medium…" />

          <FieldLabel label="Campaign" />
          <TextF value={campaign} onChange={setCampaign} placeholder="e.g. christmas-gorilla-promo" />

          {generatedUrl ? (
            <>
              <View style={ug.resultBox}>
                <Text style={ug.resultText} selectable numberOfLines={3}>{generatedUrl}</Text>
              </View>
              <TouchableOpacity style={ug.shareBtn} onPress={shareLink}>
                <Text style={ug.shareBtnT}>Share Link</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={{ fontSize: 12, color: C.danger, marginTop: 12 }}>Enter a valid destination URL.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const ug = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  title: { fontSize: 14, fontWeight: '700', color: C.text },
  sub: { fontSize: 11.5, color: C.textMuted, marginTop: 2 },
  body: { paddingHorizontal: 14, paddingBottom: 16, borderTopWidth: 1, borderTopColor: C.border },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.primarySoft, borderColor: C.primary },
  chipT: { fontSize: 11, fontWeight: '600', color: C.textMuted },
  chipTOn: { color: C.primary },
  resultBox: { backgroundColor: C.input, borderRadius: 10, padding: 12, marginTop: 16 },
  resultText: { fontSize: 12, color: C.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  shareBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  shareBtnT: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

function MarketingCommandCenterTab() {
  const { t } = useAppPreferences();
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
    utmChannels: [] as { source: string; count: number; pct: number }[],
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

      // UTM channel attribution from marketing_leads
      let utmChannels: { source: string; count: number; pct: number }[] = [];
      try {
        const { data: utmRows } = await supabase
          .from('marketing_leads')
          .select('utm_source, utm_medium');
        const sourceMap: Record<string, number> = {};
        for (const r of (utmRows ?? []) as Record<string, any>[]) {
          const src = (r.utm_source || r.utm_medium || 'Direct').replace(/_/g, ' ');
          const key = src.charAt(0).toUpperCase() + src.slice(1);
          sourceMap[key] = (sourceMap[key] || 0) + 1;
        }
        const utmTotal = Math.max(Object.values(sourceMap).reduce((s, n) => s + n, 0), 1);
        utmChannels = Object.entries(sourceMap)
          .sort(([, a], [, b]) => b - a)
          .map(([source, count]) => ({ source, count, pct: Math.round((count / utmTotal) * 100) }));
      } catch { /* marketing_leads may not exist yet */ }

      setDbStats({
        totalBookings, confirmedBookings, totalRevenue, totalCollected, totalOutstanding,
        leads: leadsCount,
        portalVehicles: visVeh ?? 0, portalPackages: visPkg ?? 0, activePromos: activeProm ?? 0,
        topPackages: topPkgData, funnel: funnelData,
        utmChannels,
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
    <ScrollView
      keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
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

      {/* Trackable share link generator */}
      <UTMLinkGenerator />

      {/* GA4 unavailable banner */}
      {unavailable && (
        <View style={cc.warnBanner}>
          <Text style={cc.warnText}>⚡ GA4 not configured — showing Supabase analytics only.</Text>
          <Text style={cc.warnSub}>Add GA4_SERVICE_ACCOUNT_JSON + GA4_PROPERTY_ID in Supabase Edge Function secrets.</Text>
        </View>
      )}
      {ga4Error && !unavailable && (
        <View style={[cc.warnBanner, { backgroundColor: '#FDE8C0' }]}>
          <Text style={[cc.warnText, { color: '#7a5522' }]}>⚠ {ga4Error}</Text>
        </View>
      )}

      {/* ── SECTION 1: Traffic & Engagement KPIs ─────────────────────────────── */}
      <Text style={cc.sectionHeader}>
        {'🔵 '}{t('marketing.trafficEngagement')}{'  '}
        <Text style={cc.sourceTag}>{s ? 'GA4' : 'Supabase'}</Text>
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {(s ? [
          // GA4 live data
          { label: 'Sessions',   value: s.sessions.toLocaleString(),        color: C.primary  },
          { label: 'Users',      value: s.activeUsers.toLocaleString(),     color: C.gold     },
          { label: 'New Users',  value: s.newUsers.toLocaleString(),        color: C.success  },
          { label: 'Page Views', value: s.screenPageViews.toLocaleString(), color: '#7c3aed'  },
          { label: 'Key Events', value: s.keyEvents.toLocaleString(),                                  color: C.danger   },
          { label: 'Avg Engage', value: formatEngagement(s.userEngagementDuration, s.sessions), color: '#0891b2' },
        ] : [
          // Supabase fallback — always populated from Jackal Dashboard data
          { label: 'Leads',          value: dbStats.leads.toLocaleString(),             color: C.primary  },
          { label: 'Enquiries',      value: dbStats.totalBookings.toLocaleString(),     color: C.gold     },
          { label: 'Confirmed',      value: dbStats.confirmedBookings.toLocaleString(), color: C.success  },
          { label: 'Vehicles Live',  value: dbStats.portalVehicles.toLocaleString(),    color: '#7c3aed'  },
          { label: 'Packages Live',  value: dbStats.portalPackages.toLocaleString(),    color: C.danger   },
          { label: 'Active Promos',  value: dbStats.activePromos.toLocaleString(),      color: '#0891b2'  },
        ]).map(k => (
          <View key={k.label} style={[cc.kpiCard, { borderLeftColor: k.color, borderLeftWidth: 3 }]}>
            <Text style={cc.kpiLabel}>{k.label}</Text>
            <Text style={[cc.kpiVal, { color: k.color }]}>{k.value}</Text>
          </View>
        ))}
      </View>

      {/* ── SECTION 2: Traffic Channels ─────────────────────────────────────── */}
      {ch && (
        <View style={cc.sect}>
          <Text style={cc.sectTitle}>{t('marketing.channelBreakdown')}  <Text style={cc.sourceTagInline}>GA4</Text></Text>
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

      {/* Source / Medium detailed rows */}
      {ga4 && ga4.sourceMedium.length > 0 && (
        <View style={cc.sect}>
          <Text style={cc.sectTitle}>{t('marketing.sourceMedium')}  <Text style={cc.sourceTagInline}>GA4</Text></Text>
          {ga4.sourceMedium.slice(0, 10).map((r, i) => {
            const color = CHANNEL_COLORS[r.source] || C.textMuted;
            return (
              <View key={i} style={cc.funnelRow}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
                <Text style={[cc.funnelLabel, { width: 90 }]} numberOfLines={1}>
                  {r.source} / {r.medium}
                </Text>
                <View style={{ flex: 1, height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginHorizontal: 8 }}>
                  <View style={{ height: 5, width: `${r.pct}%` as any, backgroundColor: color, borderRadius: 3 }} />
                </View>
                <Text style={[cc.funnelCount, { color, minWidth: 40, textAlign: 'right' }]}>{r.sessions.toLocaleString()}</Text>
                <Text style={[cc.kpiSub, { minWidth: 28, textAlign: 'right' }]}>{r.pct}%</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* UTM attribution from marketing_leads — always shown alongside or when GA4 unavailable */}
      {dbStats.utmChannels.length > 0 && (
        <View style={cc.sect}>
          <Text style={cc.sectTitle}>{t('marketing.leadAttribution')}  <Text style={cc.sourceTagInline}>Supabase · UTM</Text></Text>
          {dbStats.utmChannels.map(({ source, count, pct }) => {
            const color = CHANNEL_COLORS[source] || C.gold;
            return (
              <View key={source} style={cc.funnelRow}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
                <Text style={[cc.funnelLabel, { width: 80 }]}>{source}</Text>
                <View style={{ flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginHorizontal: 8 }}>
                  <View style={{ height: 6, width: `${pct}%` as any, backgroundColor: color, borderRadius: 3 }} />
                </View>
                <Text style={[cc.funnelCount, { color }]}>{count.toLocaleString()}</Text>
                <Text style={[cc.kpiSub, { minWidth: 32, textAlign: 'right' }]}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── SECTION 3: Top Pages ────────────────────────────────────────────── */}
      {ga4 && ga4.topPages.length > 0 && (
        <View style={cc.sect}>
          <Text style={cc.sectTitle}>{t('marketing.topPages')}  <Text style={cc.sourceTagInline}>GA4</Text></Text>
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
          <Text style={cc.sectTitle}>{t('marketing.socialTraffic')}  <Text style={cc.sourceTagInline}>GA4</Text></Text>
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
          <Text style={cc.sectTitle}>{t('marketing.audienceInsights')}  <Text style={cc.sourceTagInline}>GA4</Text></Text>
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
      <Text style={cc.sectionHeader}>{'🟣 '}{t('marketing.conversionsRevenue')}  <Text style={cc.sourceTag}>Supabase</Text></Text>
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
        <Text style={cc.sectTitle}>{t('marketing.revenueCollection')}</Text>
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
          <Text style={cc.sectTitle}>{t('marketing.bookingFunnel')}  <Text style={cc.sourceTagInline}>Supabase</Text></Text>
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
        <Text style={cc.sectTitle}>{t('marketing.portalCatalogLive')}  <Text style={cc.sourceTagInline}>Supabase</Text></Text>
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
          <Text style={cc.sectTitle}>{t('marketing.topPackages')}  <Text style={cc.sourceTagInline}>Supabase</Text></Text>
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
  warnText:     { fontSize: 12, fontWeight: '700', color: '#7a5522', marginBottom: 2 },
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
  const { t } = useAppPreferences();
  const [period, setPeriod] = useState<DatePreset>('30d');
  const { data: ga4, loading, refreshing, stale, error, unavailable, refresh } = useGA4Analytics(period);

  if (loading) return <LoadingView label="Loading analytics…" />;

  const eng = ga4?.engagement;
  const ch  = ga4?.channels;
  const totalCh = ch ? Object.values(ch).reduce((a, b) => a + b, 0) || 1 : 1;

  // Derive engagement KPIs — prefer engagement object, fall back to summary
  const s = ga4?.summary;
  const totalUsers    = eng?.totalUsers    ?? s?.totalUsers ?? s?.activeUsers ?? 0;
  const newUsers      = eng?.newUsers      ?? s?.newUsers ?? 0;
  const returningUsers = eng?.returningUsers ?? Math.max(0, totalUsers - newUsers);
  const avgEngTime    = eng?.avgEngagementTimePerUser
    ?? (s && totalUsers > 0 ? s.userEngagementDuration / totalUsers : 0);
  const engSessPerUser = eng?.engagedSessionsPerUser
    ?? (s && totalUsers > 0 ? s.engagedSessions / totalUsers : 0);
  const eventCount    = eng?.eventCount  ?? s?.eventCount ?? 0;
  const keyEventsVal  = eng?.keyEvents   ?? s?.keyEvents  ?? 0;
  const convRate      = eng?.userKeyEventRate
    ?? (totalUsers > 0 ? keyEventsVal / totalUsers : 0);
  const keyEventsList = eng?.keyEventsList ?? [];

  const fmtSecs = (sec: number) => {
    if (!sec || !isFinite(sec)) return '0s';
    const m = Math.floor(sec / 60);
    const r = Math.round(sec % 60);
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.primary} />}>

      {/* Date range + Live GA4 badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {(['7d','30d','90d'] as DatePreset[]).map(p => (
          <TouchableOpacity key={p} style={[cc.periodBtn, period === p && cc.periodBtnOn]} onPress={() => setPeriod(p)}>
            <Text style={[cc.periodT, period === p && cc.periodTOn]}>
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: ga4 && !stale ? '#d1fae5' : C.border,
          borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3,
            backgroundColor: ga4 && !stale ? C.success : C.textMuted }} />
          <Text style={{ fontSize: 10, fontWeight: '600',
            color: ga4 && !stale ? C.success : C.textMuted }}>
            {ga4 && !stale ? 'Live GA4' : stale ? 'Cached' : 'No Data'}
          </Text>
        </View>
      </View>

      {ga4 && (
        <>
          {/* ── Engagement Metrics (8 KPIs matching web) ── */}
          <View style={cc.sect}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Text style={cc.sectTitle}>{t('marketing.engagementMetrics')}</Text>
              <View style={{ backgroundColor: C.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: '600' }}>From Google Analytics</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { label: 'Total Users',        value: totalUsers.toLocaleString(),          color: C.primary },
                { label: 'New Users',           value: newUsers.toLocaleString(),            color: C.success },
                { label: 'Returning Users',     value: returningUsers.toLocaleString(),      color: C.gold    },
                { label: 'Avg Engage / User',   value: fmtSecs(avgEngTime),                  color: '#0891b2' },
                { label: 'Engaged Sess / User', value: engSessPerUser.toFixed(2),            color: '#7c3aed' },
                { label: 'Event Count',         value: eventCount.toLocaleString(),          color: '#d97706' },
                { label: 'Conversions',         value: keyEventsVal.toLocaleString(),        color: C.danger  },
                { label: 'Conversion Rate',     value: convRate.toFixed(2),                  color: '#0891b2' },
              ].map(k => (
                <View key={k.label} style={cc.kpiCard}>
                  <Text style={cc.kpiLabel}>{k.label}</Text>
                  <Text style={[cc.kpiVal, { color: k.color }]}>{k.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Top Conversions ── */}
          {keyEventsList.length > 0 && (
            <View style={cc.sect}>
              <Text style={cc.sectTitle}>{t('marketing.topConversions')}</Text>
              {keyEventsList.slice(0, 8).map((k, i) => (
                <View key={i} style={[cc.funnelRow, {
                  borderBottomWidth: i < keyEventsList.length - 1 ? 1 : 0,
                  borderBottomColor: C.border, paddingBottom: 7, marginBottom: 4,
                }]}>
                  <Text style={[cc.funnelLabel, { flex: 1 }]} numberOfLines={1}>{k.eventName}</Text>
                  <Text style={[cc.kpiSub, { marginRight: 12 }]}>{k.eventCount.toLocaleString()} events</Text>
                  <Text style={[cc.funnelCount, { color: C.primary, fontWeight: '700', minWidth: 60, textAlign: 'right' }]}>
                    {k.keyEvents.toLocaleString()} conv
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Traffic Sources (Channels) ── */}
          {ch && (
            <View style={cc.sect}>
              <Text style={cc.sectTitle}>{t('marketing.trafficSources')}</Text>
              {(Object.entries(ch) as [string, number][])
                .filter(([,v]) => v > 0).sort(([,a],[,b]) => b - a)
                .map(([channel, sessions]) => {
                  const pct   = Math.round((sessions / totalCh) * 100);
                  const color = CHANNEL_COLORS[channel] || C.textMuted;
                  return (
                    <View key={channel} style={cc.funnelRow}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
                      <Text style={[cc.funnelLabel, { width: 68 }]}>{channel}</Text>
                      <View style={{ flex: 1, height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginHorizontal: 8 }}>
                        <View style={{ height: 5, width: `${pct}%` as any, backgroundColor: color, borderRadius: 3 }} />
                      </View>
                      <Text style={[cc.kpiSub, { minWidth: 30, textAlign: 'right', marginRight: 4 }]}>{pct}%</Text>
                      <Text style={[cc.funnelCount, { color, minWidth: 44, textAlign: 'right' }]}>{sessions.toLocaleString()}</Text>
                    </View>
                  );
                })}
            </View>
          )}

          {/* ── Source / Medium detail ── */}
          {ga4!.sourceMedium.length > 0 && (
            <View style={cc.sect}>
              <Text style={cc.sectTitle}>{t('marketing.sourceMedium')}</Text>
              {ga4!.sourceMedium.slice(0, 12).map((r, i) => {
                const color = CHANNEL_COLORS[r.source] || C.textMuted;
                return (
                  <View key={i} style={cc.funnelRow}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
                    <Text style={[cc.funnelLabel, { flex: 1 }]} numberOfLines={1}>
                      {r.source} / {r.medium}
                    </Text>
                    <Text style={[cc.kpiSub, { marginRight: 8 }]}>{r.pct}%</Text>
                    <Text style={[cc.funnelCount, { color, minWidth: 44, textAlign: 'right' }]}>{r.sessions.toLocaleString()}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Device Distribution + Browser Breakdown ── */}
          {ga4!.audience.devices.length > 0 && (
            <View style={cc.sect}>
              <Text style={cc.sectTitle}>{t('marketing.deviceDistribution')}</Text>
              {ga4!.audience.devices.map((d, i) => {
                const color = [C.primary, C.success, C.gold][i] ?? C.textMuted;
                return (
                  <View key={i} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={cc.pkgName}>{d.label.charAt(0).toUpperCase() + d.label.slice(1)}</Text>
                      <Text style={cc.kpiSub}>{d.sessions.toLocaleString()} · {d.pct}%</Text>
                    </View>
                    <View style={{ height: 5, backgroundColor: C.border, borderRadius: 3 }}>
                      <View style={{ height: 5, width: `${d.pct}%` as any, backgroundColor: color, borderRadius: 3 }} />
                    </View>
                  </View>
                );
              })}
              {ga4!.browserData && ga4!.browserData.length > 0 && (() => {
                const total = ga4!.browserData!.reduce((s, b) => s + b.sessions, 0) || 1;
                return (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
                    <Text style={[cc.kpiLabel, { marginBottom: 8 }]}>Top Browsers</Text>
                    {ga4!.browserData!.slice(0, 5).map((b, i) => {
                      const pct = Math.round((b.sessions / total) * 100);
                      return (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={[cc.funnelLabel, { width: 84 }]} numberOfLines={1}>{b.browser}</Text>
                          <View style={{ flex: 1, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden', marginHorizontal: 6 }}>
                            <View style={{ height: 4, width: `${pct}%` as any, backgroundColor: C.primary, borderRadius: 2 }} />
                          </View>
                          <Text style={[cc.kpiSub, { minWidth: 32, textAlign: 'right' }]}>{pct}%</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
            </View>
          )}

          {/* ── Geographic Insights ── */}
          {ga4!.audience.countries.length > 0 && (
            <View style={cc.sect}>
              <Text style={cc.sectTitle}>{t('marketing.geoInsights')}</Text>
              {ga4!.audience.countries.slice(0, 8).map((c, i) => (
                <View key={i} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={cc.pkgName} numberOfLines={1}>{i + 1}. {c.label}</Text>
                    <Text style={cc.kpiSub}>{c.sessions.toLocaleString()} sessions</Text>
                  </View>
                  <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2 }}>
                    <View style={{ height: 4, width: `${c.pct}%` as any, backgroundColor: C.primary, borderRadius: 2 }} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Social Media Traffic ── */}
          {Object.keys(ga4!.socialTraffic).length > 0 && (
            <View style={cc.sect}>
              <Text style={cc.sectTitle}>{t('marketing.socialMediaTraffic')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {Object.entries(ga4!.socialTraffic)
                  .sort(([,a],[,b]) => (b as number) - (a as number))
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

          {/* ── Top Performing Pages ── */}
          {ga4!.topPages.length > 0 && (
            <View style={cc.sect}>
              <Text style={cc.sectTitle}>{t('marketing.topPerformingPages')}</Text>
              {ga4!.topPages.slice(0, 10).map((p, i) => (
                <View key={i} style={cc.pkgRow}>
                  <View style={cc.pkgRank}><Text style={cc.pkgRankT}>{i + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={cc.pkgName} numberOfLines={1}>{p.path}</Text>
                    <View style={{ height: 3, backgroundColor: C.border, borderRadius: 2, marginTop: 3 }}>
                      <View style={{ height: 3, width: `${p.pct}%` as any, backgroundColor: C.primary, borderRadius: 2 }} />
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', minWidth: 60 }}>
                    <Text style={cc.pkgBkgs}>{p.views.toLocaleString()}</Text>
                    <Text style={[cc.kpiSub, {
                      color: (p.bounceRate ?? 0) > 70 ? C.danger : C.textMuted,
                    }]}>
                      {p.bounceRate !== undefined ? `${p.bounceRate}% bounce` : `${p.engagedSessions} eng`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {!ga4 && !loading && (
        <View style={an.connectCard}>
          <Text style={an.connectTitle}>No Analytics Data</Text>
          <Text style={an.connectSub}>Pull down to refresh.</Text>
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
// GOOGLE ADS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function GoogleAdsTab() {
  const { t } = useAppPreferences();
  const [period, setPeriod] = useState<DatePreset>('30d');
  // No Google Ads API credentials here — the website doesn't use a developer
  // token, customer ID, client ID/secret or refresh token either. Ads
  // numbers come from Google Ads via its GA4 link, through the same
  // ga4-analytics dashboard service the website calls. Confirmed the real
  // response shape directly against the live function before wiring this.
  const { data, loading, refreshing, stale, error, refresh } = useGA4Analytics(period);
  const ads = data?.ads;

  const fmt$ = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
  const fmtN = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));

  if (loading) return <LoadingView label="Loading Ads data…" />;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.primary} />}
    >
      {/* Period selector */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['7d', '30d', '90d', '12m'] as DatePreset[]).map(p => (
          <TouchableOpacity key={p} style={[cc.periodBtn, period === p && cc.periodBtnOn]} onPress={() => setPeriod(p)}>
            <Text style={[cc.periodT, period === p && cc.periodTOn]}>
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '12 Months'}
            </Text>
          </TouchableOpacity>
        ))}
        {stale && <Text style={{ fontSize: 10, color: C.textMuted, marginLeft: 4 }}>⚠ cached</Text>}
        {data?.fetchedAt && !stale && (
          <Text style={{ fontSize: 10, color: C.textMuted, marginLeft: 4 }}>
            Updated {new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>

      {error && (
        <View style={[cc.warnBanner, { backgroundColor: '#FDE8C020', borderColor: '#F59E0B' }]}>
          <Text style={[cc.warnText, { color: '#7a5522' }]}>⚠ {error}</Text>
        </View>
      )}

      {!ads ? (
        <EmptyView title={t('marketing.noAdsData')} sub={t('marketing.pullToRefresh')} />
      ) : !ads.costDataAvailable ? (
        // Same flag and message the website uses — never show 0s when cost
        // data genuinely isn't linked, since that reads as "no ad spend"
        // rather than "we can't see ad spend."
        <View style={ga.unavailCard}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>📢</Text>
          <Text style={ga.unavailTitle}>{t('marketing.adCostNotAvailable')}</Text>
          <Text style={ga.unavailSub}>{ads.costNote || "Google Ads isn't linked to Analytics for this property yet."}</Text>
        </View>
      ) : (
        <>
          {/* ── KPI Summary ──────────────────────────────────────────────────── */}
          <Text style={cc.sectionHeader}>
            {'📢 '}{t('marketing.adsPerformance')}  <Text style={cc.sourceTag}>Google Ads via GA4</Text>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {[
              { label: t('marketing.adSpend'),       value: fmt$(ads.totals.cost),                color: C.danger   },
              { label: t('marketing.adImpressions'), value: fmtN(ads.totals.impressions),         color: C.primary  },
              { label: t('marketing.adClicks'),      value: fmtN(ads.totals.clicks),              color: C.gold     },
              { label: t('marketing.adCtr'),         value: `${ads.totals.ctr.toFixed(2)}%`,      color: '#7c3aed'  },
              { label: t('marketing.adAvgCpc'),      value: fmt$(ads.totals.cpc),                 color: '#0891b2'  },
              { label: t('marketing.adVisits'),      value: fmtN(ads.totals.sessions),            color: C.success  },
              { label: t('marketing.adConversions'), value: fmtN(ads.totals.conversions),         color: C.gold     },
              { label: t('marketing.adCostPerConv'), value: ads.totals.conversions > 0 ? fmt$(ads.totals.costPerConversion) : '—', color: C.textMuted },
            ].map(k => (
              <View key={k.label} style={[cc.kpiCard, { borderLeftColor: k.color, borderLeftWidth: 3 }]}>
                <Text style={cc.kpiLabel}>{k.label}</Text>
                <Text style={[cc.kpiVal, { color: k.color }]}>{k.value}</Text>
              </View>
            ))}
          </View>

          {/* ── Campaigns list ───────────────────────────────────────────────── */}
          {ads.campaigns.length > 0 && (
            <View style={cc.sect}>
              <Text style={cc.sectTitle}>{t('marketing.campaignPerformance')}  <Text style={cc.sourceTagInline}>Google Ads</Text></Text>
              {ads.campaigns.map((c, i) => {
                const pctOfSpend = ads.totals.cost > 0 ? Math.round((c.cost / ads.totals.cost) * 100) : 0;
                return (
                  <View key={`${c.campaign}-${i}`} style={ga.campRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={ga.campName} numberOfLines={1}>{c.campaign}</Text>
                      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4, marginBottom: 4 }}>
                        <Text style={ga.campMeta}>{fmt$(c.cost)}</Text>
                        <Text style={[ga.campMeta, { color: C.primary }]}>{fmtN(c.clicks)} clicks</Text>
                        <Text style={[ga.campMeta, { color: C.success }]}>{fmtN(c.sessions)} visits</Text>
                        {c.conversions > 0 && <Text style={[ga.campMeta, { color: C.gold }]}>{fmtN(c.conversions)} conv</Text>}
                      </View>
                      <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2 }}>
                        <View style={{ height: 4, width: `${Math.min(pctOfSpend, 100)}%` as any, backgroundColor: C.danger + '80', borderRadius: 2 }} />
                      </View>
                    </View>
                    <Text style={[ga.campMeta, { minWidth: 36, textAlign: 'right', fontWeight: '700', color: C.danger }]}>{pctOfSpend}%</Text>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const ga = StyleSheet.create({
  unavailCard: { backgroundColor: C.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  unavailTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 10, textAlign: 'center' },
  unavailSub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  campRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border + '60' },
  campName: { fontSize: 13, fontWeight: '700', color: C.text, flex: 1 },
  campMeta: { fontSize: 11, color: C.textMuted, fontVariant: ['tabular-nums'] },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MARKETING SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

type MarketingTab = 'command-center' | 'vehicles' | 'safaris' | 'analytics' | 'ads';

export function MarketingScreen() {
  const [tab, setTab] = useState<MarketingTab>('command-center');
  const insets = useSafeAreaInsets();
  const { t } = useAppPreferences();

  const tabLabel = useCallback((key: MarketingTab): string => {
    switch (key) {
      case 'command-center': return t('marketing.tabConsole');
      case 'vehicles': return t('marketing.tabVehicles');
      case 'safaris': return t('marketing.tabSafaris');
      case 'analytics': return t('marketing.tabAnalytics');
      case 'ads': return t('marketing.tabAds');
      default: return key;
    }
  }, [t]);

  const TABS: { key: MarketingTab }[] = [
    { key: 'command-center' },
    { key: 'vehicles' },
    { key: 'safaris' },
    { key: 'analytics' },
    { key: 'ads' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Hero header */}
      <View style={[ms.hero, { paddingTop: insets.top + 10 }]}>
        <View style={ms.glowL} /><View style={ms.glowR} />
        <Text style={ms.eyebrow}>{t('marketing.eyebrow')}</Text>
        <Text style={ms.heroTitle}>{tab === 'command-center' ? t('marketing.commandCenter') : t('marketing.title')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ms.tabRow}>
          {TABS.map(t2 => (
            <TouchableOpacity key={t2.key} style={[ms.tabPill, tab === t2.key && ms.tabPillOn]} onPress={() => setTab(t2.key)}>
              <Text style={[ms.tabPillT, tab === t2.key && ms.tabPillTOn]}>{tabLabel(t2.key)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {tab === 'command-center' && <MarketingCommandCenterTab />}
        {tab === 'vehicles'       && <VehicleCatalogTab />}
        {tab === 'safaris'        && <SafariCatalogTab />}
        {tab === 'analytics'      && <WebsiteAnalyticsTab />}
        {tab === 'ads'            && <GoogleAdsTab />}
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  hero: { backgroundColor: C.hero, paddingHorizontal: 20, paddingBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  glowL: { position: 'absolute', top: -30, left: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: '#6c5228', opacity: 0.3 },
  glowR: { position: 'absolute', right: -40, bottom: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: '#4A2E12', opacity: 0.18 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', color: '#C4A882', marginBottom: 5 },
  heroTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: '#fffaf3', marginBottom: 14 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  tabPillOn: { backgroundColor: C.gold, borderColor: C.gold },
  tabPillT: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  tabPillTOn: { color: '#fff' },
});

export default MarketingScreen;
