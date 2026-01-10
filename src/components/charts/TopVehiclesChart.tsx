import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Modal,
} from 'react-native';
import { CartesianChart, BarGroup } from 'victory-native';

// Types
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

// Color constants matching web dashboard - by capacity
const COLORS = {
  // 7 Seater colors
  revenue7S: '#9333ea', // Purple
  trips7S: '#f59e0b', // Amber
  // 5 Seater colors
  revenue5S: '#10b981', // Green
  trips5S: '#3b82f6', // Blue
  // General
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

// Truncate vehicle names
const truncateName = (name: string, maxLength: number = 8): string => {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 2) + '..';
};

// Get colors based on capacity
const getColors = (capacity?: string) => {
  if (capacity === '7S' || capacity?.includes('7')) {
    return { revenue: COLORS.revenue7S, trips: COLORS.trips7S };
  }
  return { revenue: COLORS.revenue5S, trips: COLORS.trips5S };
};

export function TopVehiclesChart({
  data,
  loading = false,
  currency = 'USD',
}: TopVehiclesChartProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<TopVehicle | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Get screen width for responsive sizing
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 32;

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => ({
      x: index,
      revenue: item.revenue,
      tripCount: item.tripCount,
      name: item.name,
      capacity: item.capacity,
      originalData: item,
    }));
  }, [data]);

  // Calculate domains for dual axis
  const { revenueMax, tripMax } = useMemo(() => {
    if (chartData.length === 0) return { revenueMax: 100, tripMax: 10 };
    const maxRev = Math.max(...chartData.map((d) => d.revenue));
    const maxTrip = Math.max(...chartData.map((d) => d.tripCount));
    return { revenueMax: maxRev * 1.1, tripMax: maxTrip * 1.1 };
  }, [chartData]);

  // Normalize trip count to revenue scale for dual-axis display
  const normalizedData = useMemo(() => {
    if (chartData.length === 0) return [];
    const scale = revenueMax / tripMax;
    return chartData.map((item) => ({
      ...item,
      normalizedTripCount: item.tripCount * scale,
    }));
  }, [chartData, revenueMax, tripMax]);

  const handleBarPress = (vehicle: TopVehicle) => {
    setSelectedVehicle(vehicle);
    setTooltipVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.revenue7S} />
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
        <View style={styles.legendGroup}>
          <Text style={styles.legendGroupTitle}>7 Seater:</Text>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.revenue7S }]} />
            <Text style={styles.legendText}>Revenue</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.trips7S }]} />
            <Text style={styles.legendText}>Trips</Text>
          </View>
        </View>
        <View style={styles.legendGroup}>
          <Text style={styles.legendGroupTitle}>5 Seater:</Text>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.revenue5S }]} />
            <Text style={styles.legendText}>Revenue</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.trips5S }]} />
            <Text style={styles.legendText}>Trips</Text>
          </View>
        </View>
      </View>

      {/* Dual Y-axis labels */}
      <View style={styles.axisLabelContainer}>
        <Text style={[styles.axisLabel, { color: COLORS.revenue7S }]}>
          Revenue ({currency})
        </Text>
        <Text style={[styles.axisLabel, { color: COLORS.trips7S }]}>
          Trip Count
        </Text>
      </View>

      {/* Touch overlay for interactions */}
      <View style={[styles.touchOverlay, { width: chartWidth }]}>
        {chartData.map((item, index) => (
          <TouchableOpacity
            key={`touch-${index}`}
            style={[
              styles.touchZone,
              { width: chartWidth / chartData.length },
            ]}
            onPress={() => handleBarPress(item.originalData)}
            activeOpacity={0.7}
          />
        ))}
      </View>

      {/* Chart */}
      <View style={[styles.chartWrapper, { width: chartWidth }]}>
        <CartesianChart
          data={normalizedData}
          xKey="x"
          yKeys={['revenue', 'normalizedTripCount']}
          domain={{ y: [0, revenueMax] }}
          padding={{ left: 50, right: 40, top: 16, bottom: 60 }}
          axisOptions={{
            font: null,
            tickCount: { x: chartData.length, y: 5 },
            lineColor: COLORS.grid,
            labelColor: COLORS.axis,
            formatXLabel: (value) => {
              const index = Math.round(value);
              if (index >= 0 && index < chartData.length) {
                return truncateName(chartData[index]?.name || '', 6);
              }
              return '';
            },
            formatYLabel: (value) => formatCurrency(value, currency),
            labelOffset: { x: 12, y: 8 },
          }}
        >
          {({ points, chartBounds }) => (
            <BarGroup
              chartBounds={chartBounds}
              betweenGroupPadding={0.3}
              withinGroupPadding={0.1}
            >
              <BarGroup.Bar
                points={points.revenue}
                color={COLORS.revenue7S}
              />
              <BarGroup.Bar
                points={points.normalizedTripCount}
                color={COLORS.trips7S}
              />
            </BarGroup>
          )}
        </CartesianChart>
      </View>

      {/* Right Y-axis label for trip count */}
      <View style={styles.rightAxisContainer}>
        {[0, 1, 2, 3, 4].map((tick) => (
          <Text key={`right-tick-${tick}`} style={styles.rightAxisTick}>
            {Math.round((tripMax / 4) * (4 - tick))}
          </Text>
        ))}
      </View>

      {/* Custom Tooltip Modal */}
      <Modal
        visible={tooltipVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTooltipVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTooltipVisible(false)}
        >
          <View style={styles.tooltipContainer}>
            {selectedVehicle && (
              <>
                <Text style={styles.tooltipTitle}>{selectedVehicle.name}</Text>
                <View style={styles.tooltipRow}>
                  <Text style={styles.tooltipLabel}>Capacity:</Text>
                  <Text style={styles.tooltipValue}>
                    {selectedVehicle.capacity || 'N/A'}
                  </Text>
                </View>
                <View style={styles.tooltipRow}>
                  <Text style={styles.tooltipLabel}>Revenue:</Text>
                  <Text style={[styles.tooltipValue, { color: getColors(selectedVehicle.capacity).revenue }]}>
                    {formatCurrency(selectedVehicle.revenue, currency)}
                  </Text>
                </View>
                <View style={styles.tooltipRow}>
                  <Text style={styles.tooltipLabel}>Trips:</Text>
                  <Text style={[styles.tooltipValue, { color: getColors(selectedVehicle.capacity).trips }]}>
                    {selectedVehicle.tripCount}
                  </Text>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
    position: 'relative',
  },
  chartWrapper: {
    height: 240,
  },
  loadingContainer: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.mutedText,
  },
  emptyContainer: {
    height: 240,
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
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 8,
  },
  legendGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendGroupTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.mutedText,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: COLORS.text,
  },
  axisLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  axisLabel: {
    fontSize: 9,
    fontWeight: '500',
  },
  touchOverlay: {
    position: 'absolute',
    top: 80,
    left: 50,
    height: 240,
    flexDirection: 'row',
    zIndex: 10,
  },
  touchZone: {
    height: '100%',
  },
  rightAxisContainer: {
    position: 'absolute',
    right: 8,
    top: 80,
    height: 180,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  rightAxisTick: {
    fontSize: 9,
    color: COLORS.trips7S,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  tooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tooltipLabel: {
    fontSize: 12,
    color: COLORS.mutedText,
  },
  tooltipValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
});

export default TopVehiclesChart;
