import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { PolarChart, Pie } from 'victory-native';

interface FleetStatus {
  status: string;
  count: number;
  color?: string;
}

interface FleetStatusChartProps {
  data: FleetStatus[];
  loading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Available: '#3d8f6a',
  available: '#3d8f6a',
  Booked: '#4a7fc1',
  booked: '#4a7fc1',
  Rented: '#4a7fc1',
  rented: '#4a7fc1',
  'On Safari': '#4a7fc1',
  Maintenance: '#b8883f',
  maintenance: '#b8883f',
  'Out of Service': '#c96d4d',
  'out of service': '#c96d4d',
  Operational: '#3d8f6a',
  operational: '#3d8f6a',
};

const CARD_COLORS = {
  background: '#fffdf9',
  text: '#181512',
  textMuted: '#7f7565',
  border: '#e1d7c8',
  sectionBg: '#f5f0e8',
};

const getStatusColor = (status: string, provided?: string): string => {
  if (provided) return provided;
  return (
    STATUS_COLORS[status] ||
    STATUS_COLORS[status.toLowerCase()] ||
    '#8a9ab0'
  );
};

export function FleetStatusChart({ data, loading = false }: FleetStatusChartProps) {
  const screenWidth = Dimensions.get('window').width;
  const chartSize = Math.min(screenWidth - 140, 180);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data
      .filter((item) => item.count > 0)
      .map((item) => ({
        label: item.status,
        value: item.count,
        color: getStatusColor(item.status, item.color),
      }));
  }, [data]);

  const total = useMemo(
    () => chartData.reduce((sum, item) => sum + item.value, 0),
    [chartData]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4a7fc1" />
          <Text style={styles.mutedText}>Loading fleet status…</Text>
        </View>
      </View>
    );
  }

  if (chartData.length === 0 || total === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🚗</Text>
          <Text style={styles.emptyTitle}>No fleet data</Text>
          <Text style={styles.mutedText}>Vehicle statuses will appear here once fleet is configured.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        {/* Donut chart */}
        <View style={{ width: chartSize, height: chartSize, position: 'relative' }}>
          <PolarChart
            data={chartData}
            labelKey="label"
            valueKey="value"
            colorKey="color"
          >
            <Pie.Chart innerRadius="52%">
              {() => <Pie.Slice />}
            </Pie.Chart>
          </PolarChart>

          {/* Center overlay */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.centerOverlay}>
              <Text style={styles.centerValue}>{total}</Text>
              <Text style={styles.centerLabel}>Vehicles</Text>
            </View>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {chartData.map((item, index) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <View key={`${item.label}-${index}`} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <View style={styles.legendInfo}>
                  <Text style={styles.legendName}>{item.label}</Text>
                  <Text style={[styles.legendCount, { color: item.color }]}>
                    {item.value} · {pct}%
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        {chartData.map((item) => (
          <View
            key={item.label}
            style={[
              styles.summarySegment,
              {
                flex: item.value,
                backgroundColor: item.color,
              },
            ]}
          />
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
    gap: 16,
  },
  centered: {
    minHeight: 160,
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
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  centerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerValue: {
    fontSize: 30,
    fontWeight: '800',
    color: CARD_COLORS.text,
    letterSpacing: -1,
  },
  centerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: CARD_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  legend: {
    flex: 1,
    gap: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  legendInfo: {
    flex: 1,
  },
  legendName: {
    fontSize: 13,
    fontWeight: '600',
    color: CARD_COLORS.text,
  },
  legendCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    gap: 2,
  },
  summarySegment: {
    borderRadius: 999,
  },
});

export default FleetStatusChart;
