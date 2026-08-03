import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MemoryRouter,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useEffect } from 'react'

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

class EmptyActiveWorkoutSessionRepository
  implements ActiveWorkoutSessionRepository
{
  async get() {
    return undefined
  }

  async save() {}
  async update() {}
  async complete() {}
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
      await screen.findByRole('heading', { name: 'Отдых', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Упражнения' })).toHaveAttribute(
      'href',
      '/exercises',
    )
  })

  it('navigates between all catalog sections and marks the active link', async () => {
    renderNavigationApp()
    await screen.findByRole('heading', { name: 'Упражнения', level: 1 })

    expect(screen.getByRole('link', { name: 'Упражнения' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    fireEvent.click(screen.getByRole('link', { name: 'Отдых' }))
    expect(
      await screen.findByRole('heading', { name: 'Отдых', level: 1 }),
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

    fireEvent.click(screen.getByRole('link', { name: 'Упражнения' }))
    expect(
      await screen.findByRole('heading', { name: 'Упражнения', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Текущий URL')).toHaveTextContent('/exercises')
  })

  it('redirects the root route to exercises without a document navigation', async () => {
    renderNavigationApp(['/'])

    expect(
      await screen.findByRole('heading', { name: 'Упражнения', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Текущий URL')).toHaveTextContent('/exercises')
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

  it('keeps the application shell mounted while routes change', async () => {
    const onMount = vi.fn()
    const MountProbe = () => {
      useEffect(() => {
        onMount()
      }, [])
      return null
    }

    renderNavigationApp(['/exercises'], <MountProbe />)
    await screen.findByRole('heading', { name: 'Упражнения', level: 1 })
    fireEvent.click(screen.getByRole('link', { name: 'Отдых' }))
    await screen.findByRole('heading', { name: 'Отдых', level: 1 })
    fireEvent.click(screen.getByRole('link', { name: 'Тренировки' }))
    await screen.findByRole('heading', { name: 'Тренировки', level: 1 })

    expect(onMount).toHaveBeenCalledOnce()
  })

  it('supports backward and forward navigation through router history', async () => {
    renderNavigationApp(['/exercises'], <HistoryControls />)
    await screen.findByRole('heading', { name: 'Упражнения', level: 1 })
    fireEvent.click(screen.getByRole('link', { name: 'Отдых' }))
    await screen.findByRole('heading', { name: 'Отдых', level: 1 })
    fireEvent.click(screen.getByRole('link', { name: 'Тренировки' }))
    await screen.findByRole('heading', { name: 'Тренировки', level: 1 })

    fireEvent.click(screen.getByRole('button', { name: 'Назад в тесте' }))
    expect(
      await screen.findByRole('heading', { name: 'Отдых', level: 1 }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Вперёд в тесте' }))
    expect(
      await screen.findByRole('heading', { name: 'Тренировки', level: 1 }),
    ).toBeInTheDocument()
  })

  it('returns from an empty workout session through client navigation', async () => {
    renderNavigationApp(['/workout-session'])
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
