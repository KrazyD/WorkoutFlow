import type { ReactNode } from 'react'

interface CatalogPageLayoutProps {
  readonly activePage: 'exercises' | 'rest-presets'
  readonly title: string
  readonly actionLabel: string
  readonly onAction: () => void
  readonly children: ReactNode
}

const navigationItems = [
  { id: 'exercises', href: '/exercises', label: 'Упражнения' },
  { id: 'rest-presets', href: '/rest-presets', label: 'Отдых' },
] as const

export function CatalogPageLayout({
  activePage,
  title,
  actionLabel,
  onAction,
  children,
}: CatalogPageLayoutProps) {
  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-6 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-xl">
        <header className="border-b border-slate-800 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-lime-300 uppercase">
                Workout Flow
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">
                {title}
              </h1>
            </div>
            <button
              type="button"
              onClick={onAction}
              className="min-h-11 shrink-0 rounded-xl bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
            >
              {actionLabel}
            </button>
          </div>

          <nav aria-label="Справочники" className="mt-5 flex gap-2">
            {navigationItems.map((item) => {
              const isActive = item.id === activePage

              return (
                <a
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </a>
              )
            })}
          </nav>
        </header>

        {children}
      </div>
    </main>
  )
}

export function RepositoryErrorAlert({
  message,
}: {
  readonly message: string
}) {
  return (
    <div
      role="alert"
      className="mt-5 rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200"
    >
      {message}
    </div>
  )
}

interface CatalogEmptyStateProps {
  readonly title: string
  readonly description: string
}

export function CatalogEmptyState({
  title,
  description,
}: CatalogEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}

interface DeleteConfirmationProps {
  readonly labelId: string
  readonly message: string
  readonly isBusy: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function DeleteConfirmation({
  labelId,
  message,
  isBusy,
  onConfirm,
  onCancel,
}: DeleteConfirmationProps) {
  return (
    <div
      role="alertdialog"
      aria-labelledby={labelId}
      className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-4"
    >
      <p id={labelId} className="text-sm text-red-100">
        {message}
      </p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isBusy}
          className="min-h-11 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Удалить
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isBusy}
          className="min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}
