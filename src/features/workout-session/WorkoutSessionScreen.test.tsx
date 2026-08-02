import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  createActiveWorkoutSession,
  startWorkout,
  type ActiveWorkoutSession,
  type OperationResult,
  type WorkoutTemplate,
} from '../../domain/workout-session'
import { WorkoutSessionScreen } from './WorkoutSessionScreen'
import type { ActiveWorkoutSessionRepository } from './active-workout-session-repository'

const template: WorkoutTemplate = {
  id: 'legs',
  name: 'Тренировка ног',
  steps: [
    { type: 'exercise', exercise: { id: 'press', name: 'Жим ногами' } },
    {
      type: 'rest',
      restPreset: { id: 'rest', name: 'Обычный', durationSeconds: 90 },
    },
    { type: 'exercise', exercise: { id: 'pull', name: 'Тяга верхнего блока' } },
  ],
}

function valueOf<T>(result: OperationResult<T>): T {
  if (!result.success) throw new Error(result.error.code)
  return result.value
}

const startedSession = () =>
  valueOf(startWorkout(valueOf(createActiveWorkoutSession(template)), 1_000))

class MemoryRepository implements ActiveWorkoutSessionRepository {
  constructor(public session: ActiveWorkoutSession | undefined = startedSession()) {}
  async get() {
    return this.session
  }
  async save(session: ActiveWorkoutSession) {
    this.session = session
  }
  async update(session: ActiveWorkoutSession) {
    this.session = session
  }
  async complete(session: ActiveWorkoutSession) {
    this.session = session
  }
  async clear() {
    this.session = undefined
  }
}

const renderScreen = (
  repository = new MemoryRepository(),
  navigate = vi.fn(),
) => {
  render(
    <WorkoutSessionScreen
      repository={repository}
      navigate={navigate}
      now={() => 2_000}
    />,
  )
  return { repository, navigate }
}

describe('active workout session', () => {
  it('shows exercise progress and the next step', async () => {
    renderScreen()
    expect(await screen.findByText('Шаг 1 из 3')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Жим ногами' })).toBeInTheDocument()
    expect(screen.getByText('Отдых — 1 минута 30 секунд')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Выполнено' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Завершить отдых' })).not.toBeInTheDocument()
  })

  it('persists an exercise transition before showing rest', async () => {
    const { repository } = renderScreen()
    const update = vi.spyOn(repository, 'update')
    await screen.findByText('Шаг 1 из 3')
    fireEvent.click(screen.getByRole('button', { name: 'Выполнено' }))
    expect(await screen.findByText('Шаг 2 из 3')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'rest', currentStepIndex: 1 }))
    expect(screen.getByRole('heading', { name: 'Обычный' })).toBeInTheDocument()
    expect(screen.getByText('1 минута 30 секунд')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Завершить отдых' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Выполнено' })).not.toBeInTheDocument()
  })

  it('does not advance the UI when persistence fails', async () => {
    const repository = new MemoryRepository()
    vi.spyOn(repository, 'update').mockRejectedValue(new Error('write failed'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderScreen(repository)
    await screen.findByText('Шаг 1 из 3')
    fireEvent.click(screen.getByRole('button', { name: 'Выполнено' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Текущий шаг не изменён')
    expect(screen.getByText('Шаг 1 из 3')).toBeInTheDocument()
  })

  it('finishes rest manually and completes after the final exercise', async () => {
    const { repository } = renderScreen()
    const complete = vi.spyOn(repository, 'complete')
    await screen.findByText('Шаг 1 из 3')
    fireEvent.click(screen.getByRole('button', { name: 'Выполнено' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Завершить отдых' }))
    expect(await screen.findByText('Шаг 3 из 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Выполнено' }))
    expect(await screen.findByRole('heading', { name: 'Тренировка завершена' })).toBeInTheDocument()
    expect(screen.getByText('Выполнено шагов: 3')).toBeInTheDocument()
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', completedAt: 2_000 }))
  })

  it('restores the stored current index', async () => {
    const session = startedSession()
    const repository = new MemoryRepository({
      ...session,
      status: 'rest',
      currentStepIndex: 1,
      restEndsAt: 91_000,
    })
    renderScreen(repository)
    expect(await screen.findByText('Шаг 2 из 3')).toBeInTheDocument()
  })

  it('clears a completed session when returning to workouts', async () => {
    const completed: ActiveWorkoutSession = {
      status: 'completed', templateSnapshot: template, currentStepIndex: 3,
      startedAt: 1_000, completedAt: 2_000,
    }
    const repository = new MemoryRepository(completed)
    const { navigate } = renderScreen(repository)
    fireEvent.click(await screen.findByRole('button', { name: 'Вернуться к тренировкам' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/workouts'))
    expect(repository.session).toBeUndefined()
  })

  it('requires confirmation before abandoning the session', async () => {
    const { repository, navigate } = renderScreen()
    await screen.findByText('Шаг 1 из 3')
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Продолжить тренировку' }))
    expect(repository.session).toBeDefined()
    expect(navigate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Завершить тренировку' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/workouts'))
    expect(repository.session).toBeUndefined()
  })
})
