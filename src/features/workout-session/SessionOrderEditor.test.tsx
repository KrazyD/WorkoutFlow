import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveWorkoutTemplate } from '../../domain/resolve-workout-template'
import {
  createActiveWorkoutSession,
  startWorkout,
  type OperationResult,
} from '../../domain/workout-session'
import { SessionOrderEditor } from './SessionOrderEditor'

const value = <T,>(result: OperationResult<T>) => {
  if (!result.success) throw new Error(result.error.code)
  return result.value
}
function setup() {
  const resolved = resolveWorkoutTemplate(
    {
      id: 't',
      name: 'Тест',
      steps: [
        { id: 'a', type: 'exercise', exerciseId: 'a' },
        {
          id: 'b',
          type: 'superset',
          series: [
            { id: 'sb', type: 'exercise', exerciseId: 'b', setCount: 3 },
            { id: 'sc', type: 'exercise', exerciseId: 'c', setCount: 2 },
          ],
        },
        { id: 'd', type: 'exercise', exerciseId: 'd' },
      ],
    },
    ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id })),
    [],
  )!
  const session = value(
    startWorkout(value(createActiveWorkoutSession(resolved)), 100),
  )
  const onApply = vi.fn()
  const onClose = vi.fn()
  const view = render(
    <SessionOrderEditor
      session={session}
      busy={false}
      onApply={onApply}
      onClose={onClose}
    />,
  )
  return { ...view, onApply, onClose, session }
}
function pointer(
  target: Element | Window,
  type: string,
  y: number,
  properties: Partial<PointerEvent> = {},
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries({
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientY: y,
    ...properties,
  }))
    Object.defineProperty(event, key, { value })
  fireEvent(target, event)
  return event
}
function mockRows(list: HTMLElement, startTop: number) {
  const rows = [...list.children] as HTMLElement[]
  for (const row of rows)
    vi.spyOn(row, 'getBoundingClientRect').mockImplementation(() => {
      const offset = Number(
        row.style.transform.match(/, ([-\d.]+)px/)?.[1] ?? 0,
      )
      const top = startTop + [...list.children].indexOf(row) * 100 + offset
      return { top, bottom: top + 100, height: 100 } as DOMRect
    })
  return rows
}
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('session order draft editor', () => {
  it('distinguishes block and member handles and removes the hold instruction', () => {
    setup()
    expect(
      screen.getByText('Потяните за значок, чтобы изменить порядок.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Удерживайте/)).not.toBeInTheDocument()
    const block = screen.getByRole('button', { name: 'Перетащить: b + c' })
    const member = screen.getByRole('button', { name: 'Перетащить: b' })
    expect(block.querySelector('svg')).toHaveAttribute(
      'data-icon',
      'move-vertical',
    )
    expect(block.querySelector('svg')).toHaveAttribute('stroke-width', '2.5')
    expect(member.querySelector('svg')).toHaveAttribute(
      'data-icon',
      'grip-vertical',
    )
    expect(fireEvent.contextMenu(block)).toBe(false)
    expect(fireEvent.dragStart(member)).toBe(false)
  })

  it('supports keyboard moves through handles before Apply and locks the current block', () => {
    const { onApply } = setup()
    expect(screen.getByRole('button', { name: 'Перетащить: a' })).toBeDisabled()
    expect(screen.getByText(/Закреплён/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^(Выше|Ниже):/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Перетащить: c' }),
    ).toHaveAccessibleDescription(/С клавиатуры/)
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Перетащить: b + c' }),
      { key: 'ArrowDown' },
    )
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Перетащить: b + c' }),
      { key: 'ArrowUp' },
    )
    fireEvent.keyDown(screen.getByRole('button', { name: 'Перетащить: c' }), {
      key: 'ArrowUp',
    })
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Применить' }))
    expect(onApply).toHaveBeenCalledWith({
      blocks: [
        { id: 'a', seriesIds: ['a'] },
        { id: 'b', seriesIds: ['sc', 'sb'] },
        { id: 'd', seriesIds: ['d'] },
      ],
    })
  })

  it('activates at 5px without waiting, follows the pointer, reorders a superset and scrolls at both edges', () => {
    vi.useFakeTimers()
    const { onApply } = setup()
    const scroller = document.querySelector<HTMLElement>('.sheet-content')!
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 500,
      height: 400,
    } as DOMRect)
    const blockList = screen.getByRole('list', { name: 'Оставшиеся блоки' })
    mockRows(blockList, 20)
    const grip = screen.getByRole('button', { name: 'Перетащить: b + c' })
    const row = grip.closest<HTMLElement>('[data-order-id]')!
    pointer(grip, 'pointerdown', 150)
    pointer(window, 'pointermove', 154)
    expect(document.querySelector('.is-dragging')).toBeNull()
    expect(pointer(window, 'pointermove', 155).defaultPrevented).toBe(true)
    expect(row).toHaveClass('is-dragging')
    expect(row.style.transform).toBe('translate3d(0, 5px, 0)')
    pointer(window, 'pointermove', 160)
    act(() => vi.advanceTimersByTime(20))
    expect(row.style.transform).toBe('translate3d(0, 10px, 0)')
    act(() => vi.advanceTimersByTime(20))
    expect(row.style.transform).toBe('translate3d(0, 10px, 0)')
    pointer(window, 'pointermove', 300)
    act(() => vi.advanceTimersByTime(20))
    expect(
      within(blockList)
        .getAllByRole('heading')
        .map((h) => h.textContent),
    ).toEqual(['a', 'd', 'b + c'])
    expect(row.getBoundingClientRect().top).toBe(270)
    pointer(window, 'pointermove', 490)
    act(() => vi.advanceTimersByTime(50))
    expect(scroller.scrollTop).toBeGreaterThan(0)
    const lowerScrollTop = scroller.scrollTop
    pointer(window, 'pointermove', 110)
    act(() => vi.advanceTimersByTime(20))
    expect(scroller.scrollTop).toBeLessThan(lowerScrollTop)
    expect(screen.getByRole('button', { name: 'Применить' })).toBeDisabled()
    pointer(window, 'pointerup', 490)
    expect(document.querySelector('.is-dragging')).toBeNull()
    expect(row.style.transform).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Применить' }))
    expect(
      onApply.mock.calls[0][0].blocks.map((b: { id: string }) => b.id),
    ).toEqual(['a', 'd', 'b'])
  })

  it('keeps keyboard moves within their group and respects the pinned boundary', () => {
    const { onApply } = setup()
    const block = screen.getByRole('button', { name: 'Перетащить: b + c' })
    const member = screen.getByRole('button', { name: 'Перетащить: b' })
    fireEvent.keyDown(block, { key: 'ArrowUp' })
    fireEvent.keyDown(member, { key: 'ArrowUp' })
    fireEvent.keyDown(member, { key: 'ArrowDown', altKey: true })
    fireEvent.keyDown(block, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Применить' }))
    expect(onApply).toHaveBeenCalledWith({
      blocks: [
        { id: 'a', seriesIds: ['a'] },
        { id: 'b', seriesIds: ['sb', 'sc'] },
        { id: 'd', seriesIds: ['d'] },
      ],
    })
  })

  it('moves a standalone series with the mouse and leaves the pinned block in place', () => {
    vi.useFakeTimers()
    const { onApply } = setup()
    const blockList = screen.getByRole('list', { name: 'Оставшиеся блоки' })
    mockRows(blockList, 20)
    const grip = screen.getByRole('button', { name: 'Перетащить: d' })
    pointer(grip, 'pointerdown', 250, { pointerType: 'mouse' })
    expect(document.querySelector('.is-dragging')).toBeNull()
    pointer(window, 'pointermove', 140, { pointerType: 'mouse' })
    expect(document.querySelector('.is-dragging')).toHaveAttribute(
      'data-order-id',
      'd',
    )
    act(() => vi.advanceTimersByTime(20))
    pointer(window, 'pointermove', 50, { pointerType: 'mouse' })
    act(() => vi.advanceTimersByTime(20))
    pointer(window, 'pointerup', 50, { pointerType: 'mouse' })
    fireEvent.click(screen.getByRole('button', { name: 'Применить' }))
    expect(onApply).toHaveBeenCalledWith({
      blocks: [
        { id: 'a', seriesIds: ['a'] },
        { id: 'd', seriesIds: ['d'] },
        { id: 'b', seriesIds: ['sb', 'sc'] },
      ],
    })
  })

  it.each([false, true])(
    'animates group crossings and release unless reduced motion is %s',
    (reducedMotion) => {
      vi.useFakeTimers()
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: reducedMotion })),
      )
      const { unmount } = setup()
      const list = screen.getByRole('list', { name: 'Оставшиеся блоки' })
      const [, active, sibling] = mockRows(list, 20)
      const cancel = vi.fn()
      const animate = vi.fn(() => ({ cancel }) as unknown as Animation)
      active.animate = animate
      sibling.animate = animate
      pointer(
        screen.getByRole('button', { name: 'Перетащить: b + c' }),
        'pointerdown',
        150,
      )
      pointer(window, 'pointermove', 300)
      act(() => vi.advanceTimersByTime(20))
      expect(active.getBoundingClientRect().top).toBe(270)
      pointer(window, 'pointerup', 300)
      if (reducedMotion) expect(animate).not.toHaveBeenCalled()
      else {
        expect(animate).toHaveBeenCalledWith(
          [
            { transform: 'translate3d(0, 100px, 0)' },
            { transform: 'translate3d(0, 0, 0)' },
          ],
          { duration: 180, easing: 'ease-out' },
        )
        expect(animate).toHaveBeenCalledWith(
          [
            { transform: 'translate3d(0, 50px, 0)' },
            { transform: 'translate3d(0, 0, 0)' },
          ],
          { duration: 180, easing: 'ease-out' },
        )
      }
      unmount()
      expect(cancel).toHaveBeenCalledTimes(reducedMotion ? 0 : 2)
    },
  )

  it('does not start dragging from row content during an ordinary touch scroll', () => {
    vi.useFakeTimers()
    setup()
    pointer(screen.getByRole('heading', { name: 'b + c' }), 'pointerdown', 150)
    pointer(window, 'pointermove', 80)
    act(() => vi.advanceTimersByTime(400))
    expect(document.querySelector('.is-dragging')).toBeNull()
    expect(screen.getByRole('button', { name: 'Применить' })).toBeEnabled()
  })

  it('ignores locked handles, non-primary touches, secondary mouse buttons and busy controls', () => {
    const { rerender, session, onApply, onClose } = setup()
    pointer(
      screen.getByRole('button', { name: 'Перетащить: a' }),
      'pointerdown',
      150,
    )
    pointer(window, 'pointermove', 180)
    expect(document.querySelector('.is-dragging')).toBeNull()
    const grip = screen.getByRole('button', { name: 'Перетащить: b + c' })
    pointer(grip, 'pointerdown', 150, { isPrimary: false })
    pointer(window, 'pointermove', 180)
    expect(document.querySelector('.is-dragging')).toBeNull()
    pointer(grip, 'pointerdown', 150, { button: 2, pointerType: 'mouse' })
    pointer(window, 'pointermove', 180)
    expect(document.querySelector('.is-dragging')).toBeNull()
    rerender(
      <SessionOrderEditor
        session={session}
        busy
        onApply={onApply}
        onClose={onClose}
      />,
    )
    pointer(grip, 'pointerdown', 150)
    pointer(window, 'pointermove', 180)
    expect(document.querySelector('.is-dragging')).toBeNull()
  })

  it('does not activate on a tap, a stationary hold or movement below the threshold', () => {
    vi.useFakeTimers()
    const { onApply } = setup()
    const grip = screen.getByRole('button', { name: 'Перетащить: b + c' })
    pointer(grip, 'pointerdown', 150)
    pointer(window, 'pointerup', 150)
    act(() => vi.advanceTimersByTime(400))
    expect(document.querySelector('.is-dragging')).toBeNull()
    pointer(grip, 'pointerdown', 150)
    act(() => vi.advanceTimersByTime(1000))
    expect(document.querySelector('.is-dragging')).toBeNull()
    pointer(window, 'pointermove', 154)
    pointer(window, 'pointerup', 154)
    expect(document.querySelector('.is-dragging')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Применить' }))
    expect(onApply).toHaveBeenCalledWith({
      blocks: [
        { id: 'a', seriesIds: ['a'] },
        { id: 'b', seriesIds: ['sb', 'sc'] },
        { id: 'd', seriesIds: ['d'] },
      ],
    })
  })

  it.each([
    'pointercancel',
    'lostpointercapture',
    'blur',
    'pagehide',
    'resize',
    'Escape',
    'hidden',
  ])(
    'cleans up an interrupted gesture on %s and accepts a new gesture',
    (interruption) => {
      vi.useFakeTimers()
      setup()
      const grip = screen.getByRole('button', { name: 'Перетащить: b + c' })
      pointer(grip, 'pointerdown', 150)
      pointer(window, 'pointermove', 156)
      expect(document.querySelector('.is-dragging')).not.toBeNull()
      if (interruption === 'Escape')
        fireEvent.keyDown(window, { key: 'Escape' })
      else if (interruption === 'hidden') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
        fireEvent(document, new Event('visibilitychange'))
      } else pointer(window, interruption, 156)
      expect(document.querySelector('.is-dragging')).toBeNull()
      expect(screen.getByRole('button', { name: 'Применить' })).toBeEnabled()
      act(() => vi.advanceTimersByTime(500))
      expect(vi.getTimerCount()).toBe(0)
      pointer(grip, 'pointerdown', 150)
      pointer(window, 'pointermove', 144)
      expect(document.querySelector('.is-dragging')).not.toBeNull()
      pointer(window, 'pointerup', 144)
    },
  )

  it('captures on the stable scroller, ignores other pointers and releases on cancellation and unmount', () => {
    vi.useFakeTimers()
    const { unmount } = setup()
    const scroller = document.querySelector<HTMLElement>('.sheet-content')!
    scroller.setPointerCapture = vi.fn()
    scroller.hasPointerCapture = vi.fn(() => true)
    scroller.releasePointerCapture = vi.fn()
    const grip = screen.getByRole('button', { name: 'Перетащить: b + c' })
    pointer(grip, 'pointerdown', 150)
    expect(scroller.setPointerCapture).toHaveBeenCalledWith(1)
    pointer(window, 'pointermove', 180, { pointerId: 2 })
    expect(document.querySelector('.is-dragging')).toBeNull()
    pointer(window, 'pointercancel', 150, { pointerId: 2 })
    pointer(window, 'pointermove', 156)
    expect(document.querySelector('.is-dragging')).not.toBeNull()
    pointer(window, 'pointercancel', 150)
    expect(document.querySelector('.is-dragging')).toBeNull()
    expect(scroller.releasePointerCapture).toHaveBeenCalledWith(1)
    pointer(grip, 'pointerdown', 150)
    pointer(window, 'pointermove', 156)
    unmount()
    act(() => vi.advanceTimersByTime(500))
    expect(vi.getTimerCount()).toBe(0)
    expect(scroller.releasePointerCapture).toHaveBeenCalledTimes(2)
  })
})

it('drags an individual series within its superset without moving the whole block', () => {
  vi.useFakeTimers()
  const { onApply } = setup()
  const scroller = document.querySelector<HTMLElement>('.sheet-content')!
  vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 500,
    height: 500,
  } as DOMRect)
  const seriesList = screen.getByRole('list', { name: 'Упражнения: b + c' })
  mockRows(seriesList, 100)
  pointer(
    screen.getByRole('button', { name: 'Перетащить: b' }),
    'pointerdown',
    150,
  )
  pointer(window, 'pointermove', 280)
  expect(document.querySelectorAll('.is-dragging')).toHaveLength(1)
  expect(document.querySelector('.order-block.is-dragging')).toBeNull()
  act(() => vi.advanceTimersByTime(20))
  pointer(window, 'pointerup', 280)
  fireEvent.click(screen.getByRole('button', { name: 'Применить' }))
  expect(onApply).toHaveBeenCalledWith({
    blocks: [
      { id: 'a', seriesIds: ['a'] },
      { id: 'b', seriesIds: ['sc', 'sb'] },
      { id: 'd', seriesIds: ['d'] },
    ],
  })
})
