import { afterEach, describe, expect, it, vi } from 'vitest'

import type { WorkoutTemplateRecord } from '../domain/workout-template'
import type { Exercise, RestPreset } from '../domain/workout-session'
import { DexieExerciseRepository } from './dexie-exercise-repository'
import { DexieRestPresetRepository } from './dexie-rest-preset-repository'
import { DexieWorkoutTemplateRepository } from './dexie-workout-template-repository'
import type { WorkoutFlowDatabase } from './database'

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'crypto',
)

const installCryptoWithoutRandomUuid = () => {
  let value = 0
  const getRandomValues = vi.fn((array: ArrayBufferView) => {
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(value)
    value += 1
    return array
  }) as Crypto['getRandomValues']

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { getRandomValues },
  })
}

const databaseWithTables = () => {
  const exercises: Exercise[] = []
  const restPresets: RestPreset[] = []
  const workoutTemplates: WorkoutTemplateRecord[] = []
  const database = {
    exercises: {
      add: vi.fn(async (record: Exercise) => {
        exercises.push(record)
        return record.id
      }),
    },
    restPresets: {
      add: vi.fn(async (record: RestPreset) => {
        restPresets.push(record)
        return record.id
      }),
    },
    workoutTemplates: {
      add: vi.fn(async (record: WorkoutTemplateRecord) => {
        workoutTemplates.push(record)
        return record.id
      }),
    },
  } as unknown as WorkoutFlowDatabase

  return { database, exercises, restPresets, workoutTemplates }
}

afterEach(() => {
  vi.restoreAllMocks()

  if (originalCryptoDescriptor) {
    Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'crypto')
  }
})

describe('repositories without crypto.randomUUID', () => {
  it('creates and persists exercises with non-empty unique IDs', async () => {
    installCryptoWithoutRandomUuid()
    const { database, exercises } = databaseWithTables()
    const repository = new DexieExerciseRepository(database)

    const first = await repository.create({ name: 'Приседания' })
    const second = await repository.create({ name: 'Отжимания' })

    expect(first.id).not.toBe('')
    expect(second.id).not.toBe(first.id)
    expect(exercises).toEqual([first, second])
  })

  it('creates and persists rest presets with non-empty unique IDs', async () => {
    installCryptoWithoutRandomUuid()
    const { database, restPresets } = databaseWithTables()
    const repository = new DexieRestPresetRepository(database)

    const first = await repository.create({
      name: 'Короткий',
      durationSeconds: 30,
    })
    const second = await repository.create({
      name: 'Обычный',
      durationSeconds: 90,
    })

    expect(first.id).not.toBe('')
    expect(second.id).not.toBe(first.id)
    expect(restPresets).toEqual([first, second])
  })

  it('creates and persists workout templates with a generated ID', async () => {
    installCryptoWithoutRandomUuid()
    const { database, workoutTemplates } = databaseWithTables()
    const repository = new DexieWorkoutTemplateRepository(database)

    const template = await repository.create({ name: 'Круговая', steps: [] })

    expect(template.id).not.toBe('')
    expect(workoutTemplates).toEqual([template])
  })
})
