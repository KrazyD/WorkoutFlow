import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createActiveWorkoutSession,
  startWorkout,
  type ActiveWorkoutSession,
  type OperationResult,
  type WorkoutTemplate,
} from '../../domain/workout-session'
import { WorkoutSessionScreen } from './WorkoutSessionScreen'
import type { ActiveWorkoutSessionRepository } from './active-workout-session-repository'
import type { WorkoutAudioService } from '../../shared/audio/workout-audio-service'
import type { WorkoutVibrationService } from '../../shared/vibration/workout-vibration-service'

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
  now = () => 2_000,
) => {
  render(
    <WorkoutSessionScreen
      repository={repository}
      navigate={navigate}
      now={now}
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
    expect(screen.getByText('01:30')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Пропустить отдых' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+30 секунд' })).toBeInTheDocument()
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
    fireEvent.click(await screen.findByRole('button', { name: 'Пропустить отдых' }))
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
    expect(screen.getByText('01:29')).toBeInTheDocument()
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

describe('rest countdown', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const restingRepository = (restEndsAt: number) => {
    const session = startedSession()
    return new MemoryRepository({
      ...session,
      status: 'rest',
      currentStepIndex: 1,
      restEndsAt,
    })
  }

  it('updates from the absolute end time and advances once at zero', async () => {
    vi.useFakeTimers()
    let currentTime = 1_000
    const repository = restingRepository(3_000)
    const update = vi.spyOn(repository, 'update')
    renderScreen(repository, vi.fn(), () => currentTime)

    await act(async () => undefined)
    expect(screen.getByText('00:02')).toBeInTheDocument()

    currentTime = 2_001
    await act(async () => vi.advanceTimersByTime(1_000))
    expect(screen.getByText('00:01')).toBeInTheDocument()

    currentTime = 3_000
    await act(async () => vi.advanceTimersByTime(1_000))
    expect(screen.getByText('Шаг 3 из 3')).toBeInTheDocument()
    expect(update).toHaveBeenCalledTimes(1)

    await act(async () => vi.advanceTimersByTime(5_000))
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('automatically finishes an expired restored rest', async () => {
    const repository = restingRepository(1_000)
    renderScreen(repository, vi.fn(), () => 2_000)

    expect(await screen.findByText('Шаг 3 из 3')).toBeInTheDocument()
    expect(repository.session).toMatchObject({ status: 'exercise', currentStepIndex: 2 })
  })

  it('keeps the rest visible after a failed auto transition and retries', async () => {
    const repository = restingRepository(1_000)
    const update = vi.spyOn(repository, 'update').mockRejectedValueOnce(new Error('write failed'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderScreen(repository, vi.fn(), () => 2_000)

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось завершить отдых')
    expect(screen.getByText('00:00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Шаг 3 из 3')).toBeInTheDocument()
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('extends rest repeatedly and persists each new absolute end time', async () => {
    let currentTime = 1_000
    const repository = restingRepository(61_000)
    const update = vi.spyOn(repository, 'update')
    renderScreen(repository, vi.fn(), () => currentTime)
    await screen.findByText('01:00')

    fireEvent.click(screen.getByRole('button', { name: '+30 секунд' }))
    expect(await screen.findByText('01:30')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+30 секунд' }))
    expect(await screen.findByText('02:00')).toBeInTheDocument()
    expect(update).toHaveBeenNthCalledWith(1, expect.objectContaining({ restEndsAt: 91_000 }))
    expect(update).toHaveBeenNthCalledWith(2, expect.objectContaining({ restEndsAt: 121_000 }))
    currentTime = 2_000
  })

  it('rolls back a failed extension and prevents double skip', async () => {
    const repository = restingRepository(61_000)
    const update = vi.spyOn(repository, 'update')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderScreen(repository, vi.fn(), () => 1_000)
    await screen.findByText('01:00')

    update.mockRejectedValueOnce(new Error('write failed'))
    fireEvent.click(screen.getByRole('button', { name: '+30 секунд' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось увеличить время')
    expect(screen.getByText('01:00')).toBeInTheDocument()

    const skipButton = screen.getByRole('button', { name: 'Пропустить отдых' })
    fireEvent.click(skipButton)
    fireEvent.click(skipButton)
    expect(await screen.findByText('Шаг 3 из 3')).toBeInTheDocument()
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('synchronizes on visibility change and clears its single interval on unmount', async () => {
    vi.useFakeTimers()
    let currentTime = 1_000
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const repository = restingRepository(61_000)
    const rendered = render(
      <WorkoutSessionScreen repository={repository} navigate={vi.fn()} now={() => currentTime} />,
    )
    await act(async () => undefined)
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)

    currentTime = 31_000
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(screen.getByText('00:30')).toBeInTheDocument()

    rendered.unmount()
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
  })
})

describe('rest-finished feedback', () => {
  const restingRepository = (restEndsAt: number, steps = template.steps) => {
    const customTemplate = { ...template, steps }
    const session = valueOf(startWorkout(valueOf(createActiveWorkoutSession(customTemplate)), 1_000))
    return new MemoryRepository({ ...session, status: 'rest', currentStepIndex: 1, restEndsAt })
  }

  const services = (settings = { soundEnabled: true, vibrationEnabled: true }) => {
    const audioService: WorkoutAudioService = {
      isSupported: () => true,
      prepare: vi.fn(async () => ({ success: true })),
      playRestFinishedSignal: vi.fn(async () => ({ success: true })),
    }
    const vibrationService: WorkoutVibrationService = {
      isSupported: () => true,
      vibrateRestFinished: vi.fn(() => true),
    }
    const marked = new Set<string>()
    return {
      audioService,
      vibrationService,
      feedbackSettingsStore: { load: () => settings, save: vi.fn() },
      feedbackDeduplicator: { markOnce: (key: string) => marked.has(key) ? false : Boolean(marked.add(key)) },
    }
  }

  it('plays sound and vibrates once before the existing natural transition', async () => {
    const feedback = services()
    const repository = restingRepository(1_000)
    const update = vi.spyOn(repository, 'update')
    render(<WorkoutSessionScreen repository={repository} navigate={vi.fn()} now={() => 2_000} {...feedback} />)
    expect(await screen.findByText('Шаг 3 из 3')).toBeInTheDocument()
    expect(feedback.audioService.playRestFinishedSignal).toHaveBeenCalledOnce()
    expect(feedback.vibrationService.vibrateRestFinished).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledOnce()
  })

  it('does not call disabled feedback or feedback on manual skip', async () => {
    const disabled = services({ soundEnabled: false, vibrationEnabled: false })
    render(<WorkoutSessionScreen repository={restingRepository(1_000)} navigate={vi.fn()} now={() => 2_000} {...disabled} />)
    await screen.findByText('Шаг 3 из 3')
    expect(disabled.audioService.playRestFinishedSignal).not.toHaveBeenCalled()
    expect(disabled.vibrationService.vibrateRestFinished).not.toHaveBeenCalled()

    const manual = services()
    render(<WorkoutSessionScreen repository={restingRepository(10_000)} navigate={vi.fn()} now={() => 2_000} {...manual} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Пропустить отдых' }))
    await waitFor(() => expect(manual.audioService.playRestFinishedSignal).not.toHaveBeenCalled())
    expect(manual.vibrationService.vibrateRestFinished).not.toHaveBeenCalled()
  })

  it('does not repeat feedback when saving fails and the user retries', async () => {
    const feedback = services()
    const repository = restingRepository(1_000)
    vi.spyOn(repository, 'update').mockRejectedValueOnce(new Error('write failed'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<WorkoutSessionScreen repository={repository} navigate={vi.fn()} now={() => 2_000} {...feedback} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Шаг 3 из 3')).toBeInTheDocument()
    expect(feedback.audioService.playRestFinishedSignal).toHaveBeenCalledOnce()
    expect(feedback.vibrationService.vibrateRestFinished).toHaveBeenCalledOnce()
  })

  it('silently advances a restored rest older than five seconds', async () => {
    const feedback = services()
    render(<WorkoutSessionScreen repository={restingRepository(1_000)} navigate={vi.fn()} now={() => 7_001} {...feedback} />)
    expect(await screen.findByText('Шаг 3 из 3')).toBeInTheDocument()
    expect(feedback.audioService.playRestFinishedSignal).not.toHaveBeenCalled()
    expect(feedback.vibrationService.vibrateRestFinished).not.toHaveBeenCalled()
  })
})
