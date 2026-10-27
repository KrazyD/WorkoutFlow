import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkoutFlowDatabase } from './database'
import { DexieExerciseRepository } from './dexie-exercise-repository'
import { DexieWorkoutTemplateRepository } from './dexie-workout-template-repository'
import { DexieActiveWorkoutSessionRepository } from './dexie-active-workout-session-repository'
import { resolveWorkoutTemplate } from '../domain/resolve-workout-template'
import {
  completeCurrentExercise,
  completeCurrentRest,
  createActiveWorkoutSession,
  getCurrentStep,
  getSetProgress,
  getRemainingRestSeconds,
  startWorkout,
  type OperationResult,
} from '../domain/workout-session'

const databases: WorkoutFlowDatabase[] = []
afterEach(async () => {
  for (const db of databases.splice(0)) {
    db.close()
    await db.delete()
  }
  vi.restoreAllMocks()
})
const unwrap = <T>(result: OperationResult<T>): T => {
  if (!result.success) throw new Error(result.error.code)
  return result.value
}

async function setup() {
  const db = new WorkoutFlowDatabase(`series-${crypto.randomUUID()}`)
  databases.push(db)
  const exercises = new DexieExerciseRepository(db)
  const templates = new DexieWorkoutTemplateRepository(db)
  const sessions = new DexieActiveWorkoutSessionRepository(db)
  const a = await exercises.create({ name: 'Бабочка' })
  const b = await exercises.create({ name: 'Тяга' })
  await db.restPresets.add({ id: 'r', name: 'Короткий', durationSeconds: 30 })
  const template = await templates.create({
    name: 'Суперсет',
    steps: [
      {
        id: 'block',
        type: 'superset',
        restPresetId: 'r',
        series: [
          { id: 'sa', type: 'exercise', exerciseId: a.id, setCount: 3 },
          { id: 'sb', type: 'exercise', exerciseId: b.id, setCount: 3 },
        ],
      },
    ],
  })
  const resolved = resolveWorkoutTemplate(
    (await templates.getById(template.id))!,
    await exercises.getAll(),
    await db.restPresets.toArray(),
  )!
  const session = unwrap(
    startWorkout(unwrap(createActiveWorkoutSession(resolved)), 0),
  )
  await sessions.save(session)
  return { db, exercises, sessions, templates, template, session, a }
}

describe('series persistence', () => {
  it('restores template, active set, weights and the absolute rest deadline', async () => {
    const { db, sessions, templates, template, session, a, exercises } =
      await setup()
    expect(await templates.getById(template.id)).toEqual(template)
    await sessions.updateExerciseWeight(session, a.id, 59.1)
    let stored = (await sessions.get())!
    const rest = unwrap(completeCurrentExercise(stored, 1_000))
    await sessions.update(rest)
    db.close()
    await db.open()
    stored = (await new DexieActiveWorkoutSessionRepository(db).get())!
    expect(stored).toMatchObject({ status: 'rest', restEndsAt: 31_000 })
    if (stored.status !== 'rest') throw new Error('Expected rest')
    expect(getRemainingRestSeconds(stored.restEndsAt, 11_000)).toBe(20)
    stored = unwrap(completeCurrentRest(stored, 31_000))
    stored = unwrap(completeCurrentExercise(stored, 32_000))
    stored = unwrap(completeCurrentRest(stored, 62_000))
    const step = getCurrentStep(stored)!
    expect(step).toMatchObject({ exercise: { id: a.id, lastWeightKg: 59.1 } })
    if (step.type !== 'exercise') throw new Error('Expected exercise')
    expect(getSetProgress(step)).toEqual({ number: 2, total: 3, isLast: false })
    const newTemplate = resolveWorkoutTemplate(
      template,
      await exercises.getAll(),
      await db.restPresets.toArray(),
    )!
    expect(newTemplate.steps[0]).toHaveProperty('exercise.lastWeightKg', 59.1)
    await exercises.update(a.id, { name: 'Новое название' })
    expect(
      (await exercises.getAll()).find((e) => e.id === a.id)?.lastWeightKg,
    ).toBe(59.1)
    await sessions.updateExerciseWeight(stored, a.id, null)
    expect(
      (await exercises.getAll()).find((e) => e.id === a.id)?.lastWeightKg,
    ).toBeNull()
  })

  it('rolls back catalog weight if saving the active session fails', async () => {
    const { db, sessions, session, a } = await setup()
    vi.spyOn(db.activeWorkoutSessions, 'put').mockRejectedValueOnce(
      new Error('disk full'),
    )
    await expect(
      sessions.updateExerciseWeight(session, a.id, 40),
    ).rejects.toThrow('disk full')
    expect((await db.exercises.get(a.id))?.lastWeightKg).toBeUndefined()
    expect(await sessions.get()).toEqual(session)
  })
})
