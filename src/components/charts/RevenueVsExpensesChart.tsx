import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Svg, Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Colours ─────────────────────────────────────────────────────────────────

const C = {
  bg:       '#171513',
  surface:  '#1e1a17',
  border:   '#2e2822',
  revenue:  '#3d8f6a',
  expense:  '#c96d4d',
  text:     '#fffaf3',
  muted:    '#6b6256',
  grid:     '#ffffff',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;

function fmt(v: number, currency = 'USD'): string {
  const prefix = currency === 'USD' ? '$' : currency + ' ';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${prefix}${(v / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${prefix}${Math.round(v)}`;
}

function fmtAxis(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
  return `${Math.round(v)}`;
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpX = (prev.x + curr.x) / 2;
    d += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

function abbrev(month: string): string {
  return month.slice(0, 3);
}

// ─── Chart ───────────────────────────────────────────────────────────────────

export function RevenueVsExpensesChart({
  data,
  loading = false,
  currency = 'USD',
}: RevenueVsExpensesChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Chart dimensions
  const W     = SCREEN_W - 48;  // card has 16+16 margin + 8+8 padding
  const H     = 200;
  const PAD_L = 42;
  const PAD_R = 14;
  const PAD_T = 18;
  const PAD_B = 30;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((d, i) => ({ ...d, i }));
  }, [data]);

  const maxVal = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.flatMap(d => [d.revenue, d.expenses]), 1);
  }, [chartData]);

  const yTicks = useMemo(() =>
    [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f)),
  [maxVal]);

  const n = chartData.length;

  const xOf = (i: number) => PAD_L + (n <= 1 ? plotW / 2 : (plotW / (n - 1)) * i);
  const yOf = (v: number) => PAD_T + plotH - (v / maxVal) * plotH;

  const revPts = chartData.map((d, i) => ({ x: xOf(i), y: yOf(d.revenue) }));
  const expPts = chartData.map((d, i) => ({ x: xOf(i), y: yOf(d.expenses) }));

  const totals = useMemo(() => {
    const rev = chartData.reduce((s, d) => s + d.revenue, 0);
    const exp = chartData.reduce((s, d) => s + d.expenses, 0);
    return { revenue: rev, expenses: exp, net: rev - exp };
  }, [chartData]);

  const selected = selectedIndex >= 0 && selectedIndex < chartData.length
    ? chartData[selectedIndex]
    : null;

  const lastRev = revPts[n - 1];
  const lastExp = expPts[n - 1];

  // ─── Empty / Loading ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.darkCard}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.darkCard}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No revenue trend data yet.</Text>
        </View>
      </View>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.darkCard}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Revenue vs Expenses</Text>
          <Text style={styles.headerSub}>{n} month{n !== 1 ? 's' : ''} · {currency}</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.expense }]} />
            <Text style={styles.legendLabel}>Expenses</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.revenue }]} />
            <Text style={styles.legendLabel}>Revenue</Text>
          </View>
        </View>
      </View>

      {/* SVG Line Chart */}
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="rvGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.revenue} stopOpacity="0.20" />
            <Stop offset="1" stopColor={C.revenue} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="exGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.expense} stopOpacity="0.20" />
            <Stop offset="1" stopColor={C.expense} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Y-axis grid + labels */}
        {yTicks.map((tick, ti) => {
          const y = yOf(tick);
          return (
            <React.Fragment key={ti}>
              <Line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                stroke={C.grid} strokeOpacity="0.06" strokeWidth="1" />
              <SvgText x={PAD_L - 5} y={y + 4} fontSize="9" fill={C.muted}
                textAnchor="end" fontWeight="600">{fmtAxis(tick)}</SvgText>
            </React.Fragment>
          );
        })}

        {/* X-axis labels + vertical guides */}
        {chartData.map((d, i) => {
          const x = xOf(i);
          const isSelected = i === selectedIndex;
          return (
            <React.Fragment key={i}>
              <Line x1={x} y1={PAD_T} x2={x} y2={H - PAD_B}
                stroke={C.grid}
                strokeOpacity={isSelected ? '0.18' : '0.07'}
                strokeWidth={isSelected ? '1.5' : '1'}
                strokeDasharray="3,3" />
              <SvgText x={x} y={H - 6} fontSize="9" fill={isSelected ? C.text : C.muted}
                textAnchor="middle" fontWeight="600">{abbrev(d.month)}</SvgText>
            </React.Fragment>
          );
        })}

        {/* Revenue area */}
        {revPts.length >= 2 && (
          <Path
            d={`${smoothPath(revPts)} L ${revPts[n-1].x} ${PAD_T + plotH} L ${revPts[0].x} ${PAD_T + plotH} Z`}
            fill="url(#rvGrad)" />
        )}

        {/* Expense area */}
        {expPts.length >= 2 && (
          <Path
            d={`${smoothPath(expPts)} L ${expPts[n-1].x} ${PAD_T + plotH} L ${expPts[0].x} ${PAD_T + plotH} Z`}
            fill="url(#exGrad)" />
        )}

        {/* Revenue line */}
        {revPts.length >= 2 && (
          <Path d={smoothPath(revPts)} fill="none" stroke={C.revenue}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Expense line */}
        {expPts.length >= 2 && (
          <Path d={smoothPath(expPts)} fill="none" stroke={C.expense}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Data-point dots — highlight selected */}
        {chartData.map((_, i) => {
          const isSelected = i === selectedIndex;
          return (
            <React.Fragment key={i}>
              <Circle cx={revPts[i].x} cy={revPts[i].y}
                r={isSelected ? 5.5 : 3.5}
                fill={isSelected ? C.revenue : C.bg}
                stroke={C.revenue} strokeWidth={isSelected ? 0 : 1.8} />
              <Circle cx={expPts[i].x} cy={expPts[i].y}
                r={isSelected ? 5.5 : 3.5}
                fill={isSelected ? C.expense : C.bg}
                stroke={C.expense} strokeWidth={isSelected ? 0 : 1.8} />
            </React.Fragment>
          );
        })}

        {/* Endpoint value bubbles (rightmost point) */}
        {lastRev && (
          <SvgText x={lastRev.x + 6} y={lastRev.y + 4} fontSize="10"
            fill={C.revenue} fontWeight="700" textAnchor="start">
            +{fmtAxis(chartData[n-1]?.revenue ?? 0)}
          </SvgText>
        )}
        {lastExp && (
          <SvgText x={lastExp.x + 6} y={lastExp.y + 4} fontSize="10"
            fill={C.expense} fontWeight="700" textAnchor="start">
            -{fmtAxis(chartData[n-1]?.expenses ?? 0)}
          </SvgText>
        )}
      </Svg>

      {/* Tap-to-select month rail */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthRail}>
        {chartData.map((d, i) => {
          const active = i === selectedIndex;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.monthChip, active && styles.monthChipActive]}
              onPress={() => setSelectedIndex(active ? -1 : i)}
              activeOpacity={0.8}
            >
              <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>
                {abbrev(d.month)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Selected month detail */}
      {selected ? (
        <View style={styles.detailCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.detailMonth}>{selected.month}</Text>
            <View style={[styles.netBadge,
              { backgroundColor: selected.revenue - selected.expenses >= 0 ? '#172420' : '#2a1e1b' }]}>
              <Text style={[styles.netBadgeText,
                { color: selected.revenue - selected.expenses >= 0 ? C.revenue : C.expense }]}>
                {selected.revenue - selected.expenses >= 0 ? '+' : ''}
                {fmt(selected.revenue - selected.expenses, currency)}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <View style={[styles.legendDot, { backgroundColor: C.revenue }]} />
              <Text style={styles.detailLabel}>Revenue</Text>
              <Text style={[styles.detailValue, { color: C.revenue }]}>
                {fmt(selected.revenue, currency)}
              </Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailItem}>
              <View style={[styles.legendDot, { backgroundColor: C.expense }]} />
              <Text style={styles.detailLabel}>Expenses</Text>
              <Text style={[styles.detailValue, { color: C.expense }]}>
                {fmt(selected.expenses, currency)}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        /* Totals summary row */
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Revenue</Text>
            <Text style={[styles.summaryValue, { color: C.revenue }]}>
              {fmt(totals.revenue, currency)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: C.expense }]}>
              {fmt(totals.expenses, currency)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Net</Text>
            <Text style={[styles.summaryValue,
              { color: totals.net >= 0 ? C.revenue : C.expense }]}>
              {totals.net >= 0 ? '+' : ''}{fmt(totals.net, currency)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  darkCard: {
    backgroundColor: C.bg,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  empty: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: C.muted,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 10,
    color: C.muted,
    fontWeight: '600',
  },

  // Month selector rail
  monthRail: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  monthChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#2e2822',
  },
  monthChipActive: {
    backgroundColor: C.text,
  },
  monthChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
  },
  monthChipTextActive: {
    color: '#171513',
  },

  // Selected detail card
  detailCard: {
    backgroundColor: '#1e1a17',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#2e2822',
  },
  detailMonth: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text,
  },
  netBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  netBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  detailDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#2e2822',
    marginHorizontal: 12,
  },

  // Summary row (default, no selection)
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#1e1a17',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2e2822',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#2e2822',
    marginHorizontal: 8,
  },
});

export default RevenueVsExpensesChart;
