export default {
  name: 'Zazzy Mobile',
  slug: 'zazzy-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.zazzy.mobile',
    infoPlist: {
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Zazzy Mobile tracks your location to log shift activity.',
      NSLocationAlwaysUsageDescription:
        'Zazzy Mobile tracks your location in the background during your shift.',
      NSMotionUsageDescription:
        'Used to detect movement for efficient location logging.',
      NSCameraUsageDescription:
        'Camera is used to scan item barcodes and table QR codes.',
      UIBackgroundModes: ['location', 'fetch'],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.zazzy.mobile',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'CAMERA',
      'RECEIVE_BOOT_COMPLETED',
      'WAKE_LOCK',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'react-native-vision-camera',
      {
        cameraPermissionText: 'Zazzy Mobile needs camera access to scan barcodes and QR codes.',
        enableCodeScanner: true,
      },
    ],
    [
      'react-native-background-geolocation',
      {
        license: process.env.BACKGROUND_GEOLOCATION_LICENSE || '',
        revisionCode: 1,
      },
    ],
    ['react-native-background-fetch', {}],
  ],
  experiments: {
    typedRoutes: true,
  },
  scheme: 'zazzy-mobile',
};
