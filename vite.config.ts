import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaConfig } from './src/features/pwa/pwa-config.ts'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA(pwaConfig)],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
