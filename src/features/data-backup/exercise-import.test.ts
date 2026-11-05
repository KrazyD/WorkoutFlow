import { describe, expect, it } from 'vitest'
import {
  AmbiguousExerciseImportError,
  mergeImportedExercises,
} from './exercise-import'
import type { Exercise } from '../../domain/workout-session'

const existing: Exercise = {
  id: 'old',
  name: 'Chest Press',
  lastWeightKg: 15,
  lastReps: 12,
}
const incoming: Exercise = {
  id: 'new',
  name: 'Chest Press',
  description: 'Новая программа',
  lastWeightKg: 10,
  lastReps: 10,
}

describe('import exercise working values', () => {
  it.each(['Chest Press', 'chest press', ' CHEST   Press ', 'Chest\tPress'])(
    'matches normalized name %s and preserves current values by default',
    (name) => {
      const result = mergeImportedExercises([{ ...incoming, name }], [existing])
      expect(result.matchedCount).toBe(1)
      expect(result.exercises).toEqual([
        { ...incoming, name, lastWeightKg: 15, lastReps: 12 },
      ])
      expect(incoming.lastWeightKg).toBe(10)
    },
  )
  it('overwrites only provided numeric values with explicit opt-in, including zero weight', () => {
    expect(
      mergeImportedExercises([incoming], [existing], {
        overwriteWorkingValues: true,
      }).exercises,
    ).toEqual([incoming])
    expect(
      mergeImportedExercises([{ ...incoming, lastWeightKg: 0 }], [existing], {
        overwriteWorkingValues: true,
      }).exercises[0]?.lastWeightKg,
    ).toBe(0)
  })
  it.each([
    {},
    { lastWeightKg: null, lastReps: null },
    { lastWeightKg: 5 },
    { lastReps: 8 },
  ])(
    'never clears existing values when missing or unspecified in the file: %j',
    (fields) => {
      const partial = { id: incoming.id, name: incoming.name, ...fields }
      for (const overwriteWorkingValues of [false, true]) {
        const merged = mergeImportedExercises([partial], [existing], {
          overwriteWorkingValues,
        }).exercises[0]!
        expect(merged.lastWeightKg).toBe(
          overwriteWorkingValues ? (fields.lastWeightKg ?? 15) : 15,
        )
        expect(merged.lastReps).toBe(
          overwriteWorkingValues ? (fields.lastReps ?? 12) : 12,
        )
      }
    },
  )
  it('preserves deliberately cleared existing values when overwrite is off', () => {
    expect(
      mergeImportedExercises(
        [incoming],
        [{ ...existing, lastWeightKg: null, lastReps: null }],
      ).exercises[0],
    ).toMatchObject({ lastWeightKg: null, lastReps: null })
  })
  it('imports new exercises with original IDs and values and uses no fuzzy matching', () => {
    const exercise = { ...incoming, name: 'Chest Press 2' }
    expect(mergeImportedExercises([exercise], [existing])).toEqual({
      matchedCount: 0,
      exercises: [exercise],
    })
  })
  it('rejects ambiguous normalized names in either catalog rather than choosing an arbitrary exercise', () => {
    expect(() =>
      mergeImportedExercises(
        [incoming],
        [existing, { ...existing, id: 'other', name: ' chest  PRESS' }],
      ),
    ).toThrow(AmbiguousExerciseImportError)
    expect(() =>
      mergeImportedExercises(
        [incoming, { ...incoming, id: 'another', name: ' CHEST PRESS ' }],
        [existing],
      ),
    ).toThrow(AmbiguousExerciseImportError)
  })
})
