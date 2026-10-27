import 'fake-indexeddb/auto'
import { afterEach, expect, it, vi } from 'vitest'
import { workoutFlowDatabase } from './database'
import { pwaWorkoutGuard } from './pwa-workout-guard'
import { DexieActiveWorkoutSessionRepository } from './dexie-active-workout-session-repository'
import type { ActiveWorkoutSession } from '../domain/workout-session'

const repository = new DexieActiveWorkoutSessionRepository(workoutFlowDatabase)
const session: ActiveWorkoutSession = {
  status: 'exercise',
  startedAt: 1000,
  currentStepIndex: 0,
  templateSnapshot: {
    id: 'template',
    name: 'Тест',
    steps: [{ type: 'exercise', exercise: { id: 'exercise', name: 'Тест' } }],
  },
}

afterEach(async () => {
  await workoutFlowDatabase.delete()
})

it('observes persisted workout lifecycle while preserving catalog data and schema', async () => {
  await workoutFlowDatabase.exercises.put({ id: 'saved', name: 'Сохранено' })
  const listener = vi.fn()
  const unsubscribe = pwaWorkoutGuard.subscribe(listener)
  try {
    await vi.waitFor(() => expect(listener).toHaveBeenLastCalledWith(false))
    await repository.save(session)
    await vi.waitFor(() => expect(listener).toHaveBeenLastCalledWith(true))
    expect(await pwaWorkoutGuard.isBlocked()).toBe(true)
    await repository.complete({
      ...session,
      status: 'completed',
      completedAt: 2000,
    })
    await vi.waitFor(() => expect(listener).toHaveBeenLastCalledWith(false))
    expect(await pwaWorkoutGuard.isBlocked()).toBe(false)
    await repository.save({ ...session, status: 'rest', restEndsAt: 90000 })
    await vi.waitFor(() => expect(listener).toHaveBeenLastCalledWith(true))
    await repository.clear()
    await vi.waitFor(() => expect(listener).toHaveBeenLastCalledWith(false))
    expect(await workoutFlowDatabase.exercises.get('saved')).toEqual({
      id: 'saved',
      name: 'Сохранено',
    })
    expect(workoutFlowDatabase.verno).toBe(4)
  } finally {
    unsubscribe()
  }
})
