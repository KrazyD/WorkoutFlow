import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RegisterSWOptions } from 'vite-plugin-pwa/types'
import { createPwaController, type WorkoutUpdateGuard } from './pwa-controller'

let callbacks: RegisterSWOptions
let notify: (blocked: boolean) => void
let guard: WorkoutUpdateGuard
const reload = vi.fn()
const updateSW = vi.fn<() => Promise<void>>()
const registerSW = vi.fn((options: RegisterSWOptions) => {
  callbacks = options
  return updateSW
})
const load = vi.fn(async () => ({ registerSW }))
let controller: ReturnType<typeof createPwaController>

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('isSecureContext', true)
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register: vi.fn() },
  })
  guard = {
    isBlocked: vi.fn(async () => false),
    subscribe(listener) {
      notify = listener
      return vi.fn()
    },
  }
  updateSW.mockResolvedValue(undefined)
  load.mockResolvedValue({ registerSW })
  controller = createPwaController(guard, reload)
})
afterEach(() => {
  controller.dispose()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

const start = async () => {
  await controller.start(true, load)
  notify(false)
}

describe('PWA registration and update consent', () => {
  it('registers once with prompt callbacks in a supported production context', async () => {
    await start()
    expect(registerSW).toHaveBeenCalledWith(
      expect.objectContaining({
        immediate: true,
        onNeedRefresh: expect.any(Function),
        onNeedReload: expect.any(Function),
      }),
    )
    expect(updateSW).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it.each(['development', 'insecure', 'unsupported'])(
    'skips registration when %s',
    async (condition) => {
      if (condition === 'insecure') vi.stubGlobal('isSecureContext', false)
      if (condition === 'unsupported')
        Reflect.deleteProperty(navigator, 'serviceWorker')
      await controller.start(condition !== 'development', load)
      expect(load).not.toHaveBeenCalled()
    },
  )

  it('announces offline readiness', async () => {
    await start()
    callbacks.onOfflineReady?.()
    expect(controller.getSnapshot().offlineReady).toBe(true)
    controller.dismiss()
    expect(controller.getSnapshot().offlineReady).toBe(false)
  })

  it('defers updates without activating or reloading', async () => {
    await start()
    callbacks.onNeedRefresh?.()
    controller.dismiss()
    expect(controller.getSnapshot()).toMatchObject({
      pending: true,
      dismissed: true,
    })
    expect(updateSW).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('blocks updates while a workout is active, including off the session route', async () => {
    await start()
    notify(true)
    callbacks.onNeedRefresh?.()
    await controller.update()
    expect(updateSW).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('checks persisted activity again before activation', async () => {
    await start()
    callbacks.onNeedRefresh?.()
    vi.mocked(guard.isBlocked).mockResolvedValue(true)
    await controller.update()
    expect(controller.getSnapshot().blocked).toBe(true)
    expect(updateSW).not.toHaveBeenCalled()
  })

  it('reoffers a deferred update after completion and reloads only with consent', async () => {
    await start()
    notify(true)
    callbacks.onNeedRefresh?.()
    controller.dismiss()
    notify(false)
    expect(controller.getSnapshot().dismissed).toBe(false)
    await controller.update()
    expect(updateSW).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()
    callbacks.onNeedReload?.()
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it('requires fresh confirmation when another tab activated the waiting worker', async () => {
    await start()
    notify(true)
    callbacks.onNeedRefresh?.()
    callbacks.onNeedReload?.()
    expect(reload).not.toHaveBeenCalled()
    notify(false)
    await controller.update()
    expect(reload).toHaveBeenCalledOnce()
    expect(updateSW).not.toHaveBeenCalled()
  })

  it('rechecks activity before reload even after confirmed activation', async () => {
    await start()
    callbacks.onNeedRefresh?.()
    await controller.update()
    vi.mocked(guard.isBlocked).mockResolvedValue(true)
    callbacks.onNeedReload?.()
    await vi.waitFor(() => expect(controller.getSnapshot().blocked).toBe(true))
    expect(reload).not.toHaveBeenCalled()
  })

  it('fails closed when reading workout state fails', async () => {
    await start()
    callbacks.onNeedRefresh?.()
    vi.mocked(guard.isBlocked).mockRejectedValue(new Error('IDB unavailable'))
    await controller.update()
    expect(controller.getSnapshot().error).toBeDefined()
    expect(updateSW).not.toHaveBeenCalled()
  })

  it('reports registration and dynamic import errors without breaking the app', async () => {
    await start()
    callbacks.onRegisterError?.(new Error('registration failed'))
    expect(controller.getSnapshot().error).toContain('офлайн-режим')
    load.mockRejectedValue(new Error('module unavailable'))
    await controller.start(true, load)
    expect(controller.getSnapshot().error).toContain('офлайн-режим')
    expect(reload).not.toHaveBeenCalled()
  })

  it('reports activation failure and allows retry', async () => {
    await start()
    callbacks.onNeedRefresh?.()
    updateSW.mockRejectedValueOnce(new Error('activation failed'))
    await controller.update()
    expect(controller.getSnapshot()).toMatchObject({
      pending: true,
      updating: false,
      error: expect.any(String),
    })
    await controller.update()
    expect(updateSW).toHaveBeenCalledTimes(2)
  })

  it('reports an update that never takes control', async () => {
    vi.useFakeTimers()
    await start()
    callbacks.onNeedRefresh?.()
    await controller.update()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(controller.getSnapshot().error).toContain(
      'Не удалось установить обновление',
    )
    callbacks.onNeedReload?.()
    expect(reload).not.toHaveBeenCalled()
  })

  it('checks for updates on reconnect and foreground, then cleans up', async () => {
    await start()
    const update = vi.fn(async () => undefined)
    callbacks.onRegisteredSW?.('/sw.js', {
      update,
    } as unknown as ServiceWorkerRegistration)
    window.dispatchEvent(new Event('online'))
    expect(update).toHaveBeenCalledOnce()
    controller.dispose()
    window.dispatchEvent(new Event('online'))
    expect(update).toHaveBeenCalledOnce()
  })
})
