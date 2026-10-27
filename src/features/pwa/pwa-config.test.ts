// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pwaConfig } from './pwa-config'

describe('PWA assets and build configuration', () => {
  it('uses an origin-independent standalone manifest', () => {
    expect(pwaConfig.manifest).toMatchObject({
      id: '/',
      name: 'Workout Flow',
      short_name: 'Workout Flow',
      description: 'Приложение для проведения тренировок',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#020617',
      background_color: '#020617',
    })
  })
  it('ships real PNG icons at their declared sizes, including Apple touch', () => {
    const icons = [
      ...pwaConfig.manifest.icons,
      { src: '/icons/apple-touch-icon.png', sizes: '180x180' },
    ]
    for (const icon of icons) {
      const png = readFileSync(`${process.cwd()}/public${icon.src}`)
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      const [width, height] = icon.sizes.split('x').map(Number)
      expect(png.readUInt32BE(16)).toBe(width)
      expect(png.readUInt32BE(20)).toBe(height)
    }
    expect(
      icons.some((icon) => 'purpose' in icon && icon.purpose === 'maskable'),
    ).toBe(true)
    expect(readFileSync('index.html', 'utf8')).toContain(
      'rel="apple-touch-icon"',
    )
  })
  it('precaches the SPA with prompt-only activation', () => {
    expect(pwaConfig).toMatchObject({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      devOptions: { enabled: false },
    })
    expect(pwaConfig.workbox).toMatchObject({
      navigateFallback: '/index.html',
      skipWaiting: false,
      clientsClaim: false,
      cleanupOutdatedCaches: true,
    })
    for (const extension of ['html', 'js', 'css', 'png', 'webmanifest'])
      expect(pwaConfig.workbox.globPatterns[0]).toContain(extension)
  })
})
