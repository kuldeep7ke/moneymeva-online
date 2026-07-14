import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moneymeva.app',
  appName: 'Money Meva',
  webDir: 'out',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#FF8A3D',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1e1b4b',
    },
  },
};

export default config;
