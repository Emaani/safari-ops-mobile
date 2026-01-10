import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { CartesianChart, Bar } from 'victory-native';

// Types
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

// Color constants matching web dashboard
const COLORS = {
  axis: '#6b7280',
  grid: '#e5e7eb',
  background: '#ffffff',
  text: '#111827',
  mutedText: '#6b7280',
};

// Dynamic bar colors palette
const BAR_COLORS = [
  '#6FA2E5', // Blue
  '#FF8688', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#9333ea', // Purple
  '#3b82f6', // Blue-500
  '#ef4444', // Red-500
  '#84cc16', // Lime
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

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

// Truncate long category names
const truncateName = (name: string, maxLength: number = 10): string => {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 2) + '..';
};

export function ExpenseCategoriesChart({
  data,
  loading = false,
  currency = 'USD',
  onBarPress,
}: ExpenseCategoriesChartProps) {
  // Get screen width for responsive sizing
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 32;

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => ({
      x: index,
      amount: item.amount,
      name: item.name,
      color: item.color || BAR_COLORS[index % BAR_COLORS.length],
      originalData: item,
    }));
  }, [data]);

  // Calculate Y domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return { min: 0, max: 100 };
    const maxValue = Math.max(...chartData.map((d) => d.amount));
    return { min: 0, max: maxValue * 1.1 };
  }, [chartData]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BAR_COLORS[0]} />
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
      {/* Touch overlay for bar interactions */}
      {onBarPress && (
        <View style={styles.touchOverlay}>
          {chartData.map((item, index) => (
            <TouchableOpacity
              key={`touch-${index}`}
              style={[
                styles.touchZone,
                { width: chartWidth / chartData.length },
              ]}
              onPress={() => onBarPress(item.originalData, index)}
              activeOpacity={0.7}
            />
          ))}
        </View>
      )}

      {/* Chart */}
      <View style={[styles.chartWrapper, { width: chartWidth }]}>
        <CartesianChart
          data={chartData}
          xKey="x"
          yKeys={['amount']}
          domain={{ y: [yDomain.min, yDomain.max] }}
          padding={{ left: 50, right: 16, top: 16, bottom: 50 }}
          axisOptions={{
            font: null,
            tickCount: { x: chartData.length, y: 5 },
            lineColor: COLORS.grid,
            labelColor: COLORS.axis,
            formatXLabel: (value) => {
              const index = Math.round(value);
              if (index >= 0 && index < chartData.length) {
                return truncateName(chartData[index]?.name || '', 8);
              }
              return '';
            },
            formatYLabel: (value) => formatCurrency(value, currency),
            labelOffset: { x: 8, y: 8 },
          }}
        >
          {({ points, chartBounds }) => (
            <>
              {/* Render individual bars with colors */}
              {chartData.map((item, index) => {
                const barPoints = points.amount.filter(
                  (_, i) => i === index
                );
                if (barPoints.length === 0) return null;
                return (
                  <Bar
                    key={`bar-${index}`}
                    points={[barPoints[0]]}
                    chartBounds={chartBounds}
                    color={item.color}
                    roundedCorners={{ topLeft: 4, topRight: 4 }}
                    innerPadding={0.3}
                    barCount={chartData.length}
                  />
                );
              })}
            </>
          )}
        </CartesianChart>
      </View>

      {/* Category labels with amounts */}
      <View style={styles.labelsContainer}>
        {chartData.slice(0, 5).map((item, index) => (
          <TouchableOpacity
            key={`label-${index}`}
            style={styles.labelItem}
            onPress={() => onBarPress?.(item.originalData, index)}
            activeOpacity={onBarPress ? 0.7 : 1}
            disabled={!onBarPress}
          >
            <View style={[styles.labelDot, { backgroundColor: item.color }]} />
            <View style={styles.labelTextContainer}>
              <Text style={styles.labelName} numberOfLines={1}>
                {truncateName(item.name, 12)}
              </Text>
              <Text style={styles.labelAmount}>
                {formatCurrency(item.amount, currency)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
        {chartData.length > 5 && (
          <Text style={styles.moreLabel}>+{chartData.length - 5} more</Text>
        )}
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
  touchOverlay: {
    position: 'absolute',
    top: 16,
    left: 50,
    right: 16,
    height: 220,
    flexDirection: 'row',
    zIndex: 10,
  },
  touchZone: {
    height: '100%',
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
  labelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  labelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
  },
  labelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  labelTextContainer: {
    flexDirection: 'column',
  },
  labelName: {
    fontSize: 10,
    color: COLORS.mutedText,
    fontWeight: '500',
  },
  labelAmount: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '600',
  },
  moreLabel: {
    fontSize: 10,
    color: COLORS.mutedText,
    fontStyle: 'italic',
    alignSelf: 'center',
  },
});

export default ExpenseCategoriesChart;
