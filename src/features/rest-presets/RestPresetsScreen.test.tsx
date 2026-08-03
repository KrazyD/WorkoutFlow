import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import type { RestPreset } from '../../domain/workout-session'
import { createId } from '../../shared/id/createId'
import { RestPresetsScreen } from './RestPresetsScreen'
import type {
  CreateRestPresetInput,
  RestPresetRepository,
  UpdateRestPresetInput,
} from './rest-preset-repository'

class InMemoryRestPresetRepository implements RestPresetRepository {
  constructor(private restPresets: RestPreset[] = []) {}

  async getAll(): Promise<RestPreset[]> {
    return [...this.restPresets]
  }

  async create(input: CreateRestPresetInput): Promise<RestPreset> {
    const restPreset = { id: createId(), ...input }
    this.restPresets = [...this.restPresets, restPreset]
    return restPreset
  }

  async update(id: string, input: UpdateRestPresetInput): Promise<RestPreset> {
    const restPreset = { id, ...input }
    this.restPresets = this.restPresets.map((current) =>
      current.id === id ? restPreset : current,
    )
    return restPreset
  }

  async remove(id: string): Promise<void> {
    this.restPresets = this.restPresets.filter(
      (restPreset) => restPreset.id !== id,
    )
  }
}

const storedRestPreset: RestPreset = {
  id: 'rest-preset-standard',
  name: 'Обычный',
  durationSeconds: 90,
}

const renderScreen = (
  repository: RestPresetRepository = new InMemoryRestPresetRepository(),
) =>
  render(
    <MemoryRouter initialEntries={['/rest-presets']}>
      <RestPresetsScreen repository={repository} />
    </MemoryRouter>,
  )

const waitForEmptyState = async () => {
  await screen.findByRole('heading', { name: 'Вариантов отдыха пока нет' })
}

const openCreateForm = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Добавить вариант' }))
}

const setDuration = (minutes: string, seconds: string) => {
  fireEvent.change(screen.getByLabelText('Минуты'), {
    target: { value: minutes },
  })
  fireEvent.change(screen.getByLabelText('Секунды'), {
    target: { value: seconds },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('rest preset catalog', () => {
  it('shows an empty state when there are no rest presets', async () => {
    renderScreen()

    expect(
      await screen.findByRole('heading', {
        name: 'Вариантов отдыха пока нет',
      }),
    ).toBeInTheDocument()
  })

  it('opens the create form', async () => {
    renderScreen()
    await waitForEmptyState()

    openCreateForm()

    expect(
      screen.getByRole('heading', { name: 'Новый вариант отдыха' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Название')).toHaveFocus()
  })

  it('does not accept a blank name', async () => {
    const repository = new InMemoryRestPresetRepository()
    const createSpy = vi.spyOn(repository, 'create')
    renderScreen(repository)
    await waitForEmptyState()
    openCreateForm()

    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(
      screen.getByText('Введите название варианта отдыха.'),
    ).toBeInTheDocument()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('does not accept zero duration', async () => {
    renderScreen()
    await waitForEmptyState()
    openCreateForm()
    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Нулевой' },
    })
    setDuration('0', '0')

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(
      screen.getByText('Продолжительность не может быть нулевой.'),
    ).toBeInTheDocument()
  })

  it('does not accept a duration below five seconds', async () => {
    renderScreen()
    await waitForEmptyState()
    openCreateForm()
    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Слишком короткий' },
    })
    setDuration('0', '4')

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(
      screen.getByText('Минимальная продолжительность — 5 секунд.'),
    ).toBeInTheDocument()
  })

  it('does not accept seconds above 59', async () => {
    renderScreen()
    await waitForEmptyState()
    openCreateForm()
    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Неверный' },
    })
    setDuration('0', '60')

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(
      screen.getByText('Введите целое число от 0 до 59.'),
    ).toBeInTheDocument()
  })

  it('creates a valid rest preset and shows it without randomUUID', async () => {
    vi.stubGlobal('crypto', {})
    const repository = new InMemoryRestPresetRepository()
    const create = vi.spyOn(repository, 'create')
    renderScreen(repository)
    await waitForEmptyState()
    openCreateForm()
    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: '  Обычный  ' },
    })
    setDuration('1', '30')

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(
      await screen.findByRole('heading', { name: 'Обычный' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1 минута 30 секунд')).toBeInTheDocument()
    expect((await create.mock.results[0]?.value)?.id).not.toBe('')
  })

  it('formats 90 seconds as one minute and thirty seconds', async () => {
    renderScreen(new InMemoryRestPresetRepository([storedRestPreset]))

    await screen.findByRole('heading', { name: 'Обычный' })
    expect(screen.getByText('1 минута 30 секунд')).toBeInTheDocument()
  })

  it('edits an existing rest preset', async () => {
    renderScreen(new InMemoryRestPresetRepository([storedRestPreset]))
    await screen.findByRole('heading', { name: 'Обычный' })
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))

    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Длинный' },
    })
    setDuration('3', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(
      await screen.findByRole('heading', { name: 'Длинный' }),
    ).toBeInTheDocument()
    expect(screen.getByText('3 минуты')).toBeInTheDocument()
  })

  it('decomposes duration into minutes and seconds when editing', async () => {
    renderScreen(new InMemoryRestPresetRepository([storedRestPreset]))
    await screen.findByRole('heading', { name: 'Обычный' })

    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))

    expect(screen.getByLabelText('Минуты')).toHaveValue(1)
    expect(screen.getByLabelText('Секунды')).toHaveValue(30)
  })

  it('requires confirmation before deletion', async () => {
    renderScreen(new InMemoryRestPresetRepository([storedRestPreset]))
    await screen.findByRole('heading', { name: 'Обычный' })

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Удалить вариант отдыха «Обычный»?',
    )
    expect(screen.getByRole('heading', { name: 'Обычный' })).toBeInTheDocument()
  })

  it('keeps the rest preset when deletion is cancelled', async () => {
    renderScreen(new InMemoryRestPresetRepository([storedRestPreset]))
    await screen.findByRole('heading', { name: 'Обычный' })
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Отмена',
      }),
    )

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Обычный' })).toBeInTheDocument()
  })

  it('removes the rest preset after confirmation', async () => {
    renderScreen(new InMemoryRestPresetRepository([storedRestPreset]))
    await screen.findByRole('heading', { name: 'Обычный' })
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Удалить',
      }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Вариантов отдыха пока нет',
      }),
    ).toBeInTheDocument()
  })

  it('shows a repository error without crashing', async () => {
    const repository = new InMemoryRestPresetRepository()
    vi.spyOn(repository, 'create').mockRejectedValue(
      new Error('IndexedDB write failed'),
    )
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    renderScreen(repository)
    await waitForEmptyState()
    openCreateForm()
    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Короткий' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось сохранить изменения. Попробуйте ещё раз.',
    )
    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    expect(
      screen.getByRole('heading', { name: 'Новый вариант отдыха' }),
    ).toBeInTheDocument()
  })
})
