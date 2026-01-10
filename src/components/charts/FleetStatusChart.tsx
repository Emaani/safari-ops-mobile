import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { PolarChart, Pie } from 'victory-native';
import { Text as SkiaText, useFont } from '@shopify/react-native-skia';

// Types
interface FleetStatus {
  status: string;
  count: number;
  color?: string;
}

interface FleetStatusChartProps {
  data: FleetStatus[];
  loading?: boolean;
}

// Color constants matching web dashboard - by status
const STATUS_COLORS: Record<string, string> = {
  Available: '#6b7280',
  Booked: '#3b82f6',
  Rented: '#10b981',
  Maintenance: '#f59e0b',
  'Out of Service': '#ef4444',
  // Additional status mappings
  available: '#6b7280',
  booked: '#3b82f6',
  rented: '#10b981',
  maintenance: '#f59e0b',
  'out of service': '#ef4444',
  outofservice: '#ef4444',
  operational: '#10b981',
  Operational: '#10b981',
};

// General colors
const COLORS = {
  background: '#ffffff',
  text: '#111827',
  mutedText: '#6b7280',
};

// Get color for status
const getStatusColor = (status: string, providedColor?: string): string => {
  if (providedColor) return providedColor;
  return STATUS_COLORS[status] || STATUS_COLORS[status.toLowerCase()] || '#6b7280';
};

export function FleetStatusChart({
  data,
  loading = false,
}: FleetStatusChartProps) {
  // Get screen width for responsive sizing
  const screenWidth = Dimensions.get('window').width;
  const chartSize = Math.min(screenWidth - 64, 200);

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item) => ({
      label: item.status,
      value: item.count,
      color: getStatusColor(item.status, item.color),
    }));
  }, [data]);

  // Calculate total
  const total = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading chart data...</Text>
        </View>
      </View>
    );
  }

  if (!data || data.length === 0 || total === 0) {
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
      <View style={styles.chartSection}>
        {/* Pie Chart */}
        <View style={[styles.chartWrapper, { width: chartSize, height: chartSize }]}>
          <PolarChart
            data={chartData}
            labelKey="label"
            valueKey="value"
            colorKey="color"
          >
            <Pie.Chart innerRadius="50%">
              {({ slice }) => (
                <Pie.Slice />
              )}
            </Pie.Chart>
          </PolarChart>

          {/* Center label - Total */}
          <View style={styles.centerLabel}>
            <Text style={styles.centerValue}>{total}</Text>
            <Text style={styles.centerTitle}>Total Fleet</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          {chartData.map((item, index) => (
            <View key={`legend-${index}`} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendName}>{item.label}</Text>
                <Text style={styles.legendCount}>
                  {item.value} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
                </Text>
              </View>
            </View>
          ))}
        </View>
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
  chartSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLabel: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  centerTitle: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.mutedText,
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.mutedText,
  },
  legendContainer: {
    flex: 1,
    marginLeft: 16,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendTextContainer: {
    flex: 1,
  },
  legendName: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
  },
  legendCount: {
    fontSize: 11,
    color: COLORS.mutedText,
  },
});

export default FleetStatusChart;
