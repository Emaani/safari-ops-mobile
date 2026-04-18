import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useMessages } from '../hooks/useMessages';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { supabase } from '../lib/supabase';
import type { Notification, NotificationStatus } from '../types/notification';
import type { Message } from '../types/message';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNotifDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d))     return formatDistanceToNow(d, { addSuffix: true });
  if (isYesterday(d)) return `Yesterday · ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d · h:mm a');
}

function formatMsgTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d))     return format(d, 'h:mm a');
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
}

type FilterTab = NotificationStatus | 'all' | 'messages';
type MsgSubTab = 'broadcast' | 'direct';

interface StaffProfile {
  id: string;
  email: string | null;
  full_name: string | null;
}

const TYPE_EMOJI: Record<string, string> = {
  booking_created:    '📅',
  booking_new:        '📅',
  booking_started:    '🚙',
  booking_completed:  '✅',
  booking_confirmed:  '✔️',
  booking_cancelled:  '❌',
  cr_raised:          '📝',
  cr_created:         '📝',
  cr_approved:        '✅',
  cr_rejected:        '❌',
  cr_completed:       '💵',
  payment:            '💰',
  payment_received:   '💰',
  payment_overdue:    '⚠️',
  vehicle_maintenance:'🔧',
  vehicle_available:  '🚗',
  admin_message:      '📣',
  system_alert:       '⚡',
  general:            '🔔',
  info:               '🔔',
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#c96d4d',
  high:   '#b8883f',
  medium: '#4a7fc1',
  low:    '#7f7565',
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high:   'High',
  medium: 'Medium',
  low:    'Low',
};

const TYPE_LABEL: Record<string, string> = {
  booking_created:    'New Booking',
  booking_confirmed:  'Booking Confirmed',
  booking_completed:  'Booking Completed',
  booking_cancelled:  'Booking Cancelled',
  payment_received:   'Payment Received',
  payment_overdue:    'Payment Overdue',
  cr_created:         'Cash Requisition',
  cr_approved:        'CR Approved',
  cr_rejected:        'CR Rejected',
  vehicle_maintenance:'Maintenance',
  vehicle_available:  'Vehicle Available',
  system_alert:       'System Alert',
  admin_message:      'Admin Message',
  general:            'General',
};

function getInitials(name: string): string {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonItem() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[skeletonStyles.item, { opacity }]}>
      <View style={skeletonStyles.icon} />
      <View style={skeletonStyles.lines}>
        <View style={[skeletonStyles.line, { width: '60%' }]} />
        <View style={[skeletonStyles.line, { width: '90%', marginTop: 6 }]} />
        <View style={[skeletonStyles.line, { width: '35%', marginTop: 6 }]} />
      </View>
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    backgroundColor: '#fffdf9',
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#e1d7c8',
    gap: 12,
  },
  icon:  { width: 40, height: 40, borderRadius: 14, backgroundColor: '#e1d7c8' },
  lines: { flex: 1, justifyContent: 'center' },
  line:  { height: 12, borderRadius: 6, backgroundColor: '#e1d7c8' },
});

// ─── Notification Detail Modal ────────────────────────────────────────────────

function NotificationDetailModal({
  notification,
  onClose,
  onMarkRead,
  onDelete,
}: {
  notification: Notification | null;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const slideAnim   = useRef(new Animated.Value(600)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const visible = notification !== null;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 600, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  if (!notification) return null;

  const emoji = TYPE_EMOJI[notification.type] || '🔔';
  const priorityColor = PRIORITY_COLOR[notification.priority] || '#7f7565';
  const isUnread = notification.status === 'unread';

  const metaRows: { label: string; value: string }[] = [
    { label: 'Type',     value: TYPE_LABEL[notification.type] || notification.type },
    { label: 'Priority', value: PRIORITY_LABEL[notification.priority] || notification.priority },
    { label: 'Status',   value: isUnread ? 'Unread' : 'Read' },
    { label: 'Date',     value: format(new Date(notification.created_at), 'MMM d, yyyy · h:mm a') },
  ];
  if (notification.data?.reference)  metaRows.push({ label: 'Reference', value: notification.data.reference });
  if (notification.data?.booking_id) metaRows.push({ label: 'Booking ID', value: notification.data.booking_id });
  if (notification.data?.amount !== undefined && notification.data?.currency) {
    metaRows.push({ label: 'Amount', value: `${notification.data.currency} ${notification.data.amount.toLocaleString()}` });
  }
  if (notification.read_at) {
    metaRows.push({ label: 'Read at', value: format(new Date(notification.read_at), 'MMM d · h:mm a') });
  }

  return (
    <Modal transparent animationType="none" visible={true} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(18,14,10,0.55)', opacity: backdropAnim }]} />
      </Pressable>

      <Animated.View style={[detailStyles.sheet, { transform: [{ translateY: slideAnim }] }]} pointerEvents="box-none">
        <View style={detailStyles.handle} />

        <View style={detailStyles.titleRow}>
          <View style={[detailStyles.iconCircle, { backgroundColor: priorityColor + '20' }]}>
            <Text style={detailStyles.iconEmoji}>{emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={detailStyles.badgesRow}>
              <View style={[detailStyles.priorityBadge, { backgroundColor: priorityColor + '20' }]}>
                <View style={[detailStyles.priorityDot, { backgroundColor: priorityColor }]} />
                <Text style={[detailStyles.priorityText, { color: priorityColor }]}>
                  {PRIORITY_LABEL[notification.priority] || notification.priority}
                </Text>
              </View>
              {isUnread && (
                <View style={detailStyles.unreadBadge}>
                  <Text style={detailStyles.unreadBadgeText}>Unread</Text>
                </View>
              )}
            </View>
            <Text style={detailStyles.titleText}>{notification.title}</Text>
          </View>
        </View>

        <View style={detailStyles.messageBox}>
          <Text style={detailStyles.messageText}>{notification.message}</Text>
        </View>

        <View style={detailStyles.metaCard}>
          {metaRows.map((row, i) => (
            <View key={row.label} style={[detailStyles.metaRow, i < metaRows.length - 1 && detailStyles.metaRowBorder]}>
              <Text style={detailStyles.metaLabel}>{row.label}</Text>
              <Text style={detailStyles.metaValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        <View style={detailStyles.actions}>
          {isUnread && (
            <TouchableOpacity
              style={detailStyles.actionPrimary}
              onPress={() => { onMarkRead(notification.id); onClose(); }}
              activeOpacity={0.85}
            >
              <CheckIcon size={16} color="#fff" />
              <Text style={detailStyles.actionPrimaryText}>Mark as Read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={detailStyles.actionDanger}
            onPress={() => { onDelete(notification.id); onClose(); }}
            activeOpacity={0.85}
          >
            <TrashIcon size={15} color="#c96d4d" />
            <Text style={detailStyles.actionDangerText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fffdf9',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14, shadowRadius: 24, elevation: 20,
    maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#d4c9b5', alignSelf: 'center', marginBottom: 20,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  iconCircle: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: 26 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  unreadBadge: { backgroundColor: '#4a7fc120', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#4a7fc1' },
  titleText: { fontSize: 18, fontWeight: '800', color: '#181512', letterSpacing: -0.4, lineHeight: 24 },
  messageBox: { backgroundColor: '#f6f2eb', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e1d7c8' },
  messageText: { fontSize: 15, color: '#3d3428', lineHeight: 22 },
  metaCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e1d7c8', marginBottom: 20, overflow: 'hidden' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  metaRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0ebe0' },
  metaLabel: { fontSize: 13, color: '#9a8f7e', fontWeight: '600' },
  metaValue: { fontSize: 13, color: '#181512', fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 10 },
  actionPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#1f4d45', borderRadius: 16, paddingVertical: 14,
  },
  actionPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  actionDanger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: '#fdf0ec', borderRadius: 16, paddingVertical: 14,
    paddingHorizontal: 20, borderWidth: 1, borderColor: '#f0cfc5',
  },
  actionDangerText: { color: '#c96d4d', fontSize: 14, fontWeight: '700' },
});

// ─── Notification Item ────────────────────────────────────────────────────────

function NotificationItem({ item, onPress, onDelete }: {
  item: Notification;
  onPress: (n: Notification) => void;
  onDelete: (id: string) => void;
}) {
  const isUnread = item.status === 'unread';
  const emoji = TYPE_EMOJI[item.type] || '🔔';
  const priorityColor = PRIORITY_COLOR[item.priority] || '#7f7565';

  return (
    <TouchableOpacity
      style={[styles.item, isUnread && styles.itemUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: priorityColor + '18' }]}>
        <Text style={styles.iconEmoji}>{emoji}</Text>
        {isUnread && <View style={[styles.unreadPip, { backgroundColor: priorityColor }]} />}
      </View>
      <View style={styles.notifContent}>
        <View style={styles.contentTop}>
          <Text style={[styles.notifTitle, isUnread && styles.notifTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <TrashIcon size={16} color="#b8ab95" />
          </TouchableOpacity>
        </View>
        <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
        <View style={styles.notifMeta}>
          <Text style={styles.notifDate}>{formatNotifDate(item.created_at)}</Text>
          {isUnread && (
            <View style={[styles.typePill, { backgroundColor: priorityColor + '18' }]}>
              <Text style={[styles.typePillText, { color: priorityColor }]}>
                {PRIORITY_LABEL[item.priority] || item.priority}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Staff Picker Modal ───────────────────────────────────────────────────────

function StaffPickerModal({
  visible,
  currentUserId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  currentUserId: string;
  onSelect: (profile: StaffProfile) => void;
  onClose: () => void;
}) {
  const [staff, setStaff]     = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    supabase
      .from('profiles')
      .select('id,email,full_name')
      .neq('id', currentUserId)
      .order('full_name', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setStaff(data as StaffProfile[]);
        setLoading(false);
      });
  }, [visible, currentUserId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return staff;
    const q = search.toLowerCase();
    return staff.filter(
      (s) =>
        s.full_name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [staff, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(18,14,10,0.5)' }} />
      </Pressable>
      <View style={pickerStyles.sheet}>
        <View style={pickerStyles.handle} />
        <Text style={pickerStyles.title}>Select Staff Member</Text>
        <View style={pickerStyles.searchWrap}>
          <TextInput
            style={pickerStyles.search}
            placeholder="Search by name or email…"
            placeholderTextColor="#b8ab95"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {loading ? (
          <ActivityIndicator color="#1f4d45" style={{ marginTop: 32 }} />
        ) : filtered.length === 0 ? (
          <View style={pickerStyles.empty}>
            <Text style={pickerStyles.emptyText}>No staff members found</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(s) => s.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={pickerStyles.row}
                onPress={() => { onSelect(item); onClose(); }}
                activeOpacity={0.75}
              >
                <View style={pickerStyles.avatar}>
                  <Text style={pickerStyles.avatarText}>
                    {getInitials(item.full_name || item.email || '?')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={pickerStyles.name}>
                    {item.full_name || item.email || 'Unknown'}
                  </Text>
                  {item.email && item.full_name && (
                    <Text style={pickerStyles.email}>{item.email}</Text>
                  )}
                </View>
                <ArrowRightIcon size={16} color="#b8ab95" />
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fffdf9', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, maxHeight: '80%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d4c9b5', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '800', color: '#181512', paddingHorizontal: 20, marginBottom: 12 },
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  search: {
    backgroundColor: '#f6f2eb', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#181512', borderWidth: 1, borderColor: '#e1d7c8',
  },
  empty: { alignItems: 'center', paddingTop: 32 },
  emptyText: { fontSize: 14, color: '#9a8f7e' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0ebe0',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1f4d45', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: '#181512' },
  email: { fontSize: 12, color: '#9a8f7e', marginTop: 1 },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const initials = getInitials(message.sender_name || 'S');
  return (
    <View style={[msgStyles.row, isMine && msgStyles.rowMine]}>
      {!isMine && (
        <View style={msgStyles.avatar}>
          <Text style={msgStyles.avatarText}>{initials}</Text>
        </View>
      )}
      <View style={[msgStyles.bubble, isMine ? msgStyles.bubbleMine : msgStyles.bubbleTheirs]}>
        {!isMine && <Text style={msgStyles.senderName}>{message.sender_name}</Text>}
        <Text style={[msgStyles.bodyText, isMine && msgStyles.bodyTextMine]}>{message.body}</Text>
        <Text style={[msgStyles.timeText, isMine && msgStyles.timeTextMine]}>
          {formatMsgTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

const msgStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: 16, marginVertical: 4, gap: 8 },
  rowMine: { justifyContent: 'flex-end' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1f4d45', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleTheirs: { backgroundColor: '#fffdf9', borderWidth: 1, borderColor: '#e1d7c8', borderBottomLeftRadius: 6 },
  bubbleMine: { backgroundColor: '#1f4d45', borderBottomRightRadius: 6 },
  senderName: { fontSize: 11, fontWeight: '800', color: '#1f4d45', letterSpacing: 0.2, marginBottom: 2 },
  bodyText: { fontSize: 14, color: '#3d3428', lineHeight: 20 },
  bodyTextMine: { color: '#f0f9f5' },
  timeText: { fontSize: 10, color: '#b8ab95', fontWeight: '600', alignSelf: 'flex-end' },
  timeTextMine: { color: 'rgba(240,249,245,0.6)' },
});

// ─── Chat Thread ──────────────────────────────────────────────────────────────

function ChatThread({
  messages,
  userId,
  sending,
  onSend,
  onBack,
  title,
  subtitle,
  isBroadcast,
}: {
  messages: Message[];
  userId: string;
  sending: boolean;
  onSend: (body: string) => void;
  onBack?: () => void;
  title: string;
  subtitle?: string;
  isBroadcast?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  const itemsWithSeparators = useMemo(() => {
    const result: ({ type: 'sep'; date: string } | { type: 'msg'; data: Message })[] = [];
    let lastDate = '';
    messages.forEach((m) => {
      const day = format(new Date(m.created_at), 'yyyy-MM-dd');
      if (day !== lastDate) {
        result.push({ type: 'sep', date: m.created_at });
        lastDate = day;
      }
      result.push({ type: 'msg', data: m });
    });
    return result;
  }, [messages]);

  const handleSend = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    onSend(body);
  }, [draft, onSend]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
    >
      {/* Thread header */}
      <View style={threadStyles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginRight: 8 }}>
            <BackIcon size={20} color="#1f4d45" />
          </TouchableOpacity>
        )}
        <View style={[threadStyles.threadAvatar, isBroadcast && { backgroundColor: '#b8883f' }]}>
          <Text style={threadStyles.threadAvatarText}>{isBroadcast ? '📣' : getInitials(title)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={threadStyles.threadTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={threadStyles.threadSub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>

      {messages.length === 0 ? (
        <View style={threadStyles.empty}>
          <Text style={threadStyles.emptyEmoji}>{isBroadcast ? '📣' : '💬'}</Text>
          <Text style={threadStyles.emptyTitle}>{isBroadcast ? 'Team Broadcast' : 'Start a conversation'}</Text>
          <Text style={threadStyles.emptyMsg}>
            {isBroadcast
              ? 'Messages here are visible to all staff.'
              : 'Your messages with this staff member will appear here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={itemsWithSeparators}
          keyExtractor={(item, index) => (item.type === 'msg' ? item.data.id : `sep-${index}`)}
          renderItem={({ item }) =>
            item.type === 'sep' ? (
              <View style={threadStyles.dateSep}>
                <View style={threadStyles.dateLine} />
                <Text style={threadStyles.dateLabel}>
                  {isToday(new Date(item.date)) ? 'Today'
                    : isYesterday(new Date(item.date)) ? 'Yesterday'
                    : format(new Date(item.date), 'MMM d, yyyy')}
                </Text>
                <View style={threadStyles.dateLine} />
              </View>
            ) : (
              <MessageBubble message={item.data} isMine={item.data.sender_id === userId} />
            )
          }
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Compose bar */}
      <View style={[threadStyles.compose, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={threadStyles.input}
          placeholder={isBroadcast ? 'Broadcast to all staff…' : 'Type a message…'}
          placeholderTextColor="#b8ab95"
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[threadStyles.sendBtn, (!draft.trim() || sending) && threadStyles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          activeOpacity={0.85}
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <SendIcon size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const threadStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e1d7c8',
    backgroundColor: '#fffdf9',
  },
  threadAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1f4d45', alignItems: 'center', justifyContent: 'center',
  },
  threadAvatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  threadTitle: { fontSize: 15, fontWeight: '800', color: '#181512' },
  threadSub: { fontSize: 11, color: '#9a8f7e', marginTop: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12, paddingBottom: 80 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#181512', letterSpacing: -0.4 },
  emptyMsg: { fontSize: 14, color: '#7f7565', textAlign: 'center', lineHeight: 20 },
  dateSep: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginVertical: 12, gap: 10 },
  dateLine: { flex: 1, height: 1, backgroundColor: '#e1d7c8' },
  dateLabel: { fontSize: 11, fontWeight: '700', color: '#b8ab95', letterSpacing: 0.4 },
  compose: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#e1d7c8',
    backgroundColor: '#fffdf9', gap: 10,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    backgroundColor: '#f6f2eb', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 11,
    fontSize: 15, color: '#181512', borderWidth: 1, borderColor: '#e1d7c8',
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1f4d45', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#b8d4cc' },
});

// ─── Conversation List ────────────────────────────────────────────────────────

interface ConversationThread {
  partnerId: string;
  partnerName: string;
  lastMessage: Message;
  unreadCount: number;
}

function ConversationList({
  messages,
  userId,
  onSelectThread,
  onNewDM,
}: {
  messages: Message[];
  userId: string;
  onSelectThread: (partnerId: string, partnerName: string) => void;
  onNewDM: () => void;
}) {
  const threads = useMemo(() => {
    const map = new Map<string, ConversationThread>();
    messages
      .filter((m) => m.recipient_id !== null) // DMs only
      .forEach((m) => {
        const partnerId   = m.sender_id === userId ? m.recipient_id! : m.sender_id;
        const partnerName = m.sender_id === userId ? (m.recipient_id || 'Unknown') : m.sender_name;

        const existing = map.get(partnerId);
        const isUnread = m.sender_id !== userId && !(m.read_by || []).includes(userId);
        if (!existing || new Date(m.created_at) > new Date(existing.lastMessage.created_at)) {
          map.set(partnerId, {
            partnerId,
            partnerName: m.sender_id !== userId ? m.sender_name : (existing?.partnerName || partnerName),
            lastMessage: m,
            unreadCount: (existing?.unreadCount || 0) + (isUnread && !existing ? 1 : 0),
          });
        } else if (isUnread) {
          existing.unreadCount += 1;
        }
      });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [messages, userId]);

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={convStyles.newDMBtn} onPress={onNewDM} activeOpacity={0.85}>
        <PlusIcon size={16} color="#1f4d45" />
        <Text style={convStyles.newDMText}>New Direct Message</Text>
      </TouchableOpacity>

      {threads.length === 0 ? (
        <View style={convStyles.empty}>
          <Text style={convStyles.emptyEmoji}>💬</Text>
          <Text style={convStyles.emptyTitle}>No direct messages</Text>
          <Text style={convStyles.emptyMsg}>Tap "New Direct Message" to start a private conversation with a staff member.</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.partnerId}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={convStyles.row}
              onPress={() => onSelectThread(item.partnerId, item.partnerName)}
              activeOpacity={0.75}
            >
              <View style={convStyles.avatar}>
                <Text style={convStyles.avatarText}>{getInitials(item.partnerName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={convStyles.rowTop}>
                  <Text style={[convStyles.name, item.unreadCount > 0 && convStyles.nameBold]}>
                    {item.partnerName}
                  </Text>
                  <Text style={convStyles.time}>{formatMsgTime(item.lastMessage.created_at)}</Text>
                </View>
                <View style={convStyles.rowBottom}>
                  <Text style={convStyles.preview} numberOfLines={1}>
                    {item.lastMessage.sender_id === userId ? 'You: ' : ''}{item.lastMessage.body}
                  </Text>
                  {item.unreadCount > 0 && (
                    <View style={convStyles.badge}>
                      <Text style={convStyles.badgeText}>{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const convStyles = StyleSheet.create({
  newDMBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: '#dce8e3', borderRadius: 14,
  },
  newDMText: { fontSize: 14, fontWeight: '700', color: '#1f4d45' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12, paddingBottom: 80 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#181512', letterSpacing: -0.4 },
  emptyMsg: { fontSize: 13, color: '#7f7565', textAlign: 'center', lineHeight: 19 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0ebe0',
    backgroundColor: '#fffdf9',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1f4d45', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  name: { fontSize: 15, fontWeight: '600', color: '#181512' },
  nameBold: { fontWeight: '800' },
  time: { fontSize: 11, color: '#b8ab95', fontWeight: '600' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview: { fontSize: 13, color: '#9a8f7e', flex: 1, marginRight: 8 },
  badge: { backgroundColor: '#1f4d45', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});

// ─── Messages View ────────────────────────────────────────────────────────────

function MessagesView({
  userId,
  senderName,
  messages,
  loading,
  sending,
  sendMessage,
  refresh,
}: {
  userId: string;
  senderName: string;
  messages: Message[];
  loading: boolean;
  sending: boolean;
  sendMessage: (payload: { body: string; recipient_id?: string | null; recipient_email?: string | null }) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const [msgTab, setMsgTab]                 = useState<MsgSubTab>('broadcast');
  const [activeThread, setActiveThread]     = useState<{ id: string; name: string } | null>(null);
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);

  const broadcastMessages = useMemo(
    () => messages.filter((m) => m.recipient_id === null),
    [messages]
  );

  const threadMessages = useMemo(() => {
    if (!activeThread) return [];
    return messages.filter(
      (m) =>
        m.recipient_id !== null &&
        (
          (m.sender_id === userId && m.recipient_id === activeThread.id) ||
          (m.sender_id === activeThread.id && m.recipient_id === userId)
        )
    );
  }, [messages, activeThread, userId]);

  const handleSendBroadcast = useCallback(async (body: string) => {
    try {
      await sendMessage({ body, recipient_id: null });
    } catch (e: any) {
      Alert.alert('Not sent', e?.message || 'Could not send message.');
    }
  }, [sendMessage]);

  const handleSendDM = useCallback(async (body: string) => {
    if (!activeThread) return;
    try {
      await sendMessage({ body, recipient_id: activeThread.id });
    } catch (e: any) {
      Alert.alert('Not sent', e?.message || 'Could not send message.');
    }
  }, [activeThread, sendMessage]);

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#1f4d45" size="large" /></View>;
  }

  // DM thread open
  if (msgTab === 'direct' && activeThread) {
    return (
      <>
        <ChatThread
          messages={threadMessages}
          userId={userId}
          sending={sending}
          onSend={handleSendDM}
          onBack={() => setActiveThread(null)}
          title={activeThread.name}
          subtitle="Direct message"
        />
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tabs: Broadcast / Direct */}
      <View style={msgTabStyles.tabs}>
        <TouchableOpacity
          style={[msgTabStyles.tab, msgTab === 'broadcast' && msgTabStyles.tabActive]}
          onPress={() => setMsgTab('broadcast')}
          activeOpacity={0.8}
        >
          <Text style={[msgTabStyles.tabText, msgTab === 'broadcast' && msgTabStyles.tabTextActive]}>
            📣 Broadcast
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[msgTabStyles.tab, msgTab === 'direct' && msgTabStyles.tabActive]}
          onPress={() => setMsgTab('direct')}
          activeOpacity={0.8}
        >
          <Text style={[msgTabStyles.tabText, msgTab === 'direct' && msgTabStyles.tabTextActive]}>
            💬 Direct
          </Text>
        </TouchableOpacity>
      </View>

      {msgTab === 'broadcast' ? (
        <ChatThread
          messages={broadcastMessages}
          userId={userId}
          sending={sending}
          onSend={handleSendBroadcast}
          title="Team Broadcast"
          subtitle="Visible to all staff"
          isBroadcast
        />
      ) : (
        <ConversationList
          messages={messages}
          userId={userId}
          onSelectThread={(id, name) => setActiveThread({ id, name })}
          onNewDM={() => setStaffPickerOpen(true)}
        />
      )}

      <StaffPickerModal
        visible={staffPickerOpen}
        currentUserId={userId}
        onSelect={(profile) => {
          setActiveThread({
            id:   profile.id,
            name: profile.full_name || profile.email || 'Staff',
          });
          setMsgTab('direct');
        }}
        onClose={() => setStaffPickerOpen(false)}
      />
    </View>
  );
}

const msgTabStyles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e1d7c8',
    backgroundColor: '#fffdf9',
    gap: 8,
  },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: 12,
    alignItems: 'center', backgroundColor: '#f6f2eb',
    borderWidth: 1, borderColor: '#e1d7c8',
  },
  tabActive: { backgroundColor: '#1f4d45', borderColor: '#1f4d45' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#7f7565' },
  tabTextActive: { color: '#fff' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NotificationsScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const userId = user?.id || '';
  const senderName: string =
    (user as any)?.user_metadata?.full_name ||
    (user as any)?.user_metadata?.name ||
    (user as any)?.email?.split('@')[0] ||
    'Staff';

  const { theme } = useAppPreferences();

  // Allow navigation params to set initial tab (e.g., from admin_message notification tap)
  const initialTab: FilterTab = route?.params?.initialTab || 'all';
  const [filterTab, setFilterTab] = useState<FilterTab>(initialTab);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);

  // Single shared useMessages instance — avoids duplicate Supabase channels
  const {
    messages,
    loading: msgsLoading,
    sending,
    sendMessage,
    refresh: refreshMessages,
    unreadCount: msgUnreadCount,
  } = useMessages(userId, senderName);

  // Update filterTab if route params change (e.g., notification tap while screen is mounted)
  useEffect(() => {
    if (route?.params?.initialTab) {
      setFilterTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  const {
    allNotifications,
    summary,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setFilters,
  } = useNotifications(userId);

  const displayedNotifications = useMemo(() => {
    if (filterTab === 'all' || filterTab === 'messages') return allNotifications;
    return allNotifications.filter((n) => n.status === filterTab);
  }, [allNotifications, filterTab]);

  const unreadCount = summary.unread;
  const readCount   = summary.total - summary.unread;

  const handleFilterChange = useCallback((tab: FilterTab) => {
    setFilterTab(tab);
    setFilters({});
  }, [setFilters]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshMessages()]);
    setRefreshing(false);
  }, [refresh, refreshMessages]);

  const handlePress = useCallback(async (notif: Notification) => {
    setSelectedNotif(notif);
    if (notif.status === 'unread') {
      await markAsRead(notif.id).catch(() => null);
    }
  }, [markAsRead]);

  const handleDelete = useCallback((id: string) => {
    deleteNotification(id).catch(() => null);
  }, [deleteNotification]);

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead().catch(() => null);
  }, [markAllAsRead]);

  const renderItem = useCallback(({ item }: { item: Notification }) => (
    <NotificationItem item={item} onPress={handlePress} onDelete={handleDelete} />
  ), [handlePress, handleDelete]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyEmoji}>🔔</Text>
        <Text style={styles.emptyTitle}>{filterTab === 'unread' ? 'All caught up!' : 'No notifications'}</Text>
        <Text style={styles.emptyMsg}>
          {filterTab === 'unread'
            ? 'You have no unread notifications.'
            : 'Booking updates and alerts will appear here.'}
        </Text>
      </View>
    );
  }, [loading, filterTab]);

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'all',      label: 'All',      count: summary.total },
    { key: 'unread',   label: 'Unread',   count: unreadCount   },
    { key: 'read',     label: 'Read',     count: readCount     },
    { key: 'messages', label: 'Messages', count: msgUnreadCount > 0 ? msgUnreadCount : undefined },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Dark hero header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerEyebrow}>Activity</Text>
            <Text style={styles.headerTitle}>
              {filterTab === 'messages' ? 'Messages' : 'Notifications'}
            </Text>
          </View>
          {unreadCount > 0 && filterTab !== 'messages' && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount} unread</Text>
            </View>
          )}
          {msgUnreadCount > 0 && filterTab === 'messages' && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{msgUnreadCount} new</Text>
            </View>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, filterTab === tab.key && styles.tabActive]}
              onPress={() => handleFilterChange(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, filterTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {tab.count !== undefined && tab.count > 0 && (
                <View style={[styles.tabCount, filterTab === tab.key && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, filterTab === tab.key && styles.tabCountTextActive]}>
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Messages tab */}
      {filterTab === 'messages' ? (
        <MessagesView
          userId={userId}
          senderName={senderName}
          messages={messages}
          loading={msgsLoading}
          sending={sending}
          sendMessage={sendMessage}
          refresh={refreshMessages}
        />
      ) : (
        <>
          {unreadCount > 0 && !loading && (
            <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead} activeOpacity={0.8}>
              <CheckIcon size={15} color="#3d8f6a" />
              <Text style={styles.markAllText}>Mark all as read</Text>
            </TouchableOpacity>
          )}

          {error && !loading && (
            <View style={styles.errorWrap}>
              <Text style={styles.errorTitle}>Couldn't load notifications</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {loading && !refreshing ? (
            <View style={{ paddingTop: 8 }}>
              {[1, 2, 3, 4, 5].map((i) => <SkeletonItem key={i} />)}
            </View>
          ) : (
            <FlatList
              data={displayedNotifications}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmpty}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#1f4d45"
                  colors={['#1f4d45']}
                />
              }
            />
          )}
        </>
      )}

      {selectedNotif && (
        <NotificationDetailModal
          notification={selectedNotif}
          onClose={() => setSelectedNotif(null)}
          onMarkRead={(id) => markAsRead(id).catch(() => null)}
          onDelete={handleDelete}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrashIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

function CheckIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

function SendIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 2L11 13" />
      <Path d="M22 2L15 22l-4-9-9-4 20-7z" />
    </Svg>
  );
}

function BackIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

function PlusIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function ArrowRightIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f2eb' },
  header: {
    backgroundColor: '#171513',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 16,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: '#b8ab95', marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -1, color: '#fffaf3' },
  unreadBadge: { backgroundColor: '#c96d4d', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  tabsScroll: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: { backgroundColor: '#fffdf9' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#b8ab95' },
  tabTextActive: { color: '#181512' },
  tabCount: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabCountActive: { backgroundColor: '#1f4d45' },
  tabCountText: { fontSize: 10, fontWeight: '800', color: '#b8ab95' },
  tabCountTextActive: { color: '#fff' },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end', marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#dce8e3',
  },
  markAllText: { fontSize: 12, fontWeight: '700', color: '#3d8f6a' },
  listContent: { paddingTop: 10, paddingBottom: 120, flexGrow: 1 },
  item: {
    flexDirection: 'row', backgroundColor: '#fffdf9', borderRadius: 20,
    padding: 16, marginHorizontal: 16, marginVertical: 5,
    borderWidth: 1, borderColor: '#e1d7c8', gap: 12,
    shadowColor: '#201a13', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  itemUnread: { backgroundColor: '#f0f6ff', borderColor: '#4a7fc1' },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  iconEmoji: { fontSize: 22, lineHeight: 28 },
  unreadPip: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#f0f6ff' },
  notifContent: { flex: 1, gap: 4 },
  contentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifTitle: { fontSize: 14, fontWeight: '600', color: '#181512', flex: 1, marginRight: 8 },
  notifTitleUnread: { fontWeight: '800' },
  notifMessage: { fontSize: 13, color: '#7f7565', lineHeight: 18 },
  notifMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  notifDate: { fontSize: 11, color: '#b8ab95', fontWeight: '600' },
  typePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  typePillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#181512', letterSpacing: -0.4 },
  emptyMsg: { fontSize: 14, color: '#7f7565', textAlign: 'center', paddingHorizontal: 48, lineHeight: 20 },
  errorWrap: { alignItems: 'center', paddingTop: 48, gap: 14 },
  errorTitle: { fontSize: 15, color: '#c96d4d', fontWeight: '600' },
  retryBtn: { backgroundColor: '#1f4d45', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
