/**
 * AnimatedFilterTabs
 *
 * Horizontal filter chips with a smooth animated sliding pill indicator
 * (Plum-style selector). The active pill slides between options using
 * Reanimated shared values measured with onLayout.
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  LayoutRectangle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface Tab<T extends string | number> {
  label: string;
  value: T;
  count?: number;
}

interface AnimatedFilterTabsProps<T extends string | number> {
  tabs: Tab<T>[];
  selected: T;
  onSelect: (value: T) => void;
  activeColor?: string;
  activePillColor?: string;
  inactiveColor?: string;
  containerStyle?: object;
  scrollable?: boolean;
}

export function AnimatedFilterTabs<T extends string | number>({
  tabs,
  selected,
  onSelect,
  activeColor      = '#1f4d45',
  activePillColor  = '#fffdf9',
  inactiveColor    = 'rgba(255,255,255,0.08)',
  containerStyle   = {},
  scrollable       = true,
}: AnimatedFilterTabsProps<T>) {
  // Map each tab index → measured layout
  const layouts = useRef<Record<number, LayoutRectangle>>({});
  const [ready, setReady] = useState(false);
  const pillX     = useSharedValue(0);
  const pillW     = useSharedValue(80);

  const movePill = useCallback(
    (idx: number) => {
      const layout = layouts.current[idx];
      if (!layout) return;
      pillX.value = withSpring(layout.x, { damping: 22, stiffness: 260 });
      pillW.value = withSpring(layout.width, { damping: 22, stiffness: 260 });
    },
    [pillX, pillW]
  );

  const handleLayout = useCallback(
    (idx: number, layout: LayoutRectangle) => {
      layouts.current[idx] = layout;
      const allReady = tabs.every((_, i) => layouts.current[i]);
      if (allReady && !ready) {
        // Initialise pill to active tab
        const activeIdx = tabs.findIndex((t) => t.value === selected);
        const initial   = layouts.current[activeIdx >= 0 ? activeIdx : 0];
        if (initial) {
          pillX.value = initial.x;
          pillW.value = initial.width;
        }
        setReady(true);
      }
    },
    [tabs, selected, ready, pillX, pillW]
  );

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width:     pillW.value,
  }));

  const inner = (
    <View style={[styles.track, containerStyle]}>
      {/* Sliding pill background */}
      {ready && (
        <Animated.View
          style={[styles.pill, { backgroundColor: activePillColor }, pillStyle]}
          pointerEvents="none"
        />
      )}

      {tabs.map((tab, idx) => {
        const isActive = tab.value === selected;
        return (
          <TouchableOpacity
            key={String(tab.value)}
            style={styles.tab}
            onLayout={(e) => handleLayout(idx, e.nativeEvent.layout)}
            onPress={() => {
              onSelect(tab.value);
              movePill(idx);
            }}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.label,
                { color: isActive ? activeColor : '#b8ab95' },
                isActive && styles.labelActive,
              ]}
            >
              {tab.label}
            </Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: isActive ? activeColor + '20' : 'rgba(255,255,255,0.12)' },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: isActive ? activeColor : '#b8ab95' },
                  ]}
                >
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {inner}
      </ScrollView>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 0 },
  track: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    padding: 3,
  },
  pill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    zIndex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  labelActive: {
    fontWeight: '800',
  },
  badge: {
    borderRadius: 999,
    minWidth: 20,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
