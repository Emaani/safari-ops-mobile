/**
 * Haptics utility — wraps expo-haptics with graceful no-ops so simulator
 * builds and devices without haptic hardware never throw.
 */
import * as Haptics from 'expo-haptics';

/** Light tap — use on most button presses, list item selects */
export function tapLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium impact — use on primary CTA, confirm actions */
export function tapMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Heavy impact — use on destructive confirmations, errors */
export function tapHeavy() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/** Selection tick — use on filter/tab changes, toggles */
export function selectionTick() {
  Haptics.selectionAsync().catch(() => {});
}

/** Success — use on form submit, booking created, CR approved */
export function notifySuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Warning — use on validation errors */
export function notifyWarning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Error — use on failed network requests, auth errors */
export function notifyError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
