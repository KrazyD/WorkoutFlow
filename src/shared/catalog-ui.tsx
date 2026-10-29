import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { NavLink, useLocation } from 'react-router-dom'

interface CatalogPageLayoutProps {
  readonly title: string
  readonly actionLabel?: string
  readonly onAction?: () => void
  readonly isEditing?: boolean
  readonly children: ReactNode
}

function NavigationIcon({
  kind,
}: {
  readonly kind: 'workouts' | 'builder' | 'settings'
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'workouts' ? (
        <>
          <path d="m6 6 12 12M4 8l4-4M2 6l4-4m10 18 4-4m-2 6 4-4M5 11l6-6m2 14 6-6" />
        </>
      ) : kind === 'builder' ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <path d="M17.5 14v7M14 17.5h7" />
        </>
      ) : (
        <>
          {/* Six identical teeth around the same center as the hub. */}
          <path d="M9.435 4.952L10.350 2.644L13.650 2.644L14.565 4.952L16.821 6.255L19.277 5.894L20.927 8.751L19.386 10.698L19.386 13.302L20.927 15.249L19.277 18.106L16.821 17.745L14.565 19.048L13.650 21.356L10.350 21.356L9.435 19.048L7.179 17.745L4.723 18.106L3.073 15.249L4.614 13.302L4.614 10.698L3.073 8.751L4.723 5.894L7.179 6.255Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  )
}

const NavigationHostContext = createContext(false)

/** Keep the dock and its expanding labels mounted across catalog routes. */
export function CatalogNavigationHost({
  children,
}: {
  readonly children: ReactNode
}) {
  const { pathname } = useLocation()
  const catalog = [
    '/workouts',
    '/exercises',
    '/rest-presets',
    '/settings/data',
  ].includes(pathname.replace(/\/+$/, ''))
  return (
    <NavigationHostContext value={true}>
      <div className="application-frame">
        {children}
        {catalog ? (
          <div className="navigation-layer">
            <BottomNavigation />
          </div>
        ) : null}
      </div>
    </NavigationHostContext>
  )
}

function BottomNavigation() {
  const { pathname } = useLocation()
  const builder = pathname === '/exercises' || pathname === '/rest-presets'
  const items = [
    {
      kind: 'workouts',
      href: '/workouts',
      label: 'Тренировки',
      active: pathname === '/workouts',
    },
    {
      kind: 'builder',
      href: builder ? pathname : '/exercises',
      label: 'Конструктор',
      active: builder,
    },
    {
      kind: 'settings',
      href: '/settings/data',
      label: 'Настройки',
      active: pathname.startsWith('/settings'),
    },
  ] as const
  return (
    <nav aria-label="Разделы" className="bottom-navigation glass-panel">
      {items.map((item) => (
        <NavLink
          key={item.kind}
          to={item.href}
          aria-label={item.label}
          aria-current={item.active ? 'page' : undefined}
          className={`navigation-item ${item.active ? 'is-active' : ''}`}
        >
          <NavigationIcon kind={item.kind} />
          <span className="navigation-label" aria-hidden="true">
            {item.label}
          </span>
        </NavLink>
      ))}
    </nav>
  )
}

export function CatalogPageLayout({
  title,
  actionLabel,
  onAction,
  isEditing,
  children,
}: CatalogPageLayoutProps) {
  const hostedNavigation = useContext(NavigationHostContext)
  const { pathname } = useLocation()
  const builder = pathname === '/exercises' || pathname === '/rest-presets'
  const scrollArea = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isEditing)
      scrollArea.current?.scrollTo?.({ top: 0, behavior: 'instant' })
  }, [isEditing])
  return (
    <main className="app-shell text-slate-50">
      <header className="page-header">
        <p className="brand">Workout Flow</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {builder ? 'Конструктор' : title}
        </h1>
        {builder ? (
          <nav aria-label="Справочники" className="segmented-control">
            <NavLink to="/exercises">Упражнения</NavLink>
            <NavLink to="/rest-presets">Отдых</NavLink>
          </nav>
        ) : null}
      </header>
      <div ref={scrollArea} className="page-content">
        {children}
      </div>
      {onAction && !isEditing ? (
        <button
          type="button"
          onClick={onAction}
          aria-label={actionLabel}
          className="add-button"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      ) : null}
      {!hostedNavigation ? <BottomNavigation /> : null}
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
