import React, { useRef } from 'react';
import {
  Animated, View, Text, StyleSheet, TouchableOpacity,
  PanResponder, Alert,
} from 'react-native';
import { Svg, Path, Rect, Circle } from 'react-native-svg';
import type { Booking } from '../../types/dashboard';
import { formatCurrency } from '../../lib/utils';
import { getBookingStatusConfig } from '../../constants/bookingStatus';
import { palette, spacing, radius, type as t, shadow } from '../../constants/tokens';
import { tapLight, tapMedium } from '../../lib/haptics';

// ─── Icons ────────────────────────────────────────────────────────────────────
function CalendarIcon({ color = palette.primary }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  );
}
function TruckIcon({ color = palette.textMuted }: { color?: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
      <Circle cx="5.5" cy="18.5" r="2.5" /><Circle cx="18.5" cy="18.5" r="2.5" />
    </Svg>
  );
}
function EditIcon({ color = '#fff' }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </Svg>
  );
}
function PhoneIcon({ color = '#fff' }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6.29 6.29l.98-.98a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </Svg>
  );
}

// ─── Swipe action button ──────────────────────────────────────────────────────
const SWIPE_THRESHOLD = -80;
const ACTION_WIDTH    = 72;

interface BookingCardProps {
  booking: Booking & { vehicle?: { name: string } };
  onPress:  (booking: Booking) => void;
  onEdit?:  (booking: Booking) => void;
  onCall?:  (booking: Booking) => void;
}

export function BookingCard({ booking, onPress, onEdit, onCall }: BookingCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen     = useRef(false);

  const statusCfg  = getBookingStatusConfig(booking.status);
  const clientName = booking.client?.company_name || booking.client_name || 'Unknown Client';
  const ref        = booking.booking_reference || booking.booking_number || `#${booking.id.slice(0, 8).toUpperCase()}`;
  const startDate  = new Date(booking.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endDate    = new Date(booking.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  const paid       = booking.amount_paid || 0;
  const total      = booking.total_cost || booking.total_amount || 0;
  const balance    = Math.max(0, total - paid);
  const currency   = booking.currency || 'USD';
  const pctPaid    = total > 0 ? Math.min((paid / total) * 100, 100) : 0;

  const numActions = (onEdit ? 1 : 0) + (onCall ? 1 : 0);
  const maxSwipe   = -(numActions * ACTION_WIDTH + 8);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => {
      const base = isOpen.current ? maxSwipe : 0;
      const next = Math.max(maxSwipe, Math.min(0, base + g.dx));
      translateX.setValue(next);
    },
    onPanResponderRelease: (_, g) => {
      const open = g.dx < SWIPE_THRESHOLD || (isOpen.current && g.dx < 20);
      isOpen.current = open;
      Animated.spring(translateX, { toValue: open ? maxSwipe : 0, useNativeDriver: true, tension: 120, friction: 14 }).start();
      if (open) selectionTick();
    },
  })).current;

  function selectionTick() {
    tapLight();
  }

  function close() {
    isOpen.current = false;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 14 }).start();
  }

  return (
    <View style={s.wrapper}>
      {/* ── Swipe action tray ── */}
      {numActions > 0 && (
        <View style={[s.tray, { width: numActions * ACTION_WIDTH + 8 }]}>
          {onEdit && statusCfg.editable && (
            <TouchableOpacity
              style={[s.action, { backgroundColor: palette.primary }]}
              onPress={() => { tapMedium(); close(); onEdit(booking); }}
              activeOpacity={0.85}
            >
              <EditIcon />
              <Text style={s.actionLabel}>Edit</Text>
            </TouchableOpacity>
          )}
          {onCall && (
            <TouchableOpacity
              style={[s.action, { backgroundColor: palette.success }]}
              onPress={() => { tapLight(); close(); onCall(booking); }}
              activeOpacity={0.85}
            >
              <PhoneIcon />
              <Text style={s.actionLabel}>Call</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Card ── */}
      <Animated.View
        style={[s.card, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={() => { tapLight(); if (isOpen.current) { close(); } else { onPress(booking); } }}
          activeOpacity={0.78}
          style={s.inner}
        >
          {/* Header row */}
          <View style={s.headerRow}>
            <View style={s.iconBox}>
              <CalendarIcon color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.refText}>{ref}</Text>
              <Text style={s.clientText} numberOfLines={1}>{clientName}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: statusCfg.bg }]}>
              <View style={[s.dot, { backgroundColor: statusCfg.dot }]} />
              <Text style={[s.badgeText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={s.divider} />

          {/* Detail row */}
          <View style={s.detailRow}>
            <View style={s.detailItem}>
              <Text style={s.detailLabel}>Dates</Text>
              <Text style={s.detailValue}>{startDate} – {endDate}</Text>
            </View>
            {booking.vehicle && (
              <View style={[s.detailItem, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
                <TruckIcon />
                <Text style={s.detailValue} numberOfLines={1}>{booking.vehicle.name}</Text>
              </View>
            )}
          </View>

          {/* Payment progress */}
          <View style={s.paymentRow}>
            <View style={s.amounts}>
              <View style={s.amtGroup}>
                <Text style={s.amtLabel}>Total</Text>
                <Text style={s.amtValue}>{formatCurrency(total, currency)}</Text>
              </View>
              <View style={s.amtGroup}>
                <Text style={s.amtLabel}>Paid</Text>
                <Text style={[s.amtValue, { color: palette.success }]}>{formatCurrency(paid, currency)}</Text>
              </View>
              {balance > 0 && (
                <View style={s.amtGroup}>
                  <Text style={s.amtLabel}>Due</Text>
                  <Text style={[s.amtValue, { color: palette.danger }]}>{formatCurrency(balance, currency)}</Text>
                </View>
              )}
            </View>
            {/* Progress bar */}
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${pctPaid}%` as any, backgroundColor: pctPaid === 100 ? palette.success : palette.warning }]} />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { marginBottom: 12, position: 'relative' },

  // Tray sits behind the card on the right
  tray: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingRight: 4,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  action: {
    width: ACTION_WIDTH - 8,
    height: '100%',
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionLabel: { color: '#fff', fontSize: t.xs, fontWeight: t.bold, letterSpacing: 0.3 },

  card: {
    backgroundColor: palette.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: palette.border,
    ...shadow.md,
    overflow: 'hidden',
  },
  inner: { padding: spacing['4'], gap: 12 },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox:   { width: 42, height: 42, borderRadius: radius.lg, backgroundColor: palette.primaryXSoft, alignItems: 'center', justifyContent: 'center' },
  refText:   { fontSize: t.md, fontWeight: t.bold, color: palette.text, lineHeight: t.md * 1.3 },
  clientText:{ fontSize: t.sm, color: palette.textMuted, marginTop: 2, lineHeight: t.sm * 1.4 },

  badge:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  dot:       { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: t.bold, lineHeight: 14 },

  // Divider
  divider: { height: 1, backgroundColor: palette.border },

  // Detail
  detailRow:   { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  detailItem:  {},
  detailLabel: { fontSize: t.xs, color: palette.textSoft, fontWeight: t.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  detailValue: { fontSize: t.sm, color: palette.text, fontWeight: t.semibold, lineHeight: t.sm * 1.4 },

  // Payment
  paymentRow:   { gap: 8 },
  amounts:      { flexDirection: 'row', gap: 20 },
  amtGroup:     {},
  amtLabel:     { fontSize: t.xs, color: palette.textSoft, fontWeight: t.semibold, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  amtValue:     { fontSize: t.base, fontWeight: t.bold, color: palette.text, lineHeight: t.base * 1.3 },
  progressTrack:{ height: 4, backgroundColor: palette.surface, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
});
