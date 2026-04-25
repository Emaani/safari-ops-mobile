/**
 * TransactionDetailModal
 * Shows full detail for a financial transaction or cash requisition.
 * Approvers can Approve / Decline pending cash requisitions directly.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { sendCRNotificationToUser } from '../../services/notificationService';
import type { FinancialTransaction, CashRequisition } from '../../types/dashboard';
import { formatCurrency } from '../../lib/utils';

// ─── Palette (matches app-wide branding) ─────────────────────────────────────
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
  income:   '#3d8f6a',
  expense:  '#c96d4d',
};

// ─── Icons ────────────────────────────────────────────────────────────────────
function CloseIcon({ color = C.muted }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  );
}
function CheckIcon({ color = C.success }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}
function XIcon({ color = C.danger }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  );
}
function ReceiptIcon({ color = C.primary }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </Svg>
  );
}
function ArrowUpIcon({ color = C.income }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M22 7l-8.5 8.5-5-5L2 17" />
      <Path d="M16 7h6v6" />
    </Svg>
  );
}
function ArrowDownIcon({ color = C.expense }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M22 17l-8.5-8.5-5 5L2 7" />
      <Path d="M16 17h6v-6" />
    </Svg>
  );
}

// ─── Status badge helpers ─────────────────────────────────────────────────────
const CR_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Pending:   { bg: '#b8883f20', text: '#b8883f' },
  Approved:  { bg: '#3d8f6a20', text: '#3d8f6a' },
  Completed: { bg: '#1f4d4520', text: '#1f4d45' },
  Resolved:  { bg: '#1f4d4520', text: '#1f4d45' },
  Declined:  { bg: '#c96d4d20', text: '#c96d4d' },
  Rejected:  { bg: '#c96d4d20', text: '#c96d4d' },
  Cancelled: { bg: '#7f756520', text: '#7f7565' },
};

function StatusBadge({ status }: { status: string }) {
  const palette = CR_STATUS_COLORS[status] ?? { bg: C.input, text: C.muted };
  return (
    <View style={[statusStyles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[statusStyles.text, { color: palette.text }]}>{status}</Text>
    </View>
  );
}
const statusStyles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  text:  { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
});

// ─── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}
const infoStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f0ebe0' },
  label: { fontSize: 13, color: C.muted, fontWeight: '500', flex: 1 },
  value: { fontSize: 13, color: C.text, fontWeight: '700', textAlign: 'right', flex: 1.5 },
});

// ─── Types ────────────────────────────────────────────────────────────────────
type DetailItem = FinancialTransaction | (CashRequisition & { description?: string });

interface TransactionDetailModalProps {
  item: DetailItem | null;
  itemType: 'transaction' | 'cr';
  visible: boolean;
  onClose: () => void;
  displayCurrency?: 'USD' | 'UGX' | 'KES';
  onRefetch?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TransactionDetailModal({
  item,
  itemType,
  visible,
  onClose,
  displayCurrency = 'USD',
  onRefetch,
}: TransactionDetailModalProps) {
  const [actioning, setActioning] = useState(false);

  if (!item) return null;

  const convertAmount = (amount: number, fromCurrency: string): number => {
    const rates: Record<string, number> = { USD: 1, UGX: 3700, KES: 130 };
    return (amount / (rates[fromCurrency] || 1)) * (rates[displayCurrency] || 1);
  };

  // ── CR Approval action ────────────────────────────────────────────────────
  const handleCRAction = async (newStatus: 'Approved' | 'Declined') => {
    if (!item) return;
    const cr = item as CashRequisition;
    const verb = newStatus === 'Approved' ? 'Approve' : 'Decline';

    Alert.alert(
      `${verb} Requisition`,
      `Are you sure you want to ${verb.toLowerCase()} ${cr.cr_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          style: newStatus === 'Declined' ? 'destructive' : 'default',
          onPress: async () => {
            setActioning(true);
            try {
              // Note: only `approved_at` exists in the DB schema — there is no `declined_at` column.
              const updatePayload: Record<string, unknown> = { status: newStatus };
              if (newStatus === 'Approved') {
                updatePayload.approved_at = new Date().toISOString();
              }

              const { error } = await supabase
                .from('cash_requisitions')
                .update(updatePayload)
                .eq('id', cr.id);

              if (error) throw error;

              // Notify the requester on their device
              const requesterId = (cr as any).requester_id as string | null | undefined;
              if (requesterId) {
                const approvedTitle = newStatus === 'Approved'
                  ? '✅ Cash Requisition Approved'
                  : '❌ Cash Requisition Declined';
                const approvedBody = newStatus === 'Approved'
                  ? `Your requisition ${cr.cr_number} has been approved and is ready for disbursement.`
                  : `Your requisition ${cr.cr_number} has been declined. Please contact your approver for details.`;
                sendCRNotificationToUser(
                  requesterId,
                  approvedTitle,
                  approvedBody,
                  { cr_id: cr.id, cr_number: cr.cr_number, screen: 'Finance' },
                  newStatus === 'Approved' ? 'cr_approved' : 'cr_rejected',
                ).catch(console.error);
              }

              onRefetch?.();
              onClose();
              Alert.alert(
                newStatus === 'Approved' ? '✅ Requisition Approved' : 'Requisition Declined',
                `${cr.cr_number} has been ${newStatus.toLowerCase()}.`
              );
            } catch (e: any) {
              Alert.alert('Error', e?.message || `Failed to ${verb.toLowerCase()} requisition.`);
            } finally {
              setActioning(false);
            }
          },
        },
      ]
    );
  };

  // ── Transaction view ──────────────────────────────────────────────────────
  if (itemType === 'transaction') {
    const t = item as FinancialTransaction;
    const isIncome = t.transaction_type === 'income';
    const displayAmt = convertAmount(t.amount, t.currency || 'USD');
    const date = t.transaction_date
      ? new Date(t.transaction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerEyebrow}>{isIncome ? 'Income' : 'Expense'}</Text>
              <Text style={styles.headerTitle}>Transaction</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <CloseIcon />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {/* Amount hero */}
            <View style={[styles.amountHero, { backgroundColor: isIncome ? C.success + '12' : C.danger + '12' }]}>
              <View style={[styles.amountIcon, { backgroundColor: isIncome ? C.success + '20' : C.danger + '20' }]}>
                {isIncome ? <ArrowUpIcon /> : <ArrowDownIcon />}
              </View>
              <Text style={styles.amountLabel}>Amount</Text>
              <Text style={[styles.amountValue, { color: isIncome ? C.income : C.expense }]}>
                {isIncome ? '+' : '-'}{formatCurrency(displayAmt, displayCurrency)}
              </Text>
              {t.currency !== displayCurrency && (
                <Text style={styles.amountOriginal}>{formatCurrency(t.amount, t.currency || 'USD')}</Text>
              )}
            </View>

            {/* Details card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Transaction Details</Text>
              <InfoRow label="Category"   value={t.category || 'Uncategorized'} />
              <InfoRow label="Date"       value={date} />
              <InfoRow label="Status"     value={t.status} />
              <InfoRow label="Reference"  value={t.reference_number} />
              <InfoRow label="Currency"   value={t.currency} />
            </View>

            {t.description && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Description</Text>
                <Text style={styles.descText}>{t.description}</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // ── Cash Requisition view ─────────────────────────────────────────────────
  const cr = item as CashRequisition & { description?: string };
  const displayAmt = convertAmount(
    cr.amount_usd ?? cr.total_cost,
    cr.amount_usd != null ? 'USD' : (cr.currency || 'USD')
  );
  const createdDate  = cr.created_at  ? new Date(cr.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const dateNeeded   = cr.date_needed ? new Date(cr.date_needed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const isPending    = cr.status === 'Pending';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>Finance</Text>
            <Text style={styles.headerTitle}>Cash Requisition</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <CloseIcon />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {/* Amount hero */}
          <View style={[styles.amountHero, { backgroundColor: C.warning + '10' }]}>
            <View style={[styles.amountIcon, { backgroundColor: C.warning + '20' }]}>
              <ReceiptIcon color={C.warning} />
            </View>
            <Text style={styles.amountLabel}>Requested Amount</Text>
            <Text style={[styles.amountValue, { color: C.text }]}>
              {formatCurrency(displayAmt, displayCurrency)}
            </Text>
            {cr.currency !== displayCurrency && (
              <Text style={styles.amountOriginal}>{formatCurrency(cr.total_cost, cr.currency || 'USD')}</Text>
            )}
            <StatusBadge status={cr.status} />
          </View>

          {/* Details card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Requisition Details</Text>
            <InfoRow label="CR Number"    value={cr.cr_number} />
            <InfoRow label="Category"     value={cr.expense_category} />
            <InfoRow label="Requested By" value={(cr as any).requester_name || cr.requested_by} />
            <InfoRow label="Date Needed"  value={dateNeeded} />
            <InfoRow label="Date Created" value={createdDate} />
            {cr.approver && (
              <InfoRow
                label="Assigned Approver"
                value={cr.approver.full_name?.trim() || cr.approver.email || undefined}
              />
            )}
            {cr.approved_at && (
              <InfoRow
                label="Approved At"
                value={new Date(cr.approved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              />
            )}
            {cr.status === 'Declined' && (
              <InfoRow label="Decision" value="Declined by approver" />
            )}
          </View>

          {cr.description && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Description / Purpose</Text>
              <Text style={styles.descText}>{cr.description}</Text>
            </View>
          )}

          {/* Approve / Decline — shown for Pending requisitions */}
          {isPending && (
            <View style={styles.approvalCard}>
              <Text style={styles.approvalTitle}>Approval Action</Text>
              <Text style={styles.approvalSub}>
                This requisition is awaiting approval. As an authorised approver you can approve or decline it.
              </Text>
              <View style={styles.approvalBtns}>
                <TouchableOpacity
                  style={[styles.approveBtn, actioning && { opacity: 0.6 }]}
                  onPress={() => handleCRAction('Approved')}
                  disabled={actioning}
                  activeOpacity={0.85}
                >
                  {actioning
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <CheckIcon color="#fff" />
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.declineBtn, actioning && { opacity: 0.6 }]}
                  onPress={() => handleCRAction('Declined')}
                  disabled={actioning}
                  activeOpacity={0.85}
                >
                  {actioning
                    ? <ActivityIndicator color={C.danger} size="small" />
                    : <>
                        <XIcon color={C.danger} />
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea:        { flex: 1, backgroundColor: C.bg },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, backgroundColor: C.hero },
  headerEyebrow:   { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 2 },
  headerTitle:     { fontSize: 24, fontWeight: '800', color: '#fffaf3', letterSpacing: -0.6 },
  closeBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  body:            { padding: 20, gap: 14 },

  // Amount hero
  amountHero:      { borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
  amountIcon:      { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  amountLabel:     { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountValue:     { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  amountOriginal:  { fontSize: 13, color: C.muted, marginTop: -4 },

  // Detail card
  card:            { backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border },
  cardTitle:       { fontSize: 13, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  descText:        { fontSize: 14, color: C.text, lineHeight: 22 },

  // Approval
  approvalCard:    { backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.warning + '50' },
  approvalTitle:   { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 6 },
  approvalSub:     { fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 16 },
  approvalBtns:    { flexDirection: 'row', gap: 10 },
  approveBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.success, borderRadius: 14, paddingVertical: 14 },
  approveBtnText:  { fontSize: 15, fontWeight: '800', color: '#fff' },
  declineBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.danger + '12', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: C.danger + '40' },
  declineBtnText:  { fontSize: 15, fontWeight: '800', color: C.danger },
});
