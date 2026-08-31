import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { formatCurrency } from '../../lib/utils';

interface ExpenseCategory {
  id?: string;
  name: string;
  amount: number;
  color?: string;
}

interface ExpenseCategoriesChartProps {
  data: ExpenseCategory[];
  loading?: boolean;
  currency?: string;
  onBarPress?: (category: ExpenseCategory, index: number) => void;
}

const CARD_COLORS = {
  background: '#FFFFFF',
  text: '#1C1C1E',
  textMuted: '#6C6C70',
  border: '#E5E5EA',
  track: '#F2F2F7',
};

const BAR_PALETTE = [
  '#8B6B3E', // bronze
  '#C6A563', // gold
  '#7A5AF8', // indigo
  '#FF3B30', // red
  '#34A853', // green
  '#F5A623', // amber
  '#007AFF', // blue
  '#FF6B9D', // pink
  '#5AC8FA', // cyan
  '#FF9500', // orange
];


export function ExpenseCategoriesChart({
  data,
  loading = false,
  currency = 'USD',
}: ExpenseCategoriesChartProps) {
  const sorted = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
      .map((item, i) => ({
        ...item,
        color: item.color || BAR_PALETTE[i % BAR_PALETTE.length],
      }));
  }, [data]);

  const maxAmount = useMemo(
    () => (sorted.length > 0 ? sorted[0].amount : 1),
    [sorted]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BAR_PALETTE[0]} />
          <Text style={styles.mutedText}>Loading expense breakdown…</Text>
        </View>
      </View>
    );
  }

  if (sorted.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>No expense data</Text>
          <Text style={styles.mutedText}>Expenses will appear here once recorded.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {sorted.map((item, index) => {
        const fillPct = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
        return (
          <View key={`${item.name}-${index}`} style={styles.row}>
            {/* Rank + dot */}
            <View style={styles.rankWrap}>
              <View style={[styles.rankDot, { backgroundColor: item.color }]} />
              <Text style={styles.rankNum}>{index + 1}</Text>
            </View>

            {/* Name + bar + amount */}
            <View style={styles.barSection}>
              <View style={styles.labelRow}>
                <Text style={styles.categoryName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.amountText, { color: item.color }]}>
                  {formatCurrency(item.amount, currency as any)}
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${fillPct}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        );
      })}

      {data.length > 8 && (
        <Text style={styles.moreLabel}>+{data.length - 8} more categories</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankWrap: {
    width: 32,
    alignItems: 'center',
    gap: 4,
  },
  rankDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rankNum: {
    fontSize: 10,
    fontWeight: '700',
    color: CARD_COLORS.textMuted,
  },
  barSection: {
    flex: 1,
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: CARD_COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  amountText: {
    fontSize: 13,
    fontWeight: '800',
  },
  track: {
    height: 7,
    borderRadius: 999,
    backgroundColor: CARD_COLORS.track,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  moreLabel: {
    fontSize: 11,
    color: CARD_COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ExpenseCategoriesChart;
