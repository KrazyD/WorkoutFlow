import { act, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useVisibleViewport } from './use-visible-viewport'

function Layout() {
  useVisibleViewport()
  return <main>Тренировка</main>
}
afterEach(() => vi.unstubAllGlobals())

it('adapts the layout height to keyboard resize and removes the listener on unmount', () => {
  const viewport = Object.assign(new EventTarget(), { height: 812 })
  vi.stubGlobal('visualViewport', viewport)
  const view = render(<Layout />)
  expect(document.documentElement.style.getPropertyValue('--visible-viewport-height')).toBe('812px')
  act(() => {
    viewport.height = 440
    viewport.dispatchEvent(new Event('resize'))
  })
  expect(document.documentElement.style.getPropertyValue('--visible-viewport-height')).toBe('440px')
  act(() => {
    viewport.height = 812
    viewport.dispatchEvent(new Event('resize'))
  })
  expect(document.documentElement.style.getPropertyValue('--visible-viewport-height')).toBe('812px')
  view.unmount()
  act(() => viewport.dispatchEvent(new Event('resize')))
  expect(document.documentElement.style.getPropertyValue('--visible-viewport-height')).toBe('')
})
