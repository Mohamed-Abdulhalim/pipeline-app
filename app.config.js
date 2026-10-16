const build = Number(process.env.GITHUB_RUN_NUMBER || 1);

module.exports = {
  expo: {
    name: 'Pipeline',
    slug: 'pipeline',
    version: `1.0.${build}`,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    backgroundColor: '#0A0C11',
    android: {
      package: 'pro.halim.pipeline',
      versionCode: build,
      adaptiveIcon: {
        backgroundColor: '#0A0C11',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM'],
    },
    plugins: [
      'expo-sqlite',
      'expo-font',
      'expo-local-authentication',
      [
        'expo-notifications',
        {
          icon: './assets/android-icon-monochrome.png',
          color: '#D9AE62',
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#0A0C11',
        },
      ],
    ],
  },
};
