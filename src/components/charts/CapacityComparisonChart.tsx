import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface CapacityData {
  category: string;
  sevenSeater: number;
  fiveSeater: number;
}

interface CapacityComparisonChartProps {
  revenueData: CapacityData | null;
  tripData: CapacityData | null;
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
  sectionBg: '#f5f0e8',
};

const formatCurrency = (value: number, currency: string = 'USD'): string => {
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000)
    return `${currency === 'USD' ? '$' : currency}${(value / 1_000_000).toFixed(1)}M`;
  if (absValue >= 1_000)
    return `${currency === 'USD' ? '$' : currency}${(value / 1_000).toFixed(1)}K`;
  return `${currency === 'USD' ? '$' : currency}${value.toFixed(0)}`;
};

interface StatRowProps {
  label: string;
  sevenValue: number;
  fiveValue: number;
  formatValue: (v: number) => string;
}

function StatRow({ label, sevenValue, fiveValue, formatValue }: StatRowProps) {
  const total = sevenValue + fiveValue;
  const sevenPct = total > 0 ? (sevenValue / total) * 100 : 50;
  const fivePct = total > 0 ? (fiveValue / total) * 100 : 50;
  const winner = sevenValue >= fiveValue ? '7S' : '5S';

  return (
    <View style={sStyles.block}>
      <View style={sStyles.blockHeader}>
        <Text style={sStyles.blockLabel}>{label}</Text>
        <View style={[
          sStyles.winnerBadge,
          { backgroundColor: winner === '7S' ? CARD_COLORS.sevenSeater + '22' : CARD_COLORS.fiveSeater + '22' },
        ]}>
          <Text style={[
            sStyles.winnerText,
            { color: winner === '7S' ? CARD_COLORS.sevenSeater : CARD_COLORS.fiveSeater },
          ]}>
            {winner} leads
          </Text>
        </View>
      </View>

      {/* Split bar */}
      <View style={sStyles.splitBar}>
        <View style={[sStyles.splitLeft, { flex: sevenPct, backgroundColor: CARD_COLORS.sevenSeater }]} />
        <View style={[sStyles.splitRight, { flex: fivePct, backgroundColor: CARD_COLORS.fiveSeater }]} />
      </View>

      {/* Value cards */}
      <View style={sStyles.valueRow}>
        <View style={[sStyles.valueCard, { borderLeftColor: CARD_COLORS.sevenSeater, borderLeftWidth: 3 }]}>
          <Text style={sStyles.valueCapacity}>7 Seater</Text>
          <Text style={[sStyles.valueAmount, { color: CARD_COLORS.sevenSeater }]}>
            {formatValue(sevenValue)}
          </Text>
          <Text style={sStyles.valuePct}>{sevenPct.toFixed(0)}%</Text>
        </View>
        <View style={[sStyles.valueCard, { borderLeftColor: CARD_COLORS.fiveSeater, borderLeftWidth: 3 }]}>
          <Text style={sStyles.valueCapacity}>5 Seater</Text>
          <Text style={[sStyles.valueAmount, { color: CARD_COLORS.fiveSeater }]}>
            {formatValue(fiveValue)}
          </Text>
          <Text style={sStyles.valuePct}>{fivePct.toFixed(0)}%</Text>
        </View>
      </View>
    </View>
  );
}

export function CapacityComparisonChart({
  revenueData,
  tripData,
  loading = false,
  currency = 'USD',
}: CapacityComparisonChartProps) {
  const hasRevenueData = revenueData && (revenueData.sevenSeater > 0 || revenueData.fiveSeater > 0);
  const hasTripData = tripData && (tripData.sevenSeater > 0 || tripData.fiveSeater > 0);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={CARD_COLORS.sevenSeater} />
          <Text style={styles.mutedText}>Loading capacity comparison…</Text>
        </View>
      </View>
    );
  }

  if (!hasRevenueData && !hasTripData) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🚐</Text>
          <Text style={styles.emptyTitle}>No capacity data</Text>
          <Text style={styles.mutedText}>Fleet comparison data will appear once trips are completed.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: CARD_COLORS.sevenSeater }]} />
          <Text style={styles.legendText}>7 Seater</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: CARD_COLORS.fiveSeater }]} />
          <Text style={styles.legendText}>5 Seater</Text>
        </View>
      </View>

      {hasRevenueData && revenueData && (
        <StatRow
          label="Revenue Comparison"
          sevenValue={revenueData.sevenSeater}
          fiveValue={revenueData.fiveSeater}
          formatValue={(v) => formatCurrency(v, currency)}
        />
      )}

      {hasTripData && tripData && (
        <StatRow
          label="Trip Count Comparison"
          sevenValue={tripData.sevenSeater}
          fiveValue={tripData.fiveSeater}
          formatValue={(v) => `${v} trips`}
        />
      )}
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
    gap: 16,
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
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: CARD_COLORS.textMuted,
  },
});

const sStyles = StyleSheet.create({
  block: {
    backgroundColor: CARD_COLORS.sectionBg,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  blockLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: CARD_COLORS.text,
  },
  winnerBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  winnerText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  splitBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    gap: 2,
  },
  splitLeft: {
    borderRadius: 999,
  },
  splitRight: {
    borderRadius: 999,
  },
  valueRow: {
    flexDirection: 'row',
    gap: 10,
  },
  valueCard: {
    flex: 1,
    backgroundColor: CARD_COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
  valueCapacity: {
    fontSize: 10,
    fontWeight: '600',
    color: CARD_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueAmount: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  valuePct: {
    fontSize: 11,
    color: CARD_COLORS.textMuted,
    fontWeight: '600',
  },
});

export default CapacityComparisonChart;
