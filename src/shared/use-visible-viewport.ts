import { useEffect } from 'react'

/** One visual-viewport owner for the root and all overlays inside it. */
export function useVisibleViewport() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    let frame: number | undefined

    const update = () => {
      frame = undefined
      // Keep browser zoom accessible: do not reflow around a magnified viewport.
      if (viewport.scale !== 1 || viewport.height <= 0) return
      const style = document.documentElement.style
      style.setProperty('--visible-viewport-height', `${viewport.height}px`)
      style.setProperty('--visible-viewport-top', `${viewport.offsetTop}px`)
      const focusedField = document.activeElement?.matches(
        "input:not([type='checkbox']):not([type='file']), textarea, select",
      )
      // Focus can remain on iOS after the system keyboard is dismissed. Geometry
      // must release the dock even when no blur event follows dismissal.
      document.documentElement.dataset.keyboardOpen = String(
        Boolean(focusedField) && viewport.height < window.innerHeight - 1,
      )
      revealFocusedControl()
    }
    const schedule = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(update)
    }
    update()
    viewport.addEventListener('resize', schedule)
    viewport.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('pageshow', schedule)
    document.addEventListener('visibilitychange', schedule)
    document.addEventListener('focusin', schedule)
    document.addEventListener('focusout', schedule)
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', schedule)
      viewport.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('pageshow', schedule)
      document.removeEventListener('visibilitychange', schedule)
      document.removeEventListener('focusin', schedule)
      document.removeEventListener('focusout', schedule)
      const style = document.documentElement.style
      style.removeProperty('--visible-viewport-height')
      style.removeProperty('--visible-viewport-top')
      delete document.documentElement.dataset.keyboardOpen
    }
  }, [])
}

function revealFocusedControl() {
  const control = document.activeElement
  if (
    !(control instanceof HTMLElement) ||
    !control.matches('input, textarea, select')
  )
    return
  const scroller = control.closest<HTMLElement>(
    '.sheet-content, .session-content, .page-content',
  )
  if (!scroller) return
  const bounds = scroller.getBoundingClientRect()
  // Keep Save visible with the field whenever the complete numeric form fits.
  const card = control.closest('.value-card')?.getBoundingClientRect()
  const form = control.closest('form')?.getBoundingClientRect()
  const target =
    card && card.height <= bounds.height - 24
      ? card
      : form && form.height <= bounds.height - 24
        ? form
        : control.getBoundingClientRect()
  const delta =
    target.bottom > bounds.bottom - 12
      ? target.bottom - bounds.bottom + 12
      : target.top < bounds.top + 12
        ? target.top - bounds.top - 12
        : 0
  if (delta) scroller.scrollTop += delta
}
