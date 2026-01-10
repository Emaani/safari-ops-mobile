import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { Circle, useFont, Text as SkiaText } from '@shopify/react-native-skia';

// Types
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

// Color constants matching web dashboard
const COLORS = {
  revenue: '#6FA2E5',
  expenses: '#FF8688',
  axis: '#6b7280',
  grid: '#e5e7eb',
  background: '#ffffff',
  text: '#111827',
  mutedText: '#6b7280',
};

// Month abbreviations for x-axis
const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Compact currency formatter
const formatCurrency = (value: number, currency: string = 'USD'): string => {
  const absValue = Math.abs(value);
  if (absValue >= 1000000) {
    return `${currency === 'USD' ? '$' : currency}${(value / 1000000).toFixed(1)}M`;
  } else if (absValue >= 1000) {
    return `${currency === 'USD' ? '$' : currency}${(value / 1000).toFixed(0)}K`;
  }
  return `${currency === 'USD' ? '$' : currency}${value.toFixed(0)}`;
};

export function RevenueVsExpensesChart({
  data,
  loading = false,
  currency = 'USD',
}: RevenueVsExpensesChartProps) {
  const [showRevenue, setShowRevenue] = useState(true);
  const [showExpenses, setShowExpenses] = useState(true);

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => ({
      x: index,
      month: item.month,
      revenue: item.revenue,
      expenses: item.expenses,
    }));
  }, [data]);

  // Calculate Y domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return { min: 0, max: 100 };
    const allValues: number[] = [];
    chartData.forEach((d) => {
      if (showRevenue) allValues.push(d.revenue);
      if (showExpenses) allValues.push(d.expenses);
    });
    if (allValues.length === 0) return { min: 0, max: 100 };
    const max = Math.max(...allValues);
    const min = Math.min(0, Math.min(...allValues));
    return { min, max: max * 1.1 };
  }, [chartData, showRevenue, showExpenses]);

  // Get screen width for responsive sizing
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 32; // Account for padding

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.revenue} />
          <Text style={styles.loadingText}>Loading chart data...</Text>
        </View>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legendContainer}>
        <TouchableOpacity
          style={styles.legendItem}
          onPress={() => setShowRevenue(!showRevenue)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.legendDot,
              { backgroundColor: showRevenue ? COLORS.revenue : '#d1d5db' },
            ]}
          />
          <Text
            style={[
              styles.legendText,
              { color: showRevenue ? COLORS.text : '#9ca3af' },
            ]}
          >
            Revenue
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.legendItem}
          onPress={() => setShowExpenses(!showExpenses)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.legendDot,
              { backgroundColor: showExpenses ? COLORS.expenses : '#d1d5db' },
            ]}
          />
          <Text
            style={[
              styles.legendText,
              { color: showExpenses ? COLORS.text : '#9ca3af' },
            ]}
          >
            Expenses
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chart */}
      <View style={[styles.chartWrapper, { width: chartWidth }]}>
        <CartesianChart
          data={chartData}
          xKey="x"
          yKeys={['revenue', 'expenses']}
          domain={{ y: [yDomain.min, yDomain.max] }}
          padding={{ left: 50, right: 16, top: 16, bottom: 40 }}
          axisOptions={{
            font: null,
            tickCount: { x: Math.min(chartData.length, 6), y: 5 },
            lineColor: COLORS.grid,
            labelColor: COLORS.axis,
            formatXLabel: (value) => {
              const index = Math.round(value);
              if (index >= 0 && index < chartData.length) {
                const monthStr = chartData[index]?.month || '';
                // Try to get abbreviated month
                const monthIndex = MONTH_ABBREV.findIndex(
                  (m) => monthStr.toLowerCase().startsWith(m.toLowerCase())
                );
                return monthIndex >= 0 ? MONTH_ABBREV[monthIndex] : monthStr.slice(0, 3);
              }
              return '';
            },
            formatYLabel: (value) => formatCurrency(value, currency),
          }}
        >
          {({ points }) => (
            <>
              {/* Revenue line */}
              {showRevenue && points.revenue && (
                <Line
                  points={points.revenue}
                  color={COLORS.revenue}
                  strokeWidth={2}
                  curveType="natural"
                />
              )}
              {/* Expenses line */}
              {showExpenses && points.expenses && (
                <Line
                  points={points.expenses}
                  color={COLORS.expenses}
                  strokeWidth={2}
                  curveType="natural"
                />
              )}
              {/* Data points for revenue */}
              {showRevenue &&
                points.revenue?.map((point, index) => (
                  point.y !== null && (
                    <Circle
                      key={`revenue-dot-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={4}
                      color={COLORS.revenue}
                    />
                  )
                ))}
              {/* Data points for expenses */}
              {showExpenses &&
                points.expenses?.map((point, index) => (
                  point.y !== null && (
                    <Circle
                      key={`expenses-dot-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={4}
                      color={COLORS.expenses}
                    />
                  )
                ))}
            </>
          )}
        </CartesianChart>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  chartWrapper: {
    height: 220,
  },
  loadingContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.mutedText,
  },
  emptyContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.mutedText,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default RevenueVsExpensesChart;
