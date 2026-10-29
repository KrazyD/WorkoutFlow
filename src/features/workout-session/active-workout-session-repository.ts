import type { ActiveWorkoutSession } from '../../domain/workout-session'

export interface ActiveWorkoutSessionRepository {
  get(): Promise<ActiveWorkoutSession | undefined>
  save(session: ActiveWorkoutSession): Promise<void>
  update(session: ActiveWorkoutSession): Promise<void>
  complete(session: ActiveWorkoutSession): Promise<void>
  updateExerciseWeight(
    session: ActiveWorkoutSession,
    exerciseId: string,
    weightKg: number | null,
  ): Promise<void>
  updateExerciseReps(
    session: ActiveWorkoutSession,
    exerciseId: string,
    reps: number | null,
  ): Promise<void>
  clear(): Promise<void>
}
