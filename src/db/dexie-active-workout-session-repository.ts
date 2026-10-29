import {
  setSessionExerciseWeight,
  setSessionExerciseReps,
} from '../domain/workout-session'
import type { ActiveWorkoutSession } from '../domain/workout-session'
import type { ActiveWorkoutSessionRepository } from '../features/workout-session/active-workout-session-repository'
import type { WorkoutFlowDatabase } from './database'

const ACTIVE_SESSION_ID = 'active'

export interface StoredActiveWorkoutSession {
  readonly id: typeof ACTIVE_SESSION_ID
  readonly session: ActiveWorkoutSession
}

export class DexieActiveWorkoutSessionRepository implements ActiveWorkoutSessionRepository {
  constructor(private readonly database: WorkoutFlowDatabase) {}

  async get(): Promise<ActiveWorkoutSession | undefined> {
    return (await this.database.activeWorkoutSessions.get(ACTIVE_SESSION_ID))
      ?.session
  }

  async save(session: ActiveWorkoutSession): Promise<void> {
    await this.database.activeWorkoutSessions.put({
      id: ACTIVE_SESSION_ID,
      session,
    })
  }

  async update(session: ActiveWorkoutSession): Promise<void> {
    await this.save(session)
  }

  async complete(session: ActiveWorkoutSession): Promise<void> {
    await this.save(session)
  }

  async updateExerciseWeight(
    session: ActiveWorkoutSession,
    exerciseId: string,
    weightKg: number | null,
  ): Promise<void> {
    const updated = setSessionExerciseWeight(session, exerciseId, weightKg)
    await this.database.transaction(
      'rw',
      this.database.exercises,
      this.database.activeWorkoutSessions,
      async () => {
        // Deleted catalog exercises must not break an independent running snapshot.
        await this.database.exercises.update(exerciseId, {
          lastWeightKg: weightKg,
        })
        await this.save(updated)
      },
    )
  }

  async updateExerciseReps(
    session: ActiveWorkoutSession,
    exerciseId: string,
    reps: number | null,
  ): Promise<void> {
    const updated = setSessionExerciseReps(session, exerciseId, reps)
    await this.database.transaction(
      'rw',
      this.database.exercises,
      this.database.activeWorkoutSessions,
      async () => {
        // Deleted catalog exercises must not break an independent running snapshot.
        await this.database.exercises.update(exerciseId, {
          lastReps: reps,
        })
        await this.save(updated)
      },
    )
  }

  async clear(): Promise<void> {
    await this.database.activeWorkoutSessions.delete(ACTIVE_SESSION_ID)
  }
}
