import { workoutFlowDatabase } from './database'
import { DexieExerciseRepository } from './dexie-exercise-repository'
import { DexieRestPresetRepository } from './dexie-rest-preset-repository'
import { DexieWorkoutTemplateRepository } from './dexie-workout-template-repository'
import { DexieActiveWorkoutSessionRepository } from './dexie-active-workout-session-repository'
import { workoutFeedbackSettingsStore } from '../features/workout-feedback/workout-feedback-settings'
import { DexieWorkoutDataBackupService } from './dexie-workout-data-backup-service'

export const exerciseRepository = new DexieExerciseRepository(
  workoutFlowDatabase,
)

export const restPresetRepository = new DexieRestPresetRepository(
  workoutFlowDatabase,
)

export const workoutTemplateRepository = new DexieWorkoutTemplateRepository(
  workoutFlowDatabase,
)

export const activeWorkoutSessionRepository =
  new DexieActiveWorkoutSessionRepository(workoutFlowDatabase)

export const workoutDataBackupService = new DexieWorkoutDataBackupService(
  workoutFlowDatabase,
  exerciseRepository,
  restPresetRepository,
  workoutTemplateRepository,
  activeWorkoutSessionRepository,
  workoutFeedbackSettingsStore,
)
