export const REST_FINISHED_VIBRATION_PATTERN = [200, 100, 200] as const

export interface WorkoutVibrationService {
  isSupported(): boolean
  vibrateRestFinished(): boolean
}

class NavigatorWorkoutVibrationService implements WorkoutVibrationService {
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  }

  vibrateRestFinished(): boolean {
    if (!this.isSupported()) return false
    try {
      return navigator.vibrate([...REST_FINISHED_VIBRATION_PATTERN])
    } catch (error) {
      console.warn('Could not vibrate when rest finished.', error)
      return false
    }
  }
}

export const workoutVibrationService: WorkoutVibrationService =
  new NavigatorWorkoutVibrationService()

