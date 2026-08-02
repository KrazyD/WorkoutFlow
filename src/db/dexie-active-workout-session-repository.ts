import type { ActiveWorkoutSession } from '../domain/workout-session'
import type { ActiveWorkoutSessionRepository } from '../features/workout-session/active-workout-session-repository'
import type { WorkoutFlowDatabase } from './database'

const ACTIVE_SESSION_ID = 'active'

export interface StoredActiveWorkoutSession {
  readonly id: typeof ACTIVE_SESSION_ID
  readonly session: ActiveWorkoutSession
}

export class DexieActiveWorkoutSessionRepository
  implements ActiveWorkoutSessionRepository
{
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

  async clear(): Promise<void> {
    await this.database.activeWorkoutSessions.delete(ACTIVE_SESSION_ID)
  }
}
