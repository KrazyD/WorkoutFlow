import { useEffect } from 'react'

/** iOS keyboards resize the visual viewport without always changing dvh. */
export function useVisibleViewport() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => {
      document.documentElement.style.setProperty(
        '--visible-viewport-height',
        `${viewport.height}px`,
      )
    }
    update()
    viewport.addEventListener('resize', update)
    return () => {
      viewport.removeEventListener('resize', update)
      document.documentElement.style.removeProperty('--visible-viewport-height')
    }
  }, [])
}
