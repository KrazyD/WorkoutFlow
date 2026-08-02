export {
  completeCurrentExercise,
  completeCurrentRest,
  createActiveWorkoutSession,
  extendCurrentRest,
  getCurrentStep,
  getNextStep,
  getRemainingRestSeconds,
  isRestFinished,
  isWorkoutCompleted,
  startWorkout,
} from './workout-session'

export type {
  ActiveWorkoutSession,
  CompletedWorkoutSession,
  Exercise,
  ExerciseWorkoutSession,
  ExerciseWorkoutStep,
  NotStartedWorkoutSession,
  OperationResult,
  RestPreset,
  RestWorkoutSession,
  RestWorkoutStep,
  WorkoutSessionError,
  WorkoutStep,
  WorkoutTemplate,
} from './types'
