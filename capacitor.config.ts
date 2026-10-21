import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.hookline.clips',
  appName: 'Hookline',
  // The APK ships the single-file build (see vite.standalone.config.ts), so what
  // runs on the phone is byte-identical to what `standalone:check` verifies.
  webDir: 'standalone',
  android: {
    backgroundColor: '#07070b',
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#07070b',
      showSpinner: false,
    },
  },
};

export default config;
