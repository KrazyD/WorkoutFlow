import { describe, expect, it } from 'vitest'
import { resolveWorkoutTemplate } from '../resolve-workout-template'
import type { WorkoutTemplateRecord } from '../workout-template'
import {
  createActiveWorkoutSession,
  startWorkout,
  getCurrentStep,
  getNextExercise,
  getSetProgress,
  getWorkingSetProgress,
  completeCurrentExercise,
} from './workout-session'
import {
  getSessionReorderOptions,
  swapSessionExercises,
} from './reorder-session'
import type { ActiveWorkoutSession, OperationResult } from './types'

const unwrap = <T>(result: OperationResult<T>): T => {
  if (!result.success) throw new Error(result.error.code)
  return result.value
}
const exercises = ['a', 'b', 'c', 'd'].map((id, i) => ({
  id,
  name: id,
  lastWeightKg: i * 10,
  lastReps: 10 + i,
}))
const rest = [{ id: 'r', name: 'Отдых', durationSeconds: 30 }]
const single = (id: string, count = 3) => ({
  id: `s${id}`,
  type: 'exercise' as const,
  exerciseId: id,
  setCount: count,
  restPresetId: 'r',
})
function start(steps: WorkoutTemplateRecord['steps']) {
  const template = { id: 't', name: 'Тренировка', steps }
  const resolved = resolveWorkoutTemplate(template, exercises, rest)!
  return {
    template,
    resolved,
    session: unwrap(
      startWorkout(unwrap(createActiveWorkoutSession(resolved)), 100),
    ),
  }
}
const order = (session: ActiveWorkoutSession) =>
  session.templateSnapshot.steps
    .filter((s) => s.type === 'exercise')
    .map((s) => `${s.exercise.id}${s.set?.number}`)

describe('session exercise swapping', () => {
  it('exchanges entire unequal standalone series, keeping intermediate blocks and their rests', () => {
    const { template, resolved, session } = start([
      single('a', 2),
      single('b', 1),
      single('c', 3),
      single('d', 1),
    ])
    const previous = structuredClone(session)
    const swapped = unwrap(swapSessionExercises(session, 'sc'))
    expect(order(swapped)).toEqual(['c1', 'c2', 'c3', 'b1', 'a1', 'a2', 'd1'])
    expect(session).toEqual(previous)
    expect(getWorkingSetProgress(swapped)).toEqual(
      getWorkingSetProgress(session),
    )
    expect(
      swapped.templateSnapshot.steps.filter((s) => s.type === 'rest'),
    ).toHaveLength(3)
    for (const step of swapped.templateSnapshot.steps)
      if (step.type === 'exercise')
        expect(step.exercise).toEqual(
          exercises.find((e) => e.id === step.exercise.id),
        )
    expect(getCurrentStep(swapped)).toMatchObject({
      exercise: { id: 'c' },
      set: { number: 1, total: 3 },
    })
    expect(getNextExercise(swapped)).toMatchObject({
      exercise: { id: 'c' },
      set: { number: 2 },
    })
    expect(resolveWorkoutTemplate(template, exercises, rest)).toEqual(resolved)
    expect(order(start(template.steps).session)).toEqual(order(session))
  })

  it('only swaps the pending suffix, retaining performed sets and set numbers after partial progress', () => {
    const { session } = start([single('a'), single('b', 1), single('c', 2)])
    const partial = { ...session, currentStepIndex: 2 }
    const swapped = unwrap(swapSessionExercises(partial, 'sc'))
    expect(swapped.templateSnapshot.steps.slice(0, 2)).toEqual(
      partial.templateSnapshot.steps.slice(0, 2),
    )
    expect(order(swapped)).toEqual(['a1', 'c1', 'c2', 'b1', 'a2', 'a3'])
    expect(
      getSessionReorderOptions(swapped).find((o) => o.seriesId === 'sa')
        ?.remainingSets,
    ).toBe(2)
    expect(getWorkingSetProgress(swapped)).toEqual({
      completed: 1,
      current: 2,
      total: 6,
    })
    const again = unwrap(swapSessionExercises(swapped, 'sa'))
    expect(getCurrentStep(again)).toMatchObject({
      set: { number: 2, total: 3 },
    })
    expect(getNextExercise(again)).toMatchObject({
      set: { number: 3, total: 3 },
    })
  })

  it('swaps all pending sets within an unequal superset, leaving rest slots and completed history intact', () => {
    const { session } = start([
      {
        id: 'super',
        type: 'superset',
        restPresetId: 'r',
        series: [single('a', 3), single('b', 2), single('c', 3)],
      },
      single('d'),
    ])
    const partial = { ...session, currentStepIndex: 6 } // A2 after the first full round
    const swapped = unwrap(swapSessionExercises(partial, 'sb'))
    expect(order(swapped)).toEqual([
      'a1',
      'b1',
      'c1',
      'b2',
      'a2',
      'c2',
      'a3',
      'c3',
      'd1',
      'd2',
      'd3',
    ])
    expect(swapped.templateSnapshot.steps.slice(0, 6)).toEqual(
      partial.templateSnapshot.steps.slice(0, 6),
    )
    const originalRests = partial.templateSnapshot.steps
      .map((step, i) => (step.type === 'rest' ? i : -1))
      .filter((i) => i !== -1)
    expect(
      swapped.templateSnapshot.steps
        .map((step, i) => (step.type === 'rest' ? i : -1))
        .filter((i) => i !== -1),
    ).toEqual(originalRests)
    expect(getCurrentStep(swapped)).toMatchObject({
      exercise: { id: 'b' },
      set: { number: 2, total: 2 },
    })
    const step = getCurrentStep(swapped)!
    if (step.type !== 'exercise') throw new Error('Expected exercise')
    expect(getSetProgress(step).isLast).toBe(true)
    expect(getNextExercise(swapped)).toMatchObject({
      exercise: { id: 'a' },
      set: { number: 2 },
    })
    const serialized = JSON.parse(
      JSON.stringify(swapped),
    ) as ActiveWorkoutSession
    expect(serialized).toEqual(swapped)
    expect(unwrap(completeCurrentExercise(serialized, 200))).toMatchObject({
      status: 'rest',
      restEndsAt: 30200,
    })
  })

  it('excludes cross-superset moves, completed series, and next-round series from a partial round', () => {
    const { session } = start([
      {
        id: 'super',
        type: 'superset',
        series: [single('a'), single('b'), single('c')],
      },
      single('d'),
    ])
    const partial = { ...session, currentStepIndex: 1 }
    expect(getSessionReorderOptions(partial).map((o) => o.seriesId)).toEqual([
      'sc',
    ])
    for (const target of ['sa', 'sd', 'sb', 'missing'])
      expect(swapSessionExercises(partial, target)).toEqual({
        success: false,
        error: { code: 'UNSAFE_REORDER' },
      })
    const standalone = { ...session, currentStepIndex: 9 }
    expect(getSessionReorderOptions(standalone)).toEqual([])
    expect(
      getSessionReorderOptions({
        ...session,
        status: 'completed',
        currentStepIndex: 12,
        completedAt: 300,
      }),
    ).toEqual([])
  })

  it('supports repeated swaps without reverting other members of a partially completed superset', () => {
    const { session } = start([
      {
        id: 'super',
        type: 'superset',
        series: [single('a'), single('b'), single('c')],
      },
    ])
    const partial = { ...session, currentStepIndex: 3 }
    const first = unwrap(swapSessionExercises(partial, 'sc'))
    const second = unwrap(swapSessionExercises(first, 'sb'))
    expect(order(second)).toEqual([
      'a1',
      'b1',
      'c1',
      'b2',
      'c2',
      'a2',
      'b3',
      'c3',
      'a3',
    ])
    if (second.status !== 'exercise') throw new Error('Expected exercise')
    const midRound = { ...second, currentStepIndex: 4 }
    const third = unwrap(swapSessionExercises(midRound, 'sa'))
    expect(order(third)).toEqual([
      'a1',
      'b1',
      'c1',
      'b2',
      'a2',
      'c2',
      'b3',
      'a3',
      'c3',
    ])
  })

  it('keeps legacy snapshots runnable without guessing superset boundaries', () => {
    const { session } = start([single('a'), single('b')])
    const legacy = {
      ...session,
      templateSnapshot: {
        ...session.templateSnapshot,
        steps: session.templateSnapshot.steps.map((step) =>
          step.type === 'exercise'
            ? { type: step.type, exercise: step.exercise, set: step.set }
            : { type: step.type, restPreset: step.restPreset },
        ),
      },
    }
    expect(getSessionReorderOptions(legacy)).toEqual([])
    expect(completeCurrentExercise(legacy, 200).success).toBe(true)
  })
})
