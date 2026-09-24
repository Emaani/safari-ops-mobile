import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Svg, Path, Circle, Line } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';
import type { Booking } from '../../types/dashboard';
import type { SafariFieldReport } from '../../types/safari';
import { formatCurrency } from '../../lib/utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary:    '#8B6B3E',
  gold:       '#C6A563',
  success:    '#34A853',
  warning:    '#F5A623',
  danger:     '#FF3B30',
  purple:     '#7A5AF8',
  safari:     '#C6A563',
  background: '#F2F2F7',
  card:       '#FFFFFF',
  text:       '#1C1C1E',
  textMuted:  '#6C6C70',
  border:     '#E5E5EA',
  input:      '#F2F2F7',
  primarySoft:'#FEF0DC',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Confirmed:     { bg: '#FEF0DC', text: '#8B6B3E' },
  'In-Progress': { bg: '#E8F7EE', text: '#1A6B3C' },
  Completed:     { bg: '#EDE8FE', text: '#5436CC' },
};

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function CloseIcon({ size = 24, color = COLORS.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

function CompassIcon({ size = 24, color = COLORS.safari }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </Svg>
  );
}

function FileTextIcon({ size = 22, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </Svg>
  );
}

function EyeIcon({ size = 16, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

function DownloadIcon({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M7 10l5 5 5-5" /><Path d="M12 15V3" />
    </Svg>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function fmtBytes(n?: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

// ============================================================================
// DOCUMENTS TAB
// ============================================================================

function DocumentsTab({ bookingId }: { bookingId: string }) {
  const [reports, setReports] = useState<SafariFieldReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    setLoading(true);
    supabase.from('safari_field_reports')
      .select('id, booking_id, file_name, file_url, file_size, file_type, notes, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setReports((data || []) as SafariFieldReport[]);
        setLoading(false);
      });
  }, [bookingId]);

  const openPreview = useCallback(async (report: SafariFieldReport) => {
    if (!report.file_url) return;
    const isPdf = report.file_type?.includes('pdf') || report.file_name?.toLowerCase().endsWith('.pdf');
    const viewerUrl = isPdf
      ? `https://docs.google.com/viewer?url=${encodeURIComponent(report.file_url)}&embedded=true`
      : report.file_url;
    await WebBrowser.openBrowserAsync(viewerUrl, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  }, []);

  const downloadReport = useCallback(async (report: SafariFieldReport) => {
    if (!report.file_url) return;
    setDownloading(report.id);
    try {
      const ext = report.file_name.includes('.') ? report.file_name.split('.').pop() : 'pdf';
      const localUri = FileSystem.documentDirectory + `field_report_${report.id.slice(0, 8)}.${ext}`;
      const { uri } = await FileSystem.downloadAsync(report.file_url, localUri);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: report.file_type || 'application/pdf',
          dialogTitle: report.file_name,
          UTI: report.file_type?.includes('pdf') ? 'com.adobe.pdf' : undefined,
        });
      } else {
        await Linking.openURL(report.file_url);
      }
    } catch (e: any) {
      Alert.alert('Download Failed', e?.message || 'Could not download the file.');
    } finally { setDownloading(null); }
  }, []);

  if (loading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 48 }}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (reports.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 52, paddingHorizontal: 32 }}>
        <View style={ds.emptyIcon}><FileTextIcon size={26} color={COLORS.textMuted} /></View>
        <Text style={ds.emptyTitle}>No Field Reports</Text>
        <Text style={ds.emptySub}>
          Upload post-safari field reports from the Operations tab in Safari Management.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 4 }}>
      {reports.map(r => {
        const isPdf = r.file_type?.includes('pdf') || r.file_name?.toLowerCase().endsWith('.pdf');
        const isLoading = downloading === r.id;
        return (
          <View key={r.id} style={ds.reportCard}>
            <View style={ds.reportIcon}><FileTextIcon size={20} color={COLORS.primary} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={ds.reportName} numberOfLines={2}>{r.file_name}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {r.file_size ? <Text style={ds.reportMeta}>{fmtBytes(r.file_size)}</Text> : null}
                <View style={[ds.typePill, { backgroundColor: isPdf ? '#FFF0E0' : '#EEEEFF' }]}>
                  <Text style={[ds.typePillT, { color: isPdf ? '#8B4513' : '#3B5BDB' }]}>
                    {isPdf ? 'PDF' : (r.file_type?.split('/')[1]?.toUpperCase() || 'DOC')}
                  </Text>
                </View>
                {r.created_at ? <Text style={ds.reportMeta}>{fmtDate(r.created_at)}</Text> : null}
              </View>
              {r.notes ? <Text style={ds.reportNotes} numberOfLines={2}>{r.notes}</Text> : null}
            </View>
            <View style={{ gap: 8, flexShrink: 0 }}>
              <TouchableOpacity style={ds.actionBtn} onPress={() => openPreview(r)}>
                <EyeIcon size={13} color={COLORS.primary} />
                <Text style={ds.actionBtnT}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ds.actionBtn, ds.downloadBtn, isLoading && { opacity: 0.6 }]}
                onPress={() => downloadReport(r)} disabled={isLoading}>
                {isLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <>
                      <DownloadIcon size={13} color="#fff" />
                      <Text style={[ds.actionBtnT, { color: '#fff' }]}>Save</Text>
                    </>
                  )}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const ds = StyleSheet.create({
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18 },
  reportCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  reportIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reportName: { fontSize: 13, fontWeight: '700', color: COLORS.text, lineHeight: 17 },
  reportMeta: { fontSize: 11, color: COLORS.textMuted },
  reportNotes: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 4, lineHeight: 16 },
  typePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  typePillT: { fontSize: 9, fontWeight: '700' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary, minWidth: 60, justifyContent: 'center' },
  actionBtnT: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  downloadBtn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});

// ============================================================================
// COMPONENT
// ============================================================================

interface SafariDetailModalProps {
  safari: (Booking & { vehicle?: { name: string }; destination?: string; pax_count?: number }) | null;
  visible: boolean;
  onClose: () => void;
}

type DetailTab = 'overview' | 'documents';

export function SafariDetailModal({ safari, visible, onClose }: SafariDetailModalProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // Reset to overview when a new safari opens
  useEffect(() => { if (visible) setActiveTab('overview'); }, [visible]);

  if (!safari) return null;

  const statusColors = STATUS_COLORS[safari.status] || STATUS_COLORS.Confirmed;
  const clientName = safari.client?.company_name || 'Unknown Client';
  const assignedUser = safari.profiles?.full_name || 'Unassigned';
  const startDate = new Date(safari.start_date).toLocaleDateString();
  const endDate = new Date(safari.end_date).toLocaleDateString();
  const amountPaid = safari.amount_paid || 0;
  const totalCost = safari.total_cost || 0;
  const balance = totalCost - amountPaid;
  const currency = safari.currency || 'USD';

  const start = new Date(safari.start_date);
  const end = new Date(safari.end_date);
  const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const extSafari = safari as any;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <CompassIcon size={24} color={COLORS.safari} />
            </View>
            <View>
              <Text style={styles.headerTitle}>{safari.booking_number || `#${safari.id.slice(0, 8)}`}</Text>
              <Text style={styles.headerSubtitle}>Safari Trip</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <CloseIcon size={24} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnOn]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabBtnT, activeTab === 'overview' && styles.tabBtnTOn]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'documents' && styles.tabBtnOn]}
            onPress={() => setActiveTab('documents')}
          >
            <Text style={[styles.tabBtnT, activeTab === 'documents' && styles.tabBtnTOn]}>Documents</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <>
              {/* Status Badge */}
              <View style={styles.statusSection}>
                <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                  <Text style={[styles.statusText, { color: statusColors.text }]}>{safari.status}</Text>
                </View>
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{durationDays} Days</Text>
                </View>
              </View>

              {/* Trip Overview */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Trip Overview</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Start Date</Text>
                    <Text style={styles.infoValue}>{startDate}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>End Date</Text>
                    <Text style={styles.infoValue}>{endDate}</Text>
                  </View>
                  {extSafari.destination && (
                    <View style={[styles.infoItem, { width: '100%' }]}>
                      <Text style={styles.infoLabel}>Destination</Text>
                      <Text style={styles.infoValue}>{extSafari.destination}</Text>
                    </View>
                  )}
                  {extSafari.pax_count && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Passengers</Text>
                      <Text style={styles.infoValue}>{extSafari.pax_count} pax</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Client & Assignment */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Assignment</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Client</Text>
                    <Text style={styles.infoValue}>{clientName}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Driver/Guide</Text>
                    <Text style={styles.infoValue}>{assignedUser}</Text>
                  </View>
                  {safari.vehicle && (
                    <View style={[styles.infoItem, { width: '100%' }]}>
                      <Text style={styles.infoLabel}>Vehicle</Text>
                      <Text style={styles.infoValue}>{safari.vehicle.name}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Payment Information */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment Information</Text>
                <View style={styles.paymentGrid}>
                  <View style={[styles.paymentItem, { backgroundColor: '#D8F0E4' }]}>
                    <Text style={styles.paymentLabel}>Total Cost</Text>
                    <Text style={styles.paymentValue}>{formatCurrency(totalCost, currency)}</Text>
                  </View>
                  <View style={[styles.paymentItem, { backgroundColor: '#D8F0E4' }]}>
                    <Text style={styles.paymentLabel}>Amount Paid</Text>
                    <Text style={[styles.paymentValue, { color: COLORS.success }]}>{formatCurrency(amountPaid, currency)}</Text>
                  </View>
                  <View style={[styles.paymentItem, { backgroundColor: balance > 0 ? '#FDE8C0' : '#D8F0E4' }]}>
                    <Text style={styles.paymentLabel}>Balance</Text>
                    <Text style={[styles.paymentValue, { color: balance > 0 ? COLORS.warning : COLORS.success }]}>{formatCurrency(balance, currency)}</Text>
                  </View>
                </View>
              </View>

              {/* Notes */}
              {extSafari.notes && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <Text style={styles.notesText}>{extSafari.notes}</Text>
                </View>
              )}
            </>
          )}

          {/* ── DOCUMENTS ── */}
          {activeTab === 'documents' && (
            <View style={{ paddingTop: 12 }}>
              <DocumentsTab bookingId={safari.id} />
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#D8F0E4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
  },
  tabBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabBtnOn: {
    borderBottomColor: COLORS.primary,
  },
  tabBtnT: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabBtnTOn: {
    color: COLORS.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  durationBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#D8F0E4',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.safari,
  },
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    width: '50%',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  paymentGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentItem: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  notesText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 32,
  },
});
