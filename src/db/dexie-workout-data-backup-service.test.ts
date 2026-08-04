import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WorkoutFlowDatabase } from './database'
import { DexieWorkoutDataBackupService } from './dexie-workout-data-backup-service'
import { ActiveWorkoutImportError, EXPORT_FORMAT, CURRENT_EXPORT_VERSION, type WorkoutFlowExportV1 } from '../features/data-backup/workout-data-backup'
import type { WorkoutFeedbackSettings } from '../features/workout-feedback/workout-feedback-settings'

const databases: WorkoutFlowDatabase[] = []
const backup = (): WorkoutFlowExportV1 => ({
  format: EXPORT_FORMAT,
  version: CURRENT_EXPORT_VERSION,
  exportedAt: '2026-08-05T12:00:00.000Z',
  data: {
    exercises: [{ id: 'new-exercise', name: 'Новое' }],
    restPresets: [{ id: 'new-rest', name: 'Новый отдых', durationSeconds: 90 }],
    workoutTemplates: [{ id: 'new-workout', name: 'Новая', steps: [
      { id: 'new-step-1', type: 'exercise', exerciseId: 'new-exercise' },
      { id: 'new-step-2', type: 'rest', restPresetId: 'new-rest' },
    ] }],
    feedbackSettings: { soundEnabled: false, vibrationEnabled: true },
  },
})

const createService = (database: WorkoutFlowDatabase, options: { active?: object; settings?: WorkoutFeedbackSettings } = {}) => {
  let settings = options.settings ?? { soundEnabled: true, vibrationEnabled: false }
  const store = { load: vi.fn(() => settings), save: vi.fn((next: WorkoutFeedbackSettings) => { settings = next }) }
  const service = new DexieWorkoutDataBackupService(
    database,
    { getAll: () => database.exercises.toArray(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    { getAll: () => database.restPresets.toArray(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    { getAll: () => database.workoutTemplates.toArray(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    { get: vi.fn(async () => options.active), save: vi.fn(), update: vi.fn(), complete: vi.fn(), clear: vi.fn() } as never,
    store,
    () => new Date('2026-08-05T12:00:00.000Z'),
  )
  return { service, store, getSettings: () => settings }
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => { database.close(); await database.delete() }))
})

describe('DexieWorkoutDataBackupService', () => {
  it('exports all supported entities, settings, format and date without an active session', async () => {
    const database = new WorkoutFlowDatabase(`backup-export-${crypto.randomUUID()}`); databases.push(database)
    await database.exercises.add({ id: 'e', name: 'Упражнение' })
    await database.restPresets.add({ id: 'r', name: 'Отдых', durationSeconds: 30 })
    await database.workoutTemplates.add({ id: 'w', name: 'Тренировка', steps: [{ id: 's', type: 'exercise', exerciseId: 'e' }] })
    await database.activeWorkoutSessions.add({ id: 'active', session: {} as never })
    const { service } = createService(database)
    const result = await service.exportData()
    expect(result).toMatchObject({ format: EXPORT_FORMAT, version: 1, exportedAt: '2026-08-05T12:00:00.000Z' })
    expect(result.data).toMatchObject({ exercises: [{ id: 'e' }], restPresets: [{ id: 'r' }], workoutTemplates: [{ id: 'w' }], feedbackSettings: { soundEnabled: true, vibrationEnabled: false } })
    expect(result).not.toHaveProperty('data.activeWorkoutSessions')
  })

  it('atomically replaces entity tables, preserves references and active-session table, then saves settings', async () => {
    const database = new WorkoutFlowDatabase(`backup-import-${crypto.randomUUID()}`); databases.push(database)
    await database.exercises.add({ id: 'old', name: 'Старое' })
    await database.restPresets.add({ id: 'old-rest', name: 'Старый', durationSeconds: 30 })
    await database.workoutTemplates.add({ id: 'old-workout', name: 'Старая', steps: [{ id: 'old-step', type: 'exercise', exerciseId: 'old' }] })
    const { service, store, getSettings } = createService(database)
    await service.importData(backup())
    expect(await database.exercises.toArray()).toEqual(backup().data.exercises)
    expect(await database.restPresets.toArray()).toEqual(backup().data.restPresets)
    expect(await database.workoutTemplates.toArray()).toEqual(backup().data.workoutTemplates)
    expect(store.save).toHaveBeenCalledAfter(store.load)
    expect(getSettings()).toEqual(backup().data.feedbackSettings)
  })

  it('blocks import before any changes when an active session exists', async () => {
    const database = new WorkoutFlowDatabase(`backup-active-${crypto.randomUUID()}`); databases.push(database)
    await database.exercises.add({ id: 'old', name: 'Старое' })
    const { service, store } = createService(database, { active: {} })
    await expect(service.importData(backup())).rejects.toBeInstanceOf(ActiveWorkoutImportError)
    expect(await database.exercises.toArray()).toEqual([{ id: 'old', name: 'Старое' }])
    expect(store.save).not.toHaveBeenCalled()
  })

  it('rolls back every table and does not update settings on a transaction error', async () => {
    const database = new WorkoutFlowDatabase(`backup-rollback-${crypto.randomUUID()}`); databases.push(database)
    await database.exercises.add({ id: 'old', name: 'Старое' })
    const invalid = backup()
    const duplicateTemplates = { ...invalid, data: { ...invalid.data, workoutTemplates: [invalid.data.workoutTemplates[0]!, invalid.data.workoutTemplates[0]!] } }
    const { service, store } = createService(database)
    await expect(service.importData(duplicateTemplates)).rejects.toThrow()
    expect(await database.exercises.toArray()).toEqual([{ id: 'old', name: 'Старое' }])
    expect(await database.restPresets.toArray()).toEqual([])
    expect(await database.workoutTemplates.toArray()).toEqual([])
    expect(store.save).not.toHaveBeenCalled()
  })
})
