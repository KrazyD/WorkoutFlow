export interface WorkoutFeedbackSettings {
  readonly soundEnabled: boolean
  readonly vibrationEnabled: boolean
}

export interface WorkoutFeedbackSettingsStore {
  load(): WorkoutFeedbackSettings
  save(settings: WorkoutFeedbackSettings): void
}

export const DEFAULT_WORKOUT_FEEDBACK_SETTINGS: WorkoutFeedbackSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
}

export const WORKOUT_FEEDBACK_SETTINGS_KEY = 'workout-flow.feedback-settings.v1'

const isSettings = (value: unknown): value is WorkoutFeedbackSettings => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.soundEnabled === 'boolean' &&
    typeof candidate.vibrationEnabled === 'boolean'
}

export const createWorkoutFeedbackSettingsStore = (
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): WorkoutFeedbackSettingsStore => ({
  load: () => {
    try {
      const stored = storage.getItem(WORKOUT_FEEDBACK_SETTINGS_KEY)
      if (!stored) return DEFAULT_WORKOUT_FEEDBACK_SETTINGS
      const parsed: unknown = JSON.parse(stored)
      return isSettings(parsed) ? parsed : DEFAULT_WORKOUT_FEEDBACK_SETTINGS
    } catch {
      return DEFAULT_WORKOUT_FEEDBACK_SETTINGS
    }
  },
  save: (settings) => storage.setItem(WORKOUT_FEEDBACK_SETTINGS_KEY, JSON.stringify(settings)),
})

export const workoutFeedbackSettingsStore = createWorkoutFeedbackSettingsStore(localStorage)

