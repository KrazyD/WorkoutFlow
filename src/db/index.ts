import { workoutFlowDatabase } from './database'
import { DexieExerciseRepository } from './dexie-exercise-repository'

export const exerciseRepository = new DexieExerciseRepository(
  workoutFlowDatabase,
)
