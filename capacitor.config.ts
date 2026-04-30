import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.75314d32e3c642998eae5114185be0f3',
  appName: 'MedControl CRM',
  webDir: 'dist',
  server: {
    url: 'https://75314d32-e3c6-4299-8eae-5114185be0f3.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    Geolocation: {
      permissions: ['location'],
    },
  },
};

export default config;
