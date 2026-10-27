import { describe, expect, it } from 'vitest'
import { resolveWorkoutTemplate } from './resolve-workout-template'
import type { WorkoutTemplateRecord } from './workout-template'
import {
  completeCurrentExercise,
  completeCurrentRest,
  createActiveWorkoutSession,
  getCurrentStep,
  getNextExercise,
  getSetProgress,
  startWorkout,
  type ActiveWorkoutSession,
  type OperationResult,
} from './workout-session'

const exercises = [
  { id: 'a', name: 'Бабочка' },
  { id: 'b', name: 'Тяга' },
]
const rests = [{ id: 'r', name: 'Короткий', durationSeconds: 30 }]
const template = (
  steps: WorkoutTemplateRecord['steps'],
): WorkoutTemplateRecord => ({ id: 'w', name: 'Тест', steps })
const unwrap = <T>(result: OperationResult<T>): T => {
  if (!result.success) throw new Error(result.error.code)
  return result.value
}
const series = (id: string, exerciseId: string, setCount: number) => ({
  id,
  type: 'exercise' as const,
  exerciseId,
  setCount,
})

const superset = (a = 3, b = 3) =>
  template([
    {
      id: 'g',
      type: 'superset',
      restPresetId: 'r',
      series: [series('sa', 'a', a), series('sb', 'b', b)],
    },
  ])

function run(record: WorkoutTemplateRecord) {
  const resolved = resolveWorkoutTemplate(record, exercises, rests)!
  let session: ActiveWorkoutSession = unwrap(
    startWorkout(unwrap(createActiveWorkoutSession(resolved)), 1_000),
  )
  const visited = []
  while (session.status !== 'completed') {
    const step = getCurrentStep(session)!
    if (step.type === 'exercise')
      visited.push([step.exercise.id, step.set?.seriesId, getSetProgress(step)])
    const result =
      session.status === 'rest'
        ? completeCurrentRest(session, 32_000)
        : completeCurrentExercise(session, 2_000)
    session = JSON.parse(JSON.stringify(unwrap(result))) as ActiveWorkoutSession
  }
  return { resolved, visited }
}

describe('explicit workout series', () => {
  it('expands a single series with rest only between sets', () => {
    const { resolved, visited } = run(
      template([{ ...series('s', 'a', 3), restPresetId: 'r' }]),
    )
    expect(resolved.steps.map((step) => step.type)).toEqual([
      'exercise',
      'rest',
      'exercise',
      'rest',
      'exercise',
    ])
    expect(visited.map((item) => item[2])).toEqual([
      { number: 1, total: 3, isLast: false },
      { number: 2, total: 3, isLast: false },
      { number: 3, total: 3, isLast: true },
    ])
  })

  it('alternates two series for three rounds and restores independent counters', () => {
    const { resolved, visited } = run(superset())
    expect(resolved.steps).toHaveLength(11)
    expect(visited.map(([id]) => id)).toEqual(['a', 'b', 'a', 'b', 'a', 'b'])
    expect(visited.map((item) => item[2])).toEqual([
      { number: 1, total: 3, isLast: false },
      { number: 1, total: 3, isLast: false },
      { number: 2, total: 3, isLast: false },
      { number: 2, total: 3, isLast: false },
      { number: 3, total: 3, isLast: true },
      { number: 3, total: 3, isLast: true },
    ])
  })

  it('skips exhausted series when set counts differ', () => {
    const { visited } = run(superset(1, 3))
    expect(visited.map(([id]) => id)).toEqual(['a', 'b', 'b', 'b'])
    expect(visited[0]?.[2]).toEqual({ number: 1, total: 1, isLast: true })
  })

  it('keeps a repeated exercise in a later block independent', () => {
    const { visited } = run(
      template([...superset().steps, series('later', 'a', 2)]),
    )
    expect(visited.slice(-2)).toEqual([
      ['a', 'later', { number: 1, total: 2, isLast: false }],
      ['a', 'later', { number: 2, total: 2, isLast: true }],
    ])
  })

  it('previews the actual next exercise across rest and returns none at the end', () => {
    const resolved = resolveWorkoutTemplate(superset(), exercises, rests)!
    const session = unwrap(
      startWorkout(unwrap(createActiveWorkoutSession(resolved)), 0),
    )
    expect(getNextExercise(session)).toMatchObject({
      exercise: { id: 'b' },
      set: { number: 1, total: 3 },
    })
    expect(
      getNextExercise({ ...session, currentStepIndex: 10 }),
    ).toBeUndefined()
    const rest = unwrap(completeCurrentExercise(session, 1_000))
    expect(rest).toMatchObject({ status: 'rest', restEndsAt: 31_000 })
    expect(
      getNextExercise(JSON.parse(JSON.stringify(rest)) as ActiveWorkoutSession)
        ?.exercise.id,
    ).toBe('b')
  })

  it.each([0, -1, 1.5, 101, NaN])('rejects invalid set count %s', (count) => {
    expect(
      resolveWorkoutTemplate(
        template([series('s', 'a', count)]),
        exercises,
        rests,
      ),
    ).toBeUndefined()
  })

  it('rejects missing catalog references', () => {
    expect(resolveWorkoutTemplate(superset(), [], rests)).toBeUndefined()
    expect(resolveWorkoutTemplate(superset(), exercises, [])).toBeUndefined()
  })
})
