/**
 * Platform detection for the Capacitor mobile builds.
 *
 * Two distinct questions get asked in this codebase, and conflating them
 * causes real bugs, so they have separate helpers:
 *
 *   isNativeApp()     — "should this behave like the mobile app?"
 *                       Drives UI decisions: hiding billing, showing the
 *                       bottom tab bar, suppressing the cookie banner.
 *                       Also true in a browser when the build flag is set,
 *                       so Playwright can exercise mobile-only behavior.
 *
 *   hasNativeRuntime() — "are Capacitor plugins actually callable?"
 *                       Guard every plugin call with this. It is false in a
 *                       browser even for a mobile build, so a forced-flag
 *                       test run never tries to invoke a native bridge that
 *                       is not there.
 *
 * Web builds are unaffected: with no flag and no Capacitor bridge, every
 * helper here returns false and behavior at app.realestateflow.in is
 * identical to before.
 */
import { Capacitor } from '@capacitor/core';

/** Set at build time by `npm run build:mobile`. Lets browser-based tests opt into mobile UI. */
const FORCED_NATIVE = import.meta.env.VITE_IS_NATIVE_BUILD === 'true';

/**
 * True when the app should present as the native mobile app.
 *
 * Use for UI/UX branching. Do NOT use this to guard plugin calls — a
 * Playwright run with the build flag set satisfies this but has no bridge.
 */
export function isNativeApp(): boolean {
  return FORCED_NATIVE || Capacitor.isNativePlatform();
}

/**
 * True only when a real Capacitor bridge exists and plugins can be called.
 * Guard every `@capacitor/*` plugin invocation with this.
 */
export function hasNativeRuntime(): boolean {
  return Capacitor.isNativePlatform();
}

/** True on a real iOS device or simulator. */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/** True on a real Android device or emulator. */
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/** Raw Capacitor platform: 'ios' | 'android' | 'web'. */
export function getPlatform(): string {
  return Capacitor.getPlatform();
}

/**
 * Whether a given Capacitor plugin is available right now.
 * Useful where a plugin is optional or only registered on one platform.
 */
export function isPluginAvailable(name: string): boolean {
  return Capacitor.isPluginAvailable(name);
}
