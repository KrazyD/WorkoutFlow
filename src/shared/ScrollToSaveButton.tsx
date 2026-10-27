import { useEffect, useState, type RefObject } from 'react'

export function ScrollToSaveButton({
  target,
}: {
  readonly target: RefObject<HTMLButtonElement | null>
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const element = target.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setVisible(!entry.isIntersecting)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [target])
  return visible ? (
    <button
      type="button"
      aria-label="Прокрутить к сохранению"
      className="scroll-to-save rounded-full border border-lime-300 bg-slate-900 text-2xl text-lime-300 shadow-xl"
      onClick={() =>
        target.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    >
      ↓
    </button>
  ) : null
}
