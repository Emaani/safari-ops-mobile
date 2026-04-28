import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createNavigationContainerRef,
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Animated, AppState, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ErrorBoundary } from './src/components/system/ErrorBoundary';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import {
  AppPreferencesProvider,
  useAppPreferences,
} from './src/contexts/AppPreferencesContext';
import { AppLoadingScreen, BiometricGateScreen } from './src/components/system/AuthScreens';
import {
  InAppNotificationProvider,
  useInAppNotification,
} from './src/components/system/InAppNotificationBanner';
import { useNotifications } from './src/hooks/useNotifications';
import { useBookingNotifications } from './src/hooks/useBookingNotifications';
import { useCRNotifications } from './src/hooks/useCRNotifications';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import DashboardScreen from './src/screens/DashboardScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import FleetScreen from './src/screens/FleetScreen';
import FinanceScreen from './src/screens/FinanceScreen';
import LoginScreen from './src/screens/LoginScreen';
import MoreScreen from './src/screens/MoreScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import { SafariManagementScreen } from './src/screens/SafariManagementScreen';
import { MarketingScreen } from './src/screens/MarketingScreen';
import { initializeSDK } from './src/sdk-init';
import { realtimeManager } from './src/lib/realtimeManager';
import { suppressProductionLogs } from './src/lib/devLog';

// Silence debug noise in production builds immediately
suppressProductionLogs();
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  registerForPushNotifications,
  savePushToken,
  setBadgeCount,
} from './src/services/notificationService';
import type { Notification } from './src/types/notification';

// Global navigation ref — allows InAppNotificationBanner to navigate from outside NavigationContainer
const navigationRef = createNavigationContainerRef<any>();

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

type TabScreenConfig = {
  name: 'Dashboard' | 'Bookings' | 'Fleet' | 'Finance' | 'Safari' | 'Marketing';
  component: React.ComponentType<any>;
  labelKey: string;
  icon: ({ color, size }: { color: string; size: number }) => React.JSX.Element;
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  useEffect(() => {
    initializeSDK()
      .then(() => console.log('SDK initialized'))
      .catch((e) => console.error('SDK init failed:', e));
  }, []);

  // Refresh all realtime subscribers when app returns to foreground
  // so stale data from background sleep is updated immediately
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        realtimeManager.refreshAll();
      }
    });
    return () => sub.remove();
  }, []);

  // Navigate to a screen from outside NavigationContainer (e.g. from banner)
  const handleBannerNavigate = useCallback((screen?: string) => {
    if (!navigationRef.isReady()) return;
    if (screen === 'Bookings' || screen === 'Finance' || screen === 'Dashboard') {
      navigationRef.navigate('MainTabs', { screen } as any);
    } else if (screen === 'Messages') {
      navigationRef.navigate('Notifications', { initialTab: 'messages' } as never);
    } else {
      navigationRef.navigate('Notifications' as never);
    }
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <AppPreferencesProvider>
            {/* InAppNotificationProvider wraps everything so banners appear above all screens */}
            <InAppNotificationProvider onNavigate={handleBannerNavigate}>
              <AppShell />
            </InAppNotificationProvider>
          </AppPreferencesProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function AppShell() {
  const { theme } = useAppPreferences();
  const { isOnline } = useNetworkStatus();

  return (
    <>
      <StatusBar style={theme.statusBarStyle} />
      {/* Offline banner — shown below status bar, above all content */}
      {!isOnline && (
        <View style={shellStyles.offlineBanner}>
          <Text style={shellStyles.offlineText}>⚡ No internet connection — data may be outdated</Text>
        </View>
      )}
      <AppNavigator />
    </>
  );
}

const shellStyles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: '#b8883f',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 999,
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

// ─── Navigator ────────────────────────────────────────────────────────────────

function AppNavigator() {
  const { isAuthenticated, loading, user, authOrigin } = useAuth();
  const {
    ready,
    theme,
    t,
    isRTL,
    biometricEnabled,
    biometricAvailable,
    biometricLabel,
    authenticateWithBiometrics,
    notificationPrefs,
  } = useAppPreferences();

  const { showNotification } = useInAppNotification();

  const notifListenerRef    = useRef<(() => void) | null>(null);
  const responseListenerRef = useRef<(() => void) | null>(null);

  const [biometricUnlocked,   setBiometricUnlocked]   = useState(false);
  const [usePasswordFallback, setUsePasswordFallback] = useState(false);

  const handleRealtimeNotification = useCallback((notification: Notification) => {
    if (notification.data?.suppress_banner) return;

    showNotification({
      type: notification.type === 'admin_message'
        ? 'info'
        : notification.type === 'booking_started'
        ? 'booking_started'
        : notification.type === 'booking_completed'
        ? 'booking_completed'
        : notification.type === 'booking_cancelled'
        ? 'booking_cancelled'
        : notification.type === 'cr_assigned'
        ? 'cr_assigned'
        : notification.type === 'cr_approved'
        ? 'cr_approved'
        : notification.type === 'cr_rejected'
        ? 'cr_rejected'
        : 'info',
      title: notification.title,
      body: notification.message,
      screen: notification.data?.screen || 'Notifications',
    });
  }, [showNotification]);

  useNotifications(
    isAuthenticated && user ? user.id : '',
    handleRealtimeNotification,
  );

  // Reset lock state on auth change
  useEffect(() => {
    if (!isAuthenticated) {
      setBiometricUnlocked(false);
      setUsePasswordFallback(false);
      return;
    }
    if (!biometricEnabled || !biometricAvailable || authOrigin === 'password') {
      setBiometricUnlocked(true);
      setUsePasswordFallback(false);
    } else {
      setBiometricUnlocked(false);
      setUsePasswordFallback(false);
    }
  }, [authOrigin, biometricAvailable, biometricEnabled, isAuthenticated]);

  // Push notification registration + foreground listener
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    registerForPushNotifications()
      .then((token) => {
        if (token) return savePushToken(user.id, token);
      })
      .catch((e) => console.error('[App] Push notification setup error:', e));

    // When a push arrives WHILE the app is foregrounded → show in-app banner
    notifListenerRef.current = addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      if (title) {
        showNotification({
          type:   'info',
          title:  title as string,
          body:   (body as string) || '',
          screen: 'Notifications',
        });
      }
    });

    // When user taps a push notification → deep-link into the relevant tab
    responseListenerRef.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as any;
      if (navigationRef.isReady()) {
        const target = data?.screen;
        if (target === 'Bookings' || target === 'Finance' || target === 'Dashboard') {
          navigationRef.navigate('MainTabs', { screen: target } as any);
        } else if (data?.type === 'admin_message' || data?.initialTab === 'messages') {
          // Admin messages deep-link straight to the Messages tab in Notifications
          navigationRef.navigate('Notifications', { initialTab: 'messages' } as never);
        } else {
          navigationRef.navigate('Notifications' as never);
        }
      }
    });

    return () => {
      notifListenerRef.current?.();
      responseListenerRef.current?.();
    };
  }, [isAuthenticated, user, showNotification]);

  // Realtime booking lifecycle notifications → in-app banner + OS push
  useBookingNotifications(isAuthenticated && !!user, showNotification, notificationPrefs, user?.id);

  // Realtime cash requisition notifications → in-app banner + OS push
  useCRNotifications(isAuthenticated && !!user, showNotification, notificationPrefs, user?.id);

  const navigationTheme = useMemo(() => {
    const base = theme.dark ? NavigationDarkTheme : NavigationDefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background:   theme.colors.background,
        card:         theme.colors.surface,
        primary:      theme.colors.accent,
        text:         theme.colors.text,
        border:       theme.colors.border,
        notification: theme.colors.danger,
      },
    };
  }, [theme]);

  if (loading || !ready) return <AppLoadingScreen />;
  if (!isAuthenticated)  return <LoginScreen />;

  if (biometricEnabled && biometricAvailable && !biometricUnlocked) {
    if (usePasswordFallback) return <LoginScreen mode="unlock" />;
    return (
      <BiometricGateScreen
        title={t('biometric.title')}
        subtitle={t('biometric.subtitle')}
        actionLabel={t('login.biometric', { label: biometricLabel })}
        fallbackLabel={t('biometric.fallback')}
        onAuthenticate={async () => {
          const ok = await authenticateWithBiometrics();
          if (ok) setBiometricUnlocked(true);
        }}
        onFallback={() => setUsePasswordFallback(true)}
      />
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle:      { backgroundColor: theme.colors.surface, elevation: 0, shadowOpacity: 0 },
          headerShadowVisible: false,
          headerTintColor:  theme.colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 22, letterSpacing: -0.6 },
          headerTitleAlign: 'center',
          cardStyle:        { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabNavigator}
          options={({ navigation }) => ({
            headerTitle: () => (
              <Image
                source={require('./assets/jackal-header-logo.png')}
                style={{ width: 42, height: 42, resizeMode: 'contain' }}
              />
            ),
            headerRight: isRTL
              ? undefined
              : () => <NotificationBell navigation={navigation} userId={user?.id || ''} />,
            headerLeft: isRTL
              ? () => <NotificationBell navigation={navigation} userId={user?.id || ''} />
              : undefined,
          })}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: t('common.notifications') }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── Tab Navigator ────────────────────────────────────────────────────────────

function MainTabNavigator() {
  const { theme, t, isRTL } = useAppPreferences();

  const tabs = useMemo<TabScreenConfig[]>(() => {
    const items: TabScreenConfig[] = [
      { name: 'Dashboard', component: DashboardScreen,        labelKey: 'common.dashboard', icon: DashboardIcon  },
      { name: 'Bookings',  component: BookingsScreen,         labelKey: 'common.bookings',  icon: BookingsIcon   },
      { name: 'Fleet',     component: FleetScreen,            labelKey: 'common.fleet',     icon: FleetIcon      },
      { name: 'Finance',   component: FinanceScreen,          labelKey: 'common.finance',   icon: FinanceIcon    },
      { name: 'Safari',    component: SafariManagementScreen, labelKey: 'common.safari',    icon: SafariIcon     },
      { name: 'Marketing', component: MarketingScreen,        labelKey: 'common.marketing', icon: MarketingIcon  },
    ];
    return isRTL ? [...items].reverse() : items;
  }, [isRTL]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:             false,
        tabBarShowLabel:         false,
        tabBarActiveTintColor:   theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSoft,
        tabBarStyle: {
          position:        'absolute',
          left:            10,
          right:           10,
          bottom:          14,
          borderTopWidth:  0,
          backgroundColor: theme.colors.surface,
          height:          58,
          paddingBottom:   0,
          paddingTop:      0,
          borderRadius:    22,
          shadowColor:     theme.colors.shadow,
          shadowOffset:    { width: 0, height: 14 },
          shadowOpacity:   theme.dark ? 0.35 : 0.12,
          shadowRadius:    20,
          elevation:       10,
        },
        tabBarItemStyle:  { borderRadius: 16, marginHorizontal: 2 },
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarIcon: ({ color, size }) => tab.icon({ color, size: 24 }),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

// ─── Notification Bell ────────────────────────────────────────────────────────

function NotificationBell({ navigation, userId }: { navigation: any; userId: string }) {
  const { summary }     = useNotifications(userId);
  const { theme }       = useAppPreferences();
  const pulseAnim       = useRef(new Animated.Value(1)).current;
  const pulseOpacity    = useRef(new Animated.Value(0)).current;
  const shakeAnim       = useRef(new Animated.Value(0)).current;
  const prevUnreadRef   = useRef(summary.unread);

  // Pulse ring when there are unread notifications
  useEffect(() => {
    setBadgeCount(summary.unread);

    if (summary.unread > 0) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim,    { toValue: 2.2,  duration: 900, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.55, duration: 450, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim,    { toValue: 1,    duration: 900, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0,    duration: 450, useNativeDriver: true }),
          ]),
        ]),
        { iterations: -1 }
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0);
    }
  }, [summary.unread, pulseAnim, pulseOpacity]);

  // Shake bell when a NEW notification arrives
  useEffect(() => {
    if (summary.unread > prevUnreadRef.current) {
      // Bell shake sequence: left-right oscillation
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue:  8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  4, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
    prevUnreadRef.current = summary.unread;
  }, [summary.unread, shakeAnim]);

  return (
    <TouchableOpacity
      style={[styles.bellBtn, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}
      onPress={() => navigation.navigate('Notifications')}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {/* Expanding pulse ring */}
      {summary.unread > 0 && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              backgroundColor: theme.colors.danger,
              opacity:          pulseOpacity,
              transform:        [{ scale: pulseAnim }],
            },
          ]}
        />
      )}

      {/* Bell icon with shake */}
      <Animated.View style={{ transform: [{ rotate: shakeAnim.interpolate({
        inputRange: [-8, 0, 8],
        outputRange: ['-12deg', '0deg', '12deg'],
      }) }] }}>
        <BellIcon size={22} color={theme.colors.text} />
      </Animated.View>

      {/* Badge */}
      {summary.unread > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.colors.danger }]}>
          <Text style={styles.badgeText}>
            {summary.unread > 99 ? '99+' : summary.unread}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function DashboardIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Grid 2×2 — dashboard overview */}
      <Rect x="3"  y="3"  width="7" height="7" rx="1.5" />
      <Rect x="14" y="3"  width="7" height="7" rx="1.5" />
      <Rect x="3"  y="14" width="7" height="7" rx="1.5" />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

function BookingsIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Calendar with check mark */}
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Path d="M16 2v4M8 2v4M3 10h18" />
      <Path d="M9 16l2 2 4-4" />
    </Svg>
  );
}

function FleetIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* 4×4 vehicle silhouette */}
      <Path d="M5 17H3a1 1 0 0 1-1-1v-4l2-5h14l2 5v4a1 1 0 0 1-1 1h-2" />
      <Path d="M5 17h14" />
      <Circle cx="7.5" cy="17" r="2" />
      <Circle cx="16.5" cy="17" r="2" />
      <Path d="M4 12h16" />
    </Svg>
  );
}

function FinanceIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Dollar sign + trend */}
      <Path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  );
}

function SafariIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Compass — safari navigation */}
      <Circle cx="12" cy="12" r="10" />
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </Svg>
  );
}

function MarketingIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Megaphone — marketing broadcast */}
      <Path d="M3 11v2a1 1 0 0 0 1 1h2l3 4v-12L6 10H4a1 1 0 0 0-1 1z" />
      <Path d="M19 5c1.5 1.5 2 3.5 2 7s-.5 5.5-2 7" />
      <Path d="M15.5 8.5c.8.8 1.2 2 1.2 3.5s-.4 2.7-1.2 3.5" />
    </Svg>
  );
}

function BellIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bellBtn: {
    position:      'relative',
    marginHorizontal: 8,
    padding:       10,
    borderRadius:  18,
    borderWidth:   1,
  },
  pulseRing: {
    position:     'absolute',
    top:          2,
    right:        2,
    width:        16,
    height:       16,
    borderRadius: 8,
  },
  badge: {
    position:        'absolute',
    top:             4,
    right:           4,
    borderRadius:    10,
    minWidth:        20,
    height:          20,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color:      '#ffffff',
    fontSize:   11,
    fontWeight: '700',
  },
});
