import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { RegisterSWOptions } from 'vite-plugin-pwa/types'
import { PwaNotifications } from './PwaNotifications'
import { createPwaController, type PwaState } from './pwa-controller'

it('shows update controls only after a workout ends and preserves Later', () => {
  let state: PwaState = {
    pending: true,
    blocked: true,
    dismissed: false,
    updating: false,
    offlineReady: false,
  }
  const listeners = new Set<() => void>()
  const update = vi.fn()
  const controller = {
    ...createPwaController(
      { isBlocked: async () => true, subscribe: () => () => {} },
      vi.fn(),
    ),
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    update,
    dismiss: () => {
      state = { ...state, dismissed: true }
      listeners.forEach((listener) => listener())
    },
  }
  render(<PwaNotifications controller={controller} />)
  expect(screen.getByRole('status')).toHaveTextContent(
    'после завершения тренировки',
  )
  expect(
    screen.queryByRole('button', { name: 'Обновить' }),
  ).not.toBeInTheDocument()
  act(() => {
    state = { ...state, blocked: false }
    listeners.forEach((listener) => listener())
  })
  expect(screen.getByRole('status')).toHaveTextContent(
    'Доступна новая версия Workout Flow',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
  expect(update).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Позже' }))
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
})

it('renders offline and error notices accessibly', async () => {
  vi.stubGlobal('isSecureContext', true)
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {},
  })
  let callbacks: RegisterSWOptions = {}
  const controller = createPwaController(
    { isBlocked: async () => false, subscribe: () => () => {} },
    vi.fn(),
  )
  try {
    await controller.start(true, async () => ({
      registerSW: (options) => {
        callbacks = options
        return async () => {}
      },
    }))
    render(<PwaNotifications controller={controller} />)
    act(() => callbacks.onOfflineReady?.())
    expect(screen.getByRole('status')).toHaveTextContent(
      'готов к работе без интернета',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }))
    act(() => callbacks.onRegisterError?.(new Error('failed')))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Не удалось подготовить офлайн-режим',
    )
  } finally {
    controller.dispose()
    Reflect.deleteProperty(navigator, 'serviceWorker')
    vi.unstubAllGlobals()
  }
})
