import { useSyncExternalStore } from 'react'
import { RepositoryErrorAlert } from '../../shared/catalog-ui'
import type { PwaController } from './pwa-controller'

export function PwaNotifications({
  controller,
}: {
  readonly controller: PwaController
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  )
  if (
    state.dismissed ||
    (!state.pending && !state.offlineReady && !state.error)
  )
    return null

  return (
    <aside
      aria-label="Обновления приложения"
      className="border-b border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-50"
    >
      <div className="mx-auto max-w-xl">
        {state.error ? <RepositoryErrorAlert message={state.error} /> : null}
        <p role="status">
          {state.pending
            ? state.blocked
              ? 'Доступно обновление. Его можно установить после завершения тренировки.'
              : 'Доступна новая версия Workout Flow'
            : state.offlineReady
              ? 'Workout Flow готов к работе без интернета.'
              : null}
        </p>
        <div className="mt-2 flex gap-3">
          {state.pending && !state.blocked ? (
            <button
              type="button"
              disabled={state.updating}
              onClick={() => void controller.update()}
              className="min-h-11 rounded-xl bg-lime-300 px-4 font-semibold text-slate-950 disabled:opacity-50"
            >
              {state.updating ? 'Обновление…' : 'Обновить'}
            </button>
          ) : null}
          <button
            type="button"
            disabled={state.updating}
            onClick={controller.dismiss}
            className="min-h-11 rounded-xl border border-slate-700 px-4 disabled:opacity-50"
          >
            {state.pending ? 'Позже' : 'Понятно'}
          </button>
        </div>
      </div>
    </aside>
  )
}
