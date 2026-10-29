export interface ExerciseWorkoutTemplateStep {
  readonly id: string
  readonly type: 'exercise'
  readonly exerciseId: string
  /** Omitted values represent a single set without automatic rest. */
  readonly setCount?: number
  readonly restPresetId?: string
}

export interface SupersetWorkoutTemplateStep {
  readonly id: string
  readonly type: 'superset'
  readonly series: readonly ExerciseWorkoutTemplateStep[]
  readonly restPresetId?: string
}

export interface RestWorkoutTemplateStep {
  readonly id: string
  readonly type: 'rest'
  readonly restPresetId: string
}

export type WorkoutTemplateStep =
  | ExerciseWorkoutTemplateStep
  | RestWorkoutTemplateStep
  | SupersetWorkoutTemplateStep

export interface WorkoutTemplateRecord {
  readonly id: string
  readonly name: string
  readonly steps: readonly WorkoutTemplateStep[]
}

/** Count working sets directly from catalog references without needing resolution. */
export function countTemplateWorkingSets(
  template: WorkoutTemplateRecord,
): number {
  return template.steps.reduce(
    (total, step) =>
      total +
      (step.type === 'rest'
        ? 0
        : step.type === 'superset'
          ? step.series.reduce((sum, series) => sum + (series.setCount ?? 1), 0)
          : (step.setCount ?? 1)),
    0,
  )
}
