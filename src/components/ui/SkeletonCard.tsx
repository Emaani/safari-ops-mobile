import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { palette, radius, spacing } from '../../constants/tokens';

// ─── Shimmer hook ─────────────────────────────────────────────────────────────
function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return anim;
}

// ─── Skeleton block ───────────────────────────────────────────────────────────
function Bone({ width, height = 14, style }: { width: number | string; height?: number; style?: object }) {
  const anim = useShimmer();
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.65] });
  return (
    <Animated.View style={[{ width, height, borderRadius: radius.sm, backgroundColor: palette.border, opacity }, style]} />
  );
}

// ─── Booking card skeleton ────────────────────────────────────────────────────
export function BookingCardSkeleton() {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Bone width={40} height={40} style={{ borderRadius: radius.md }} />
        <View style={{ flex: 1, gap: 6 }}>
          <Bone width="55%" height={14} />
          <Bone width="38%" height={11} />
        </View>
        <Bone width={70} height={22} style={{ borderRadius: radius.full }} />
      </View>
      <View style={s.divider} />
      <View style={{ gap: 8 }}>
        <Bone width="45%" height={11} />
        <Bone width="60%" height={13} />
      </View>
      <View style={s.divider} />
      <View style={[s.row, { gap: 24 }]}>
        <Bone width="28%" height={13} />
        <Bone width="28%" height={13} />
        <Bone width="20%" height={13} />
      </View>
    </View>
  );
}

// ─── Vehicle card skeleton ────────────────────────────────────────────────────
export function VehicleCardSkeleton() {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Bone width={48} height={48} style={{ borderRadius: radius.lg }} />
        <View style={{ flex: 1, gap: 7 }}>
          <Bone width="60%" height={14} />
          <Bone width="40%" height={11} />
          <Bone width="30%" height={11} />
        </View>
        <Bone width={64} height={22} style={{ borderRadius: radius.full }} />
      </View>
    </View>
  );
}

// ─── KPI row skeleton ─────────────────────────────────────────────────────────
export function KpiRowSkeleton() {
  return (
    <View style={[s.row, { gap: 12, paddingHorizontal: spacing['5'] }]}>
      {[0, 1].map(i => (
        <View key={i} style={[s.kpiCard]}>
          <Bone width="50%" height={11} />
          <Bone width="70%" height={20} style={{ marginTop: 8 }} />
          <Bone width="40%" height={10} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

// ─── Notification row skeleton ────────────────────────────────────────────────
export function NotifRowSkeleton() {
  return (
    <View style={[s.card, { paddingVertical: 14 }]}>
      <View style={s.row}>
        <Bone width={40} height={40} style={{ borderRadius: radius.full }} />
        <View style={{ flex: 1, gap: 7 }}>
          <Bone width="65%" height={13} />
          <Bone width="80%" height={11} />
          <Bone width="30%" height={10} />
        </View>
      </View>
    </View>
  );
}

// ─── Generic list skeleton (n rows) ──────────────────────────────────────────
export function ListSkeleton({ rows = 4, type = 'booking' }: { rows?: number; type?: 'booking' | 'vehicle' | 'notif' }) {
  const Comp = type === 'vehicle' ? VehicleCardSkeleton : type === 'notif' ? NotifRowSkeleton : BookingCardSkeleton;
  return (
    <View style={{ gap: 12, paddingHorizontal: spacing['4'], paddingTop: spacing['4'] }}>
      {Array.from({ length: rows }).map((_, i) => <Comp key={i} />)}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: radius['2xl'],
    padding: spacing['4'],
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: radius.xl,
    padding: spacing['4'],
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 88,
    justifyContent: 'center',
  },
});
