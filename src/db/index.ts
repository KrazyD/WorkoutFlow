import { workoutFlowDatabase } from './database'
import { DexieExerciseRepository } from './dexie-exercise-repository'
import { DexieRestPresetRepository } from './dexie-rest-preset-repository'
import { DexieWorkoutTemplateRepository } from './dexie-workout-template-repository'

export const exerciseRepository = new DexieExerciseRepository(
  workoutFlowDatabase,
)

export const restPresetRepository = new DexieRestPresetRepository(
  workoutFlowDatabase,
)

export const workoutTemplateRepository = new DexieWorkoutTemplateRepository(
  workoutFlowDatabase,
)
