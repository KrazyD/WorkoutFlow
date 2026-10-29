import { describe, expect, it } from 'vitest'
import { resolveWorkoutTemplate } from '../resolve-workout-template'
import {
  countTemplateWorkingSets,
  type WorkoutTemplateRecord,
} from '../workout-template'
import {
  completeCurrentExercise,
  completeCurrentRest,
  createActiveWorkoutSession,
  extendCurrentRest,
  getCurrentStep,
  getRestRemainingFraction,
  getWorkingSetProgress,
  setSessionExerciseReps,
  startWorkout,
  type ActiveWorkoutSession,
  type OperationResult,
} from './index'

const unwrap = <T>(result: OperationResult<T>) => {
  if (!result.success) throw new Error(result.error.code)
  return result.value
}
const rest = { id: 'r', name: 'Отдых', durationSeconds: 30 }
const record: WorkoutTemplateRecord = {
  id: 'w',
  name: 'Full Body A',
  steps: [
    {
      id: 's',
      type: 'exercise',
      exerciseId: 'a',
      setCount: 2,
      restPresetId: 'r',
    },
    { id: 'r', type: 'rest', restPresetId: 'r' },
    {
      id: 'g',
      type: 'superset',
      restPresetId: 'r',
      series: [
        { id: 'sa', type: 'exercise', exerciseId: 'a', setCount: 1 },
        { id: 'sb', type: 'exercise', exerciseId: 'b', setCount: 3 },
      ],
    },
  ],
}
const resolved = resolveWorkoutTemplate(
  record,
  [
    { id: 'a', name: 'Жим' },
    { id: 'b', name: 'Тяга' },
  ],
  [rest],
)!
const start = () =>
  unwrap(startWorkout(unwrap(createActiveWorkoutSession(resolved)), 0))

describe('working set progress', () => {
  it('counts series and unequal supersets, excluding every rest, across restoration', () => {
    expect(countTemplateWorkingSets(record)).toBe(6)
    let session: ActiveWorkoutSession = start()
    let completed = 0
    while (session.status !== 'completed') {
      const exercising = session.status === 'exercise'
      expect(getWorkingSetProgress(session)).toEqual({
        total: 6,
        completed,
        current: completed + Number(exercising),
      })
      if (exercising) completed++
      session = JSON.parse(
        JSON.stringify(
          unwrap(
            exercising
              ? completeCurrentExercise(session, 1000)
              : completeCurrentRest(session, 1000),
          ),
        ),
      ) as ActiveWorkoutSession
    }
    expect(getWorkingSetProgress(session)).toEqual({
      total: 6,
      completed: 6,
      current: 6,
    })
  })
  it('counts independent legacy steps and handles rest-only workouts', () => {
    const legacy = {
      ...start(),
      templateSnapshot: {
        id: 'old',
        name: 'Старая',
        steps: [
          resolved.steps[0]!,
          { type: 'rest' as const, restPreset: rest },
        ],
      },
    }
    expect(getWorkingSetProgress(legacy)).toEqual({
      total: 1,
      completed: 0,
      current: 1,
    })
    expect(
      countTemplateWorkingSets({
        ...record,
        steps: [{ id: 'r', type: 'rest', restPresetId: 'r' }],
      }),
    ).toBe(0)
  })
  it('updates every occurrence without changing the original snapshot or progress', () => {
    const original = start()
    const updated = setSessionExerciseReps(original, 'a', 12)
    for (const step of updated.templateSnapshot.steps) {
      if (step.type === 'exercise' && step.exercise.id === 'a')
        expect(step.exercise.lastReps).toBe(12)
    }
    expect(getCurrentStep(original)).not.toHaveProperty('exercise.lastReps')
    expect(getWorkingSetProgress(updated)).toEqual(
      getWorkingSetProgress(original),
    )
    expect(() => setSessionExerciseReps(original, 'a', 1.5)).toThrow()
  })
})

describe('rest ring', () => {
  it('uses the deadline, clamps the fraction and restores an extended duration', () => {
    const resting = unwrap(completeCurrentExercise(start(), 1000))
    if (resting.status !== 'rest') throw new Error('Expected rest')
    expect(getRestRemainingFraction(resting, 1000)).toBe(1)
    expect(getRestRemainingFraction(resting, 16000)).toBe(0.5)
    const extended = unwrap(extendCurrentRest(resting, 30))
    expect(getRestRemainingFraction(extended, 16000)).toBe(0.75)
    const restored = JSON.parse(JSON.stringify(extended)) as typeof extended
    expect(getRestRemainingFraction(restored, 46000)).toBe(0.25)
    expect(getRestRemainingFraction(restored, 100000)).toBe(0)
    expect(getRestRemainingFraction(restored, 0)).toBe(1)
  })
  it('supports old snapshots without a rest start and preserves their origin on extension', () => {
    const old = {
      ...start(),
      status: 'rest' as const,
      currentStepIndex: 1,
      restEndsAt: 31000,
    }
    expect(getRestRemainingFraction(old, 16000)).toBe(0.5)
    const extended = unwrap(extendCurrentRest(old, 30))
    expect(extended.restStartedAt).toBe(1000)
    expect(getRestRemainingFraction(extended, 16000)).toBe(0.75)
  })
})
