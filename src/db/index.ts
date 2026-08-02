import { workoutFlowDatabase } from './database'
import { DexieExerciseRepository } from './dexie-exercise-repository'
import { DexieRestPresetRepository } from './dexie-rest-preset-repository'

export const exerciseRepository = new DexieExerciseRepository(
  workoutFlowDatabase,
)

export const restPresetRepository = new DexieRestPresetRepository(
  workoutFlowDatabase,
)
