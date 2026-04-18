import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface TopVehicle {
  id?: string;
  name: string;
  revenue: number;
  tripCount: number;
  capacity?: '7S' | '5S' | string;
}

interface TopVehiclesChartProps {
  data: TopVehicle[];
  loading?: boolean;
  currency?: string;
}

const CARD_COLORS = {
  background: '#fffdf9',
  text: '#181512',
  textMuted: '#7f7565',
  border: '#e1d7c8',
  track: '#ede6d8',
  sevenSeater: '#8366d7',
  fiveSeater: '#3d8f6a',
  gold: '#b78a43',
  silver: '#8a9ab0',
  bronze: '#b87c5a',
};

const RANK_COLORS = [CARD_COLORS.gold, CARD_COLORS.silver, CARD_COLORS.bronze];
const RANK_LABELS = ['🥇', '🥈', '🥉'];

const formatCurrency = (value: number, currency: string = 'USD'): string => {
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000)
    return `${currency === 'USD' ? '$' : currency}${(value / 1_000_000).toFixed(1)}M`;
  if (absValue >= 1_000)
    return `${currency === 'USD' ? '$' : currency}${(value / 1_000).toFixed(1)}K`;
  return `${currency === 'USD' ? '$' : currency}${value.toFixed(0)}`;
};

export function TopVehiclesChart({
  data,
  loading = false,
  currency = 'USD',
}: TopVehiclesChartProps) {
  const sorted = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [data]);

  const maxRevenue = useMemo(
    () => (sorted.length > 0 ? sorted[0].revenue : 1),
    [sorted]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={CARD_COLORS.sevenSeater} />
          <Text style={styles.mutedText}>Loading vehicle rankings…</Text>
        </View>
      </View>
    );
  }

  if (sorted.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🚙</Text>
          <Text style={styles.emptyTitle}>No vehicle data</Text>
          <Text style={styles.mutedText}>Revenue by vehicle will appear here once trips are recorded.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: CARD_COLORS.sevenSeater }]} />
          <Text style={styles.legendText}>7 Seater</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: CARD_COLORS.fiveSeater }]} />
          <Text style={styles.legendText}>5 Seater</Text>
        </View>
      </View>

      {sorted.map((vehicle, index) => {
        const is7S = vehicle.capacity === '7S' || vehicle.capacity?.includes('7');
        const accentColor = is7S ? CARD_COLORS.sevenSeater : CARD_COLORS.fiveSeater;
        const fillPct = maxRevenue > 0 ? (vehicle.revenue / maxRevenue) * 100 : 0;
        const isTopThree = index < 3;

        return (
          <View key={vehicle.id || vehicle.name} style={styles.vehicleRow}>
            {/* Rank */}
            <View style={styles.rankCell}>
              {isTopThree ? (
                <Text style={styles.rankEmoji}>{RANK_LABELS[index]}</Text>
              ) : (
                <Text style={[styles.rankNumber, { color: RANK_COLORS[index] ?? CARD_COLORS.textMuted }]}>
                  #{index + 1}
                </Text>
              )}
            </View>

            {/* Vehicle info + bar */}
            <View style={styles.infoSection}>
              <View style={styles.topRow}>
                <Text style={styles.vehicleName} numberOfLines={1}>
                  {vehicle.name}
                </Text>
                <View style={[styles.capacityBadge, { backgroundColor: accentColor + '22', borderColor: accentColor + '66' }]}>
                  <Text style={[styles.capacityText, { color: accentColor }]}>
                    {vehicle.capacity || 'N/A'}
                  </Text>
                </View>
              </View>

              {/* Revenue bar */}
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${fillPct}%`, backgroundColor: accentColor },
                  ]}
                />
              </View>

              {/* Stats */}
              <View style={styles.statsRow}>
                <Text style={[styles.revenueText, { color: accentColor }]}>
                  {formatCurrency(vehicle.revenue, currency)}
                </Text>
                <Text style={styles.tripsBadgeText}>
                  {vehicle.tripCount} {vehicle.tripCount === 1 ? 'trip' : 'trips'}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: CARD_COLORS.background,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: CARD_COLORS.border,
    shadowColor: '#201a13',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
    gap: 14,
  },
  centered: {
    minHeight: 140,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CARD_COLORS.text,
  },
  mutedText: {
    fontSize: 13,
    color: CARD_COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  legend: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: CARD_COLORS.textMuted,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankCell: {
    width: 36,
    alignItems: 'center',
  },
  rankEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  rankNumber: {
    fontSize: 13,
    fontWeight: '800',
  },
  infoSection: {
    flex: 1,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: '700',
    color: CARD_COLORS.text,
    flex: 1,
  },
  capacityBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  capacityText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  barTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: CARD_COLORS.track,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revenueText: {
    fontSize: 14,
    fontWeight: '800',
  },
  tripsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: CARD_COLORS.textMuted,
  },
});

export default TopVehiclesChart;
