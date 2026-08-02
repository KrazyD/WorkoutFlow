export interface ExerciseWorkoutTemplateStep {
  readonly id: string
  readonly type: 'exercise'
  readonly exerciseId: string
}

export interface RestWorkoutTemplateStep {
  readonly id: string
  readonly type: 'rest'
  readonly restPresetId: string
}

export type WorkoutTemplateStep =
  ExerciseWorkoutTemplateStep | RestWorkoutTemplateStep

export interface WorkoutTemplateRecord {
  readonly id: string
  readonly name: string
  readonly steps: readonly WorkoutTemplateStep[]
}
