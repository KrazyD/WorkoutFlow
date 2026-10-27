import { describe, expect, it } from 'vitest'
import { formatWorkingWeight, parseWorkingWeight } from './working-weight'
import {
  setSessionExerciseWeight,
  type ActiveWorkoutSession,
} from './workout-session'

describe('working weight', () => {
  it.each([
    ['59.1', 59.1],
    ['59,1', 59.1],
    ['0', 0],
    [' 40 ', 40],
    ['', null],
    ['  ', null],
  ])('parses %s', (input, value) => {
    expect(parseWorkingWeight(input as string)).toEqual({
      success: true,
      value,
    })
  })
  it.each([
    '-1',
    'NaN',
    'Infinity',
    '1e3',
    '1,2.3',
    'abc',
    '.',
    '1 2',
    '9'.repeat(400),
  ])('rejects %s', (input) => {
    expect(parseWorkingWeight(input).success).toBe(false)
  })
  it('formats Russian decimals and missing weight', () => {
    expect(formatWorkingWeight(59.1)).toBe('59,1 кг')
    expect(formatWorkingWeight(null)).toBe('Вес не указан')
    expect(formatWorkingWeight(undefined)).toBe('Вес не указан')
  })
  it('updates every occurrence in a session without changing other exercises or the source', () => {
    const session: ActiveWorkoutSession = {
      status: 'exercise',
      startedAt: 0,
      currentStepIndex: 0,
      templateSnapshot: {
        id: 'w',
        name: 'Тест',
        steps: [
          { type: 'exercise', exercise: { id: 'a', name: 'А' } },
          {
            type: 'exercise',
            exercise: { id: 'b', name: 'Б', lastWeightKg: 20 },
          },
          { type: 'exercise', exercise: { id: 'a', name: 'А' } },
        ],
      },
    }
    const updated = setSessionExerciseWeight(session, 'a', 59.1)
    expect(
      updated.templateSnapshot.steps
        .filter((s) => s.type === 'exercise')
        .map((s) => s.exercise.lastWeightKg),
    ).toEqual([59.1, 20, 59.1])
    expect(session.templateSnapshot.steps[0]).not.toHaveProperty(
      'exercise.lastWeightKg',
    )
    expect(
      setSessionExerciseWeight(updated, 'a', null).templateSnapshot.steps[2],
    ).toHaveProperty('exercise.lastWeightKg', null)
    expect(() => setSessionExerciseWeight(session, 'a', -1)).toThrow()
  })
})
