export interface Exercise {
  readonly id: string
  readonly name: string
  readonly description?: string
}

export interface RestPreset {
  readonly id: string
  readonly name: string
  readonly durationSeconds: number
}

export interface ExerciseWorkoutStep {
  readonly type: 'exercise'
  readonly exercise: Exercise
}

export interface RestWorkoutStep {
  readonly type: 'rest'
  readonly restPreset: RestPreset
}

export type WorkoutStep = ExerciseWorkoutStep | RestWorkoutStep

export interface WorkoutTemplate {
  readonly id: string
  readonly name: string
  readonly steps: readonly WorkoutStep[]
}

interface SessionBase {
  readonly templateSnapshot: WorkoutTemplate
  readonly currentStepIndex: number
}

export interface NotStartedWorkoutSession extends SessionBase {
  readonly status: 'not_started'
  readonly currentStepIndex: 0
  readonly startedAt: null
}

export interface ExerciseWorkoutSession extends SessionBase {
  readonly status: 'exercise'
  readonly startedAt: number
}

export interface RestWorkoutSession extends SessionBase {
  readonly status: 'rest'
  readonly startedAt: number
  readonly restEndsAt: number
}

export interface CompletedWorkoutSession extends SessionBase {
  readonly status: 'completed'
  readonly startedAt: number
  readonly completedAt: number
}

export type ActiveWorkoutSession =
  | NotStartedWorkoutSession
  | ExerciseWorkoutSession
  | RestWorkoutSession
  | CompletedWorkoutSession

export type WorkoutSessionError =
  | { readonly code: 'EMPTY_TEMPLATE' }
  | { readonly code: 'SESSION_ALREADY_STARTED' }
  | { readonly code: 'SESSION_NOT_STARTED' }
  | { readonly code: 'SESSION_COMPLETED' }
  | { readonly code: 'NOT_EXERCISE' }
  | { readonly code: 'NOT_REST' }
  | { readonly code: 'REST_NOT_FINISHED'; readonly restEndsAt: number }

export type OperationResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: WorkoutSessionError }
