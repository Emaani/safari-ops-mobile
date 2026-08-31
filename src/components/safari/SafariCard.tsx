import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
import type { Booking } from '../../types/dashboard';
import { formatCurrency } from '../../lib/utils';
import { getBookingStatusConfig } from '../../constants/bookingStatus';

const P = {
  primary:     '#8B6B3E',
  gold:        '#C6A563',
  goldSoft:    '#FDE8C0',
  success:     '#34A853',
  successSoft: '#E8F7EE',
  danger:      '#FF3B30',
  card:        '#FFFFFF',
  bg:          '#F2F2F7',
  text:        '#1C1C1E',
  textMuted:   '#6C6C70',
  textSoft:    '#AEAEB2',
  border:      '#E5E5EA',
  primarySoft: '#FEF0DC',
  primaryXSoft:'#FDF8EF',
};

function CompassIcon({ color = P.gold }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </Svg>
  );
}

function MapPinIcon({ color = P.textMuted }: { color?: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

function UsersIcon({ color = P.textMuted }: { color?: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

interface SafariCardProps {
  safari: Booking & { vehicle?: { name: string }; destination?: string; pax_count?: number };
  onPress: (safari: Booking) => void;
}

export function SafariCard({ safari, onPress }: SafariCardProps) {
  const statusCfg  = getBookingStatusConfig(safari.status);
  const clientName = safari.client?.company_name || safari.client_name || 'Unknown Client';
  const ref        = safari.booking_number || `#${safari.id.slice(0, 8).toUpperCase()}`;
  const startDate  = new Date(safari.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endDate    = new Date(safari.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  const ext        = safari as any;
  const total      = safari.total_cost || (safari as any).total_amount || 0;
  const currency   = safari.currency || 'USD';

  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(safari)} activeOpacity={0.78}>
      {/* Luxury accent bar — gold for safari */}
      <View style={s.accentBar} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.iconWrap}>
          <CompassIcon color={P.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.ref}>{ref}</Text>
          <Text style={s.client} numberOfLines={1}>{clientName}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: statusCfg.bg }]}>
          <View style={[s.dot, { backgroundColor: statusCfg.dot }]} />
          <Text style={[s.badgeText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={s.divider} />

      {/* Details */}
      <View style={s.details}>
        <View style={s.detailCol}>
          <Text style={s.detailLabel}>Safari Period</Text>
          <Text style={s.detailValue}>{startDate} – {endDate}</Text>
        </View>
        {total > 0 && (
          <View style={s.detailCol}>
            <Text style={s.detailLabel}>Value</Text>
            <Text style={[s.detailValue, { color: P.success }]}>{formatCurrency(total, currency)}</Text>
          </View>
        )}
      </View>

      {/* Meta row */}
      {(ext.destination || ext.pax_count || safari.vehicle || safari.profiles?.full_name) && (
        <View style={s.metaRow}>
          {ext.destination ? (
            <View style={s.metaItem}>
              <MapPinIcon />
              <Text style={s.metaText} numberOfLines={1}>{ext.destination}</Text>
            </View>
          ) : null}
          {ext.pax_count ? (
            <View style={s.metaItem}>
              <UsersIcon />
              <Text style={s.metaText}>{ext.pax_count} pax</Text>
            </View>
          ) : null}
          {safari.vehicle ? (
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Vehicle:</Text>
              <Text style={s.metaText} numberOfLines={1}>{safari.vehicle.name}</Text>
            </View>
          ) : null}
          {safari.profiles?.full_name ? (
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Guide:</Text>
              <Text style={s.metaText}>{safari.profiles.full_name}</Text>
            </View>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: P.card,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: P.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
    overflow: 'hidden',
  },
  accentBar: {
    height: 3,
    width: '100%',
    backgroundColor: P.gold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingBottom: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: P.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ref: {
    fontSize: 15,
    fontWeight: '800',
    color: P.text,
    letterSpacing: 0.3,
  },
  client: {
    fontSize: 12,
    color: P.textMuted,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: P.border,
    marginHorizontal: 16,
  },
  details: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 24,
  },
  detailCol: {},
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: P.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: P.text,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: P.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaText: {
    fontSize: 12,
    color: P.textMuted,
    fontWeight: '500',
  },
});
