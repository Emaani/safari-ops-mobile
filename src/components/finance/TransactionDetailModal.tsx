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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { sendCRNotificationToUser } from '../../services/notificationService';
import { useCashRequisitionStatus, type CrStatusAction } from '../../hooks/useCashRequisitionStatus';
import { useUserRole } from '../../hooks/useUserRole';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { resolveDisplayAmount, DEFAULT_RATES } from '../../hooks/useExchangeRate';
import { enqueueCrAction } from '../../lib/crStatusQueue';
import type { FinancialTransaction, CashRequisition } from '../../types/dashboard';
import { formatCurrency } from '../../lib/utils';
import { getErrorMessage } from '../../lib/errors';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';

// ─── Palette (matches app-wide branding) ─────────────────────────────────────
const C = {
  bg:       '#F2F2F7',
  card:     '#FFFFFF',
  hero:     '#1C1611',
  primary:  '#8B6B3E',
  success:  '#34A853',
  danger:   '#FF3B30',
  warning:  '#F5A623',
  text:     '#1C1C1E',
  muted:    '#6C6C70',
  border:   '#E5E5EA',
  input:    '#F2F2F7',
  income:   '#34A853',
  expense:  '#FF3B30',
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
  Pending:   { bg: '#FEF3DC', text: '#7a5000' },
  Approved:  { bg: '#E8F7EE', text: '#1A6B3C' },
  Completed: { bg: '#EDE8FE', text: '#5436CC' },
  Resolved:  { bg: '#EDE8FE', text: '#5436CC' },
  Declined:  { bg: '#FFEEED', text: '#CC1400' },
  Rejected:  { bg: '#FFEEED', text: '#CC1400' },
  Cancelled: { bg: '#F2F2F7', text: '#6C6C70' },
};

function crStatusLabel(status: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    Pending: 'safari.statusPending', Approved: 'txnDetail.statusApproved',
    Completed: 'txnDetail.statusCompleted', Resolved: 'txnDetail.statusResolved',
    Declined: 'txnDetail.statusDeclined', Rejected: 'txnDetail.statusRejected',
    Cancelled: 'txnDetail.statusCancelled',
  };
  const k = map[status];
  return k ? t(k) : status;
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useAppPreferences();
  const palette = CR_STATUS_COLORS[status] ?? { bg: C.input, text: C.muted };
  return (
    <View style={[statusStyles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[statusStyles.text, { color: palette.text }]}>{crStatusLabel(status, t)}</Text>
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
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F5ECD9' },
  label: { fontSize: 13, color: C.muted, fontWeight: '500', flex: 1 },
  value: { fontSize: 13, color: C.text, fontWeight: '700', textAlign: 'right', flex: 1.5 },
});

// ─── Audit timeline ───────────────────────────────────────────────────────────
// Built only from fields the server actually persists on cash_requisitions
// (created_at, approved_at, declined_at, status). There is no decline_reason,
// cancel_reason, or cancelled_at column yet, so Declined/Cancelled steps show
// without a reason or — for Cancelled — without a timestamp. See the web-team
// proposal in CR_AUDIT_TRAIL_PROPOSAL.md before adding those.
function AuditStep({
  label, time, sublabel, tone = 'done', isLast = false,
}: { label: string; time?: string; sublabel?: string; tone?: 'done' | 'active' | 'danger' | 'muted'; isLast?: boolean }) {
  const dotColor = tone === 'done' ? C.success : tone === 'active' ? C.warning : tone === 'danger' ? C.danger : C.muted;
  return (
    <View style={auditStyles.step}>
      <View style={auditStyles.rail}>
        <View style={[auditStyles.dot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={auditStyles.line} />}
      </View>
      <View style={auditStyles.stepBody}>
        <Text style={auditStyles.stepLabel}>{label}</Text>
        {!!time && <Text style={auditStyles.stepTime}>{time}</Text>}
        {!!sublabel && <Text style={auditStyles.stepSub}>{sublabel}</Text>}
      </View>
    </View>
  );
}
const auditStyles = StyleSheet.create({
  step:     { flexDirection: 'row' },
  rail:     { width: 20, alignItems: 'center' },
  dot:      { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  line:     { flex: 1, width: 2, backgroundColor: '#E5E5EA', marginTop: 2, marginBottom: 2 },
  stepBody: { flex: 1, paddingBottom: 16, marginLeft: 10 },
  stepLabel:{ fontSize: 14, color: C.text, fontWeight: '700' },
  stepTime: { fontSize: 12, color: C.muted, fontWeight: '500', marginTop: 2 },
  stepSub:  { fontSize: 12, color: C.muted, fontStyle: 'italic', marginTop: 2 },
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
  /** ID of the currently signed-in user — used to enforce approval rules */
  currentUserId?: string;
  /** Email of the currently signed-in user — admins can approve any CR */
  currentUserEmail?: string;
  /** Live exchange rates — falls back to DEFAULT_RATES only if the caller
   *  hasn't fetched them yet. Previously this modal carried its own
   *  hardcoded, never-updated rate table, which is exactly why a CR's
   *  "Requested Amount" here could disagree with the same CR's row in the
   *  Finance list — two different numbers for two different rate sources. */
  rates?: Record<string, number>;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TransactionDetailModal({
  item,
  itemType,
  visible,
  onClose,
  displayCurrency = 'USD',
  onRefetch,
  currentUserId,
  currentUserEmail,
  rates = DEFAULT_RATES,
}: TransactionDetailModalProps) {
  const { t } = useAppPreferences();
  const [actioning, setActioning] = useState(false);
  const [declinePromptOpen, setDeclinePromptOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const { updateStatus } = useCashRequisitionStatus();
  const { isAdminOrFleetManager } = useUserRole();
  const { isOnline } = useNetworkStatus();

  if (!item) return null;

  const convertAmount = (amount: number, fromCurrency: string, amountUsdSnapshot?: number | null): number =>
    resolveDisplayAmount(amount, fromCurrency, displayCurrency, rates, amountUsdSnapshot);

  // ── CR status action (Approve / Decline / Cancel) ─────────────────────────
  const runCRAction = async (newStatus: CrStatusAction, reason: string | null) => {
    if (!item) return;
    const cr = item as CashRequisition;
    setActioning(true);
    try {
      // No signal right now — queue it instead of attempting the RPC, same
      // pattern as RecordPaymentSheet. The server's "finished CR cannot
      // change again" rule makes a later replay safe even if this had
      // actually gone through moments before the device dropped signal.
      if (!isOnline) {
        await enqueueCrAction({ crId: cr.id, crNumber: cr.cr_number, action: newStatus, notes: null, reason });
        onClose();
        const offlineMsgKey = newStatus === 'Approved' ? 'txnDetail.approvedOfflineMsg' : newStatus === 'Declined' ? 'txnDetail.declinedOfflineMsg' : 'txnDetail.cancelledOfflineMsg';
        Alert.alert(
          t('payments.savedWillSubmit'),
          t(offlineMsgKey, { crNumber: cr.cr_number }),
        );
        return;
      }

      const result = await updateStatus(cr.id, newStatus, { reason });
      if (!result.ok) throw new Error(result.error);

      // Notify the requester on their device
      const requesterId = (cr as any).requester_id as string | null | undefined;
      if (requesterId && newStatus !== 'Cancelled') {
        const title = newStatus === 'Approved' ? '✅ Cash Requisition Approved' : '❌ Cash Requisition Declined';
        const body = newStatus === 'Approved'
          ? `Your requisition ${cr.cr_number} has been approved and is ready for disbursement.`
          : `Your requisition ${cr.cr_number} has been declined. Please contact your approver for details.`;
        sendCRNotificationToUser(
          requesterId, title, body,
          { cr_id: cr.id, cr_number: cr.cr_number, screen: 'Finance' },
          newStatus === 'Approved' ? 'cr_approved' : 'cr_rejected',
        ).catch(console.error);
      }

      onRefetch?.();
      onClose();
      const titleKey = newStatus === 'Approved' ? 'txnDetail.requisitionApprovedTitle' : newStatus === 'Declined' ? 'txnDetail.requisitionDeclinedTitle' : 'txnDetail.requisitionCancelledTitle';
      const msgKey = newStatus === 'Approved' ? 'txnDetail.requisitionApprovedMsg' : newStatus === 'Declined' ? 'txnDetail.requisitionDeclinedMsg' : 'txnDetail.requisitionCancelledMsg';
      Alert.alert(t(titleKey), t(msgKey, { crNumber: cr.cr_number }));
    } catch (e: any) {
      Alert.alert('Error', getErrorMessage(e, 'Failed to update requisition.'));
    } finally {
      setActioning(false);
    }
  };

  const handleCRAction = (newStatus: 'Approved' | 'Cancelled') => {
    if (!item) return;
    const cr = item as CashRequisition;
    const isApprove = newStatus === 'Approved';
    Alert.alert(
      isApprove ? t('txnDetail.approveRequisitionConfirmTitle') : t('txnDetail.cancelRequisitionConfirmTitle'),
      isApprove ? t('txnDetail.approveConfirmMsg', { crNumber: cr.cr_number }) : t('txnDetail.cancelConfirmMsg', { crNumber: cr.cr_number }),
      [
        { text: t('txnDetail.backLabel'), style: 'cancel' },
        { text: isApprove ? t('txnDetail.approveLabel') : t('common.cancel'), style: newStatus === 'Cancelled' ? 'destructive' : 'default', onPress: () => runCRAction(newStatus, null) },
      ]
    );
  };

  const confirmDecline = () => {
    if (!declineReason.trim()) {
      Alert.alert(t('txnDetail.reasonRequiredTitle'), t('txnDetail.reasonRequiredMsg'));
      return;
    }
    setDeclinePromptOpen(false);
    const reason = declineReason.trim();
    setDeclineReason('');
    runCRAction('Declined', reason);
  };

  // ── Transaction view ──────────────────────────────────────────────────────
  if (itemType === 'transaction') {
    const txn = item as FinancialTransaction;
    const isIncome = txn.transaction_type === 'income';
    const displayAmt = convertAmount(txn.amount, txn.currency || 'USD');
    const date = txn.transaction_date
      ? new Date(txn.transaction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerEyebrow}>{isIncome ? t('finance.income') : t('finance.expenses')}</Text>
              <Text style={styles.headerTitle}>{t('txnDetail.transactionTitle')}</Text>
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
              <Text style={styles.amountLabel}>{t('txnDetail.amountLabel')}</Text>
              <Text style={[styles.amountValue, { color: isIncome ? C.income : C.expense }]}>
                {isIncome ? '+' : '-'}{formatCurrency(displayAmt, displayCurrency)}
              </Text>
              {txn.currency !== displayCurrency && (
                <Text style={styles.amountOriginal}>{formatCurrency(txn.amount, txn.currency || 'USD')}</Text>
              )}
            </View>

            {/* Details card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('txnDetail.transactionDetailsTitle')}</Text>
              <InfoRow label={t('txnDetail.categoryLabel')}   value={txn.category || t('txnDetail.uncategorized')} />
              <InfoRow label={t('txnDetail.dateLabel')}       value={date} />
              <InfoRow label={t('safari.statusLabel')}     value={crStatusLabel(txn.status, t) !== txn.status ? crStatusLabel(txn.status, t) : txn.status} />
              <InfoRow label={t('txnDetail.referenceLabel')}  value={txn.reference_number} />
              <InfoRow label={t('editBooking.fieldCurrency')}   value={txn.currency} />
            </View>

            {txn.description && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('safari.fieldDescription')}</Text>
                <Text style={styles.descText}>{txn.description}</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // ── Cash Requisition view ─────────────────────────────────────────────────
  const cr = item as CashRequisition & { description?: string };
  const displayAmt = convertAmount(cr.total_cost, cr.currency || 'USD', cr.amount_usd);
  const createdDate  = cr.created_at  ? new Date(cr.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const dateNeeded   = cr.date_needed ? new Date(cr.date_needed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const isPending     = cr.status === 'Pending';
  const requesterId   = (cr as any).requester_id as string | undefined;
  const approverId    = (cr as any).approver_id  as string | undefined;

  // canApprove rules:
  //  1. CR must still be Pending
  //  2. The current user must NOT be the submitter (no self-approval)
  //  3a. If a specific approver is designated (approver_id set): only that person sees buttons
  //  3b. If no approver is designated (approver_id null): any non-submitter may approve
  //      — prevents CRs from being permanently stuck with no actionable approver
  const approverEmail     = cr.approver?.email ?? null;
  const isSubmitter       = !!currentUserId && !!requesterId && currentUserId === requesterId;
  const isApproverById    = !!currentUserId && !!approverId && currentUserId === approverId;
  const isApproverByEmail = !!currentUserEmail && !!approverEmail &&
    currentUserEmail.toLowerCase() === approverEmail.toLowerCase();
  const isApprover            = isApproverById || isApproverByEmail;
  const hasDesignatedApprover = !!approverId;
  const canApprove = isPending && !isSubmitter && (!hasDesignatedApprover || isApprover);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Without this, the autoFocus'd decline-reason field pops the keyboard
          up over the Confirm Decline/Back buttons right below it — same fix
          as RecordPaymentSheet/ReversalSheet. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>{t('dashboard.financeEyebrow')}</Text>
            <Text style={styles.headerTitle}>{t('txnDetail.cashRequisitionTitle')}</Text>
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
            <Text style={styles.amountLabel}>{t('txnDetail.requestedAmount')}</Text>
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
            <Text style={styles.cardTitle}>{t('txnDetail.requisitionDetailsTitle')}</Text>
            <InfoRow label={t('txnDetail.crNumberLabel')}    value={cr.cr_number} />
            <InfoRow label={t('txnDetail.categoryLabel')}     value={cr.expense_category} />
            <InfoRow label={t('txnDetail.requestedByLabel')} value={(cr as any).requester_name || cr.requested_by} />
            <InfoRow label={t('txnDetail.dateNeededLabel')}  value={dateNeeded} />
            <InfoRow label={t('txnDetail.dateCreatedLabel')} value={createdDate} />
            {cr.approver && (
              <InfoRow
                label={t('txnDetail.assignedApproverLabel')}
                value={cr.approver.full_name?.trim() || cr.approver.email || undefined}
              />
            )}
          </View>

          {/* Audit timeline — see AuditStep comment above for what's omitted and why */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('txnDetail.auditTimelineTitle')}</Text>
            <AuditStep label={t('txnDetail.submittedLabel')} time={createdDate} tone="done" />
            {cr.status === 'Pending' && (
              <AuditStep label={t('txnDetail.awaitingApprovalLabel')} tone="active" isLast />
            )}
            {(cr.status === 'Approved' || cr.status === 'Completed' || cr.status === 'Resolved') && (
              <AuditStep
                label={t('txnDetail.statusApproved')}
                time={cr.approved_at ? new Date(cr.approved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : undefined}
                sublabel={cr.approver?.full_name?.trim() || cr.approver?.email || undefined}
                tone="done"
                isLast={cr.status === 'Approved'}
              />
            )}
            {(cr.status === 'Declined' || cr.status === 'Rejected') && (
              <AuditStep
                label={crStatusLabel(cr.status, t)}
                time={cr.declined_at ? new Date(cr.declined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : undefined}
                tone="danger"
                isLast
              />
            )}
            {cr.status === 'Cancelled' && (
              <AuditStep label={t('txnDetail.statusCancelled')} tone="muted" isLast />
            )}
            {(cr.status === 'Completed' || cr.status === 'Resolved') && (
              <AuditStep
                label={cr.status === 'Completed' ? t('txnDetail.statusCompleted') : t('txnDetail.statusResolved')}
                time={cr.date_completed ? new Date(cr.date_completed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined}
                tone="done"
                isLast
              />
            )}
          </View>

          {cr.description && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('txnDetail.descriptionPurposeTitle')}</Text>
              <Text style={styles.descText}>{cr.description}</Text>
            </View>
          )}

          {/* Approve / Decline — designated approver, or any non-submitter when no approver is set */}
          {isPending && canApprove && (
            <View style={styles.approvalCard}>
              <Text style={styles.approvalTitle}>{t('txnDetail.approvalActionTitle')}</Text>
              <Text style={styles.approvalSub}>
                {hasDesignatedApprover
                  ? t('txnDetail.awaitingYourApproval')
                  : t('txnDetail.noApproverAssigned')}
              </Text>

              {!isOnline && (
                <Text style={styles.offlineHint}>{t('payments.offlineHint')}</Text>
              )}

              {declinePromptOpen ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.declineLabel}>{t('txnDetail.reasonForDeclining')}</Text>
                  <TextInput
                    style={styles.declineInput}
                    value={declineReason}
                    onChangeText={setDeclineReason}
                    placeholder={t('txnDetail.declineReasonPlaceholder')}
                    placeholderTextColor={C.muted}
                    multiline
                    autoFocus
                  />
                  <View style={styles.approvalBtns}>
                    <TouchableOpacity
                      style={[styles.declineBtn, actioning && { opacity: 0.6 }]}
                      onPress={confirmDecline}
                      disabled={actioning}
                      activeOpacity={0.85}
                    >
                      {actioning
                        ? <ActivityIndicator color={C.danger} size="small" />
                        : <Text style={styles.declineBtnText}>{t('txnDetail.confirmDecline')}</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelPromptBtn}
                      onPress={() => { setDeclinePromptOpen(false); setDeclineReason(''); }}
                      disabled={actioning}
                    >
                      <Text style={styles.cancelPromptBtnText}>{t('txnDetail.backLabel')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.approvalBtns}>
                  <TouchableOpacity
                    style={[styles.approveBtn, actioning && { opacity: 0.6 }]}
                    onPress={() => handleCRAction('Approved')}
                    disabled={actioning}
                    activeOpacity={0.85}
                  >
                    {actioning
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <><CheckIcon color="#fff" /><Text style={styles.approveBtnText}>{t('txnDetail.approveLabel')}</Text></>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.declineBtn, actioning && { opacity: 0.6 }]}
                    onPress={() => setDeclinePromptOpen(true)}
                    disabled={actioning}
                    activeOpacity={0.85}
                  >
                    <XIcon color={C.danger} /><Text style={styles.declineBtnText}>{t('txnDetail.declineLabel')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Cancel — the requester can withdraw their own pending requisition, admin/fleet_manager can cancel any */}
          {isPending && (isSubmitter || isAdminOrFleetManager) && (
            <View style={styles.cancelCard}>
              <Text style={styles.cancelCardTitle}>{t('txnDetail.withdrawTitle')}</Text>
              <Text style={styles.cancelCardSub}>
                {isSubmitter ? t('txnDetail.withdrawSubmitterMsg') : t('txnDetail.withdrawAdminMsg')}
              </Text>
              <TouchableOpacity
                style={[styles.cancelReqBtn, actioning && { opacity: 0.6 }]}
                onPress={() => handleCRAction('Cancelled')}
                disabled={actioning}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelReqBtnText}>{t('txnDetail.cancelRequisitionBtn')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Blocked — submitter cannot approve their own requisition */}
          {isPending && isSubmitter && (
            <View style={styles.selfSubmitNotice}>
              <Text style={styles.selfSubmitText}>
                {hasDesignatedApprover
                  ? t('txnDetail.selfSubmitDesignated')
                  : t('txnDetail.selfSubmitUndesignated')}
              </Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea:        { flex: 1, backgroundColor: C.bg },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, backgroundColor: C.hero },
  headerEyebrow:   { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#C4A882', marginBottom: 2 },
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
  approvalCard:      { backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.warning + '50' },
  approvalTitle:     { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 6 },
  approvalSub:       { fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 16 },
  approvalBtns:      { flexDirection: 'row', gap: 10 },
  approveBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.success, borderRadius: 14, paddingVertical: 14 },
  approveBtnText:    { fontSize: 15, fontWeight: '800', color: '#fff' },
  declineBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.danger + '12', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: C.danger + '40' },
  declineBtnText:    { fontSize: 15, fontWeight: '800', color: C.danger },
  selfSubmitNotice:  { backgroundColor: C.warning + '15', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.warning + '40' },
  selfSubmitText:    { fontSize: 13, color: C.warning, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  offlineHint:       { fontSize: 11.5, color: C.primary, backgroundColor: C.primary + '15', borderRadius: 10, padding: 10, marginBottom: 14, lineHeight: 16 },
  declineLabel:      { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  declineInput:      { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, minHeight: 70, textAlignVertical: 'top', marginBottom: 14 },
  cancelPromptBtn:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  cancelPromptBtnText: { fontSize: 14, fontWeight: '600', color: C.muted },
  cancelCard:        { backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, marginTop: 14 },
  cancelCardTitle:   { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 6 },
  cancelCardSub:     { fontSize: 12.5, color: C.muted, lineHeight: 18, marginBottom: 14 },
  cancelReqBtn:      { backgroundColor: C.bg, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  cancelReqBtnText:  { fontSize: 14, fontWeight: '700', color: C.danger },
});
