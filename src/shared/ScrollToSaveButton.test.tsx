import { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ScrollToSaveButton } from './ScrollToSaveButton'

afterEach(() => vi.unstubAllGlobals())

it('observes Save, scrolls smoothly when hidden, disappears when visible and disconnects', () => {
  let notify: IntersectionObserverCallback = () => undefined
  const observe = vi.fn()
  const disconnect = vi.fn()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback
      }
      observe = observe
      disconnect = disconnect
    },
  )
  const target = createRef<HTMLButtonElement>()
  const { unmount } = render(
    <>
      <button ref={target}>Сохранить</button>
      <ScrollToSaveButton target={target} />
    </>,
  )
  const scroll = vi.fn()
  target.current!.scrollIntoView = scroll
  expect(observe).toHaveBeenCalledWith(target.current)
  expect(
    screen.queryByRole('button', { name: 'Прокрутить к сохранению' }),
  ).not.toBeInTheDocument()
  act(() =>
    notify(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  )
  const arrow = screen.getByRole('button', { name: 'Прокрутить к сохранению' })
  expect(arrow).toHaveAttribute('type', 'button')
  fireEvent.click(arrow)
  expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  act(() =>
    notify(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  )
  expect(
    screen.queryByRole('button', { name: 'Прокрутить к сохранению' }),
  ).not.toBeInTheDocument()
  unmount()
  expect(disconnect).toHaveBeenCalledOnce()
})
