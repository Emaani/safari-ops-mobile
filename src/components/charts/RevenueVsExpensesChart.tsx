import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
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

const formatAxisCompact = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return `${Math.round(value)}`;
};

export function RevenueVsExpensesChart({
  data,
  loading = false,
  currency = 'USD',
}: RevenueVsExpensesChartProps) {
  const [showRevenue, setShowRevenue] = useState(true);
  const [showExpenses, setShowExpenses] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { width: windowWidth } = useWindowDimensions();

  const chartWidth = Math.max(windowWidth - 76, 240);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => ({
      x: index,
      month: item.month,
      revenue: item.revenue,
      expenses: item.expenses,
      net: item.revenue - item.expenses,
    }));
  }, [data]);

  useEffect(() => {
    if (chartData.length === 0) {
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex((prev) => Math.min(prev, chartData.length - 1));
  }, [chartData]);

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
  const selectedPoint = chartData[selectedIndex] || null;

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
      <View style={styles.chartFrame}>
        <View style={{ width: chartWidth, height: 220, alignSelf: 'center' }}>
          <CartesianChart
            data={chartData}
            xKey="x"
            yKeys={['revenue', 'expenses']}
            domain={{ y: yDomain }}
            padding={{ left: 44, right: 12, top: 18, bottom: 30 }}
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
              formatYLabel: (value) => formatAxisCompact(value),
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
                      strokeWidth={3}
                      curveType="natural"
                    />
                    {points.revenue.map((pt, i) =>
                      pt.y !== null ? (
                        <React.Fragment key={`rev-${i}`}>
                          <Circle cx={pt.x} cy={pt.y} r={5} color="#fffdf9" />
                          <Circle cx={pt.x} cy={pt.y} r={i === selectedIndex ? 4.5 : 3.5} color={CARD_COLORS.revenue} />
                        </React.Fragment>
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
                      strokeWidth={3}
                      curveType="natural"
                    />
                    {points.expenses.map((pt, i) =>
                      pt.y !== null ? (
                        <React.Fragment key={`exp-${i}`}>
                          <Circle cx={pt.x} cy={pt.y} r={5} color="#fffdf9" />
                          <Circle cx={pt.x} cy={pt.y} r={i === selectedIndex ? 4.5 : 3.5} color={CARD_COLORS.expenses} />
                        </React.Fragment>
                      ) : null
                    )}
                  </>
                )}
              </>
            )}
          </CartesianChart>
        </View>
      </View>

      {selectedPoint && (
        <View style={styles.selectedCard}>
          <View style={styles.selectedHeader}>
            <Text style={styles.selectedMonth}>{selectedPoint.month}</Text>
            <View
              style={[
                styles.netBadge,
                { backgroundColor: selectedPoint.net >= 0 ? CARD_COLORS.revenueSoft : CARD_COLORS.expensesSoft },
              ]}
            >
              <Text
                style={[
                  styles.netBadgeText,
                  { color: selectedPoint.net >= 0 ? CARD_COLORS.revenue : CARD_COLORS.expenses },
                ]}
              >
                {selectedPoint.net >= 0 ? '+' : ''}
                {formatCompact(selectedPoint.net, currency)}
              </Text>
            </View>
          </View>
          <View style={styles.selectedMetricsRow}>
            <View style={styles.selectedMetric}>
              <Text style={styles.selectedMetricLabel}>Revenue</Text>
              <Text style={[styles.selectedMetricValue, { color: CARD_COLORS.revenue }]}>
                {formatCompact(selectedPoint.revenue, currency)}
              </Text>
            </View>
            <View style={styles.selectedMetricDivider} />
            <View style={styles.selectedMetric}>
              <Text style={styles.selectedMetricLabel}>Expenses</Text>
              <Text style={[styles.selectedMetricValue, { color: CARD_COLORS.expenses }]}>
                {formatCompact(selectedPoint.expenses, currency)}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.monthRail}>
        {chartData.map((point, index) => (
          <TouchableOpacity
            key={`${point.month}-${index}`}
            style={[styles.monthChip, index === selectedIndex && styles.monthChipActive]}
            onPress={() => setSelectedIndex(index)}
            activeOpacity={0.82}
          >
            <Text style={[styles.monthChipText, index === selectedIndex && styles.monthChipTextActive]}>
              {point.month}
            </Text>
          </TouchableOpacity>
        ))}
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
  chartFrame: {
    borderRadius: 18,
    paddingVertical: 8,
    backgroundColor: '#f9f5ee',
    borderWidth: 1,
    borderColor: CARD_COLORS.border,
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
  selectedCard: {
    backgroundColor: '#f9f5ee',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_COLORS.border,
    padding: 14,
    gap: 12,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectedMonth: {
    fontSize: 15,
    fontWeight: '800',
    color: CARD_COLORS.text,
  },
  netBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  netBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  selectedMetricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  selectedMetric: {
    flex: 1,
    gap: 4,
  },
  selectedMetricDivider: {
    width: 1,
    backgroundColor: CARD_COLORS.border,
    marginHorizontal: 12,
  },
  selectedMetricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: CARD_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedMetricValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  monthRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD_COLORS.border,
    backgroundColor: '#f7f1e8',
  },
  monthChipActive: {
    backgroundColor: CARD_COLORS.text,
    borderColor: CARD_COLORS.text,
  },
  monthChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: CARD_COLORS.textMuted,
  },
  monthChipTextActive: {
    color: '#fffaf3',
  },
});

export default RevenueVsExpensesChart;
