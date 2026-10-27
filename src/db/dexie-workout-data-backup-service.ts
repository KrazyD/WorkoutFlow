import type { WorkoutFlowDatabase } from './database'
import type { ExerciseRepository } from '../features/exercises/exercise-repository'
import type { RestPresetRepository } from '../features/rest-presets/rest-preset-repository'
import type { WorkoutTemplateRepository } from '../features/workout-templates/workout-template-repository'
import type { ActiveWorkoutSessionRepository } from '../features/workout-session/active-workout-session-repository'
import type { WorkoutFeedbackSettingsStore } from '../features/workout-feedback/workout-feedback-settings'
import {
  ActiveWorkoutImportError,
  CURRENT_EXPORT_VERSION,
  EXPORT_FORMAT,
  FeedbackSettingsImportError,
  validateWorkoutFlowImport,
  type WorkoutDataBackupService,
  type WorkoutFlowExportV2,
} from '../features/data-backup/workout-data-backup'

export class DexieWorkoutDataBackupService implements WorkoutDataBackupService {
  constructor(
    private readonly database: WorkoutFlowDatabase,
    private readonly exerciseRepository: ExerciseRepository,
    private readonly restPresetRepository: RestPresetRepository,
    private readonly workoutTemplateRepository: WorkoutTemplateRepository,
    private readonly activeSessionRepository: ActiveWorkoutSessionRepository,
    private readonly feedbackSettingsStore: WorkoutFeedbackSettingsStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async exportData(): Promise<WorkoutFlowExportV2> {
    const [exercises, restPresets, workoutTemplates] = await Promise.all([
      this.exerciseRepository.getAll(),
      this.restPresetRepository.getAll(),
      this.workoutTemplateRepository.getAll(),
    ])
    return {
      format: EXPORT_FORMAT,
      version: CURRENT_EXPORT_VERSION,
      exportedAt: this.now().toISOString(),
      data: {
        exercises,
        restPresets,
        workoutTemplates,
        feedbackSettings: this.feedbackSettingsStore.load(),
      },
    }
  }

  validateImport(input: unknown) {
    return validateWorkoutFlowImport(input)
  }

  async importData(input: WorkoutFlowExportV2): Promise<void> {
    const validation = validateWorkoutFlowImport(input)
    if (!validation.success) throw new Error(validation.message)
    const backup = validation.data
    if (await this.activeSessionRepository.get())
      throw new ActiveWorkoutImportError()
    const previousSettings = this.feedbackSettingsStore.load()
    let settingsChanged = false
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.workoutTemplates,
          this.database.restPresets,
          this.database.exercises,
          this.database.activeWorkoutSessions,
        ],
        async () => {
          // Lock the session table too: another tab cannot start during restore.
          if (await this.database.activeWorkoutSessions.count())
            throw new ActiveWorkoutImportError()
          await this.database.workoutTemplates.clear()
          await this.database.restPresets.clear()
          await this.database.exercises.clear()
          await this.database.exercises.bulkAdd([...backup.data.exercises])
          await this.database.restPresets.bulkAdd([...backup.data.restPresets])
          await this.database.workoutTemplates.bulkAdd([
            ...backup.data.workoutTemplates,
          ])
          try {
            settingsChanged = true
            this.feedbackSettingsStore.save(backup.data.feedbackSettings)
          } catch (error) {
            throw new FeedbackSettingsImportError(
              'Feedback settings could not be saved.',
              { cause: error },
            )
          }
        },
      )
    } catch (error) {
      if (settingsChanged) {
        try {
          this.feedbackSettingsStore.save(previousSettings)
        } catch (rollbackError) {
          console.error('Could not restore feedback settings.', rollbackError)
        }
      }
      throw error
    }
  }
}
