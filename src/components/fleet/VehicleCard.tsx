import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
import type { Vehicle } from '../../types/dashboard';

const P = {
  primary:     '#8B6B3E',
  gold:        '#C6A563',
  goldSoft:    '#FDE8C0',
  success:     '#34A853',
  successSoft: '#E8F7EE',
  warning:     '#F5A623',
  warningSoft: '#FEF3DC',
  danger:      '#FF3B30',
  dangerSoft:  '#FFEEED',
  purple:      '#7A5AF8',
  purpleSoft:  '#EDE8FE',
  card:        '#FFFFFF',
  bg:          '#F2F2F7',
  text:        '#1C1C1E',
  textMuted:   '#6C6C70',
  textSoft:    '#AEAEB2',
  border:      '#E5E5EA',
  primarySoft: '#FEF0DC',
  primaryXSoft:'#FDF8EF',
};

const STATUS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  available:     { bg: P.successSoft, text: '#1A6B3C', dot: P.success, label: 'Available'      },
  booked:        { bg: P.purpleSoft,  text: '#5436CC', dot: P.purple,  label: 'Booked'         },
  rented:        { bg: P.primarySoft, text: P.primary, dot: P.primary, label: 'Rented'         },
  maintenance:   { bg: P.warningSoft, text: '#7a5000', dot: P.warning, label: 'Maintenance'    },
  out_of_service:{ bg: P.dangerSoft,  text: '#CC1400', dot: P.danger,  label: 'Out of Service' },
};

function TruckIcon({ color = P.primary }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 3h15v13H1z" />
      <Path d="M16 8h4l3 3v5h-7V8z" />
      <Circle cx="5.5" cy="18.5" r="2.5" />
      <Circle cx="18.5" cy="18.5" r="2.5" />
    </Svg>
  );
}

interface VehicleCardProps {
  vehicle: Vehicle;
  onPress: (vehicle: Vehicle) => void;
}

export function VehicleCard({ vehicle, onPress }: VehicleCardProps) {
  const st         = STATUS[vehicle.status] ?? STATUS.available;
  const vehicleName = `${vehicle.make} ${vehicle.model}`;
  const capacity   = vehicle.capacity?.replace('_', ' ')
    .replace(/(\d+)\s*seater/i, '$1-Seater') || 'N/A';
  const driver     = vehicle.drivers?.full_name || 'Unassigned';

  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(vehicle)} activeOpacity={0.78}>
      {/* Luxury accent bar */}
      <View style={[s.accentBar, { backgroundColor: st.dot }]} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.iconWrap}>
          <TruckIcon color={P.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.plate}>{vehicle.license_plate}</Text>
          <Text style={s.name} numberOfLines={1}>{vehicleName}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: st.bg }]}>
          <View style={[s.dot, { backgroundColor: st.dot }]} />
          <Text style={[s.badgeText, { color: st.text }]}>{st.label}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={s.divider} />

      {/* Details */}
      <View style={s.details}>
        <View style={s.detailCol}>
          <Text style={s.detailLabel}>Capacity</Text>
          <Text style={s.detailValue}>{capacity}</Text>
        </View>
        <View style={s.detailCol}>
          <Text style={s.detailLabel}>Driver</Text>
          <Text style={s.detailValue} numberOfLines={1}>{driver}</Text>
        </View>
        {(vehicle as any).year ? (
          <View style={s.detailCol}>
            <Text style={s.detailLabel}>Year</Text>
            <Text style={s.detailValue}>{(vehicle as any).year}</Text>
          </View>
        ) : null}
      </View>
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
    backgroundColor: P.primaryXSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plate: {
    fontSize: 15,
    fontWeight: '800',
    color: P.text,
    letterSpacing: 0.3,
  },
  name: {
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
});
