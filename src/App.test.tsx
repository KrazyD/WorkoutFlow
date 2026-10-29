import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'

import { App } from './App'
import type { Exercise } from './domain/workout-session'
import type {
  CreateExerciseInput,
  ExerciseRepository,
  UpdateExerciseInput,
} from './features/exercises/exercise-repository'
import type { RestPresetRepository } from './features/rest-presets/rest-preset-repository'
import type { WorkoutTemplateRepository } from './features/workout-templates/workout-template-repository'
import type { ActiveWorkoutSessionRepository } from './features/workout-session/active-workout-session-repository'
import { createId } from './shared/id/createId'

class InMemoryExerciseRepository implements ExerciseRepository {
  constructor(private exercises: Exercise[] = []) {}

  async getAll(): Promise<Exercise[]> {
    return [...this.exercises]
  }

  async create(input: CreateExerciseInput): Promise<Exercise> {
    const exercise = { id: createId(), ...input }
    this.exercises = [...this.exercises, exercise]
    return exercise
  }

  async update(id: string, input: UpdateExerciseInput): Promise<Exercise> {
    const exercise = { id, ...input }
    this.exercises = this.exercises.map((current) =>
      current.id === id ? exercise : current,
    )
    return exercise
  }

  async remove(id: string): Promise<void> {
    this.exercises = this.exercises.filter((exercise) => exercise.id !== id)
  }
}

class EmptyRestPresetRepository implements RestPresetRepository {
  async getAll() {
    return []
  }

  async create(): Promise<never> {
    throw new Error('Not implemented in this test repository.')
  }

  async update(): Promise<never> {
    throw new Error('Not implemented in this test repository.')
  }

  async remove(): Promise<void> {
    throw new Error('Not implemented in this test repository.')
  }
}

class EmptyWorkoutTemplateRepository implements WorkoutTemplateRepository {
  async getAll() {
    return []
  }

  async getById() {
    return undefined
  }

  async create(): Promise<never> {
    throw new Error('Not implemented in this test repository.')
  }

  async update(): Promise<never> {
    throw new Error('Not implemented in this test repository.')
  }

  async remove(): Promise<void> {
    throw new Error('Not implemented in this test repository.')
  }
}

class EmptyActiveWorkoutSessionRepository implements ActiveWorkoutSessionRepository {
  async get() {
    return undefined
  }

  async save() {}
  async update() {}
  async complete() {}
  async updateExerciseWeight() {}
  async updateExerciseReps() {}
  async clear() {}
}

const LocationProbe = () => {
  const location = useLocation()
  return <output aria-label="Текущий URL">{location.pathname}</output>
}

const HistoryControls = () => {
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>
        Назад в тесте
      </button>
      <button type="button" onClick={() => navigate(1)}>
        Вперёд в тесте
      </button>
    </>
  )
}

const appRepositories = {
  exerciseRepository: new InMemoryExerciseRepository(),
  restPresetRepository: new EmptyRestPresetRepository(),
  workoutTemplateRepository: new EmptyWorkoutTemplateRepository(),
  activeWorkoutSessionRepository: new EmptyActiveWorkoutSessionRepository(),
}

const renderNavigationApp = (
  initialEntries: string[] = ['/exercises'],
  extraContent?: React.ReactNode,
) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <App {...appRepositories} />
      <LocationProbe />
      {extraContent}
    </MemoryRouter>,
  )

const storedExercise: Exercise = {
  id: 'stored-exercise',
  name: 'Приседания',
  description: 'Держите спину ровно.',
}

const renderApp = (
  repository: ExerciseRepository = new InMemoryExerciseRepository(),
  route = '/exercises',
) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <App exerciseRepository={repository} />
    </MemoryRouter>,
  )

const waitForLoadedScreen = async () => {
  await screen.findByRole('heading', { name: 'Упражнений пока нет' })
}

const openCreateForm = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Добавить упражнение' }))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.pushState({}, '', '/')
})

describe('exercise catalog', () => {
  it('shows an empty state when there are no exercises', async () => {
    renderApp()

    expect(
      await screen.findByRole('heading', { name: 'Упражнений пока нет' }),
    ).toBeInTheDocument()
  })

  it('opens the create exercise form', async () => {
    renderApp()
    await waitForLoadedScreen()

    openCreateForm()

    expect(
      screen.getByRole('heading', { name: 'Новое упражнение' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Название')).toHaveFocus()
  })

  it('cancels exercise creation without submitting or changing the route', async () => {
    const repository = new InMemoryExerciseRepository()
    const create = vi.spyOn(repository, 'create')
    renderApp(repository)
    await waitForLoadedScreen()
    openCreateForm()

    const cancel = screen.getByRole('button', { name: 'Отмена' })
    expect(cancel).toHaveAttribute('type', 'button')
    fireEvent.click(cancel)

    expect(create).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', { name: 'Новое упражнение' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Упражнения' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('does not accept a blank exercise name', async () => {
    const repository = new InMemoryExerciseRepository()
    const createSpy = vi.spyOn(repository, 'create')
    renderApp(repository)
    await waitForLoadedScreen()
    openCreateForm()

    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(screen.getByText('Введите название упражнения.')).toBeInTheDocument()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('creates a valid exercise and shows it without randomUUID', async () => {
    vi.stubGlobal('crypto', {})
    const repository = new InMemoryExerciseRepository()
    const create = vi.spyOn(repository, 'create')
    renderApp(repository)
    await waitForLoadedScreen()
    openCreateForm()

    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: '  Отжимания  ' },
    })
    fireEvent.change(screen.getByLabelText('Описание'), {
      target: { value: '  Корпус держать ровно.  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(
      await screen.findByRole('heading', { name: 'Отжимания' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Корпус держать ровно.')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Новое упражнение' }),
    ).not.toBeInTheDocument()
    expect((await create.mock.results[0]?.value)?.id).not.toBe('')
  })

  it('edits an existing exercise', async () => {
    renderApp(new InMemoryExerciseRepository([storedExercise]))
    await screen.findByRole('heading', { name: 'Приседания' })

    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Приседания с паузой' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(
      await screen.findByRole('heading', { name: 'Приседания с паузой' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Приседания' }),
    ).not.toBeInTheDocument()
  })

  it('requires confirmation before deletion', async () => {
    renderApp(new InMemoryExerciseRepository([storedExercise]))
    await screen.findByRole('heading', { name: 'Приседания' })

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Удалить упражнение «Приседания»?',
    )
    expect(
      screen.getByRole('heading', { name: 'Приседания' }),
    ).toBeInTheDocument()
  })

  it('keeps the exercise when deletion is cancelled', async () => {
    renderApp(new InMemoryExerciseRepository([storedExercise]))
    await screen.findByRole('heading', { name: 'Приседания' })
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Отмена',
      }),
    )

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Приседания' }),
    ).toBeInTheDocument()
  })

  it('removes the exercise after confirmation', async () => {
    renderApp(new InMemoryExerciseRepository([storedExercise]))
    await screen.findByRole('heading', { name: 'Приседания' })
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Удалить',
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Упражнений пока нет' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Приседания' }),
    ).not.toBeInTheDocument()
  })

  it('shows a repository error without crashing', async () => {
    const repository = new InMemoryExerciseRepository()
    vi.spyOn(repository, 'create').mockRejectedValue(
      new Error('IndexedDB write failed'),
    )
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    renderApp(repository)
    await waitForLoadedScreen()
    openCreateForm()

    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Планка' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(
      await screen.findByRole('alert', {
        name: '',
      }),
    ).toHaveTextContent('Не удалось сохранить изменения. Попробуйте ещё раз.')
    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    expect(
      screen.getByRole('heading', { name: 'Новое упражнение' }),
    ).toBeInTheDocument()
  })
})

describe('catalog navigation', () => {
  it('opens the rest preset screen at /rest-presets', async () => {
    render(
      <MemoryRouter initialEntries={['/rest-presets']}>
        <App restPresetRepository={new EmptyRestPresetRepository()} />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Конструктор', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Упражнения' })).toHaveAttribute(
      'href',
      '/exercises',
    )
  })

  it('navigates between all catalog sections and marks the active link', async () => {
    renderNavigationApp()
    await screen.findByRole('heading', { name: 'Конструктор', level: 1 })

    expect(screen.getByRole('link', { name: 'Упражнения' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    fireEvent.click(screen.getByRole('link', { name: 'Отдых' }))
    expect(
      await screen.findByRole('heading', { name: 'Конструктор', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Текущий URL')).toHaveTextContent(
      '/rest-presets',
    )
    expect(screen.getByRole('link', { name: 'Отдых' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    fireEvent.click(screen.getByRole('link', { name: 'Тренировки' }))
    expect(
      await screen.findByRole('heading', { name: 'Тренировки', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Текущий URL')).toHaveTextContent('/workouts')

    fireEvent.click(screen.getByRole('link', { name: 'Конструктор' }))
    expect(
      await screen.findByRole('heading', { name: 'Конструктор', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Текущий URL')).toHaveTextContent('/exercises')
  })

  it('redirects the root route to workouts without a document navigation', async () => {
    renderNavigationApp(['/'])

    expect(
      await screen.findByRole('heading', { name: 'Тренировки', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Текущий URL')).toHaveTextContent('/workouts')
  })

  it('shows a client-side not-found screen for an unknown route', () => {
    renderNavigationApp(['/missing-page'])

    expect(
      screen.getByRole('heading', { name: 'Страница не найдена' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'К тренировкам' })).toHaveAttribute(
      'href',
      '/workouts',
    )
  })

  it('keeps the actual dock and its links mounted across rapid route changes', async () => {
    renderNavigationApp(['/workouts'])
    const dock = screen.getByRole('navigation', { name: 'Разделы' })
    const settings = within(dock).getByRole('link', { name: 'Настройки' })
    const builder = within(dock).getByRole('link', { name: 'Конструктор' })
    const workouts = within(dock).getByRole('link', { name: 'Тренировки' })

    for (const link of [builder, settings, workouts, builder]) {
      fireEvent.click(link)
      expect(screen.getByRole('navigation', { name: 'Разделы' })).toBe(dock)
      expect(screen.getAllByRole('main')).toHaveLength(1)
    }
    fireEvent.click(screen.getByRole('link', { name: 'Отдых' }))
    expect(screen.getByRole('navigation', { name: 'Разделы' })).toBe(dock)
    expect(builder).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Отдых' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByLabelText('Текущий URL')).toHaveTextContent(
      '/rest-presets',
    )
    await screen.findByRole('heading', { name: 'Вариантов отдыха пока нет' })
  })

  it('keeps an open editor and its draft on same-route navigation', async () => {
    renderNavigationApp()
    await waitForLoadedScreen()
    openCreateForm()
    const name = screen.getByLabelText('Название')
    fireEvent.change(name, { target: { value: 'Черновик' } })
    fireEvent.click(screen.getByRole('link', { name: 'Конструктор' }))
    expect(screen.getByLabelText('Название')).toBe(name)
    expect(name).toHaveValue('Черновик')
    expect(
      screen.getByRole('heading', { name: 'Новое упражнение' }),
    ).toBeInTheDocument()
  })

  it('supports backward and forward navigation through router history', async () => {
    renderNavigationApp(['/exercises'], <HistoryControls />)
    await screen.findByRole('heading', { name: 'Конструктор', level: 1 })
    fireEvent.click(screen.getByRole('link', { name: 'Отдых' }))
    await screen.findByRole('heading', { name: 'Конструктор', level: 1 })
    fireEvent.click(screen.getByRole('link', { name: 'Тренировки' }))
    await screen.findByRole('heading', { name: 'Тренировки', level: 1 })

    fireEvent.click(screen.getByRole('button', { name: 'Назад в тесте' }))
    expect(
      await screen.findByRole('heading', { name: 'Конструктор', level: 1 }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Вперёд в тесте' }))
    expect(
      await screen.findByRole('heading', { name: 'Тренировки', level: 1 }),
    ).toBeInTheDocument()
  })

  it('returns from an empty workout session through client navigation', async () => {
    renderNavigationApp(['/workout-session'])
    expect(
      screen.queryByRole('navigation', { name: 'Разделы' }),
    ).not.toBeInTheDocument()
    const returnButton = await screen.findByRole('button', {
      name: 'Вернуться к тренировкам',
    })

    fireEvent.click(returnButton)

    expect(
      await screen.findByRole('heading', { name: 'Тренировки', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Текущий URL')).toHaveTextContent('/workouts')
  })
})

it('offers three bottom destinations, contextual creation and settings feedback', async () => {
  renderNavigationApp(['/workouts'])
  const menu = screen.getByRole('navigation', { name: 'Разделы' })
  expect(within(menu).getAllByRole('link')).toHaveLength(3)
  for (const label of ['Тренировки', 'Конструктор', 'Настройки']) {
    const link = within(menu).getByRole('link', { name: label })
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  }
  expect(within(menu).getByRole('link', { name: 'Тренировки' })).toHaveClass(
    'is-active',
  )
  expect(
    screen.getByRole('button', { name: 'Создать тренировку' }),
  ).toHaveClass('add-button')
  expect(
    screen
      .getByRole('button', { name: 'Создать тренировку' })
      .querySelector('svg'),
  ).toHaveAttribute('aria-hidden', 'true')
  expect(
    screen.queryByRole('heading', { name: 'Оповещения' }),
  ).not.toBeInTheDocument()
  fireEvent.click(within(menu).getByRole('link', { name: 'Конструктор' }))
  expect(
    screen.getByRole('button', { name: 'Добавить упражнение' }),
  ).toHaveClass('add-button')
  fireEvent.click(screen.getByRole('link', { name: 'Отдых' }))
  expect(
    screen.getByRole('button', { name: 'Добавить вариант отдыха' }),
  ).toHaveClass('add-button')
  expect(screen.getByRole('link', { name: 'Конструктор' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  fireEvent.click(screen.getByRole('link', { name: 'Настройки' }))
  expect(
    await screen.findByRole('heading', { name: 'Оповещения' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Настройки' })).toHaveClass(
    'is-active',
  )
  expect(document.querySelector('.add-button')).toBeNull()
})

it('hides only the edited exercise and restores it on cancel without a false empty state', async () => {
  renderApp(new InMemoryExerciseRepository([storedExercise]))
  await screen.findByRole('heading', { name: storedExercise.name })
  fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
  const list = screen.getByRole('region', { name: 'Список упражнений' })
  expect(
    within(list).queryByRole('heading', { name: storedExercise.name }),
  ).not.toBeInTheDocument()
  expect(screen.queryByText('Упражнений пока нет')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))
  expect(
    within(list).getByRole('heading', { name: storedExercise.name }),
  ).toBeInTheDocument()
})
