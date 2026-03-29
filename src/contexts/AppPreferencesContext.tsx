import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { darkTheme, themes, type AppTheme, type ThemeMode } from '../theme';

export type AppLanguage = 'en' | 'ar';

type TranslationLeaf = string;
type TranslationTree = {
  [key: string]: TranslationLeaf | TranslationTree;
};

const STORAGE_KEYS = {
  theme: 'jackal:theme',
  language: 'jackal:language',
  biometrics: 'jackal:biometrics',
} as const;

const translations: Record<AppLanguage, TranslationTree> = {
  en: {
    app: {
      name: 'Jackal Adventures',
      subtitle: 'Operations snapshot',
    },
    common: {
      dashboard: 'Dashboard',
      bookings: 'Bookings',
      fleet: 'Fleet',
      finance: 'Finance',
      more: 'More',
      notifications: 'Notifications',
      retry: 'Retry',
      cancel: 'Cancel',
      save: 'Save',
      logout: 'Sign Out',
      lightMode: 'Light Mode',
      darkMode: 'Dark Mode',
      language: 'Language',
      biometric: 'Biometric Login',
      enabled: 'Enabled',
      disabled: 'Disabled',
      settings: 'Settings',
      profile: 'Profile',
      theme: 'Theme',
      currency: 'Currency',
      loading: 'Loading...',
      today: 'Today',
      search: 'Search',
      functionalSoon: 'This action is available in the next step of the workflow.',
    },
    login: {
      welcome: 'Welcome back',
      subtitle: 'Use your Jackal Adventures credentials to continue.',
      email: 'Email Address',
      password: 'Password',
      forgotPassword: 'Forgot Password?',
      signIn: 'Sign In',
      show: 'Show',
      hide: 'Hide',
      biometric: 'Unlock with {{label}}',
      usePassword: 'Use password instead',
      enableBiometricTitle: 'Enable biometric login?',
      enableBiometricMessage: 'You can unlock the app faster with {{label}} next time.',
      invalidEmail: 'Please enter a valid email address',
      passwordRequired: 'Password is required',
      emailRequired: 'Email is required',
      passwordLength: 'Password must be at least 6 characters',
      footer: 'Only authorized staff can access the mobile operations app.',
    },
    biometric: {
      title: 'Quick unlock',
      subtitle: 'Verify your identity to open the dashboard.',
      promptMessage: 'Authenticate to access Jackal Adventures',
      promptDescription: 'Use your enrolled biometrics or device passcode.',
      action: 'Authenticate now',
      fallback: 'Use password instead',
      unavailable: 'Biometric authentication is not available on this device.',
    },
    dashboard: {
      refine: 'Refine the snapshot',
      filters: 'Filters',
      tapToSwitch: 'Tap to switch',
      month: 'Month',
      year: 'Year',
      revenueFocus: 'Revenue in focus for the selected period',
      costs: 'Costs',
      due: 'Due',
      fleet: 'Fleet',
      outstandingPayments: 'Outstanding Payments',
      recentBookings: 'Recent Bookings',
      fleetStatus: 'Fleet Status',
      revenueVsExpenses: 'Revenue vs Expenses',
      expenseCategories: 'Expense Categories',
      topVehicles: 'Top Revenue Vehicles',
      capacityComparison: 'Capacity Comparison',
      allMonths: 'All Months',
      allMonthsAtGlance: 'All months at a glance',
      pulse: '{{month}} pulse',
    },
    finance: {
      title: 'Financial Management',
      subtitle: 'Track transactions, requisitions, and cash movement.',
      transactions: 'Transactions',
      requisitions: 'Cash Requisitions',
      income: 'Income',
      expenses: 'Expenses',
      netProfit: 'Net',
      pending: 'Pending',
      searchPlaceholder: 'Search category, description, or CR number...',
      recentActivity: 'Recent activity',
      cashRequisitions: 'Cash Requisitions',
      noTransactions: 'No transactions match the current filters.',
      noRequisitions: 'No cash requisitions match the current filters.',
      filterIncome: 'Income',
      filterExpense: 'Expense',
      filterAll: 'All',
    },
    bookings: {
      title: 'Reservations',
      subtitle: 'Manage confirmed, pending, and in-progress trips.',
      total: 'Total',
      active: 'Active',
      confirmed: 'Confirmed',
      pending: 'Pending',
      searchPlaceholder: 'Search by booking number or client...',
      sortNewest: 'Newest',
      sortOldest: 'Oldest',
      sortAmountHigh: 'Amount high',
      sortAmountLow: 'Amount low',
      sortClientAsc: 'Client A-Z',
      sortClientDesc: 'Client Z-A',
      reservationsCount: 'Reservations ({{count}})',
    },
    fleet: {
      title: 'Fleet Management',
      subtitle: 'Monitor availability, assignments, and maintenance.',
      total: 'Total Fleet',
      available: 'Available',
      onSafari: 'On Safari',
      maintenance: 'Maintenance',
      searchPlaceholder: 'Search vehicles...',
      vehiclesCount: 'Vehicles ({{count}})',
    },
    notifications: {
      unread: 'Unread',
      read: 'Read',
      all: 'All',
      markAll: 'Mark all as read',
      empty: 'No notifications',
      emptyMessage: 'You have no notifications at this time.',
      error: 'Error loading notifications',
    },
    more: {
      title: 'Settings',
      account: 'Account Settings',
      changePassword: 'Change Password',
      appInformation: 'App Information',
      quickActions: 'Quick Actions',
      themeDescription: 'Choose between dark and light appearance.',
      languageDescription: 'Switch the app language and layout direction.',
      biometricDescription: 'Use Face ID, fingerprint, or device passcode to unlock the app.',
      version: 'Version',
      lastSync: 'Last Sync',
      justNow: 'Just now',
    },
  },
  ar: {
    app: {
      name: 'جاكال أدفنتشرز',
      subtitle: 'ملخص العمليات',
    },
    common: {
      dashboard: 'لوحة التحكم',
      bookings: 'الحجوزات',
      fleet: 'الأسطول',
      finance: 'المالية',
      more: 'المزيد',
      notifications: 'الإشعارات',
      retry: 'إعادة المحاولة',
      cancel: 'إلغاء',
      save: 'حفظ',
      logout: 'تسجيل الخروج',
      lightMode: 'الوضع الفاتح',
      darkMode: 'الوضع الداكن',
      language: 'اللغة',
      biometric: 'الدخول البيومتري',
      enabled: 'مفعل',
      disabled: 'غير مفعل',
      settings: 'الإعدادات',
      profile: 'الملف الشخصي',
      theme: 'السمة',
      currency: 'العملة',
      loading: 'جاري التحميل...',
      today: 'اليوم',
      search: 'بحث',
      functionalSoon: 'هذه العملية متاحة في الخطوة التالية من سير العمل.',
    },
    login: {
      welcome: 'مرحباً بعودتك',
      subtitle: 'استخدم بيانات جاكال أدفنتشرز للمتابعة.',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      forgotPassword: 'هل نسيت كلمة المرور؟',
      signIn: 'تسجيل الدخول',
      show: 'إظهار',
      hide: 'إخفاء',
      biometric: 'الدخول باستخدام {{label}}',
      usePassword: 'استخدام كلمة المرور',
      enableBiometricTitle: 'تفعيل الدخول البيومتري؟',
      enableBiometricMessage: 'يمكنك فتح التطبيق بسرعة باستخدام {{label}} في المرة القادمة.',
      invalidEmail: 'يرجى إدخال بريد إلكتروني صحيح',
      passwordRequired: 'كلمة المرور مطلوبة',
      emailRequired: 'البريد الإلكتروني مطلوب',
      passwordLength: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل',
      footer: 'يمكن للموظفين المصرح لهم فقط استخدام تطبيق العمليات المحمول.',
    },
    biometric: {
      title: 'فتح سريع',
      subtitle: 'تحقق من هويتك لفتح لوحة التحكم.',
      promptMessage: 'قم بالمصادقة للوصول إلى جاكال أدفنتشرز',
      promptDescription: 'استخدم القياسات الحيوية المسجلة أو رمز الجهاز.',
      action: 'تحقق الآن',
      fallback: 'استخدام كلمة المرور',
      unavailable: 'المصادقة البيومترية غير متاحة على هذا الجهاز.',
    },
    dashboard: {
      refine: 'خصص الملخص',
      filters: 'الفلاتر',
      tapToSwitch: 'اضغط للتبديل',
      month: 'الشهر',
      year: 'السنة',
      revenueFocus: 'الإيرادات ضمن الفترة المحددة',
      costs: 'التكاليف',
      due: 'المستحق',
      fleet: 'الأسطول',
      outstandingPayments: 'المدفوعات المستحقة',
      recentBookings: 'أحدث الحجوزات',
      fleetStatus: 'حالة الأسطول',
      revenueVsExpenses: 'الإيرادات مقابل المصروفات',
      expenseCategories: 'فئات المصروفات',
      topVehicles: 'أعلى المركبات دخلاً',
      capacityComparison: 'مقارنة السعة',
      allMonths: 'كل الأشهر',
      allMonthsAtGlance: 'نظرة على كل الأشهر',
      pulse: 'نبض {{month}}',
    },
    finance: {
      title: 'الإدارة المالية',
      subtitle: 'تابع المعاملات وطلبات الصرف وحركة النقد.',
      transactions: 'المعاملات',
      requisitions: 'طلبات الصرف',
      income: 'الإيرادات',
      expenses: 'المصروفات',
      netProfit: 'الصافي',
      pending: 'قيد الانتظار',
      searchPlaceholder: 'ابحث في الفئة أو الوصف أو رقم الطلب...',
      recentActivity: 'آخر النشاطات',
      cashRequisitions: 'طلبات الصرف النقدي',
      noTransactions: 'لا توجد معاملات تطابق الفلاتر الحالية.',
      noRequisitions: 'لا توجد طلبات صرف تطابق الفلاتر الحالية.',
      filterIncome: 'إيراد',
      filterExpense: 'مصروف',
      filterAll: 'الكل',
    },
    bookings: {
      title: 'الحجوزات',
      subtitle: 'إدارة الرحلات المؤكدة والقيد الجاري والمعلقة.',
      total: 'الإجمالي',
      active: 'نشط',
      confirmed: 'مؤكد',
      pending: 'معلق',
      searchPlaceholder: 'ابحث برقم الحجز أو العميل...',
      sortNewest: 'الأحدث',
      sortOldest: 'الأقدم',
      sortAmountHigh: 'المبلغ الأعلى',
      sortAmountLow: 'المبلغ الأقل',
      sortClientAsc: 'العميل أ-ي',
      sortClientDesc: 'العميل ي-أ',
      reservationsCount: 'الحجوزات ({{count}})',
    },
    fleet: {
      title: 'إدارة الأسطول',
      subtitle: 'راقب التوفر والتكليفات والصيانة.',
      total: 'إجمالي الأسطول',
      available: 'متاح',
      onSafari: 'في رحلة',
      maintenance: 'صيانة',
      searchPlaceholder: 'ابحث عن المركبات...',
      vehiclesCount: 'المركبات ({{count}})',
    },
    notifications: {
      unread: 'غير مقروء',
      read: 'مقروء',
      all: 'الكل',
      markAll: 'تحديد الكل كمقروء',
      empty: 'لا توجد إشعارات',
      emptyMessage: 'لا توجد لديك إشعارات حالياً.',
      error: 'تعذر تحميل الإشعارات',
    },
    more: {
      title: 'الإعدادات',
      account: 'إعدادات الحساب',
      changePassword: 'تغيير كلمة المرور',
      appInformation: 'معلومات التطبيق',
      quickActions: 'إجراءات سريعة',
      themeDescription: 'اختر بين الوضع الداكن والفاتح.',
      languageDescription: 'بدّل لغة التطبيق واتجاه الواجهة.',
      biometricDescription: 'استخدم بصمة الوجه أو الإصبع أو رمز الجهاز لفتح التطبيق.',
      version: 'الإصدار',
      lastSync: 'آخر مزامنة',
      justNow: 'الآن',
    },
  },
};

interface AppPreferencesContextValue {
  ready: boolean;
  theme: AppTheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  language: AppLanguage;
  isRTL: boolean;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  biometricEnabled: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  biometricAvailable: boolean;
  biometricLabel: string;
  authenticateWithBiometrics: () => Promise<boolean>;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | undefined>(undefined);

function getDeviceLanguage(): AppLanguage {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  return locale.startsWith('ar') ? 'ar' : 'en';
}

function getTranslationValue(language: AppLanguage, key: string): string {
  const segments = key.split('.');
  let current: TranslationLeaf | TranslationTree | undefined = translations[language];

  for (const segment of segments) {
    if (!current || typeof current === 'string') {
      return key;
    }
    current = current[segment];
  }

  return typeof current === 'string' ? current : key;
}

function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((message, [paramKey, value]) => {
    return message.replaceAll(`{{${paramKey}}}`, String(value));
  }, template);
}

async function readStoredPreference<T>(key: string): Promise<T | null> {
  const rawValue = await AsyncStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [language, setLanguageState] = useState<AppLanguage>(getDeviceLanguage());
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [storedTheme, storedLanguage, storedBiometrics] = await Promise.all([
        readStoredPreference<ThemeMode>(STORAGE_KEYS.theme),
        readStoredPreference<AppLanguage>(STORAGE_KEYS.language),
        readStoredPreference<boolean>(STORAGE_KEYS.biometrics),
      ]);

      if (!mounted) {
        return;
      }

      if (storedTheme) {
        setThemeModeState(storedTheme);
      }
      if (storedLanguage) {
        setLanguageState(storedLanguage);
      }
      if (typeof storedBiometrics === 'boolean') {
        setBiometricEnabledState(storedBiometrics);
      }

      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);

      if (!mounted) {
        return;
      }

      setBiometricAvailable(hasHardware && isEnrolled);

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricLabel(Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock');
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricLabel('Fingerprint');
      } else {
        setBiometricLabel('Biometrics');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(mode));
  }, []);

  const toggleTheme = useCallback(async () => {
    await setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  }, [setThemeMode, themeMode]);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    await AsyncStorage.setItem(STORAGE_KEYS.language, JSON.stringify(nextLanguage));
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    setBiometricEnabledState(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.biometrics, JSON.stringify(enabled));
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return formatMessage(getTranslationValue(language, key), params);
    },
    [language]
  );

  const authenticateWithBiometrics = useCallback(async () => {
    if (!biometricAvailable) {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('biometric.promptMessage'),
      promptDescription: t('biometric.promptDescription'),
      fallbackLabel: t('login.usePassword'),
      cancelLabel: t('common.cancel'),
      disableDeviceFallback: false,
    });

    return result.success;
  }, [biometricAvailable, t]);

  const value = useMemo<AppPreferencesContextValue>(() => {
    return {
      ready,
      theme: themes[themeMode] ?? darkTheme,
      themeMode,
      setThemeMode,
      toggleTheme,
      language,
      isRTL: language === 'ar',
      setLanguage,
      t,
      biometricEnabled,
      setBiometricEnabled,
      biometricAvailable,
      biometricLabel,
      authenticateWithBiometrics,
    };
  }, [
    authenticateWithBiometrics,
    biometricAvailable,
    biometricEnabled,
    biometricLabel,
    language,
    ready,
    setBiometricEnabled,
    setLanguage,
    setThemeMode,
    t,
    themeMode,
    toggleTheme,
  ]);

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences(): AppPreferencesContextValue {
  const context = useContext(AppPreferencesContext);

  if (!context) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  }

  return context;
}
