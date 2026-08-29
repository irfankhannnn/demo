import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';
import { Style } from '@capacitor/status-bar';

// NOTE: appId and appName are permanent. Changing either after the first
// store submission creates a new listing and loses all reviews and installs.
const config: CapacitorConfig = {
  appId: 'in.realestateflow.app',
  appName: 'RealEstateFlow',
  webDir: 'dist',

  server: {
    // Android serves from https://localhost, iOS from capacitor://localhost.
    // Both origins must be present in the API's ALLOWED_ORIGINS allowlist.
    androidScheme: 'https',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
      // The app hides this manually once auth has resolved, so the user never
      // sees a flash of the login screen before being restored to their session.
      launchAutoHide: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      // Style.Dark means light text, which is what the dark background needs.
      // The previous config paired style 'light' (dark text) with this same
      // dark background, which would have rendered the status bar unreadable.
      style: Style.Dark,
      backgroundColor: '#1f2937',
    },
    Keyboard: {
      // Resize the app frame rather than the viewport: the CRM's long forms
      // (KhataEntryForm, AddPropertyModal, PropertyDetails) sit inside
      // scrollable containers that need to shrink, not scroll under the keyboard.
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
