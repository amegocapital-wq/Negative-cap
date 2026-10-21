import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.hookline.clips',
  appName: 'Hookline',
  webDir: 'dist',
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
