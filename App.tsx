import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import {
  AppPreferencesProvider,
  useAppPreferences,
} from './src/contexts/AppPreferencesContext';
import { AppLoadingScreen, BiometricGateScreen } from './src/components/system/AuthScreens';
import { useNotifications } from './src/hooks/useNotifications';
import DashboardScreen from './src/screens/DashboardScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import FleetScreen from './src/screens/FleetScreen';
import FinanceScreen from './src/screens/FinanceScreen';
import LoginScreen from './src/screens/LoginScreen';
import MoreScreen from './src/screens/MoreScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import { initializeSDK } from './src/sdk-init';
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  registerForPushNotifications,
  savePushToken,
  setBadgeCount,
} from './src/services/notificationService';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

type TabScreenConfig = {
  name: 'Dashboard' | 'Bookings' | 'Fleet' | 'Finance' | 'More';
  component: React.ComponentType<any>;
  labelKey: string;
  icon: ({ color, size }: { color: string; size: number }) => React.JSX.Element;
};

export default function App() {
  useEffect(() => {
    initializeSDK()
      .then(() => {
        console.log('SDK initialized successfully');
      })
      .catch((error) => {
        console.error('SDK initialization failed:', error);
      });
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppPreferencesProvider>
          <AppShell />
        </AppPreferencesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const { theme } = useAppPreferences();

  return (
    <>
      <StatusBar style={theme.statusBarStyle} />
      <AppNavigator />
    </>
  );
}

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
  } = useAppPreferences();
  const notificationListener = useRef<(() => void) | null>(null);
  const responseListener = useRef<(() => void) | null>(null);
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);
  const [usePasswordFallback, setUsePasswordFallback] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setBiometricUnlocked(false);
      setUsePasswordFallback(false);
      return;
    }

    if (!biometricEnabled || !biometricAvailable || authOrigin === 'password') {
      setBiometricUnlocked(true);
      setUsePasswordFallback(false);
      return;
    }

    setBiometricUnlocked(false);
    setUsePasswordFallback(false);
  }, [authOrigin, biometricAvailable, biometricEnabled, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return undefined;
    }

    console.log('[App] Initializing push notifications for user:', user.id);

    registerForPushNotifications()
      .then((token) => {
        if (token) {
          console.log('[App] Push token obtained, saving to database');
          return savePushToken(user.id, token);
        }
        return undefined;
      })
      .catch((error) => {
        console.error('[App] Error setting up push notifications:', error);
      });

    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('[App] Notification received:', notification);
    });

    responseListener.current = addNotificationResponseListener((response) => {
      console.log('[App] Notification response:', response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current();
      }
      if (responseListener.current) {
        responseListener.current();
      }
    };
  }, [isAuthenticated, user]);

  const navigationTheme = useMemo(() => {
    const baseTheme = theme.dark ? NavigationDarkTheme : NavigationDefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: theme.colors.background,
        card: theme.colors.surface,
        primary: theme.colors.accent,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
    };
  }, [theme]);

  if (loading || !ready) {
    return <AppLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (biometricEnabled && biometricAvailable && !biometricUnlocked) {
    if (usePasswordFallback) {
      return <LoginScreen mode="unlock" />;
    }

    return (
      <BiometricGateScreen
        title={t('biometric.title')}
        subtitle={t('biometric.subtitle')}
        actionLabel={t('login.biometric', { label: biometricLabel })}
        fallbackLabel={t('biometric.fallback')}
        onAuthenticate={async () => {
          const success = await authenticateWithBiometrics();
          if (success) {
            setBiometricUnlocked(true);
          }
        }}
        onFallback={() => setUsePasswordFallback(true)}
      />
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.surface,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 22,
            letterSpacing: -0.6,
          },
          headerTitleAlign: 'center',
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabNavigator}
          options={({ navigation }) => ({
            title: t('app.name'),
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
          options={{
            title: t('common.notifications'),
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function MainTabNavigator() {
  const { theme, t, isRTL } = useAppPreferences();

  const tabs = useMemo<TabScreenConfig[]>(() => {
    const items: TabScreenConfig[] = [
      {
        name: 'Dashboard',
        component: DashboardScreen,
        labelKey: 'common.dashboard',
        icon: DashboardIcon,
      },
      {
        name: 'Bookings',
        component: BookingsScreen,
        labelKey: 'common.bookings',
        icon: BookingsIcon,
      },
      {
        name: 'Fleet',
        component: FleetScreen,
        labelKey: 'common.fleet',
        icon: FleetIcon,
      },
      {
        name: 'Finance',
        component: FinanceScreen,
        labelKey: 'common.finance',
        icon: FinanceIcon,
      },
      {
        name: 'More',
        component: MoreScreen,
        labelKey: 'common.more',
        icon: MoreIcon,
      },
    ];

    return isRTL ? [...items].reverse() : items;
  }, [isRTL]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSoft,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 16,
          borderTopWidth: 0,
          backgroundColor: theme.colors.surface,
          height: 74,
          paddingBottom: 10,
          paddingTop: 10,
          borderRadius: 24,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: theme.dark ? 0.35 : 0.12,
          shadowRadius: 20,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarItemStyle: {
          borderRadius: 18,
          marginHorizontal: 4,
        },
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarLabel: t(tab.labelKey),
            tabBarIcon: ({ color, size }) => tab.icon({ color, size }),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

function NotificationBell({ navigation, userId }: { navigation: any; userId: string }) {
  const { summary } = useNotifications(userId);
  const { theme } = useAppPreferences();

  useEffect(() => {
    setBadgeCount(summary.unread);
  }, [summary.unread]);

  return (
    <TouchableOpacity
      style={[
        styles.notificationButton,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
      onPress={() => navigation.navigate('Notifications')}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <BellIcon size={22} color={theme.colors.text} />
      {summary.unread > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.colors.danger }]}>
          <Text style={styles.badgeText}>{summary.unread > 99 ? '99+' : summary.unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function DashboardIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="2" />
      <Rect x="14" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="2" />
      <Rect x="3" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="2" />
      <Rect x="14" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

function BookingsIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <Path d="M16 2v4" />
      <Path d="M8 2v4" />
      <Path d="M3 10h18" />
    </Svg>
  );
}

function FleetIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M1 3h15v13H1z" />
      <Path d="M16 8h4l3 3v5h-7V8z" />
      <Circle cx="5.5" cy="18.5" r="2.5" />
      <Circle cx="18.5" cy="18.5" r="2.5" />
    </Svg>
  );
}

function FinanceIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 2v20" />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  );
}

function MoreIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx="12" cy="12" r="1" fill={color} />
      <Circle cx="12" cy="5" r="1" fill={color} />
      <Circle cx="12" cy="19" r="1" fill={color} />
    </Svg>
  );
}

function BellIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  notificationButton: {
    position: 'relative',
    marginHorizontal: 8,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
