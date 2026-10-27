import type { VitePWAOptions } from 'vite-plugin-pwa'

export const pwaConfig = {
  strategies: 'generateSW',
  registerType: 'prompt',
  injectRegister: false,
  manifest: {
    id: '/',
    name: 'Workout Flow',
    short_name: 'Workout Flow',
    description: 'Приложение для проведения тренировок',
    lang: 'ru',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#020617',
    background_color: '#020617',
    icons: [
      {
        src: '/icons/pwa-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/pwa-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  includeAssets: ['icons/apple-touch-icon.png'],
  workbox: {
    globPatterns: ['**/*.{html,js,css,png,svg,webmanifest}'],
    navigateFallback: '/index.html',
    cleanupOutdatedCaches: true,
    skipWaiting: false,
    clientsClaim: false,
  },
  devOptions: { enabled: false },
} satisfies Partial<VitePWAOptions>
