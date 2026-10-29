import { describe, expect, it, vi } from 'vitest'

import {
  CURRENT_EXPORT_VERSION,
  EXPORT_FORMAT,
  createBackupFileName,
  downloadWorkoutFlowExport,
  serializeWorkoutFlowExport,
  validateWorkoutFlowImport,
  type WorkoutFlowExportV2,
} from './workout-data-backup'

const validBackup = (): WorkoutFlowExportV2 => ({
  format: EXPORT_FORMAT,
  version: CURRENT_EXPORT_VERSION,
  exportedAt: '2026-08-05T12:00:00.000Z',
  data: {
    exercises: [{ id: 'exercise-1', name: '  Жим ногами  ', description: '  ' }],
    restPresets: [{ id: 'rest-1', name: 'Обычный', durationSeconds: 90 }],
    workoutTemplates: [{
      id: 'workout-1',
      name: 'Ноги',
      steps: [
        { id: 'step-1', type: 'exercise', exerciseId: 'exercise-1' },
        { id: 'step-2', type: 'rest', restPresetId: 'rest-1' },
      ],
    }],
    feedbackSettings: { soundEnabled: true, vibrationEnabled: false },
  },
})

describe('workout data backup validation', () => {
  it('accepts and normalizes a valid v2 backup', () => {
    const result = validateWorkoutFlowImport(validBackup())
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.data.exercises[0]).toEqual({ id: 'exercise-1', name: 'Жим ногами' })
  })

  it.each([
    [{}, 'Это не файл резервной копии Workout Flow'],
    [{ ...validBackup(), format: 'another' }, 'Это не файл резервной копии Workout Flow'],
    [{ ...validBackup(), version: 1 }, 'Версия резервной копии не поддерживается'],
    [{ format: EXPORT_FORMAT, version: 2, exportedAt: validBackup().exportedAt }, 'В файле отсутствуют данные резервной копии'],
  ])('rejects an invalid envelope', (input, message) => {
    expect(validateWorkoutFlowImport(input)).toEqual({ success: false, message })
  })

  it.each([
    ['exercises', 'В файле повторяются ID упражнений'],
    ['restPresets', 'В файле повторяются ID вариантов отдыха'],
    ['workoutTemplates', 'В файле повторяются ID тренировок'],
  ] as const)('rejects duplicate %s identifiers', (section, message) => {
    const backup = validBackup()
    const record = backup.data[section][0]!
    const result = validateWorkoutFlowImport({
      ...backup,
      data: { ...backup.data, [section]: [record, record] },
    })
    expect(result).toEqual({ success: false, message })
  })

  it('rejects duplicate step identifiers and broken references', () => {
    const backup = validBackup()
    const template = backup.data.workoutTemplates[0]!
    expect(validateWorkoutFlowImport({
      ...backup,
      data: { ...backup.data, workoutTemplates: [{ ...template, steps: [template.steps[0], template.steps[0]] }] },
    }).success).toBe(false)

    expect(validateWorkoutFlowImport({
      ...backup,
      data: { ...backup.data, workoutTemplates: [{ ...template, steps: [{ id: 'x', type: 'exercise', exerciseId: 'missing' }] }] },
    })).toEqual({ success: false, message: 'Шаблон ссылается на отсутствующее упражнение' })

    expect(validateWorkoutFlowImport({
      ...backup,
      data: { ...backup.data, workoutTemplates: [{ ...template, steps: [{ id: 'x', type: 'rest', restPresetId: 'missing' }] }] },
    })).toEqual({ success: false, message: 'Шаблон ссылается на отсутствующий вариант отдыха' })
  })

  it('rejects invalid duration and step discriminant', () => {
    const backup = validBackup()
    expect(validateWorkoutFlowImport({ ...backup, data: { ...backup.data, restPresets: [{ ...backup.data.restPresets[0], durationSeconds: 4 }] } })).toEqual({ success: false, message: 'В файле есть некорректные варианты отдыха' })
    expect(validateWorkoutFlowImport({ ...backup, data: { ...backup.data, workoutTemplates: [{ ...backup.data.workoutTemplates[0], steps: [{ id: 'x', type: 'unknown' }] }] } })).toEqual({ success: false, message: 'В файле есть некорректные тренировки' })
  })
})

describe('workout data backup download', () => {
  it('serializes readable JSON and creates a timestamped filename', () => {
    expect(JSON.parse(serializeWorkoutFlowExport(validBackup()))).toMatchObject({ format: EXPORT_FORMAT, version: 2 })
    expect(serializeWorkoutFlowExport(validBackup())).toContain('\n  "format"')
    expect(createBackupFileName(validBackup().exportedAt)).toBe('workout-flow-backup-2026-08-05-12-00-00.json')
  })

  it('downloads a JSON blob and always releases the object URL', () => {
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
    const revokeObjectURL = vi.fn()
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob
      return 'blob:test'
    })
    downloadWorkoutFlowExport(validBackup(), { createObjectURL, revokeObjectURL, createAnchor: () => anchor })
    expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob)
    expect(anchor.download).toBe('workout-flow-backup-2026-08-05-12-00-00.json')
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(anchor.remove).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })
})

it.each([
  { id: 'g', type: 'superset', series: [{ id: 'same', type: 'exercise', exerciseId: 'exercise-1', setCount: 3 }, { id: 'same', type: 'exercise', exerciseId: 'exercise-1', setCount: 2 }] },
  { id: 'g', type: 'superset', series: [{ id: 'a', type: 'exercise', exerciseId: 'missing', setCount: 3 }, { id: 'b', type: 'exercise', exerciseId: 'exercise-1', setCount: 3 }] },
  { id: 'g', type: 'superset', restPresetId: 'missing', series: [{ id: 'a', type: 'exercise', exerciseId: 'exercise-1' }, { id: 'b', type: 'exercise', exerciseId: 'exercise-1' }] },
  { id: 'g', type: 'exercise', exerciseId: 'exercise-1', setCount: 1.5 },
  { id: 'g', type: 'superset', series: [] },
])('rejects invalid nested series or references before import: %j', (step) => {
  const backup = validBackup()
  expect(validateWorkoutFlowImport({ ...backup, data: { ...backup.data, workoutTemplates: [{ id: 'w', name: 'Тест', steps: [step] }] } }).success).toBe(false)
})

it.each([-1, NaN, Infinity, '59,1'])('rejects an invalid exported weight %s', (lastWeightKg) => {
  const backup = validBackup()
  expect(validateWorkoutFlowImport({ ...backup, data: { ...backup.data, exercises: [{ id: 'exercise-1', name: 'Тест', lastWeightKg }] } }).success).toBe(false)
})

it.each([undefined, null, 10])('round trips optional repetitions in v2: %s', (lastReps) => {
  const backup = validBackup()
  const exported = { ...backup, data: { ...backup.data, exercises: [{ id: 'exercise-1', name: 'Жим', ...(lastReps !== undefined ? { lastReps } : {}) }] } }
  const result = validateWorkoutFlowImport(JSON.parse(serializeWorkoutFlowExport(exported)))
  expect(result).toEqual({ success: true, data: exported })
})
it.each([0, -1, 1.5, '10', Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid repetitions in backups: %s', (lastReps) => {
  const backup = validBackup()
  expect(validateWorkoutFlowImport({ ...backup, data: { ...backup.data, exercises: [{ id: 'exercise-1', name: 'Жим', lastReps }] } }).success).toBe(false)
})
