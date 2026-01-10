import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { CartesianChart, Bar } from 'victory-native';

// Types
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

// Color constants matching web dashboard
const COLORS = {
  sevenSeater: '#9333ea', // Purple
  fiveSeater: '#10b981', // Green
  axis: '#6b7280',
  grid: '#e5e7eb',
  background: '#ffffff',
  text: '#111827',
  mutedText: '#6b7280',
};

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

// Format number with compact notation
const formatNumber = (value: number): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};

// Single bar chart component
interface SingleComparisonChartProps {
  title: string;
  data: { label: string; value: number; color: string }[];
  formatValue: (value: number) => string;
  height: number;
}

function SingleComparisonChart({
  title,
  data,
  formatValue,
  height,
}: SingleComparisonChartProps) {
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      x: index,
      value: item.value,
      label: item.label,
      color: item.color,
    }));
  }, [data]);

  const maxValue = useMemo(() => {
    const max = Math.max(...data.map((d) => d.value));
    return max * 1.2 || 100;
  }, [data]);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = (screenWidth - 48) / 2; // Half width minus padding

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <View style={[styles.chartCard, { width: chartWidth }]}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.emptyMiniContainer}>
          <Text style={styles.emptyText}>No data</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.chartCard, { width: chartWidth }]}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={{ height }}>
        <CartesianChart
          data={chartData}
          xKey="x"
          yKeys={['value']}
          domain={{ y: [0, maxValue] }}
          padding={{ left: 40, right: 8, top: 8, bottom: 30 }}
          axisOptions={{
            font: null,
            tickCount: { x: 2, y: 4 },
            lineColor: COLORS.grid,
            labelColor: COLORS.axis,
            formatXLabel: (value) => {
              const index = Math.round(value);
              if (index >= 0 && index < chartData.length) {
                return chartData[index]?.label || '';
              }
              return '';
            },
            formatYLabel: (value) => formatValue(value),
          }}
        >
          {({ points, chartBounds }) => (
            <>
              {chartData.map((item, index) => {
                const point = points.value[index];
                if (!point) return null;
                return (
                  <Bar
                    key={`bar-${index}`}
                    points={[point]}
                    chartBounds={chartBounds}
                    color={item.color}
                    roundedCorners={{ topLeft: 4, topRight: 4 }}
                    innerPadding={0.4}
                    barCount={2}
                  />
                );
              })}
            </>
          )}
        </CartesianChart>
      </View>

      {/* Values display */}
      <View style={styles.valuesContainer}>
        {data.map((item, index) => (
          <View key={`value-${index}`} style={styles.valueItem}>
            <View style={[styles.valueDot, { backgroundColor: item.color }]} />
            <Text style={styles.valueLabel}>{item.label}</Text>
            <Text style={styles.valueText}>{formatValue(item.value)}</Text>
          </View>
        ))}
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
  // Prepare revenue comparison data
  const revenueComparisonData = useMemo(() => {
    if (!revenueData) return [];
    return [
      { label: '7S', value: revenueData.sevenSeater, color: COLORS.sevenSeater },
      { label: '5S', value: revenueData.fiveSeater, color: COLORS.fiveSeater },
    ];
  }, [revenueData]);

  // Prepare trip comparison data
  const tripComparisonData = useMemo(() => {
    if (!tripData) return [];
    return [
      { label: '7S', value: tripData.sevenSeater, color: COLORS.sevenSeater },
      { label: '5S', value: tripData.fiveSeater, color: COLORS.fiveSeater },
    ];
  }, [tripData]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.sevenSeater} />
          <Text style={styles.loadingText}>Loading chart data...</Text>
        </View>
      </View>
    );
  }

  const hasRevenueData = revenueData && (revenueData.sevenSeater > 0 || revenueData.fiveSeater > 0);
  const hasTripData = tripData && (tripData.sevenSeater > 0 || tripData.fiveSeater > 0);

  if (!hasRevenueData && !hasTripData) {
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
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.sevenSeater }]} />
          <Text style={styles.legendText}>7 Seater</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.fiveSeater }]} />
          <Text style={styles.legendText}>5 Seater</Text>
        </View>
      </View>

      {/* Side by side charts */}
      <View style={styles.chartsRow}>
        <SingleComparisonChart
          title="Revenue Comparison"
          data={revenueComparisonData}
          formatValue={(v) => formatCurrency(v, currency)}
          height={180}
        />
        <SingleComparisonChart
          title="Trip Count Comparison"
          data={tripComparisonData}
          formatValue={formatNumber}
          height={180}
        />
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
  emptyMiniContainer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
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
    fontWeight: '500',
    color: COLORS.text,
  },
  chartsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  chartCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  valuesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.grid,
  },
  valueItem: {
    alignItems: 'center',
    gap: 2,
  },
  valueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  valueLabel: {
    fontSize: 10,
    color: COLORS.mutedText,
    fontWeight: '500',
  },
  valueText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
});

export default CapacityComparisonChart;
