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
  completeCurrentRest,
} from './workout-session'
import {
  getSessionReorderBlocks,
  getSessionOrder,
  reorderSession,
} from './reorder-session'
import type { ActiveWorkoutSession, OperationResult } from './types'

const unwrap = <T>(result: OperationResult<T>): T => {
  if (!result.success) throw new Error(result.error.code)
  return result.value
}
const exercises = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => ({
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
const superset = (id: string, members: string[], counts = [3, 3]) => ({
  id,
  type: 'superset' as const,
  series: members.map((member, i) => single(member, counts[i])),
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
function arrange(session: ActiveWorkoutSession, ids: string[]) {
  const plan = getSessionOrder(session)
  return unwrap(
    reorderSession(session, {
      blocks: ids.map((id) => plan.blocks.find((b) => b.id === id)!),
    }),
  )
}
function members(
  session: ActiveWorkoutSession,
  id: string,
  seriesIds: string[],
) {
  return unwrap(
    reorderSession(session, {
      blocks: getSessionOrder(session).blocks.map((block) =>
        block.id === id ? { ...block, seriesIds } : block,
      ),
    }),
  )
}
const standard = () =>
  start([
    superset('current', ['a', 'b']),
    superset('legs', ['c', 'd']),
    superset('upper', ['e', 'f']),
    single('g', 2),
  ])

describe('logical session order', () => {
  it('moves a future superset to the end while the current superset continues unchanged', () => {
    const { session, template, resolved } = standard()
    const previous = structuredClone(session)
    const reordered = arrange(session, ['current', 'upper', 'sg', 'legs'])
    expect(getSessionOrder(reordered).blocks.map((b) => b.id)).toEqual([
      'current',
      'upper',
      'sg',
      'legs',
    ])
    expect(order(reordered)).toEqual([
      'a1',
      'b1',
      'a2',
      'b2',
      'a3',
      'b3',
      'e1',
      'f1',
      'e2',
      'f2',
      'e3',
      'f3',
      'g1',
      'g2',
      'c1',
      'd1',
      'c2',
      'd2',
      'c3',
      'd3',
    ])
    expect(getCurrentStep(reordered)).toBe(getCurrentStep(session))
    expect(getNextExercise(reordered)).toEqual(getNextExercise(session))
    expect(session).toEqual(previous)
    expect(resolveWorkoutTemplate(template, exercises, rest)).toEqual(resolved)
    expect(order(start(template.steps).session)).toEqual(order(session))
  })

  it('exchanges two future supersets from an unrelated standalone current block', () => {
    const { session } = start([
      single('g'),
      superset('legs', ['c', 'd']),
      superset('upper', ['e', 'f']),
    ])
    expect(order(arrange(session, ['sg', 'upper', 'legs']))).toEqual([
      'g1',
      'g2',
      'g3',
      'e1',
      'f1',
      'e2',
      'f2',
      'e3',
      'f3',
      'c1',
      'd1',
      'c2',
      'd2',
      'c3',
      'd3',
    ])
  })

  it('moves a single series before a superset and a superset after a single series', () => {
    const { session } = standard()
    const first = arrange(session, ['current', 'sg', 'legs', 'upper'])
    expect(order(first).slice(6, 8)).toEqual(['g1', 'g2'])
    const second = arrange(first, ['current', 'sg', 'upper', 'legs'])
    expect(getSessionOrder(second).blocks.map((b) => b.id)).toEqual([
      'current',
      'sg',
      'upper',
      'legs',
    ])
    expect(order(second).slice(-6)).toEqual([
      'c1',
      'd1',
      'c2',
      'd2',
      'c3',
      'd3',
    ])
  })

  it('reorders every round of an unequal future superset, preserving series metadata and working values', () => {
    const { session } = start([
      single('g', 1),
      superset('future', ['a', 'b', 'c'], [3, 1, 2]),
    ])
    const reordered = members(session, 'future', ['sc', 'sb', 'sa'])
    expect(order(reordered)).toEqual(['g1', 'c1', 'b1', 'a1', 'c2', 'a2', 'a3'])
    for (const step of reordered.templateSnapshot.steps) {
      if (step.type !== 'exercise') continue
      const original = session.templateSnapshot.steps.find(
        (s) =>
          s.type === 'exercise' &&
          s.set?.seriesId === step.set?.seriesId &&
          s.set?.number === step.set?.number,
      )
      expect(step.set).toEqual(
        original?.type === 'exercise' ? original.set : undefined,
      )
      expect(step.exercise).toEqual(
        exercises.find((e) => e.id === step.exercise.id),
      )
    }
    expect(getNextExercise(reordered)).toMatchObject({ exercise: { id: 'c' } })
    const last = reordered.templateSnapshot.steps.at(-1)!
    expect(last.type === 'exercise' && getSetProgress(last)).toEqual({
      number: 3,
      total: 3,
      isLast: true,
    })
    expect(getWorkingSetProgress(reordered)).toEqual(
      getWorkingSetProgress(session),
    )
  })

  it('keeps completed and current sets exactly intact, reordering only remaining members in the current round and later rounds', () => {
    const { session } = start([
      superset('current', ['a', 'b', 'c'], [3, 2, 3]),
      single('d'),
    ])
    const partial = { ...session, currentStepIndex: 2 } // B1 is in progress
    const reordered = members(partial, 'current', ['sc', 'sb', 'sa'])
    expect(order(reordered)).toEqual([
      'a1',
      'b1',
      'c1',
      'c2',
      'b2',
      'a2',
      'c3',
      'a3',
      'd1',
      'd2',
      'd3',
    ])
    expect(reordered.templateSnapshot.steps.slice(0, 3)).toEqual(
      partial.templateSnapshot.steps.slice(0, 3),
    )
    expect(getCurrentStep(reordered)).toBe(getCurrentStep(partial))
    expect(getSessionOrder(reordered).blocks[0].seriesIds).toEqual([
      'sc',
      'sb',
      'sa',
    ])
    const again = members(reordered, 'current', ['sb', 'sa', 'sc'])
    expect(order(again)).toEqual([
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
    expect(getWorkingSetProgress(again)).toEqual(getWorkingSetProgress(partial))
  })

  it('blocks moving a partially performed block, replacing members, duplicating or losing blocks', () => {
    const { session } = standard()
    const partial = { ...session, currentStepIndex: 4 }
    const plan = getSessionOrder(partial)
    const unsafe = { success: false, error: { code: 'UNSAFE_REORDER' } }
    expect(
      reorderSession(partial, { blocks: [...plan.blocks].reverse() }),
    ).toEqual(unsafe)
    expect(reorderSession(partial, { blocks: plan.blocks.slice(1) })).toEqual(
      unsafe,
    )
    expect(
      reorderSession(partial, {
        blocks: [plan.blocks[0], plan.blocks[0], ...plan.blocks.slice(2)],
      }),
    ).toEqual(unsafe)
    expect(
      reorderSession(partial, {
        blocks: plan.blocks.map((b) => ({ ...b, seriesIds: ['missing'] })),
      }),
    ).toEqual(unsafe)
    expect(getSessionReorderBlocks(partial)[0].pinned).toBe(true)
  })

  it('retains every internal rest and explicit boundary pause without adding a terminal rest', () => {
    const { session } = start([
      single('a', 1),
      { id: 'gap1', type: 'rest', restPresetId: 'r' },
      superset('future', ['b', 'c'], [3, 1]),
      { id: 'gap2', type: 'rest', restPresetId: 'r' },
      single('d', 2),
    ])
    const reordered = arrange(session, ['sa', 'sd', 'future'])
    const steps = reordered.templateSnapshot.steps
    expect(steps[1]).toEqual(session.templateSnapshot.steps[1])
    // Explicit separator stays between the second and third blocks, independent
    // of the different number of steps in the moved blocks.
    expect(steps[5]).toEqual({ type: 'rest', restPreset: rest[0] })
    expect(steps.filter((s) => s.type === 'rest')).toHaveLength(6)
    expect(steps.at(-1)?.type).toBe('exercise')
    expect(
      steps.filter((s) => s.type === 'rest' && s.block?.id === 'future'),
    ).toHaveLength(3)
    expect(
      steps.filter((s) => s.type === 'rest' && s.block?.id === 'sd'),
    ).toHaveLength(1)
  })

  it('preserves active internal and boundary rest deadlines, origins and completed history', () => {
    const { session } = start([
      single('a', 2),
      { id: 'gap', type: 'rest', restPresetId: 'r' },
      superset('b', ['b', 'c']),
      single('d'),
    ])
    const resting = unwrap(completeCurrentExercise(session, 200))
    const changed = arrange(resting, ['sa', 'sd', 'b'])
    expect(changed).toMatchObject({
      status: 'rest',
      restEndsAt: 30200,
      restStartedAt: 200,
      currentStepIndex: 1,
    })
    expect(changed.templateSnapshot.steps.slice(0, 2)).toEqual(
      resting.templateSnapshot.steps.slice(0, 2),
    )
    if (resting.status !== 'rest') throw new Error('Expected rest')
    const boundary: ActiveWorkoutSession = { ...resting, currentStepIndex: 3 }
    expect(getSessionReorderBlocks(boundary).every((b) => !b.pinned)).toBe(true)
    expect(arrange(boundary, ['sd', 'b'])).toMatchObject({
      restEndsAt: 30200,
      currentStepIndex: 3,
    })
  })

  it('completes all sets exactly once after multiple reorders, retaining progress, next and final markers', () => {
    let { session } = standard()
    session = arrange(session, [
      'current',
      'sg',
      'upper',
      'legs',
    ]) as typeof session
    session = members(session, 'upper', ['sf', 'se']) as typeof session
    let running: ActiveWorkoutSession = session
    const seen: string[] = []
    for (
      let index = 0;
      running.status !== 'completed' && index < 100;
      index++
    ) {
      const current = getCurrentStep(running)!
      if (current.type === 'exercise') {
        seen.push(`${current.set!.seriesId}:${current.set!.number}`)
        const next = getNextExercise(running)
        const advanced: ActiveWorkoutSession = unwrap(
          completeCurrentExercise(running, 1000 + index * 31000),
        )
        if (advanced.status === 'exercise')
          expect(getCurrentStep(advanced)).toEqual(next)
        running = advanced
      } else
        running = unwrap(completeCurrentRest(running, 1000 + index * 31000))
    }
    expect(running.status).toBe('completed')
    expect(seen).toHaveLength(20)
    expect(new Set(seen).size).toBe(20)
    expect(getWorkingSetProgress(running)).toEqual({
      completed: 20,
      current: 20,
      total: 20,
    })
    expect(getNextExercise(running)).toBeUndefined()
  })

  it('keeps legacy snapshots executable without guessing block structure', () => {
    const { session } = start([single('a'), single('b')])
    const legacy = {
      ...session,
      templateSnapshot: {
        ...session.templateSnapshot,
        steps: session.templateSnapshot.steps.map((step) => {
          const { block: _block, ...value } = step
          void _block
          return value
        }),
      },
    }
    expect(getSessionReorderBlocks(legacy)).toEqual([])
    expect(reorderSession(legacy, { blocks: [] }).success).toBe(false)
    expect(completeCurrentExercise(legacy, 200).success).toBe(true)
  })
})

it('rejects a stale plan after a previously future block has started', () => {
  const { session } = standard()
  const plan = getSessionOrder(session)
  const latest = { ...session, currentStepIndex: 11 }
  expect(reorderSession(latest, plan)).toEqual({
    success: false,
    error: { code: 'UNSAFE_REORDER' },
  })
})

it('applying an unchanged plan preserves the exact execution order of an older, partially reordered snapshot', () => {
  const { session } = start([superset('current', ['a', 'b']), single('c')])
  const steps = [...session.templateSnapshot.steps]
  // An earlier release could reorder pending members without recording their order.
  ;[steps[4], steps[6]] = [steps[6], steps[4]]
  const older = {
    ...session,
    currentStepIndex: 2,
    templateSnapshot: { ...session.templateSnapshot, steps },
  }
  expect(unwrap(reorderSession(older, getSessionOrder(older)))).toEqual(older)
})
