import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import { palette, spacing, radius, type as t } from '../../constants/tokens';

// ─── Mini SVG illustrations per context ──────────────────────────────────────
function BookingsIllustration() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
      <Rect x="10" y="14" width="52" height="44" rx="8" fill={palette.primarySoft} />
      <Rect x="18" y="28" width="36" height="4" rx="2" fill={palette.primary} opacity={0.35} />
      <Rect x="18" y="37" width="24" height="4" rx="2" fill={palette.primary} opacity={0.25} />
      <Rect x="18" y="46" width="16" height="4" rx="2" fill={palette.primary} opacity={0.18} />
      <Rect x="22" y="8" width="4" height="12" rx="2" fill={palette.primary} />
      <Rect x="46" y="8" width="4" height="12" rx="2" fill={palette.primary} />
      <Path d="M10 24h52" stroke={palette.border} strokeWidth="1.5" />
    </Svg>
  );
}

function FleetIllustration() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
      <Rect x="8" y="26" width="48" height="24" rx="6" fill={palette.primarySoft} />
      <Rect x="56" y="32" width="10" height="12" rx="3" fill={palette.primarySoft} />
      <Path d="M56 38l6-6h8v12h-8l-6-6z" fill={palette.primarySoft} />
      <Circle cx="20" cy="52" r="6" fill={palette.primary} opacity={0.4} />
      <Circle cx="20" cy="52" r="3" fill={palette.primary} />
      <Circle cx="48" cy="52" r="6" fill={palette.primary} opacity={0.4} />
      <Circle cx="48" cy="52" r="3" fill={palette.primary} />
      <Rect x="16" y="14" width="30" height="12" rx="4" fill={palette.primary} opacity={0.2} />
    </Svg>
  );
}

function FinanceIllustration() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
      <Rect x="12" y="18" width="48" height="36" rx="8" fill={palette.successSoft} />
      <Rect x="20" y="30" width="8" height="16" rx="2" fill={palette.success} opacity={0.4} />
      <Rect x="32" y="24" width="8" height="22" rx="2" fill={palette.success} opacity={0.6} />
      <Rect x="44" y="27" width="8" height="19" rx="2" fill={palette.success} opacity={0.5} />
      <Path d="M20 46h32" stroke={palette.border} strokeWidth="1.5" />
    </Svg>
  );
}

function NotificationsIllustration() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
      <Path d="M36 12c-13.25 0-22 10.75-22 22v12l-4 6h52l-4-6V34c0-11.25-8.75-22-22-22z" fill={palette.warningSoft} />
      <Path d="M36 12c-13.25 0-22 10.75-22 22v12l-4 6h52l-4-6V34c0-11.25-8.75-22-22-22z" stroke={palette.warning} strokeWidth="1.5" fill="none" />
      <Path d="M30 52c0 3.31 2.69 6 6 6s6-2.69 6-6" stroke={palette.warning} strokeWidth="1.5" fill="none" />
    </Svg>
  );
}

function GenericIllustration() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
      <Circle cx="36" cy="36" r="28" fill={palette.primarySoft} />
      <Path d="M36 22v16M36 44v4" stroke={palette.primary} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

const ILLUSTRATIONS: Record<string, React.ComponentType> = {
  bookings: BookingsIllustration,
  fleet:    FleetIllustration,
  finance:  FinanceIllustration,
  notifications: NotificationsIllustration,
};

// ─── Component ────────────────────────────────────────────────────────────────
interface EmptyStateProps {
  type?: 'bookings' | 'fleet' | 'finance' | 'notifications' | 'generic';
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Secondary softer action */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function EmptyState({
  type = 'generic',
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: EmptyStateProps) {
  const Illustration = ILLUSTRATIONS[type] ?? GenericIllustration;

  return (
    <View style={s.root}>
      <View style={s.illustrationWrap}>
        <Illustration />
      </View>
      <Text style={s.title}>{title}</Text>
      {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      {!!actionLabel && !!onAction && (
        <TouchableOpacity style={s.btn} onPress={onAction} activeOpacity={0.85}>
          <Text style={s.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
      {!!secondaryLabel && !!onSecondary && (
        <TouchableOpacity style={s.secondaryBtn} onPress={onSecondary} activeOpacity={0.7}>
          <Text style={s.secondaryText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['8'],
    paddingVertical: spacing['10'],
  },
  illustrationWrap: {
    width: 112,
    height: 112,
    borderRadius: radius['3xl'],
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['6'],
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    fontSize: t['2xl'],
    fontWeight: t.bold,
    color: palette.text,
    textAlign: 'center',
    lineHeight: t['2xl'] * t.snug,
    letterSpacing: -0.4,
    marginBottom: spacing['2'],
  },
  subtitle: {
    fontSize: t.base,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: t.base * t.normal,
    marginBottom: spacing['6'],
    maxWidth: 260,
  },
  btn: {
    backgroundColor: palette.primary,
    borderRadius: radius.xl,
    paddingVertical: 14,
    paddingHorizontal: spacing['8'],
    marginBottom: spacing['3'],
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  btnText: {
    color: palette.white,
    fontSize: t.md,
    fontWeight: t.bold,
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing['5'],
  },
  secondaryText: {
    color: palette.textMuted,
    fontSize: t.base,
    fontWeight: t.semibold,
  },
});
