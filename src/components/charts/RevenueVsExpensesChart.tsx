import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { CartesianChart, Line, Area } from 'victory-native';
import { Circle } from '@shopify/react-native-skia';

interface MonthlyRevenueExpense {
  month: string;
  revenue: number;
  expenses: number;
}

interface RevenueVsExpensesChartProps {
  data: MonthlyRevenueExpense[];
  loading?: boolean;
  currency?: string;
}

const CARD_COLORS = {
  background: '#fffdf9',
  text: '#181512',
  textMuted: '#7f7565',
  border: '#e1d7c8',
  grid: '#e8e0d4',
  revenue: '#3d8f6a',
  expenses: '#c96d4d',
  revenueSoft: '#3d8f6a33',
  expensesSoft: '#c96d4d33',
};

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatCompact = (value: number, currency: string = 'USD'): string => {
  const prefix = currency === 'USD' ? '$' : currency + ' ';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${prefix}${(value / 1_000).toFixed(0)}K`;
  return `${prefix}${value.toFixed(0)}`;
};

export function RevenueVsExpensesChart({
  data,
  loading = false,
  currency = 'USD',
}: RevenueVsExpensesChartProps) {
  const [showRevenue, setShowRevenue] = useState(true);
  const [showExpenses, setShowExpenses] = useState(true);

  // scrollContent paddingH:20 (×2=40) + card padding:18 (×2=36) = 76
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 76;

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => ({
      x: index,
      month: item.month,
      revenue: item.revenue,
      expenses: item.expenses,
    }));
  }, [data]);

  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100] as [number, number];
    const vals: number[] = [];
    chartData.forEach((d) => {
      if (showRevenue) vals.push(d.revenue);
      if (showExpenses) vals.push(d.expenses);
    });
    if (vals.length === 0) return [0, 100] as [number, number];
    const max = Math.max(...vals);
    return [0, max * 1.15] as [number, number];
  }, [chartData, showRevenue, showExpenses]);

  // Summary totals for the header
  const totals = useMemo(() => {
    const rev = chartData.reduce((s, d) => s + d.revenue, 0);
    const exp = chartData.reduce((s, d) => s + d.expenses, 0);
    return { revenue: rev, expenses: exp, net: rev - exp };
  }, [chartData]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={CARD_COLORS.revenue} />
          <Text style={styles.mutedText}>Loading revenue data…</Text>
        </View>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>📈</Text>
          <Text style={styles.emptyTitle}>No trend data</Text>
          <Text style={styles.mutedText}>Monthly revenue and expenses will appear here.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Revenue</Text>
          <Text style={[styles.summaryValue, { color: CARD_COLORS.revenue }]}>
            {formatCompact(totals.revenue, currency)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Expenses</Text>
          <Text style={[styles.summaryValue, { color: CARD_COLORS.expenses }]}>
            {formatCompact(totals.expenses, currency)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Net</Text>
          <Text style={[
            styles.summaryValue,
            { color: totals.net >= 0 ? CARD_COLORS.revenue : CARD_COLORS.expenses },
          ]}>
            {totals.net >= 0 ? '+' : ''}{formatCompact(totals.net, currency)}
          </Text>
        </View>
      </View>

      {/* Legend toggles */}
      <View style={styles.legendRow}>
        <TouchableOpacity
          style={[styles.legendChip, { opacity: showRevenue ? 1 : 0.45 }]}
          onPress={() => setShowRevenue(!showRevenue)}
          activeOpacity={0.75}
        >
          <View style={[styles.legendDot, { backgroundColor: CARD_COLORS.revenue }]} />
          <Text style={styles.legendText}>Revenue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.legendChip, { opacity: showExpenses ? 1 : 0.45 }]}
          onPress={() => setShowExpenses(!showExpenses)}
          activeOpacity={0.75}
        >
          <View style={[styles.legendDot, { backgroundColor: CARD_COLORS.expenses }]} />
          <Text style={styles.legendText}>Expenses</Text>
        </TouchableOpacity>
      </View>

      {/* Chart */}
      <View style={{ width: chartWidth, height: 200, alignSelf: 'center' }}>
        <CartesianChart
          data={chartData}
          xKey="x"
          yKeys={['revenue', 'expenses']}
          domain={{ y: yDomain }}
          padding={{ left: 48, right: 12, top: 12, bottom: 36 }}
          axisOptions={{
            font: null,
            tickCount: { x: Math.min(chartData.length, 6), y: 4 },
            lineColor: CARD_COLORS.grid,
            labelColor: CARD_COLORS.textMuted,
            formatXLabel: (value) => {
              const idx = Math.round(value);
              if (idx >= 0 && idx < chartData.length) {
                const m = chartData[idx]?.month || '';
                const mi = MONTH_ABBREV.findIndex((a) =>
                  m.toLowerCase().startsWith(a.toLowerCase())
                );
                return mi >= 0 ? MONTH_ABBREV[mi] : m.slice(0, 3);
              }
              return '';
            },
            formatYLabel: (value) => formatCompact(value, currency),
          }}
        >
          {({ points }) => (
            <>
              {showRevenue && points.revenue && (
                <>
                  <Area
                    points={points.revenue}
                    color={CARD_COLORS.revenueSoft}
                    curveType="natural"
                    y0={yDomain[0]}
                  />
                  <Line
                    points={points.revenue}
                    color={CARD_COLORS.revenue}
                    strokeWidth={2.5}
                    curveType="natural"
                  />
                  {points.revenue.map((pt, i) =>
                    pt.y !== null ? (
                      <Circle key={`rev-${i}`} cx={pt.x} cy={pt.y} r={4} color={CARD_COLORS.revenue} />
                    ) : null
                  )}
                </>
              )}
              {showExpenses && points.expenses && (
                <>
                  <Area
                    points={points.expenses}
                    color={CARD_COLORS.expensesSoft}
                    curveType="natural"
                    y0={yDomain[0]}
                  />
                  <Line
                    points={points.expenses}
                    color={CARD_COLORS.expenses}
                    strokeWidth={2.5}
                    curveType="natural"
                  />
                  {points.expenses.map((pt, i) =>
                    pt.y !== null ? (
                      <Circle key={`exp-${i}`} cx={pt.x} cy={pt.y} r={4} color={CARD_COLORS.expenses} />
                    ) : null
                  )}
                </>
              )}
            </>
          )}
        </CartesianChart>
      </View>
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
    minHeight: 200,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f0e8',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: CARD_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: CARD_COLORS.border,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#f0ebe3',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: CARD_COLORS.text,
  },
});

export default RevenueVsExpensesChart;
