/**
 * InAppNotificationBanner
 *
 * A Framer-style animated banner that slides down from the top of the screen
 * when the app is in the foreground and a notification event fires.
 *
 * Features:
 *  - Spring-entrance + spring-exit animation
 *  - Auto-dismiss after 5 s with animated progress bar
 *  - Queues multiple notifications (shows them sequentially)
 *  - Tap "View →" to navigate to Notifications screen
 *  - Swipe up to dismiss early
 *  - Colour-coded left accent by event type
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InAppNotifType =
  | 'booking_new'
  | 'booking_started'
  | 'booking_completed'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'cr_raised'
  | 'cr_assigned'
  | 'cr_approved'
  | 'cr_rejected'
  | 'cr_completed'
  | 'payment'
  | 'info';

export interface InAppNotif {
  id: string;
  type: InAppNotifType;
  title: string;
  body: string;
  /** If provided, navigate to this route on tap */
  screen?: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface InAppNotifContextValue {
  showNotification: (notif: Omit<InAppNotif, 'id'>) => void;
}

const InAppNotifContext = createContext<InAppNotifContextValue>({
  showNotification: () => {},
});

export function useInAppNotification() {
  return useContext(InAppNotifContext);
}

// ─── Accent colours per type ──────────────────────────────────────────────────

const ACCENT: Record<InAppNotifType, string> = {
  booking_new:       '#3b82f6',   // blue
  booking_started:   '#f59e0b',   // amber
  booking_completed: '#10b981',   // green
  booking_confirmed: '#8b5cf6',   // purple
  booking_cancelled: '#ef4444',   // red
  cr_raised:         '#d97706',   // orange
  cr_assigned:       '#4a7fc1',   // blue
  cr_approved:       '#059669',   // emerald
  cr_rejected:       '#dc2626',   // red
  cr_completed:      '#10b981',   // green
  payment:           '#059669',   // emerald
  info:              '#6b7280',   // grey
};

const EMOJI: Record<InAppNotifType, string> = {
  booking_new:       '📋',
  booking_started:   '🚗',
  booking_completed: '✅',
  booking_confirmed: '🎉',
  booking_cancelled: '❌',
  cr_raised:         '📝',
  cr_assigned:       '📌',
  cr_approved:       '✅',
  cr_rejected:       '❌',
  cr_completed:      '💵',
  payment:           '💰',
  info:              '💬',
};

const BANNER_DURATION = 5000; // ms before auto-dismiss
const { width: SW } = Dimensions.get('window');

// ─── Banner UI ────────────────────────────────────────────────────────────────

interface BannerProps {
  notif: InAppNotif;
  onDismiss: () => void;
  onView: (screen?: string) => void;
}

function Banner({ notif, onDismiss, onView }: BannerProps) {
  const insets = useSafeAreaInsets();
  const translateY  = useRef(new Animated.Value(-200)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const gestureY    = useRef(new Animated.Value(0)).current;
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = ACCENT[notif.type] ?? ACCENT.info;
  const emoji  = EMOJI[notif.type]  ?? EMOJI.info;

  // Slide in
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      tension: 100,
      friction: 12,
      useNativeDriver: true,
    }).start();

    // Start progress bar drain
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: BANNER_DURATION,
      useNativeDriver: false,
    }).start();

    // Auto dismiss
    timerRef.current = setTimeout(() => {
      dismiss();
    }, BANNER_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.spring(translateY, {
      toValue: -200,
      tension: 100,
      friction: 12,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [onDismiss, translateY]);

  // Swipe-up pan gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && g.dy < 0,
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) gestureY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -40) {
          dismiss();
        } else {
          Animated.spring(gestureY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.banner,
        {
          top: insets.top + 12,
          transform: [
            { translateY: Animated.add(translateY, gestureY) },
          ],
        },
      ]}
    >
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      <View style={styles.bannerContent}>
        {/* Header row */}
        <View style={styles.bannerRow}>
          <View style={[styles.emojiWrap, { backgroundColor: accent + '18' }]}>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle} numberOfLines={1}>{notif.title}</Text>
            <Text style={styles.bannerBody}  numberOfLines={2}>{notif.body}</Text>
          </View>
          {/* Dismiss X */}
          <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeX}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Action row */}
        <View style={styles.actionRow}>
          <Text style={styles.swipeHint}>Swipe up to dismiss</Text>
          <TouchableOpacity
            style={[styles.viewBtn, { backgroundColor: accent }]}
            onPress={() => { dismiss(); onView(notif.screen); }}
            activeOpacity={0.85}
          >
            <Text style={styles.viewBtnText}>View →</Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { width: progressWidth, backgroundColor: accent }]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface InAppNotifProviderProps {
  children: React.ReactNode;
  /** Called when user taps "View →" — use to navigate to the Notifications screen */
  onNavigate?: (screen?: string) => void;
}

export function InAppNotificationProvider({
  children,
  onNavigate,
}: InAppNotifProviderProps) {
  const [queue, setQueue] = useState<InAppNotif[]>([]);

  const showNotification = useCallback((notif: Omit<InAppNotif, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setQueue(prev => {
      // Limit queue to 3 pending banners; drop oldest if overflowing
      const next = [...prev, { ...notif, id }];
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });
  }, []);

  const dismissFirst = useCallback(() => {
    setQueue(prev => prev.slice(1));
  }, []);

  const current = queue[0] ?? null;

  return (
    <InAppNotifContext.Provider value={{ showNotification }}>
      {children}
      {current && (
        <Banner
          key={current.id}
          notif={current}
          onDismiss={dismissFirst}
          onView={(screen) => {
            dismissFirst();
            onNavigate?.(screen);
          }}
        />
      )}
    </InAppNotifContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
  },
  accentBar: {
    width: 5,
    alignSelf: 'stretch',
  },
  bannerContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 10,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  emojiWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  emoji: {
    fontSize: 18,
  },
  bannerText: {
    flex: 1,
    paddingRight: 8,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  bannerBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  closeX: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
    paddingTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  swipeHint: {
    fontSize: 10,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  viewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
});
