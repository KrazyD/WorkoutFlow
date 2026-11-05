import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function BottomSheet({
  title,
  onClose,
  busy = false,
  children,
  fullScreen = false,
  footer,
}: {
  readonly title: string
  readonly onClose: () => void
  readonly busy?: boolean
  readonly children: ReactNode
  readonly fullScreen?: boolean
  readonly footer?: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  useLayoutEffect(() => {
    const previous = document.activeElement
    const element = dialog.current!
    if (element.showModal) element.showModal()
    else element.setAttribute('open', '')
    heading.current?.focus({ preventScroll: true })
    return () => {
      element.close?.()
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true })
    }
  }, [])
  return createPortal(
    <dialog
      ref={dialog}
      className={`bottom-sheet${fullScreen ? ' fullscreen-sheet' : ''}`}
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section className="sheet-panel glass-panel">
        <header className="sheet-header">
          <h2
            ref={heading}
            tabIndex={-1}
            id={titleId}
            className="text-xl font-bold"
          >
            {title}
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Закрыть панель"
            className="sheet-close"
          >
            ✕
          </button>
        </header>
        <div className="sheet-content">{children}</div>
        {footer}
      </section>
    </dialog>,
    document.getElementById('root') ?? document.body,
  )
}
