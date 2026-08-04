import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { DataBackupScreen } from './DataBackupScreen'
import { CURRENT_EXPORT_VERSION, EXPORT_FORMAT, MAX_IMPORT_FILE_SIZE_BYTES, type ImportValidationResult, type WorkoutDataBackupService, type WorkoutFlowExportV1 } from './workout-data-backup'

const backup: WorkoutFlowExportV1 = {
  format: EXPORT_FORMAT,
  version: CURRENT_EXPORT_VERSION,
  exportedAt: '2026-08-05T12:00:00.000Z',
  data: {
    exercises: [{ id: 'e1', name: 'Первое' }, { id: 'e2', name: 'Второе' }],
    restPresets: [{ id: 'r1', name: 'Отдых', durationSeconds: 60 }],
    workoutTemplates: [{ id: 'w1', name: 'Тренировка', steps: [{ id: 's1', type: 'exercise', exerciseId: 'e1' }] }],
    feedbackSettings: { soundEnabled: true, vibrationEnabled: false },
  },
}

const createService = (): WorkoutDataBackupService => ({
  exportData: vi.fn(async () => backup),
  validateImport: vi.fn((input: unknown): ImportValidationResult => input && typeof input === 'object' && 'format' in input
    ? { success: true, data: backup }
    : { success: false, message: 'Это не файл резервной копии Workout Flow' }),
  importData: vi.fn(async () => undefined),
})

const fileLike = (text: string, size = text.length): File => ({
  name: 'backup.json',
  size,
  text: vi.fn(async () => text),
} as unknown as File)

const renderScreen = (service = createService(), download = vi.fn()) => {
  render(<MemoryRouter><DataBackupScreen service={service} download={download} /></MemoryRouter>)
  return { service, download }
}

const choose = (file: File) => {
  const input = screen.getByLabelText('Выбрать файл резервной копии') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
  return input
}

describe('DataBackupScreen', () => {
  it('offers export and import actions and exports through the service', async () => {
    const { service, download } = renderScreen()
    expect(screen.getByRole('button', { name: 'Экспортировать данные' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Импортировать данные' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Экспортировать данные' }))
    await waitFor(() => expect(service.exportData).toHaveBeenCalledOnce())
    expect(download).toHaveBeenCalledWith(backup)
    expect(screen.getByRole('status')).toHaveTextContent('Резервная копия скачана')
  })

  it('shows a validated preview without changing data before confirmation', async () => {
    const { service } = renderScreen()
    choose(fileLike(JSON.stringify(backup)))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Упражнений').nextSibling).toHaveTextContent('2')
    expect(screen.getByText('Вариантов отдыха').nextSibling).toHaveTextContent('1')
    expect(screen.getByText('Тренировок').nextSibling).toHaveTextContent('1')
    expect(screen.getByText(/Текущие упражнения/)).toBeInTheDocument()
    expect(service.importData).not.toHaveBeenCalled()
  })

  it('cancels a preview and allows the same file to be selected again', async () => {
    const { service } = renderScreen()
    const file = fileLike(JSON.stringify(backup))
    const input = choose(file)
    await screen.findByRole('dialog')
    expect(input.value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    choose(file)
    await screen.findByRole('dialog')
    expect(service.validateImport).toHaveBeenCalledTimes(2)
  })

  it('rejects oversized and malformed files with clear messages', async () => {
    renderScreen()
    choose(fileLike('{}', MAX_IMPORT_FILE_SIZE_BYTES + 1))
    expect(screen.getByRole('alert')).toHaveTextContent('Файл слишком большой')
    choose(fileLike('{broken'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Файл не содержит корректный JSON')
  })

  it('imports after confirmation and reports success', async () => {
    const { service } = renderScreen()
    choose(fileLike(JSON.stringify(backup)))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Импортировать и заменить' }))
    await waitFor(() => expect(service.importData).toHaveBeenCalledWith(backup))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Данные успешно импортированы')
  })

  it('keeps the preview and explains an import failure', async () => {
    const service = createService()
    vi.mocked(service.importData).mockRejectedValueOnce(new Error('transaction failed'))
    renderScreen(service)
    choose(fileLike(JSON.stringify(backup)))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Импортировать и заменить' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось импортировать данные. Текущие данные сохранены')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
