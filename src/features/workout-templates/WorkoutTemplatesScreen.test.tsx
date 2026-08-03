import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import type { WorkoutTemplateRecord } from '../../domain/workout-template'
import type { ActiveWorkoutSession, Exercise, RestPreset } from '../../domain/workout-session'
import type { ExerciseRepository } from '../exercises/exercise-repository'
import type { RestPresetRepository } from '../rest-presets/rest-preset-repository'
import { WorkoutTemplatesScreen } from './WorkoutTemplatesScreen'
import type {
  CreateWorkoutTemplateInput,
  UpdateWorkoutTemplateInput,
  WorkoutTemplateRepository,
} from './workout-template-repository'
import type { ActiveWorkoutSessionRepository } from '../workout-session/active-workout-session-repository'

class InMemoryWorkoutTemplateRepository implements WorkoutTemplateRepository {
  private nextId = 1
  constructor(private templates: WorkoutTemplateRecord[] = []) {}
  async getAll() {
    return [...this.templates]
  }
  async getById(id: string) {
    return this.templates.find((item) => item.id === id)
  }
  async create(input: CreateWorkoutTemplateInput) {
    const template = { id: `template-${this.nextId++}`, ...input }
    this.templates = [...this.templates, template]
    return template
  }
  async update(id: string, input: UpdateWorkoutTemplateInput) {
    const template = { id, ...input }
    this.templates = this.templates.map((item) =>
      item.id === id ? template : item,
    )
    return template
  }
  async remove(id: string) {
    this.templates = this.templates.filter((item) => item.id !== id)
  }
}

class InMemoryExerciseRepository implements ExerciseRepository {
  constructor(private readonly exercises: Exercise[] = []) {}
  async getAll() {
    return [...this.exercises]
  }
  async create(): Promise<never> {
    throw new Error('Unused')
  }
  async update(): Promise<never> {
    throw new Error('Unused')
  }
  async remove(): Promise<void> {
    throw new Error('Unused')
  }
}

class InMemoryRestPresetRepository implements RestPresetRepository {
  constructor(private readonly presets: RestPreset[] = []) {}
  async getAll() {
    return [...this.presets]
  }
  async create(): Promise<never> {
    throw new Error('Unused')
  }
  async update(): Promise<never> {
    throw new Error('Unused')
  }
  async remove(): Promise<void> {
    throw new Error('Unused')
  }
}

class InMemoryActiveSessionRepository implements ActiveWorkoutSessionRepository {
  constructor(public session?: ActiveWorkoutSession) {}
  async get() { return this.session }
  async save(session: ActiveWorkoutSession) { this.session = session }
  async update(session: ActiveWorkoutSession) { this.session = session }
  async complete(session: ActiveWorkoutSession) { this.session = session }
  async clear() { this.session = undefined }
}

const squat: Exercise = { id: 'squat', name: 'Приседания' }
const pushUp: Exercise = { id: 'push-up', name: 'Отжимания' }
const rest: RestPreset = { id: 'rest-90', name: 'Обычный', durationSeconds: 90 }
const storedTemplate: WorkoutTemplateRecord = {
  id: 'legs',
  name: 'Тренировка ног',
  steps: [
    { id: 'step-squat', type: 'exercise', exerciseId: squat.id },
    { id: 'step-rest', type: 'rest', restPresetId: rest.id },
  ],
}

const renderScreen = (
  repository: WorkoutTemplateRepository = new InMemoryWorkoutTemplateRepository(),
  exercises: Exercise[] = [squat, pushUp],
  presets: RestPreset[] = [rest],
) =>
  renderInRouter(
    <WorkoutTemplatesScreen
      repository={repository}
      exerciseRepository={new InMemoryExerciseRepository(exercises)}
      restPresetRepository={new InMemoryRestPresetRepository(presets)}
      navigate={vi.fn()}
    />,
  )

const renderInRouter = (ui: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={['/workouts']}>{ui}</MemoryRouter>,
  )

const openCreateForm = async () => {
  await screen.findByRole('heading', { name: 'Тренировок пока нет' })
  fireEvent.click(screen.getByRole('button', { name: 'Создать тренировку' }))
}

const addExercise = (name = 'Приседания') => {
  fireEvent.click(screen.getByRole('button', { name: 'Добавить упражнение' }))
  fireEvent.click(
    within(screen.getByRole('region', { name: 'Выбор упражнения' })).getByRole(
      'button',
      { name },
    ),
  )
}

const addRest = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Добавить отдых' }))
  fireEvent.click(
    within(screen.getByRole('region', { name: 'Выбор отдыха' })).getByRole(
      'button',
      { name: /Обычный/ },
    ),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('workout template list', () => {
  it('shows an empty state', async () => {
    renderScreen()
    expect(
      await screen.findByRole('heading', { name: 'Тренировок пока нет' }),
    ).toBeInTheDocument()
  })

  it('shows stored templates, step count, and summary', async () => {
    renderScreen(new InMemoryWorkoutTemplateRepository([storedTemplate]))
    expect(
      await screen.findByRole('heading', { name: 'Тренировка ног' }),
    ).toBeInTheDocument()
    expect(screen.getByText('2 шага')).toBeInTheDocument()
    expect(
      screen.getByText('Приседания → 1 минута 30 секунд'),
    ).toBeInTheDocument()
  })

  it('requires confirmation and keeps a template when cancelled', async () => {
    renderScreen(new InMemoryWorkoutTemplateRepository([storedTemplate]))
    await screen.findByRole('heading', { name: 'Тренировка ног' })
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Удалить тренировку «Тренировка ног»?',
    )
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Отмена',
      }),
    )
    expect(
      screen.getByRole('heading', { name: 'Тренировка ног' }),
    ).toBeInTheDocument()
  })

  it('removes a template after confirmation', async () => {
    renderScreen(new InMemoryWorkoutTemplateRepository([storedTemplate]))
    await screen.findByRole('heading', { name: 'Тренировка ног' })
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Удалить',
      }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Тренировок пока нет' }),
    ).toBeInTheDocument()
  })

  it('shows a repository load error', async () => {
    const repository = new InMemoryWorkoutTemplateRepository()
    vi.spyOn(repository, 'getAll').mockRejectedValue(new Error('read failed'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderScreen(repository)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось загрузить тренировки. Попробуйте ещё раз.',
    )
  })
})

describe('starting a workout', () => {
  it('shows Start only for a non-empty template and saves a resolved snapshot', async () => {
    const activeRepository = new InMemoryActiveSessionRepository()
    const navigate = vi.fn()
    renderInRouter(
      <WorkoutTemplatesScreen
        repository={new InMemoryWorkoutTemplateRepository([
          storedTemplate,
          { id: 'empty', name: 'Пустая', steps: [] },
        ])}
        exerciseRepository={new InMemoryExerciseRepository([squat])}
        restPresetRepository={new InMemoryRestPresetRepository([rest])}
        activeWorkoutSessionRepository={activeRepository}
        navigate={navigate}
      />,
    )
    await screen.findByRole('heading', { name: 'Тренировка ног' })
    const startButtons = screen.getAllByRole('button', { name: 'Начать' })
    expect(startButtons[0]).toBeEnabled()
    expect(startButtons[1]).toBeDisabled()
    fireEvent.click(startButtons[0]!)
    expect(await screen.findByText('Есть незавершённая тренировка')).toBeInTheDocument()
    expect(activeRepository.session).toMatchObject({
      status: 'exercise', currentStepIndex: 0,
      templateSnapshot: { id: 'legs', name: 'Тренировка ног' },
    })
    expect(activeRepository.session?.templateSnapshot.steps[0]).toEqual({
      type: 'exercise', exercise: { id: 'squat', name: 'Приседания' },
    })
    expect(navigate).toHaveBeenCalledWith('/workout-session')
  })

  it('reports creation errors without navigating', async () => {
    const activeRepository = new InMemoryActiveSessionRepository()
    vi.spyOn(activeRepository, 'save').mockRejectedValue(new Error('write failed'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const navigate = vi.fn()
    renderInRouter(
      <WorkoutTemplatesScreen repository={new InMemoryWorkoutTemplateRepository([storedTemplate])}
        exerciseRepository={new InMemoryExerciseRepository([squat])}
        restPresetRepository={new InMemoryRestPresetRepository([rest])}
        activeWorkoutSessionRepository={activeRepository} navigate={navigate} />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Начать' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось начать тренировку')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('restores an active session and handles start conflict explicitly', async () => {
    const active: ActiveWorkoutSession = {
      status: 'exercise', currentStepIndex: 0, startedAt: 1_000,
      templateSnapshot: { id: 'current', name: 'Текущая', steps: [{ type: 'exercise', exercise: squat }] },
    }
    const activeRepository = new InMemoryActiveSessionRepository(active)
    const navigate = vi.fn()
    renderInRouter(
      <WorkoutTemplatesScreen repository={new InMemoryWorkoutTemplateRepository([storedTemplate])}
        exerciseRepository={new InMemoryExerciseRepository([squat])}
        restPresetRepository={new InMemoryRestPresetRepository([rest])}
        activeWorkoutSessionRepository={activeRepository} navigate={navigate} />,
    )
    expect(await screen.findByText('Есть незавершённая тренировка')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Начать' }))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }))
    expect(activeRepository.session).toBe(active)
    fireEvent.click(screen.getByRole('button', { name: 'Начать' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Продолжить текущую' }))
    expect(navigate).toHaveBeenCalledWith('/workout-session')
    expect(activeRepository.session).toBe(active)
  })

  it('replaces the current session only after confirmation', async () => {
    const active: ActiveWorkoutSession = {
      status: 'exercise', currentStepIndex: 0, startedAt: 1_000,
      templateSnapshot: { id: 'current', name: 'Текущая', steps: [{ type: 'exercise', exercise: squat }] },
    }
    const activeRepository = new InMemoryActiveSessionRepository(active)
    renderInRouter(
      <WorkoutTemplatesScreen repository={new InMemoryWorkoutTemplateRepository([storedTemplate])}
        exerciseRepository={new InMemoryExerciseRepository([squat])}
        restPresetRepository={new InMemoryRestPresetRepository([rest])}
        activeWorkoutSessionRepository={activeRepository} navigate={vi.fn()} />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Начать' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Завершить и начать новую' }))
    await screen.findByText('Есть незавершённая тренировка')
    expect(activeRepository.session?.templateSnapshot.id).toBe('legs')
  })
})

describe('workout template creation', () => {
  it('opens the form and validates the name and steps', async () => {
    renderScreen()
    await openCreateForm()
    expect(
      screen.getByRole('heading', { name: 'Новая тренировка' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(screen.getByText('Введите название тренировки.')).toBeInTheDocument()
    expect(screen.getByText('Добавьте хотя бы один шаг.')).toBeInTheDocument()
  })

  it('adds and saves unique exercise and rest steps without randomUUID', async () => {
    let randomByte = 0
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint8Array) => {
        array.fill(randomByte)
        randomByte += 1
        return array
      },
    })
    const repository = new InMemoryWorkoutTemplateRepository()
    const create = vi.spyOn(repository, 'create')
    renderScreen(repository)
    await openCreateForm()
    fireEvent.change(screen.getByLabelText('Название тренировки'), {
      target: { value: '  Круговая  ' },
    })
    addExercise()
    addRest()
    const sequence = screen.getByRole('group', {
      name: 'Последовательность шагов',
    })
    expect(
      within(sequence)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Приседания'),
      expect.stringContaining('1 минута 30 секунд'),
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(
      await screen.findByRole('heading', { name: 'Круговая' }),
    ).toBeInTheDocument()
    expect(screen.getByText('2 шага')).toBeInTheDocument()
    const steps = create.mock.calls[0]?.[0].steps ?? []
    expect(steps).toHaveLength(2)
    expect(steps[0]?.id).not.toBe('')
    expect(steps[1]?.id).not.toBe(steps[0]?.id)
  })

  it('shows links when either catalog is empty', async () => {
    renderScreen(new InMemoryWorkoutTemplateRepository(), [], [])
    await openCreateForm()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить упражнение' }))
    expect(screen.getByText(/Упражнения ещё не созданы/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Перейти к упражнениям' }),
    ).toHaveAttribute('href', '/exercises')
    fireEvent.click(screen.getByRole('button', { name: 'Добавить отдых' }))
    expect(
      screen.getByText(/Варианты отдыха ещё не созданы/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Перейти к отдыху' }),
    ).toHaveAttribute('href', '/rest-presets')
  })

  it('keeps the form open and reports a save error', async () => {
    const repository = new InMemoryWorkoutTemplateRepository()
    vi.spyOn(repository, 'create').mockRejectedValue(new Error('write failed'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderScreen(repository)
    await openCreateForm()
    fireEvent.change(screen.getByLabelText('Название тренировки'), {
      target: { value: 'Круговая' },
    })
    addExercise()
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось сохранить тренировку. Попробуйте ещё раз.',
    )
    expect(
      screen.getByRole('heading', { name: 'Новая тренировка' }),
    ).toBeInTheDocument()
  })
})

describe('workout template editing', () => {
  it('opens stored values, changes the name, removes and moves steps', async () => {
    const repository = new InMemoryWorkoutTemplateRepository([storedTemplate])
    renderScreen(repository)
    await screen.findByRole('heading', { name: 'Тренировка ног' })
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
    expect(
      await screen.findByDisplayValue('Тренировка ног'),
    ).toBeInTheDocument()
    const sequence = screen.getByRole('group', {
      name: 'Последовательность шагов',
    })
    const items = within(sequence).getAllByRole('listitem')
    fireEvent.click(within(items[1]!).getByRole('button', { name: 'Выше' }))
    expect(within(sequence).getAllByRole('listitem')[0]).toHaveTextContent(
      '1 минута 30 секунд',
    )
    fireEvent.click(
      within(within(sequence).getAllByRole('listitem')[1]!).getByRole(
        'button',
        { name: 'Удалить шаг' },
      ),
    )
    fireEvent.change(screen.getByLabelText('Название тренировки'), {
      target: { value: 'Ноги 2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(
      await screen.findByRole('heading', { name: 'Ноги 2' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1 шаг')).toBeInTheDocument()
  })

  it('moves a step down immediately', async () => {
    renderScreen(new InMemoryWorkoutTemplateRepository([storedTemplate]))
    await screen.findByRole('heading', { name: 'Тренировка ног' })
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
    const sequence = await screen.findByRole('group', {
      name: 'Последовательность шагов',
    })
    fireEvent.click(
      within(within(sequence).getAllByRole('listitem')[0]!).getByRole(
        'button',
        { name: 'Ниже' },
      ),
    )
    expect(within(sequence).getAllByRole('listitem')[0]).toHaveTextContent(
      '1 минута 30 секунд',
    )
  })

  it('discards editing changes on cancel', async () => {
    renderScreen(new InMemoryWorkoutTemplateRepository([storedTemplate]))
    await screen.findByRole('heading', { name: 'Тренировка ног' })
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
    await screen.findByDisplayValue('Тренировка ног')
    fireEvent.change(screen.getByLabelText('Название тренировки'), {
      target: { value: 'Несохранённое' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(
      screen.getByRole('heading', { name: 'Тренировка ног' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Несохранённое')).not.toBeInTheDocument()
  })

  it('renders and allows removing steps whose references are missing', async () => {
    renderScreen(
      new InMemoryWorkoutTemplateRepository([storedTemplate]),
      [],
      [],
    )
    await screen.findByRole('heading', { name: 'Тренировка ног' })
    expect(
      screen.getByText('Удалённое упражнение → Удалённый вариант отдыха'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
    const sequence = await screen.findByRole('group', {
      name: 'Последовательность шагов',
    })
    expect(
      within(sequence).getByText('Удалённое упражнение'),
    ).toBeInTheDocument()
    fireEvent.click(
      within(within(sequence).getAllByRole('listitem')[0]!).getByRole(
        'button',
        { name: 'Удалить шаг' },
      ),
    )
    expect(
      within(sequence).queryByText('Удалённое упражнение'),
    ).not.toBeInTheDocument()
  })
})
