import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import type { Exercise } from './domain/workout-session'
import type {
  CreateExerciseInput,
  ExerciseRepository,
  UpdateExerciseInput,
} from './features/exercises/exercise-repository'
import type { RestPresetRepository } from './features/rest-presets/rest-preset-repository'

class InMemoryExerciseRepository implements ExerciseRepository {
  private nextId = 1

  constructor(private exercises: Exercise[] = []) {}

  async getAll(): Promise<Exercise[]> {
    return [...this.exercises]
  }

  async create(input: CreateExerciseInput): Promise<Exercise> {
    const exercise = { id: String(this.nextId++), ...input }
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

const storedExercise: Exercise = {
  id: 'stored-exercise',
  name: 'Приседания',
  description: 'Держите спину ровно.',
}

const renderApp = (
  repository: ExerciseRepository = new InMemoryExerciseRepository(),
) => render(<App exerciseRepository={repository} />)

const waitForLoadedScreen = async () => {
  await screen.findByRole('heading', { name: 'Упражнений пока нет' })
}

const openCreateForm = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Добавить упражнение' }))
}

afterEach(() => {
  vi.restoreAllMocks()
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

  it('creates a valid exercise and shows it in the list', async () => {
    renderApp()
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
    window.history.pushState({}, '', '/rest-presets')

    render(<App restPresetRepository={new EmptyRestPresetRepository()} />)

    expect(
      await screen.findByRole('heading', { name: 'Отдых', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Упражнения' })).toHaveAttribute(
      'href',
      '/exercises',
    )
  })
})
