/**
 * One-time native shell setup: status bar, splash screen, keyboard.
 *
 * All four plugins were installed but never imported anywhere, so none of this
 * was configured. Every function no-ops on web.
 */
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { hasNativeRuntime, isAndroid, isIOS } from './platform';

/**
 * Configure the native chrome. Call once at startup.
 *
 * The splash screen is deliberately NOT hidden here — capacitor.config.ts sets
 * launchAutoHide: false, and hideSplash() is called only once the auth state
 * has resolved, so the user never sees a flash of the login screen before being
 * restored to their session.
 */
export async function initNativeShell(): Promise<void> {
  if (!hasNativeRuntime()) return;

  try {
    // Light text on the dark header colour used across the app.
    await StatusBar.setStyle({ style: Style.Dark });
    if (isAndroid()) {
      await StatusBar.setBackgroundColor({ color: '#1f2937' });
    }
  } catch (err) {
    console.warn('StatusBar setup failed:', err);
  }

  try {
    // Resize the app frame rather than the viewport, so the long CRM forms
    // shrink instead of scrolling underneath the keyboard.
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
    if (isIOS()) {
      await Keyboard.setAccessoryBarVisible({ isVisible: true });
    }
  } catch (err) {
    console.warn('Keyboard setup failed:', err);
  }
}

/** Dismiss the splash screen. Call once auth has resolved. */
export async function hideSplash(): Promise<void> {
  if (!hasNativeRuntime()) return;
  try {
    await SplashScreen.hide();
  } catch (err) {
    console.warn('SplashScreen.hide failed:', err);
  }
}

/**
 * Short tap feedback for primary actions.
 *
 * Fire-and-forget: haptics are a nicety and must never block or throw into a
 * click handler.
 */
export function tapFeedback(style: ImpactStyle = ImpactStyle.Light): void {
  if (!hasNativeRuntime()) return;
  Haptics.impact({ style }).catch(() => {});
}
