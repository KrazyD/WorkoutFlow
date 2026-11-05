import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'

it('uses a named modal, focuses its heading without opening a keyboard, closes on Escape and restores focus', () => {
  const onClose = vi.fn()
  const previous = document.createElement('button')
  document.body.append(previous)
  previous.focus()
  const view = render(
    <BottomSheet title="Выбор" onClose={onClose}>
      <input aria-label="Поиск" />
    </BottomSheet>,
  )
  const dialog = screen.getByRole('dialog', { name: 'Выбор' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(within(dialog).getByRole('heading')).toHaveFocus()
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(onClose).toHaveBeenCalledOnce()
  view.unmount()
  expect(previous).toHaveFocus()
  previous.remove()
})

it('blocks dismissal during persistence', () => {
  const onClose = vi.fn()
  render(
    <BottomSheet title="Выбор" onClose={onClose} busy>
      <p>Сохранение</p>
    </BottomSheet>,
  )
  fireEvent(
    screen.getByRole('dialog'),
    new Event('cancel', { cancelable: true }),
  )
  fireEvent.click(screen.getByRole('dialog'))
  expect(screen.getByRole('button', { name: 'Закрыть панель' })).toBeDisabled()
  expect(onClose).not.toHaveBeenCalled()
})
