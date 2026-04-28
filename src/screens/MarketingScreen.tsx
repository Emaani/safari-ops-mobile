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
  useState, useCallback, useEffect, useMemo,
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
import { formatCurrency } from '../lib/utils';
import type { PortalVehicle, Promotion, SafariPackage } from '../types/safari';

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
// VEHICLE CATALOG TAB
// ═══════════════════════════════════════════════════════════════════════════════

function VehicleCatalogTab() {
  const [vehicles, setVehicles] = useState<PortalVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const fetchVehicles = useCallback(async () => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, license_plate, make, model, capacity, status, portal_visible, portal_description, portal_category, daily_rate_usd')
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
      {/* Info banner */}
      <View style={vc.banner}>
        <Ico.Globe s={16} c={C.primary} />
        <Text style={vc.bannerText}>{visibleCount} of {vehicles.length} vehicles visible on customer portal</Text>
      </View>
      <FlatList
        data={vehicles}
        keyExtractor={i => i.id}
        renderItem={({ item: v }) => (
          <View style={vc.card}>
            <View style={[vc.statusDot, { backgroundColor: v.status === 'available' ? C.success + '20' : C.gold + '20' }]}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: v.status === 'available' ? C.success : C.gold }}>{v.status?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={vc.plate}>{v.license_plate}</Text>
              <Text style={vc.model}>{v.make} {v.model}{v.capacity ? ` · ${v.capacity}` : ''}</Text>
              {v.portal_category ? <Text style={vc.cat}>{v.portal_category}</Text> : null}
              {v.daily_rate_usd ? <Text style={vc.rate}>{formatCurrency(v.daily_rate_usd, 'USD')} / day</Text> : null}
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
          </View>
        )}
        ListEmptyComponent={<EmptyView title="No vehicles found" sub="Add vehicles in the Fleet tab first." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      />
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
  toggleWrap: { alignItems: 'center', gap: 4 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// SAFARI CATALOG TAB
// ═══════════════════════════════════════════════════════════════════════════════

function SafariCatalogTab() {
  const [packages, setPackages] = useState<SafariPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const fetchPkgs = useCallback(async () => {
    const { data, error } = await supabase
      .from('safari_packages')
      .select('id, package_code, name, description, category, country, duration_days, price_usd, is_active, portal_visible, portal_highlight')
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
          <View style={sc2.card}>
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
          </View>
        )}
        ListEmptyComponent={<EmptyView title="No packages found" sub="Create safari packages in the Safari Management screen." />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      />
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
// MAIN MARKETING SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

type MarketingTab = 'vehicles' | 'safaris' | 'promotions';

export function MarketingScreen() {
  const [tab, setTab] = useState<MarketingTab>('vehicles');
  const insets = useSafeAreaInsets();

  const TABS: { key: MarketingTab; label: string }[] = [
    { key: 'vehicles',   label: 'Vehicle Catalog' },
    { key: 'safaris',    label: 'Safari Catalog' },
    { key: 'promotions', label: 'Promotions' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Hero header */}
      <View style={[ms.hero, { paddingTop: insets.top + 10 }]}>
        <View style={ms.glowL} /><View style={ms.glowR} />
        <Text style={ms.eyebrow}>Portal</Text>
        <Text style={ms.heroTitle}>Marketing</Text>
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
        {tab === 'vehicles'   && <VehicleCatalogTab />}
        {tab === 'safaris'    && <SafariCatalogTab />}
        {tab === 'promotions' && <PromotionsTab />}
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
