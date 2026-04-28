import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { SegmentedControl } from '../components/system/SegmentedControl';
import { useAuth } from '../contexts/AuthContext';
import {
  type AppLanguage,
  type NotificationPrefs,
  useAppPreferences,
} from '../contexts/AppPreferencesContext';
import { clearAllNotifications } from '../services/notificationService';
import { supabase } from '../lib/supabase';
import { FadeSlideIn } from '../components/ui';

// ─── Language config ──────────────────────────────────────────────────────────

const LANGUAGES: {
  code: AppLanguage;
  flag: string;
  nativeName: string;
  englishName: string;
}[] = [
  { code: 'en', flag: '🇬🇧', nativeName: 'English',   englishName: 'English'    },
  { code: 'ar', flag: '🇸🇦', nativeName: 'العربية',   englishName: 'Arabic'     },
  { code: 'fr', flag: '🇫🇷', nativeName: 'Français',  englishName: 'French'     },
  { code: 'sw', flag: '🇹🇿', nativeName: 'Kiswahili', englishName: 'Swahili'    },
  { code: 'es', flag: '🇪🇸', nativeName: 'Español',   englishName: 'Spanish'    },
  { code: 'pt', flag: '🇵🇹', nativeName: 'Português', englishName: 'Portuguese' },
];

// ─── Notification config ──────────────────────────────────────────────────────

const NOTIF_SETTINGS: {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
  emoji: string;
}[] = [
  { key: 'bookingNew',       emoji: '📅', label: 'New Bookings',         description: 'When a new safari booking is created' },
  { key: 'bookingStarted',   emoji: '🚙', label: 'Safari Started',       description: 'When a booking moves to In-Progress' },
  { key: 'bookingCompleted', emoji: '✅', label: 'Booking Completed',     description: 'When a safari is marked complete' },
  { key: 'bookingCancelled', emoji: '❌', label: 'Booking Cancelled',     description: 'When a booking is cancelled' },
  { key: 'crNew',            emoji: '📝', label: 'New Cash Requisitions', description: 'When a cash requisition is raised' },
  { key: 'crApproved',       emoji: '💵', label: 'CR Approved',           description: 'When a cash requisition is approved' },
  { key: 'messages',         emoji: '💬', label: 'New Messages',          description: 'When a new staff message arrives' },
  { key: 'systemAlerts',     emoji: '⚡', label: 'System Alerts',         description: 'Important system notifications' },
];

// ─── Account Settings Modal ───────────────────────────────────────────────────

function AccountSettingsModal({
  visible,
  onClose,
  user,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  user: any;
  theme: any;
}) {
  const displayName: string =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    '—';

  const rows = [
    { label: 'Email',        value: user?.email || '—' },
    { label: 'Display Name', value: displayName },
    { label: 'Account ID',   value: user?.id?.slice(0, 16) + '…' || '—' },
    { label: 'Last Sign In', value: user?.last_sign_in_at
        ? new Date(user.last_sign_in_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—' },
    { label: 'Role',         value: user?.role || 'authenticated' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={[styles.modalSheet, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Account</Text>

          {/* Avatar */}
          <View style={[styles.modalAvatar, { backgroundColor: theme.colors.accent }]}>
            <Text style={[styles.modalAvatarText, { color: theme.colors.accentContrast }]}>
              {(displayName[0] || user?.email?.[0] || '?').toUpperCase()}
            </Text>
          </View>

          {/* Info rows */}
          <View style={[styles.infoCard, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
            {rows.map((row, i) => (
              <View
                key={row.label}
                style={[
                  styles.infoCardRow,
                  i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.infoCardLabel, { color: theme.colors.textMuted }]}>{row.label}</Text>
                <Text style={[styles.infoCardValue, { color: theme.colors.text }]} numberOfLines={1}>{row.value}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.modalDoneBtn, { backgroundColor: theme.colors.accent }]}
            onPress={onClose}
          >
            <Text style={[styles.modalDoneBtnText, { color: theme.colors.accentContrast }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({
  visible,
  onClose,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  theme: any;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm]         = useState('');
  const [saving, setSaving]           = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = useCallback(async () => {
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Success', 'Your password has been updated.', [
        { text: 'OK', onPress: () => { setNewPassword(''); setConfirm(''); onClose(); } },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update password. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [newPassword, confirm, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Change Password</Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textMuted }]}>
              Enter a new password for your account. Minimum 8 characters.
            </Text>

            {/* New password */}
            <Text style={[styles.inputLabel, { color: theme.colors.textMuted }]}>New Password</Text>
            <View style={[styles.inputRow, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Enter new password"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                <Text style={{ fontSize: 14, color: theme.colors.accent }}>{showNew ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {/* Confirm password */}
            <Text style={[styles.inputLabel, { color: theme.colors.textMuted, marginTop: 12 }]}>Confirm Password</Text>
            <View style={[styles.inputRow, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Confirm new password"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry={!showConfirm}
                value={confirm}
                onChangeText={setConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                <Text style={{ fontSize: 14, color: theme.colors.accent }}>{showConfirm ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {/* Strength indicator */}
            {newPassword.length > 0 && (
              <View style={styles.strengthRow}>
                {[4, 6, 8, 12].map((threshold, i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      { backgroundColor: newPassword.length >= threshold ? '#3d8f6a' : theme.colors.border },
                    ]}
                  />
                ))}
                <Text style={[styles.strengthLabel, { color: theme.colors.textMuted }]}>
                  {newPassword.length < 6 ? 'Weak' : newPassword.length < 10 ? 'Fair' : 'Strong'}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
                onPress={onClose}
              >
                <Text style={[styles.modalCancelText, { color: theme.colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: theme.colors.accent }, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={theme.colors.accentContrast} size="small" />
                  : <Text style={[styles.modalSaveText, { color: theme.colors.accentContrast }]}>Update Password</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────

function ToggleRow({
  emoji,
  label,
  description,
  value,
  onToggle,
  disabled,
  theme,
}: {
  emoji: string;
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  theme: any;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={[styles.toggleEmoji, { backgroundColor: theme.colors.surfaceMuted }]}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleLabel, { color: disabled ? theme.colors.textMuted : theme.colors.text }]}>
          {label}
        </Text>
        <Text style={[styles.toggleDesc, { color: theme.colors.textMuted }]} numberOfLines={1}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: theme.colors.border, true: theme.colors.accent + '88' }}
        thumbColor={value ? theme.colors.accent : theme.colors.textMuted}
        ios_backgroundColor={theme.colors.border}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const {
    theme,
    isRTL,
    t,
    language,
    setLanguage,
    themeMode,
    setThemeMode,
    biometricEnabled,
    setBiometricEnabled,
    biometricAvailable,
    biometricLabel,
    notificationPrefs,
    updateNotificationPref,
  } = useAppPreferences();

  const [isLoggingOut, setIsLoggingOut]       = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const themeOptions = [
    { label: t('common.darkMode'),  value: 'dark'  },
    { label: t('common.lightMode'), value: 'light' },
  ];

  const roleLabel = language === 'ar' ? 'إدارة التطبيق' : 'Operations Access';

  const quickActions: {
    emoji: string;
    label: string;
    description: string;
    tab: string;
    isStack?: boolean;
  }[] = [
    { emoji: '📅', label: 'Create New Booking',      description: 'Add a new safari trip reservation',        tab: 'Bookings'         },
    { emoji: '🚙', label: 'Add Vehicle',              description: 'Register a new vehicle in the fleet',      tab: 'Fleet'            },
    { emoji: '📝', label: 'Submit Cash Requisition',  description: 'Request cash or log an expense',           tab: 'Finance'          },
    { emoji: '📊', label: 'View Dashboard',            description: 'Review KPIs, charts and reports',         tab: 'Dashboard'        },
    { emoji: '🧭', label: 'Safari Management',         description: 'Bookings, guides, packages & analytics',  tab: 'SafariManagement', isStack: true },
    { emoji: '📣', label: 'Marketing & Portal',        description: 'Manage portal visibility and promotions', tab: 'Marketing',        isStack: true },
  ];

  const handleLogout = useCallback(() => {
    Alert.alert(
      t('common.logout'),
      'Are you sure you want to sign out?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.logout'),
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await clearAllNotifications().catch(() => null);
              await signOut();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to sign out. Please try again.');
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  }, [t, signOut]);

  const handleToggleBiometrics = useCallback(() => {
    if (!biometricAvailable && !biometricEnabled) {
      Alert.alert(t('common.biometric'), t('biometric.unavailable'));
      return;
    }
    void setBiometricEnabled(!biometricEnabled);
  }, [biometricAvailable, biometricEnabled, setBiometricEnabled, t]);

  const navigateToTab = useCallback((tab: string, isStack?: boolean) => {
    if (isStack) {
      // Stack screens sit on the root Stack navigator (parent of the tab navigator)
      navigation.getParent()?.navigate(tab as never);
    } else {
      // Tab screens are siblings within the same tab navigator
      navigation.navigate(tab as never);
    }
  }, [navigation]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card ── */}
        <FadeSlideIn delay={0}>
          <View style={[styles.heroCard, { backgroundColor: theme.colors.hero }]}>
            <View style={styles.heroProfileRow}>
              {/* Avatar with initials */}
              <View style={[styles.avatar, { backgroundColor: theme.colors.accent }]}>
                <Text style={[styles.avatarText, { color: theme.colors.accentContrast }]}>
                  {(() => {
                    const name = user?.user_metadata?.full_name || '';
                    if (name) {
                      return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                    }
                    return (user?.email?.charAt(0) || '?').toUpperCase();
                  })()}
                </Text>
              </View>
              {/* Name + role */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroTitle, { color: theme.colors.accentContrast, textAlign: isRTL ? 'right' : 'left' }]}>
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || '—'}
                </Text>
                <Text style={[styles.heroSubtitle, { color: '#b8ab95', textAlign: isRTL ? 'right' : 'left' }]}>
                  {roleLabel}
                </Text>
                <Text style={[styles.heroEmail, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {user?.email || ''}
                </Text>
              </View>
            </View>
          </View>
        </FadeSlideIn>

        {/* ── Appearance ── */}
        <FadeSlideIn delay={60}>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('common.settings')}</Text>

            {/* Theme */}
            <View style={styles.preferenceBlock}>
              <View style={styles.preferenceHeader}>
                <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>{t('common.theme')}</Text>
                <Text style={[styles.preferenceDescription, { color: theme.colors.textMuted }]}>{t('more.themeDescription')}</Text>
              </View>
              <SegmentedControl
                options={themeOptions}
                value={themeMode}
                onChange={(v) => void setThemeMode(v as 'light' | 'dark')}
              />
            </View>

            {/* Language */}
            <View style={styles.preferenceBlock}>
              <View style={styles.preferenceHeader}>
                <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>{t('common.language')}</Text>
                <Text style={[styles.preferenceDescription, { color: theme.colors.textMuted }]}>{t('more.languageDescription')}</Text>
              </View>
              <View style={styles.languageGrid}>
                {LANGUAGES.map((lang) => {
                  const selected = language === lang.code;
                  return (
                    <TouchableOpacity
                      key={lang.code}
                      style={[
                        styles.languageTile,
                        {
                          backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceMuted,
                          borderColor:     selected ? theme.colors.accent : theme.colors.border,
                        },
                      ]}
                      onPress={() => void setLanguage(lang.code)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.languageFlag}>{lang.flag}</Text>
                      <Text
                        style={[styles.languageNative, { color: selected ? theme.colors.accentContrast : theme.colors.text }]}
                        numberOfLines={1}
                      >
                        {lang.nativeName}
                      </Text>
                      <Text
                        style={[styles.languageEnglish, { color: selected ? 'rgba(255,255,255,0.75)' : theme.colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {lang.englishName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Biometrics */}
            <TouchableOpacity
              style={[styles.preferenceRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              onPress={handleToggleBiometrics}
            >
              <View style={styles.preferenceHeader}>
                <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>{t('common.biometric')}</Text>
                <Text style={[styles.preferenceDescription, { color: theme.colors.textMuted }]}>{t('more.biometricDescription')}</Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={(v) => void setBiometricEnabled(v)}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent + '88' }}
                thumbColor={biometricEnabled ? theme.colors.accent : theme.colors.textMuted}
                ios_backgroundColor={theme.colors.border}
              />
            </TouchableOpacity>
          </View>
        </FadeSlideIn>

        {/* ── App Notifications ── */}
        <FadeSlideIn delay={120}>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {/* Master toggle header */}
            <View style={styles.notifHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 2 }]}>App Notifications</Text>
                <Text style={[styles.preferenceDescription, { color: theme.colors.textMuted }]}>
                  Control which events trigger notifications
                </Text>
              </View>
              <Switch
                value={notificationPrefs.masterEnabled}
                onValueChange={(v) => void updateNotificationPref('masterEnabled', v)}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent + '88' }}
                thumbColor={notificationPrefs.masterEnabled ? theme.colors.accent : theme.colors.textMuted}
                ios_backgroundColor={theme.colors.border}
              />
            </View>

            {/* Per-type toggles */}
            <View style={styles.notifToggles}>
              {NOTIF_SETTINGS.map((setting, i) => (
                <View
                  key={setting.key}
                  style={[
                    styles.notifToggleWrap,
                    i < NOTIF_SETTINGS.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
                  ]}
                >
                  <ToggleRow
                    emoji={setting.emoji}
                    label={setting.label}
                    description={setting.description}
                    value={notificationPrefs[setting.key] as boolean}
                    onToggle={(v) => void updateNotificationPref(setting.key, v)}
                    disabled={!notificationPrefs.masterEnabled}
                    theme={theme}
                  />
                </View>
              ))}
            </View>
          </View>
        </FadeSlideIn>

        {/* ── Profile / Account ── */}
        <FadeSlideIn delay={180}>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('common.profile')}</Text>

            <TouchableOpacity
              style={[styles.menuRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderTopWidth: 1, borderTopColor: theme.colors.border }]}
              onPress={() => setShowAccountModal(true)}
              activeOpacity={0.75}
            >
              <View style={styles.menuRowLeft}>
                <Text style={styles.menuRowEmoji}>👤</Text>
                <View>
                  <Text style={[styles.menuRowText, { color: theme.colors.text }]}>Account Settings</Text>
                  <Text style={[styles.menuRowSub, { color: theme.colors.textMuted }]}>View profile & account info</Text>
                </View>
              </View>
              <Text style={[styles.menuArrow, { color: theme.colors.textSoft }]}>{isRTL ? '‹' : '›'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderTopWidth: 1, borderTopColor: theme.colors.border }]}
              onPress={() => setShowPasswordModal(true)}
              activeOpacity={0.75}
            >
              <View style={styles.menuRowLeft}>
                <Text style={styles.menuRowEmoji}>🔐</Text>
                <View>
                  <Text style={[styles.menuRowText, { color: theme.colors.text }]}>Change Password</Text>
                  <Text style={[styles.menuRowSub, { color: theme.colors.textMuted }]}>Update your account password</Text>
                </View>
              </View>
              <Text style={[styles.menuArrow, { color: theme.colors.textSoft }]}>{isRTL ? '‹' : '›'}</Text>
            </TouchableOpacity>
          </View>
        </FadeSlideIn>

        {/* ── Quick Actions ── */}
        <FadeSlideIn delay={240}>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('more.quickActions')}</Text>
            {quickActions.map((action, i) => (
              <TouchableOpacity
                key={action.tab}
                style={[
                  styles.menuRow,
                  { flexDirection: isRTL ? 'row-reverse' : 'row', borderTopWidth: 1, borderTopColor: theme.colors.border },
                ]}
                activeOpacity={0.75}
                onPress={() => navigateToTab(action.tab, action.isStack)}
              >
                <View style={styles.menuRowLeft}>
                  <View style={[styles.quickActionEmoji, { backgroundColor: theme.colors.surfaceMuted }]}>
                    <Text style={{ fontSize: 20 }}>{action.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuRowText, { color: theme.colors.text }]}>{action.label}</Text>
                    <Text style={[styles.menuRowSub, { color: theme.colors.textMuted }]}>{action.description}</Text>
                  </View>
                </View>
                <Text style={[styles.menuArrow, { color: theme.colors.textSoft }]}>{isRTL ? '‹' : '›'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FadeSlideIn>

        {/* ── App info ── */}
        <FadeSlideIn delay={300}>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('more.appInformation')}</Text>
            {[
              { label: 'Version',    value: '1.0 (3.2)' },
              { label: 'Build',      value: 'Release' },
              { label: 'Last Sync',  value: t('more.justNow') },
            ].map((row, i) => (
              <View key={row.label} style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.textMuted }]}>{row.label}</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{row.value}</Text>
              </View>
            ))}
          </View>
        </FadeSlideIn>

        {/* ── Logout ── */}
        <FadeSlideIn delay={340}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: theme.colors.danger }, isLoggingOut && styles.logoutButtonDisabled]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut
              ? <ActivityIndicator color={theme.colors.accentContrast} />
              : <Text style={[styles.logoutButtonText, { color: theme.colors.accentContrast }]}>{t('common.logout')}</Text>
            }
          </TouchableOpacity>
        </FadeSlideIn>
      </ScrollView>

      {/* Modals */}
      <AccountSettingsModal
        visible={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        user={user}
        theme={theme}
      />
      <ChangePasswordModal
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        theme={theme}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:      { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 120, gap: 16 },

  // Hero
  heroCard:       { borderRadius: 28, padding: 24 },
  heroProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar:         { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:     { fontSize: 24, fontWeight: '800' },
  heroTitle:      { fontSize: 18, fontWeight: '800', marginBottom: 3 },
  heroSubtitle:   { fontSize: 13, marginBottom: 2 },
  heroEmail:      { fontSize: 11, color: '#7a6d5e' },

  // Section cards
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#201a13',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },

  // Preferences
  preferenceBlock:       { marginBottom: 18, gap: 12 },
  preferenceRow:         { justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  preferenceHeader:      { flex: 1 },
  preferenceTitle:       { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  preferenceDescription: { fontSize: 13, lineHeight: 19 },

  // Language grid
  languageGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  languageTile:   { width: '30%', flexGrow: 1, borderRadius: 16, borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', gap: 4 },
  languageFlag:   { fontSize: 22, lineHeight: 28 },
  languageNative: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  languageEnglish:{ fontSize: 10, fontWeight: '500', textAlign: 'center' },

  // Notifications
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  notifToggles: { gap: 0 },
  notifToggleWrap: { paddingVertical: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleEmoji: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toggleLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  toggleDesc:  { fontSize: 12 },

  // Menu rows
  menuRow: { justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  menuRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuRowEmoji: { fontSize: 20, width: 32, textAlign: 'center' },
  menuRowText:  { fontSize: 15, fontWeight: '600' },
  menuRowSub:   { fontSize: 12, marginTop: 2 },
  menuArrow:    { fontSize: 22, lineHeight: 24, marginLeft: 8 },

  quickActionEmoji: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // Info rows
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '700' },

  // Logout
  logoutButton:         { minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  logoutButtonDisabled: { opacity: 0.7 },
  logoutButtonText:     { fontSize: 16, fontWeight: '800' },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(18,14,10,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 20,
  },
  modalHandle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d4c9b5', alignSelf: 'center', marginBottom: 20 },
  modalTitle:        { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  modalSubtitle:     { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  modalAvatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalAvatarText: { fontSize: 28, fontWeight: '800' },
  infoCard: { borderRadius: 16, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  infoCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  infoCardLabel: { fontSize: 13, fontWeight: '600' },
  infoCardValue: { fontSize: 13, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
  modalDoneBtn: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  modalDoneBtnText: { fontSize: 15, fontWeight: '800' },

  // Password form
  inputLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  textInput: { flex: 1, fontSize: 15 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  modalCancelText: { fontSize: 14, fontWeight: '700' },
  modalSaveBtn: { flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalSaveText: { fontSize: 14, fontWeight: '800' },
});
