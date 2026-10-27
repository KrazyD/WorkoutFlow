import type { RegisterSWOptions } from 'vite-plugin-pwa/types'

export interface WorkoutUpdateGuard {
  isBlocked(): Promise<boolean>
  subscribe(listener: (blocked: boolean) => void): () => void
}

type Register = (options: RegisterSWOptions) => () => Promise<void>
export interface PwaState {
  readonly pending: boolean
  readonly offlineReady: boolean
  readonly blocked: boolean
  readonly dismissed: boolean
  readonly updating: boolean
  readonly error?: string
}

export function createPwaController(
  guard: WorkoutUpdateGuard,
  reload: () => void,
) {
  let state: PwaState = {
    pending: false,
    offlineReady: false,
    blocked: true,
    dismissed: false,
    updating: false,
  }
  const listeners = new Set<() => void>()
  let updateSW: (() => Promise<void>) | undefined
  let registration: ServiceWorkerRegistration | undefined
  let consent = false
  let reloadReady = false
  let timeout: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined
  const patch = (changes: Partial<PwaState>) => {
    state = { ...state, ...changes }
    listeners.forEach((listener) => listener())
  }
  const fail = (message: string) => {
    consent = false
    clearTimeout(timeout)
    patch({ error: message, updating: false, dismissed: false })
  }
  const refresh = () => {
    if (registration && navigator.onLine)
      void registration.update().catch(() => {
        /* Retry on next foreground/online event. */
      })
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') refresh()
  }

  const controller = {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    async start(
      enabled: boolean,
      load: () => Promise<{ registerSW: Register }>,
    ) {
      if (
        !enabled ||
        !window.isSecureContext ||
        !('serviceWorker' in navigator)
      )
        return
      unsubscribe = guard.subscribe((blocked) => {
        const finished = state.blocked && !blocked
        patch({ blocked, ...(finished ? { dismissed: false } : {}) })
      })
      try {
        const { registerSW } = await load()
        updateSW = registerSW({
          immediate: true,
          onNeedRefresh: () => patch({ pending: true, dismissed: false }),
          onOfflineReady: () => patch({ offlineReady: true }),
          onRegisterError: () =>
            fail(
              'Не удалось подготовить офлайн-режим. Попробуйте открыть приложение онлайн ещё раз.',
            ),
          onRegisteredSW: (_url, value) => {
            registration = value
          },
          onNeedReload: () => {
            // Even an external controller change must never grant reload consent.
            reloadReady = true
            if (!consent) {
              patch({ pending: true, dismissed: false })
              return
            }
            void guard
              .isBlocked()
              .then((blocked) => {
                if (!consent) return
                clearTimeout(timeout)
                consent = false
                patch({ blocked, updating: false })
                if (!blocked) reload()
              })
              .catch(() =>
                fail(
                  'Не удалось проверить состояние тренировки. Обновление отложено.',
                ),
              )
          },
        })
        window.addEventListener('online', refresh)
        document.addEventListener('visibilitychange', onVisible)
      } catch {
        fail(
          'Не удалось подготовить офлайн-режим. Попробуйте открыть приложение онлайн ещё раз.',
        )
      }
    },
    dismiss() {
      patch({ dismissed: true, offlineReady: false, error: undefined })
    },
    async update() {
      if (!updateSW || !state.pending || state.blocked || state.updating) return
      patch({ updating: true, error: undefined })
      try {
        const blocked = await guard.isBlocked()
        patch({ blocked })
        if (blocked) {
          patch({ updating: false })
          return
        }
        consent = true
        if (reloadReady) {
          consent = false
          reload()
          return
        }
        timeout = setTimeout(
          () =>
            fail(
              'Не удалось установить обновление. Попробуйте ещё раз при подключении к интернету.',
            ),
          15_000,
        )
        await updateSW()
      } catch {
        fail(
          'Не удалось установить обновление. Попробуйте ещё раз при подключении к интернету.',
        )
      }
    },
    dispose() {
      unsubscribe?.()
      clearTimeout(timeout)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    },
  }
  return controller
}

export type PwaController = ReturnType<typeof createPwaController>
