import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

interface DragTarget {
  readonly group: string
  readonly id: string
}
interface Gesture extends DragTarget {
  readonly pointerId: number
  readonly startY: number
  y: number
  active: boolean
  lastTarget?: string
  readonly scroller: HTMLElement
  readonly row: HTMLElement
  readonly startTop: number
  offset: number
}

const activationDistance = 5

function rowsInGroup(current: Gesture) {
  return [
    ...current.scroller.querySelectorAll<HTMLElement>('[data-order-id]'),
  ].filter((row) => row.dataset.orderGroup === current.group)
}

function followPointer(current: Gesture) {
  const layoutTop = current.row.getBoundingClientRect().top - current.offset
  current.offset = current.startTop + current.y - current.startY - layoutTop
  current.row.style.transform = `translate3d(0, ${current.offset}px, 0)`
}

/** Only handles suppress touch scrolling. A distance threshold activates both
 * mouse and touch dragging; one frame loop owns positioning and edge scrolling.
 */
export function useOrderDrag(
  onMove: (group: string, id: string, target: string) => void,
) {
  const [dragging, setDragging] = useState<DragTarget | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const keyboardFrame = useRef(0)
  const animations = useRef(new Map<HTMLElement, Animation>())
  const pendingPositions = useRef<Map<HTMLElement, number> | null>(null)
  const move = useRef(onMove)
  useEffect(() => {
    move.current = onMove
  }, [onMove])

  const animateOffset = (row: HTMLElement, offset: number) => {
    animations.current.get(row)?.cancel()
    animations.current.delete(row)
    if (
      !offset ||
      !row.animate ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return
    const animation = row.animate(
      [
        { transform: `translate3d(0, ${offset}px, 0)` },
        { transform: 'translate3d(0, 0, 0)' },
      ],
      { duration: 180, easing: 'ease-out' },
    )
    animations.current.set(row, animation)
    animation.onfinish = () => {
      if (animations.current.get(row) === animation)
        animations.current.delete(row)
    }
  }

  // React only renders at activation, group crossings and release. Compensate
  // for the new DOM order before paint, keeping the active row under the finger.
  useLayoutEffect(() => {
    const positions = pendingPositions.current
    pendingPositions.current = null
    if (positions) {
      for (const row of positions.keys()) {
        animations.current.get(row)?.cancel()
        animations.current.delete(row)
      }
      for (const [row, top] of positions) {
        if (row !== gesture.current?.row && row.isConnected)
          animateOffset(row, top - row.getBoundingClientRect().top)
      }
    }
    if (gesture.current?.active) followPointer(gesture.current)
  })

  useEffect(() => {
    let frame = 0
    const activeAnimations = animations.current
    const finish = () => {
      const current = gesture.current
      gesture.current = null
      pendingPositions.current = null
      cancelAnimationFrame(frame)
      cancelAnimationFrame(keyboardFrame.current)
      if (current) {
        current.row.style.removeProperty('transform')
        if (current.active && current.row.isConnected)
          animateOffset(current.row, current.offset)
        if (current.scroller.hasPointerCapture?.(current.pointerId))
          current.scroller.releasePointerCapture(current.pointerId)
      }
      setDragging(null)
    }
    const tick = () => {
      const current = gesture.current
      if (!current?.active) return
      const { top, bottom } = current.scroller.getBoundingClientRect()
      const edge = 64
      const speed =
        current.y < top + edge
          ? -Math.min(14, (top + edge - current.y) / 4)
          : current.y > bottom - edge
            ? Math.min(14, (current.y - bottom + edge) / 4)
            : 0
      current.scroller.scrollTop += speed
      followPointer(current)
      const rows = rowsInGroup(current)
      const activeIndex = rows.findIndex(
        (row) => row.dataset.orderId === current.id,
      )
      const target = rows.find((row, index) => {
        const rect = row.getBoundingClientRect()
        // Hit-test layout positions, not a sibling's in-flight animation.
        const transform = animations.current.has(row)
          ? new DOMMatrixReadOnly(getComputedStyle(row).transform).m42
          : 0
        const top = rect.top - transform
        const midpoint = top + rect.height / 2
        return (
          index !== activeIndex &&
          current.y >= top &&
          current.y <= top + rect.height &&
          (index > activeIndex ? current.y > midpoint : current.y < midpoint)
        )
      })
      const targetId = target?.dataset.orderId
      if (targetId && targetId !== current.lastTarget) {
        current.lastTarget = targetId
        pendingPositions.current = new Map(
          rows.map((row) => [row, row.getBoundingClientRect().top]),
        )
        move.current(current.group, current.id, targetId)
      } else if (!targetId) current.lastTarget = undefined
      frame = requestAnimationFrame(tick)
    }
    const pointerMove = (event: PointerEvent) => {
      const current = gesture.current
      if (!current || event.pointerId !== current.pointerId) return
      current.y = event.clientY
      if (
        !current.active &&
        Math.abs(current.y - current.startY) >= activationDistance
      ) {
        current.active = true
        setDragging({ group: current.group, id: current.id })
        frame = requestAnimationFrame(tick)
      }
      if (current.active) event.preventDefault()
    }
    const pointerEnd = (event: PointerEvent) => {
      if (event.pointerId === gesture.current?.pointerId) finish()
    }
    const visibilityChanged = () => {
      if (document.hidden) finish()
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    window.addEventListener('pagehide', finish)
    window.addEventListener('pointermove', pointerMove, { passive: false })
    window.addEventListener('pointerup', pointerEnd)
    window.addEventListener('pointercancel', pointerEnd)
    window.addEventListener('lostpointercapture', pointerEnd)
    window.addEventListener('blur', finish)
    window.addEventListener('resize', finish)
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
    }
    window.addEventListener('keydown', keyDown)
    return () => {
      finish()
      for (const animation of activeAnimations.values()) animation.cancel()
      activeAnimations.clear()
      document.removeEventListener('visibilitychange', visibilityChanged)
      window.removeEventListener('pagehide', finish)
      window.removeEventListener('pointermove', pointerMove)
      window.removeEventListener('pointerup', pointerEnd)
      window.removeEventListener('pointercancel', pointerEnd)
      window.removeEventListener('lostpointercapture', pointerEnd)
      window.removeEventListener('blur', finish)
      window.removeEventListener('resize', finish)
      window.removeEventListener('keydown', keyDown)
    }
  }, [])

  const start = (
    event: ReactPointerEvent<HTMLButtonElement>,
    group: string,
    id: string,
  ) => {
    if (
      event.currentTarget.disabled ||
      !event.isPrimary ||
      event.button !== 0 ||
      gesture.current
    )
      return
    const scroller = event.currentTarget.closest<HTMLElement>('.sheet-content')
    const row = event.currentTarget.closest<HTMLElement>('[data-order-id]')
    if (!scroller || !row) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.focus({ preventScroll: true })
    for (const animation of animations.current.values()) animation.cancel()
    animations.current.clear()
    gesture.current = {
      group,
      id,
      scroller,
      pointerId: event.pointerId,
      startY: event.clientY,
      y: event.clientY,
      active: false,
      row,
      startTop: row.getBoundingClientRect().top,
      offset: 0,
    }
    // Capture on the stable scroller: moving keyed rows can release capture
    // when Safari reparents a handle during a reorder.
    scroller.setPointerCapture?.(event.pointerId)
  }
  const moveWithKeyboard = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    group: string,
    id: string,
    ids: readonly string[],
  ) => {
    if (
      gesture.current ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
    )
      return
    event.preventDefault()
    const index = ids.indexOf(id)
    const target = ids[index + (event.key === 'ArrowUp' ? -1 : 1)]
    if (index < 0 || !target) return
    move.current(group, id, target)
    const handle = event.currentTarget
    cancelAnimationFrame(keyboardFrame.current)
    keyboardFrame.current = requestAnimationFrame(() => {
      if (handle.isConnected) handle.scrollIntoView?.({ block: 'nearest' })
    })
  }
  return { dragging, start, moveWithKeyboard }
}
