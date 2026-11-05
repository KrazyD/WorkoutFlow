import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useVisibleViewport } from './use-visible-viewport'

function Layout() {
  useVisibleViewport()
  return (
    <main className="session-content">
      <input aria-label="Значение" />
    </main>
  )
}
afterEach(() => vi.unstubAllGlobals())

function setupViewport() {
  const viewport = Object.assign(new EventTarget(), {
    height: 812,
    offsetTop: 0,
    scale: 1,
  })
  vi.stubGlobal('visualViewport', viewport)
  return viewport
}
async function flush() {
  await act(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  )
}
const property = (name: string) =>
  document.documentElement.style.getPropertyValue(name)

it('tracks repeated keyboard resize AND pan, including dismissal while an input remains focused', async () => {
  const viewport = setupViewport()
  const view = render(<Layout />)
  screen.getByRole('textbox').focus()
  for (let cycle = 0; cycle < 3; cycle++) {
    Object.assign(viewport, { height: 440, offsetTop: 160 })
    viewport.dispatchEvent(new Event('resize'))
    await flush()
    expect(property('--visible-viewport-height')).toBe('440px')
    expect(property('--visible-viewport-top')).toBe('160px')
    expect(document.documentElement.dataset.keyboardOpen).toBe('true')
    viewport.offsetTop = 210
    viewport.dispatchEvent(new Event('scroll'))
    await flush()
    expect(property('--visible-viewport-top')).toBe('210px')
    Object.assign(viewport, { height: 812, offsetTop: 0 })
    viewport.dispatchEvent(new Event('resize'))
    await flush()
    expect(property('--visible-viewport-height')).toBe('812px')
    expect(property('--visible-viewport-top')).toBe('0px')
    expect(document.documentElement.dataset.keyboardOpen).toBe('false')
  }
  view.unmount()
  expect(property('--visible-viewport-height')).toBe('')
  expect(property('--visible-viewport-top')).toBe('')
  expect(document.documentElement.dataset.keyboardOpen).toBeUndefined()
})

it('resynchronizes on foreground and pageshow and cleans all listeners and queued frames', async () => {
  const viewport = setupViewport()
  const removeViewport = vi.spyOn(viewport, 'removeEventListener')
  const removeWindow = vi.spyOn(window, 'removeEventListener')
  const removeDocument = vi.spyOn(document, 'removeEventListener')
  const view = render(<Layout />)
  viewport.height = 667
  window.dispatchEvent(new Event('pageshow'))
  await flush()
  expect(property('--visible-viewport-height')).toBe('667px')
  viewport.height = 932
  document.dispatchEvent(new Event('visibilitychange'))
  await flush()
  expect(property('--visible-viewport-height')).toBe('932px')
  viewport.dispatchEvent(new Event('resize'))
  view.unmount()
  await flush()
  expect(property('--visible-viewport-height')).toBe('')
  expect(removeViewport.mock.calls.map(([name]) => name)).toEqual(
    expect.arrayContaining(['resize', 'scroll']),
  )
  expect(removeWindow.mock.calls.map(([name]) => name)).toEqual(
    expect.arrayContaining(['resize', 'pageshow']),
  )
  expect(removeDocument.mock.calls.map(([name]) => name)).toEqual(
    expect.arrayContaining(['focusin', 'focusout', 'visibilitychange']),
  )
})

it('does not resize the application around a pinch-zoomed viewport', async () => {
  const viewport = setupViewport()
  render(<Layout />)
  Object.assign(viewport, { height: 406, offsetTop: 90, scale: 2 })
  viewport.dispatchEvent(new Event('resize'))
  await flush()
  expect(property('--visible-viewport-height')).toBe('812px')
  expect(property('--visible-viewport-top')).toBe('0px')
})

it('falls back to CSS viewport units when VisualViewport is unavailable', () => {
  vi.stubGlobal('visualViewport', undefined)
  render(<Layout />)
  expect(property('--visible-viewport-height')).toBe('')
})

it('reveals the form actions inside the existing scroller without scrolling the document', async () => {
  const viewport = setupViewport()
  function Editor() {
    useVisibleViewport()
    return (
      <div className="session-content">
        <section className="value-card">
          <form>
            <input aria-label="Вес" />
            <button>Сохранить</button>
          </form>
        </section>
      </div>
    )
  }
  const view = render(<Editor />)
  const scroller = view.container.querySelector(
    '.session-content',
  ) as HTMLElement
  const form = view.container.querySelector('form')!
  const card = view.container.querySelector('.value-card')!
  const rect = (top: number, height: number) =>
    ({ top, height, bottom: top + height }) as DOMRect
  vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(rect(100, 240))
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(rect(200, 350))
  vi.spyOn(form, 'getBoundingClientRect').mockReturnValue(rect(300, 150))
  const scrollWindow = vi.spyOn(window, 'scrollTo')
  screen.getByRole('textbox', { name: 'Вес' }).focus()
  viewport.dispatchEvent(new Event('resize'))
  await flush()
  expect(scroller.scrollTop).toBe(122)
  expect(scrollWindow).not.toHaveBeenCalled()
})
